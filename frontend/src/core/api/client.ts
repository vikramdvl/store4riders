import axios from "axios";
import { useAuthStore, requestCrossTabSessionSync } from "@/stores/useAuthStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export const isAdminPortalContext = (): boolean => {
  if (typeof window === "undefined") return false;
  const { pathname, hostname } = window.location;
  return pathname.startsWith("/admin") || hostname.startsWith("admin.");
};

export const getAdminLoginPath = (): string => {
  const secretPath = process.env.NEXT_PUBLIC_ADMIN_SECRET_PATH || "rider-staff-gate";
  if (typeof window !== "undefined" && window.location.hostname.startsWith("admin.")) {
    return `/${secretPath}?expired=true`;
  }
  return `/admin/${secretPath}?expired=true`;
};

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add an interceptor for tokens from Zustand store
apiClient.interceptors.request.use(async (config) => {
  if (typeof window !== "undefined") {
    const portalScope = isAdminPortalContext() ? "admin" : "customer";
    if (!config.headers["x-auth-scope"]) {
      config.headers["x-auth-scope"] = portalScope;
    }

    let { isAuthenticated, token, user } = useAuthStore.getState();
    if (isAuthenticated && !token) {
      await requestCrossTabSessionSync();
      const updated = useAuthStore.getState();
      token = updated.token;
      user = updated.user;
    }
    const storedScope = user?.role && user.role !== "customer" ? "admin" : "customer";
    if (token && (!user || storedScope === portalScope)) {
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
  const prevUser = useAuthStore.getState().user;
  const wasAdminUser = Boolean(prevUser?.role && prevUser.role !== "customer");
  const portalScope = isAdminPortalContext() ? "admin" : "customer";
  useAuthStore.getState().logout(portalScope);

  // ROUTE-AWARE REDIRECT:
  // NEVER kick a browsing customer out of public storefront pages (Home, Category, PDP, Cart) to /login.
  // NEVER redirect Admin Portal sessions to the customer /login page.
  if (typeof window !== "undefined") {
    const pathname = window.location.pathname;
    if (isAdminPortalContext()) {
      window.location.href = wasAdminUser ? getAdminLoginPath() : "/";
      return;
    }

    if (pathname.startsWith("/account")) {
      window.location.href = `/login?expired=true&redirect=${encodeURIComponent(pathname)}`;
    }
  }
};

/**
 * Deduplicated access token refresh helper shared by the 401 interceptor and
 * proactive tab-visibility session renewal.
 */
export async function refreshAccessToken(explicitScope?: "admin" | "customer"): Promise<string | null> {
  const portalScope = explicitScope || (isAdminPortalContext() ? "admin" : "customer");
  const initialState = useAuthStore.getState();
  if (!initialState.isAuthenticated) {
    return null;
  }

  // Hydrate in-memory tokens from an open sibling tab before hitting /auth/refresh
  if (!initialState.token && !initialState.refreshToken) {
    await requestCrossTabSessionSync();
    const synced = useAuthStore.getState();
    const syncedScope = synced.user?.role && synced.user.role !== "customer" ? "admin" : "customer";
    if (synced.token && (!synced.user || syncedScope === portalScope) && !isTokenExpiringSoon(synced.token, synced.lastTokenRefreshAt)) {
      return synced.token;
    }
  }

  const { isAuthenticated, refreshToken, user } = useAuthStore.getState();
  if (!isAuthenticated) {
    return null;
  }

  const storedScope = user?.role && user.role !== "customer" ? "admin" : "customer";
  const bodyRefreshToken = !user || storedScope === portalScope ? refreshToken : undefined;

  if (isRefreshing) {
    return new Promise<string | null>((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;

  try {
    // Send both HttpOnly cookie and scope header/body fallback for cross-origin support
    const refreshResponse = await axios.post(
      `${API_URL}/auth/refresh`,
      { refreshToken: bodyRefreshToken || undefined },
      {
        withCredentials: true,
        headers: { "x-auth-scope": portalScope },
      }
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
      const pathname = typeof window !== "undefined" ? window.location.pathname : "";
      const isPublicRoute = !isAdminPortalContext() && !pathname.startsWith("/account");
      const errorMsg = String(refreshError?.response?.data?.error || "");
      // If a newly opened public tab lacked an in-memory refreshToken and cookies weren't sent cross-origin,
      // don't broadcast a global LOGOUT that would kick an active Admin/Account tab out of its session.
      const missingTokenOnPublicTab = isPublicRoute && !bodyRefreshToken && errorMsg === "No refresh token";
      if (!missingTokenOnPublicTab) {
        handleSessionExpired();
      }
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

  const checkAndRefreshSession = async () => {
    const initial = useAuthStore.getState();
    if (!initial.isAuthenticated) return;
    if (!initial.token) {
      await requestCrossTabSessionSync();
    }
    const { isAuthenticated, token, lastTokenRefreshAt } = useAuthStore.getState();
    if (!isAuthenticated) return;
    if (isTokenExpiringSoon(token, lastTokenRefreshAt)) {
      refreshAccessToken().catch(() => {
        // Handled inside refreshAccessToken (silent on network/5xx errors)
      });
    }
  };

  // Reconcile expired idle sessions or near-expiry tokens on initial mount
  void checkAndRefreshSession();

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
      originalRequest?.url?.includes("/auth/send-register-otp") ||
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
