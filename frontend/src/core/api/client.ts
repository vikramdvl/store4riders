import axios from "axios";
import { useAuthStore } from "@/stores/useAuthStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add an interceptor for tokens from Zustand store
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    // Zustand persist stores data in localStorage, but we can access it directly via getState()
    const { token } = useAuthStore.getState();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Mutex / Queue state for concurrent 401 token refreshes (prevents Thundering Herd race condition)
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const handleSessionExpired = () => {
  useAuthStore.getState().logout();

  // ROUTE-AWARE REDIRECT:
  // NEVER kick a browsing customer out of public storefront pages (Home, Category, PDP, Cart) to /login.
  // Demote to guest silently so browsing continues smoothly.
  // ONLY redirect if actively on private account or admin management routes.
  if (typeof window !== "undefined") {
    const pathname = window.location.pathname;
    const isProtectedRoute =
      pathname.startsWith("/account") ||
      pathname.startsWith("/admin");

    if (isProtectedRoute) {
      window.location.href = `/login?expired=true&redirect=${encodeURIComponent(pathname)}`;
    }
  }
};

/**
 * Deduplicated access token refresh helper shared by the 401 interceptor and
 * proactive tab-visibility session renewal.
 */
export async function refreshAccessToken(): Promise<string | null> {
  const { isAuthenticated, refreshToken } = useAuthStore.getState();
  if (!isAuthenticated) {
    return null;
  }

  if (isRefreshing) {
    return new Promise<string | null>((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;

  try {
    // Send both HttpOnly cookie and body token for cross-origin fallback support
    const refreshResponse = await axios.post(
      `${API_URL}/auth/refresh`,
      { refreshToken: refreshToken || undefined },
      { withCredentials: true }
    );

    const newAccessToken = refreshResponse.data?.data?.accessToken;
    const newRefreshToken = refreshResponse.data?.data?.refreshToken;

    if (newAccessToken) {
      useAuthStore.getState().setToken(newAccessToken, newRefreshToken);
      processQueue(null, newAccessToken);
      return newAccessToken;
    }

    throw new Error("No access token returned from refresh endpoint");
  } catch (refreshError: any) {
    processQueue(refreshError, null);

    // Only log out on explicit auth rejection (401/403). Never log out on 429, 5xx, or network errors.
    const status = refreshError?.response?.status;
    if (status === 401 || status === 403) {
      handleSessionExpired();
    }
    throw refreshError;
  } finally {
    isRefreshing = false;
  }
}

export const isTokenExpiringSoon = (jwtToken: string | null, lastTokenRefreshAt: number | null): boolean => {
  if (jwtToken) {
    try {
      const parts = jwtToken.split(".");
      if (parts.length === 3) {
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(atob(base64));
        if (typeof payload?.exp === "number") {
          // Refresh if expired or within 3 minutes of expiry
          return payload.exp * 1000 - Date.now() < 3 * 60 * 1000;
        }
      }
    } catch {
      // Fall through to timestamp check if JWT decoding fails
    }
  }

  // For tabs hydrated from localStorage (where in-memory token is null), refresh if > 10 mins since last refresh
  if (!lastTokenRefreshAt) return true;
  return Date.now() - lastTokenRefreshAt > 10 * 60 * 1000;
};

let lifecycleInitialized = false;

/**
 * Keeps authenticated sessions fresh across tab switches and background throttling.
 */
export function initSessionLifecycle(): void {
  if (typeof window === "undefined" || lifecycleInitialized) return;
  lifecycleInitialized = true;

  const checkAndRefreshSession = () => {
    const { isAuthenticated, token, lastTokenRefreshAt } = useAuthStore.getState();
    if (!isAuthenticated) return;
    if (isTokenExpiringSoon(token, lastTokenRefreshAt)) {
      refreshAccessToken().catch(() => {
        // Handled inside refreshAccessToken (silent on network/5xx errors)
      });
    }
  };

  // Reconcile expired idle sessions or near-expiry tokens on initial mount
  checkAndRefreshSession();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkAndRefreshSession();
    }
  });

  window.addEventListener("focus", checkAndRefreshSession);
}

// Auto-refresh token interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Never attempt token refresh on login/register/refresh/logout endpoints or if request config missing
    if (!originalRequest) return Promise.reject(error);

    const isAuthRoute =
      originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/register") ||
      originalRequest?.url?.includes("/auth/refresh") ||
      originalRequest?.url?.includes("/auth/logout");

    // Only attempt refresh on 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      const { isAuthenticated } = useAuthStore.getState();

      // If user was never authenticated, reject immediately without touching refresh or redirect
      if (!isAuthenticated) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshAccessToken();
        if (newAccessToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
