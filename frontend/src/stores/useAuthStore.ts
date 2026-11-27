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

type AuthPortalScope = "admin" | "customer";

const getPortalScopeFromLocation = (): AuthPortalScope => {
  if (typeof window === "undefined") return "customer";
  const { pathname, hostname } = window.location;
  return pathname.startsWith("/admin") || hostname.startsWith("admin.") ? "admin" : "customer";
};

const getUserScope = (user?: User | null): AuthPortalScope =>
  user?.role && user.role !== "customer" ? "admin" : "customer";

type AuthBroadcastMessage =
  | { type: "AUTH_SYNC"; scope: AuthPortalScope; user: User; token: string; refreshToken: string | null; lastTokenRefreshAt: number }
  | { type: "TOKEN_REFRESHED"; scope: AuthPortalScope; token: string; refreshToken: string | null; lastTokenRefreshAt: number }
  | { type: "SESSION_REQUEST"; scope: AuthPortalScope }
  | { type: "LOGOUT"; scope: AuthPortalScope };

let pendingSyncPromise: Promise<boolean> | null = null;
const sessionSyncWaiters = new Set<(synced: boolean) => void>();

const resolveSessionSyncWaiters = (synced: boolean) => {
  if (sessionSyncWaiters.size === 0) return;
  for (const resolve of sessionSyncWaiters) {
    resolve(synced);
  }
  sessionSyncWaiters.clear();
};

/**
 * Requests active in-memory session tokens from sibling tabs via BroadcastChannel.
 * Keeps JWTs strictly in memory without writing tokens to localStorage/sessionStorage.
 */
export const requestCrossTabSessionSync = (timeoutMs = 200): Promise<boolean> => {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  const state = useAuthStore.getState();
  if (!state.isAuthenticated) {
    return Promise.resolve(false);
  }
  if (state.token) {
    return Promise.resolve(true);
  }

  const channel = getAuthChannel();
  if (!channel) {
    return Promise.resolve(false);
  }

  if (pendingSyncPromise) {
    return pendingSyncPromise;
  }

  pendingSyncPromise = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      sessionSyncWaiters.delete(onDone);
      pendingSyncPromise = null;
      resolve(Boolean(useAuthStore.getState().token));
    }, timeoutMs);

    const onDone = (synced: boolean) => {
      clearTimeout(timer);
      pendingSyncPromise = null;
      resolve(synced);
    };

    sessionSyncWaiters.add(onDone);
    postAuthBroadcast({ type: "SESSION_REQUEST", scope: getPortalScopeFromLocation() });
  });

  return pendingSyncPromise;
};

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
          scope: getUserScope(user),
          user,
          token,
          refreshToken: nextRefreshToken,
          lastTokenRefreshAt: now,
        });
      },
      setToken: (token, refreshToken) => {
        const now = Date.now();
        const nextRefreshToken = refreshToken ?? get().refreshToken;
        const activeUser = get().user;
        const scope = activeUser ? getUserScope(activeUser) : getPortalScopeFromLocation();
        set({
          token,
          ...(refreshToken ? { refreshToken } : {}),
          lastTokenRefreshAt: now,
        });
        postAuthBroadcast({
          type: "TOKEN_REFRESHED",
          scope,
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
        const prevUser = get().user;
        const logoutScope = prevUser ? getUserScope(prevUser) : getPortalScopeFromLocation();
        useCartStore.getState().switchUserCart(null);
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          lastTokenRefreshAt: null,
        });
        postAuthBroadcast({ type: "LOGOUT", scope: logoutScope });
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
      const tabScope = getPortalScopeFromLocation();
      const msgScope: AuthPortalScope = msg.scope || "customer";

      if (msg.type === "TOKEN_REFRESHED") {
        if (msgScope !== tabScope) return;
        useAuthStore.setState({
          token: msg.token,
          refreshToken: msg.refreshToken,
          lastTokenRefreshAt: msg.lastTokenRefreshAt,
        });
        resolveSessionSyncWaiters(Boolean(msg.token));
      } else if (msg.type === "AUTH_SYNC") {
        if (msgScope !== tabScope) return;
        const isCustomer = !msg.user.role || msg.user.role === "customer";
        useCartStore.getState().switchUserCart(isCustomer ? (msg.user.id || msg.user.email) : null);
        useAuthStore.setState({
          user: msg.user,
          token: msg.token,
          refreshToken: msg.refreshToken,
          isAuthenticated: true,
          lastTokenRefreshAt: msg.lastTokenRefreshAt,
        });
        resolveSessionSyncWaiters(Boolean(msg.token));
      } else if (msg.type === "SESSION_REQUEST") {
        const current = useAuthStore.getState();
        if (current.isAuthenticated && current.user && current.token && getUserScope(current.user) === msgScope) {
          postAuthBroadcast({
            type: "AUTH_SYNC",
            scope: msgScope,
            user: current.user,
            token: current.token,
            refreshToken: current.refreshToken,
            lastTokenRefreshAt: current.lastTokenRefreshAt || Date.now(),
          });
        }
      } else if (msg.type === "LOGOUT") {
        if (msgScope !== tabScope) return;
        resolveSessionSyncWaiters(false);
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
    const tabScope = getPortalScopeFromLocation();
    const prevUserId = useAuthStore.getState().user?.id || useAuthStore.getState().user?.email;
    try {
      const parsed = event.newValue ? JSON.parse(event.newValue) : null;
      const nextUser = parsed?.state?.user as User | null | undefined;
      const nextScope: AuthPortalScope = nextUser ? getUserScope(nextUser) : tabScope;
      // Ignore customer storefront storage updates in an open admin portal tab (and vice versa)
      if (nextUser && nextScope !== tabScope) return;
      useAuthStore.persist.rehydrate();
      const nextIsAuth = Boolean(parsed?.state?.isAuthenticated);
      const nextUserId = nextUser?.id || nextUser?.email;
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
