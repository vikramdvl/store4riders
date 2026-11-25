import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useCartStore } from "./useCartStore";
import { IUserAddress } from "@store4riders/shared-types";

interface User {
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  role?: string;
  addresses?: IUserAddress[];
  [key: string]: any;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoggingOut: boolean;
  lastTokenRefreshAt: number | null;
  setAuth: (user: User, token: string, refreshToken?: string) => void;
  setToken: (token: string, refreshToken?: string) => void;
  setUser: (user: User | null) => void;
  setLoggingOut: (value: boolean) => void;
  logout: () => void;
}

const AUTH_CHANNEL_NAME = "store4riders-auth";

type AuthBroadcastMessage =
  | { type: "AUTH_SYNC"; user: User; token: string; refreshToken: string | null; lastTokenRefreshAt: number }
  | { type: "TOKEN_REFRESHED"; token: string; refreshToken: string | null; lastTokenRefreshAt: number }
  | { type: "LOGOUT" };

let authChannel: BroadcastChannel | null = null;
const getAuthChannel = (): BroadcastChannel | null => {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!authChannel) {
    authChannel = new BroadcastChannel(AUTH_CHANNEL_NAME);
  }
  return authChannel;
};

const postAuthBroadcast = (message: AuthBroadcastMessage) => {
  try {
    getAuthChannel()?.postMessage(message);
  } catch {
    // Ignore broadcast errors in restricted browser contexts
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoggingOut: false,
      lastTokenRefreshAt: null,
      setAuth: (user, token, refreshToken) => {
        const isCustomer = !user.role || user.role === "customer";
        if (isCustomer) {
          const userId = user.id || user.email;
          useCartStore.getState().switchUserCart(userId);
        } else {
          useCartStore.getState().switchUserCart(null);
        }
        const now = Date.now();
        const nextRefreshToken = refreshToken || null;
        set({
          user,
          token,
          refreshToken: nextRefreshToken,
          isAuthenticated: true,
          isLoggingOut: false,
          lastTokenRefreshAt: now,
        });
        postAuthBroadcast({
          type: "AUTH_SYNC",
          user,
          token,
          refreshToken: nextRefreshToken,
          lastTokenRefreshAt: now,
        });
      },
      setToken: (token, refreshToken) => {
        const now = Date.now();
        const nextRefreshToken = refreshToken ?? get().refreshToken;
        set({
          token,
          ...(refreshToken ? { refreshToken } : {}),
          lastTokenRefreshAt: now,
        });
        postAuthBroadcast({
          type: "TOKEN_REFRESHED",
          token,
          refreshToken: nextRefreshToken,
          lastTokenRefreshAt: now,
        });
      },
      setUser: (user) => {
        if (user && (!user.role || user.role === "customer")) {
          useCartStore.getState().switchUserCart(user.id || user.email);
        } else {
          useCartStore.getState().switchUserCart(null);
        }
        set({ user, isAuthenticated: !!user });
      },
      setLoggingOut: (value) => {
        set({ isLoggingOut: value });
      },
      logout: () => {
        useCartStore.getState().switchUserCart(null);
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          lastTokenRefreshAt: null,
        });
        postAuthBroadcast({ type: "LOGOUT" });
      },
    }),
    {
      name: "auth-storage", // stores auth state in localStorage
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated,
        lastTokenRefreshAt: state.lastTokenRefreshAt,
        // SECURITY: NEVER persist `token` or `refreshToken` to localStorage to prevent XSS!
        // The browser uses secure HttpOnly cookies for ongoing authentication.
      }),
    }
  )
);

// Keep multi-tab auth state and in-memory tokens synchronized across browser tabs
if (typeof window !== "undefined") {
  const channel = getAuthChannel();
  if (channel) {
    channel.onmessage = (event: MessageEvent<AuthBroadcastMessage>) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === "TOKEN_REFRESHED") {
        useAuthStore.setState({
          token: msg.token,
          refreshToken: msg.refreshToken,
          lastTokenRefreshAt: msg.lastTokenRefreshAt,
        });
      } else if (msg.type === "AUTH_SYNC") {
        const isCustomer = !msg.user.role || msg.user.role === "customer";
        useCartStore.getState().switchUserCart(isCustomer ? (msg.user.id || msg.user.email) : null);
        useAuthStore.setState({
          user: msg.user,
          token: msg.token,
          refreshToken: msg.refreshToken,
          isAuthenticated: true,
          lastTokenRefreshAt: msg.lastTokenRefreshAt,
        });
      } else if (msg.type === "LOGOUT") {
        if (useAuthStore.getState().isAuthenticated) {
          useCartStore.getState().switchUserCart(null);
          useAuthStore.setState({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            lastTokenRefreshAt: null,
          });
        }
      }
    };
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== "auth-storage") return;
    const prevUserId = useAuthStore.getState().user?.id || useAuthStore.getState().user?.email;
    useAuthStore.persist.rehydrate();
    try {
      const parsed = event.newValue ? JSON.parse(event.newValue) : null;
      const nextIsAuth = Boolean(parsed?.state?.isAuthenticated);
      const nextUserId = parsed?.state?.user?.id || parsed?.state?.user?.email;
      if (!nextIsAuth) {
        useCartStore.getState().switchUserCart(null);
        useAuthStore.setState({ token: null, refreshToken: null, isAuthenticated: false, user: null, lastTokenRefreshAt: null });
      } else if (prevUserId && nextUserId && prevUserId !== nextUserId) {
        useAuthStore.setState({ token: null, refreshToken: null });
      }
    } catch {
      // Ignore malformed storage payload
    }
  });
}
