import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { IUser } from "@store4riders/shared-types";
import { ChangePasswordInput, UpdateProfileInput } from "@store4riders/shared-validation";
import { toast } from "sonner";

/**
 * Fetches the currently authenticated customer's profile and syncs Zustand user state.
 */
export function useProfile() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setUser = useAuthStore((state) => state.setUser);

  return useQuery({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const response = await apiClient.get("/users/me");
      const user = response.data?.data as IUser | undefined;
      if (user) {
        setUser(user);
      }
      return user ?? null;
    },
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
    retry: false,
  });
}

/**
 * Updates profile fields (firstName, lastName, phone).
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (data: UpdateProfileInput) => {
      const response = await apiClient.put("/users/me", data);
      return response.data?.data as IUser;
    },
    onSuccess: (updatedUser) => {
      if (updatedUser) {
        setUser(updatedUser);
      }
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
      queryClient.invalidateQueries({ queryKey: ["user", "profile"] });
      toast.success("Profile updated successfully");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to update profile");
    },
  });
}

/**
 * Updates the current user's account password.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: ChangePasswordInput) => {
      const response = await apiClient.put("/users/me/password", data);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Password changed successfully!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to change password");
    },
  });
}

/**
 * Fetches all orders belonging to the authenticated customer.
 */
export function useMyOrders() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const res = await apiClient.get("/orders/me");
      const list = res.data?.data;
      return Array.isArray(list) ? (list as any[]) : [];
    },
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}
