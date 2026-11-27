"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useAuthStore, requestCrossTabSessionSync } from "@/stores/useAuthStore";
import { getAdminLoginPath } from "@/core/api/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, setAuth, setUser, setToken, logout } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let active = true;

    const verifyAdminSession = async () => {
      const initialState = useAuthStore.getState();
      const storedIsAdmin = Boolean(initialState.isAuthenticated && initialState.user?.role && initialState.user.role !== "customer");

      if (initialState.isAuthenticated && !initialState.token) {
        await requestCrossTabSessionSync();
      }

      const currentState = useAuthStore.getState();
      const currentToken = storedIsAdmin ? currentState.token : null;
      const headers: Record<string, string> = { "x-auth-scope": "admin" };
      if (currentToken) {
        headers.Authorization = `Bearer ${currentToken}`;
      }

      const validateMe = async (accessToken?: string | null) => {
        const reqHeaders: Record<string, string> = { "x-auth-scope": "admin" };
        if (accessToken) {
          reqHeaders.Authorization = `Bearer ${accessToken}`;
        }
        const meRes = await axios.get(`${API_URL}/auth/me?scope=admin`, {
          withCredentials: true,
          headers: reqHeaders,
        });
        return meRes.data?.data;
      };

      try {
        const meData = await validateMe(currentToken);
        if (!active) return;

        if (meData?.user?.role && meData.user.role !== "customer") {
          setUser(meData.user);
          setVerified(true);
          return;
        }
        throw new Error("Admin role required");
      } catch (err: any) {
        if (!active) return;
        const status = err?.response?.status;

        // If access token expired or wasn't hydrated after reload, renew cleanly via adminRefreshToken cookie
        if (status === 401 || !currentToken) {
          try {
            const bodyRefresh = storedIsAdmin ? currentState.refreshToken || undefined : undefined;
            const refreshRes = await axios.post(
              `${API_URL}/auth/refresh`,
              { refreshToken: bodyRefresh },
              { withCredentials: true, headers: { "x-auth-scope": "admin" } }
            );
            const newAccess = refreshRes.data?.data?.accessToken;
            const newRefresh = refreshRes.data?.data?.refreshToken;
            if (newAccess) {
              setToken(newAccess, newRefresh);
              const meData = await validateMe(newAccess);
              if (!active) return;
              if (meData?.user?.role && meData.user.role !== "customer") {
                setAuth(meData.user, newAccess, newRefresh);
                setVerified(true);
                return;
              }
            }
          } catch (refreshErr: any) {
            if (!active) return;
            const refreshStatus = refreshErr?.response?.status;
            // On transient 5xx/network outage while already holding a persisted admin session, keep active rather than kicking out
            if (storedIsAdmin && refreshStatus !== 401 && refreshStatus !== 403) {
              setVerified(true);
              return;
            }
          }
        } else if (storedIsAdmin && status !== 401 && status !== 403) {
          // Transient backend or network failure: preserve existing authenticated admin state
          setVerified(true);
          return;
        }

        if (!active) return;
        if (storedIsAdmin) {
          logout();
          router.replace(getAdminLoginPath());
        } else {
          // Obfuscate admin existence: unauthenticated or customer access redirects to home
          router.replace("/");
        }
      }
    };

    void verifyAdminSession();

    return () => {
      active = false;
    };
  }, [mounted, router, setAuth, setToken, setUser, logout]);

  if (!mounted || !verified) {
    return <div className="h-screen w-full flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated || !user?.role || user?.role === "customer") {
    return null;
  }

  return <>{children}</>;
}
