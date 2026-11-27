import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, isAdminPortalContext } from "../api/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCartStore } from "@/stores/useCartStore";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const sanitizePostLoginRedirect = (rawTarget: string | null, scope: "admin" | "customer"): string => {
  if (!rawTarget || !rawTarget.startsWith("/") || rawTarget.startsWith("//") || rawTarget.startsWith("/\\")) {
    return "/";
  }
  if (scope !== "admin" && rawTarget.startsWith("/admin")) {
    return "/";
  }
  return rawTarget;
};

export function useLogin(options?: { disableRedirect?: boolean; scope?: "admin" | "customer" }) {
  const setAuth = useAuthStore((state) => state.setAuth);
  const router = useRouter();
  const loginScope: "admin" | "customer" = options?.scope || "customer";

  return useMutation({
    mutationFn: async (credentials: any) => {
      const endpoint = loginScope === "admin" ? "/auth/login?scope=admin" : "/auth/login";
      const response = await apiClient.post(
        endpoint,
        { ...credentials, scope: loginScope },
        { headers: { "x-auth-scope": loginScope } }
      );
      return response.data;
    },
    onSuccess: (data) => {
      const loggedInUser = data?.data?.user;
      const role = loggedInUser?.role || "customer";

      if (loginScope === "customer" && role !== "customer") {
        toast.error("Staff and admin accounts must sign in through the Admin Portal");
        return;
      }
      if (loginScope === "admin" && role === "customer") {
        toast.error("Customer accounts cannot access the Admin Portal");
        return;
      }

      if (loggedInUser && data?.data?.accessToken) {
        setAuth(loggedInUser, data.data.accessToken, data.data.refreshToken);
      }
      toast.success("Successfully logged in!");
      
      if (!options?.disableRedirect) {
        const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const redirectTarget = sanitizePostLoginRedirect(searchParams?.get("redirect") || null, loginScope);
        router.push(redirectTarget);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Invalid email or password");
    },
  });
}

export function useSendRegisterOtp() {
  return useMutation({
    mutationFn: async (payload: { email: string }) => {
      const response = await apiClient.post("/auth/send-register-otp", payload);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      toast.success(`Verification code sent to ${variables.email}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to send verification code");
    },
  });
}

export function useRegister(options?: { disableRedirect?: boolean }) {
  const setAuth = useAuthStore((state) => state.setAuth);
  const router = useRouter();

  return useMutation({
    mutationFn: async (userData: any) => {
      const response = await apiClient.post("/auth/register", userData);
      return response.data;
    },
    onSuccess: (data) => {
      if (data?.data?.user && data?.data?.accessToken) {
        setAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
      }

      if (!options?.disableRedirect) {
        const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const redirectTarget = searchParams?.get("redirect") || "/";

        toast.success("Account created successfully!");
        router.push(redirectTarget);
      } else {
        toast.success("Account created successfully!");
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Registration failed");
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (data: { email: string }) => {
      const response = await apiClient.post("/auth/forgot-password", data);
      return response.data;
    },
    onSuccess: () => {
      toast.success("If an account exists, a password reset link has been sent.");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to request password reset");
    },
  });
}

export function useResetPassword() {
  const router = useRouter();
  
  return useMutation({
    mutationFn: async (data: { token: string; password: string }) => {
      const response = await apiClient.post("/auth/reset-password", data);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Password reset successfully. You can now log in.");
      router.push("/login");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to reset password. Link may be expired.");
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logoutStore = useAuthStore((state) => state.logout);
  const setLoggingOut = useAuthStore((state) => state.setLoggingOut);

  return useMutation({
    mutationFn: async () => {
      try {
        const scope = isAdminPortalContext() ? "admin" : "customer";
        const refreshToken = useAuthStore.getState().refreshToken;
        await apiClient.post(
          `/auth/logout?scope=${scope}`,
          refreshToken ? { refreshToken } : {},
          { headers: { "x-auth-scope": scope } }
        );
      } catch (e) {
        // Proceed to clean up locally even if network is offline
      }
    },
    onSettled: () => {
      // Prevent account guards from redirecting to /login while deliberate logout navigates home
      setLoggingOut(true);

      // 1. Clear Zustand auth store (user, token, refreshToken, isAuthenticated: false)
      logoutStore();

      // 2. Clear user cart binding, revert to guest cart
      useCartStore.getState().switchUserCart(null);

      // 3. Clear all cached React Query data (wishlist, profile, orders)
      queryClient.clear();

      toast.success("Logged out successfully");
      router.replace("/");
      setTimeout(() => setLoggingOut(false), 500);
    },
  });
}
