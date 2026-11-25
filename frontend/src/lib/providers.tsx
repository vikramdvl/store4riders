"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Toaster } from "sonner";

import { useCartStore } from "@/stores/useCartStore";
import { initSessionLifecycle } from "@/core/api/client";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,         // 1 minute — fast navigation but fresh enough for stock
            gcTime: 5 * 60 * 1000,        // 5 minutes — keep in memory for back-navigation speed
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  useEffect(() => {
    initSessionLifecycle();
    try {
      const authData = localStorage.getItem("auth-storage");
      let initialUserId: string | null = null;
      if (authData) {
        const parsed = JSON.parse(authData);
        // Only bind cloud cart if strictly authenticated customer!
        const isAuth = Boolean(parsed?.state?.isAuthenticated);
        const role = parsed?.state?.user?.role;
        if (isAuth && (!role || role === "customer")) {
          initialUserId = parsed?.state?.user?.id || parsed?.state?.user?.email || null;
        }
      }
      useCartStore.getState().switchUserCart(initialUserId);
    } catch (e) {}
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
