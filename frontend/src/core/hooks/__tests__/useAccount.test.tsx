import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useChangePassword } from "../useAccount";
import { apiClient } from "../../api/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { toast } from "sonner";

vi.mock("../../api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useAccount — useChangePassword", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { id: "user-1", email: "rider@store4riders.com", role: "customer" },
      token: "old-access-token",
      refreshToken: "old-refresh-token",
      isAuthenticated: true,
      isLoggingOut: false,
      lastTokenRefreshAt: 1000,
    });
  });

  it("updates Zustand access and refresh tokens when password change returns rotated session tokens", async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
          scope: "customer",
        },
        message: "Password changed successfully",
      },
    } as any);

    const { result } = renderHook(() => useChangePassword(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        currentPassword: "OldSecret@123",
        newPassword: "NewSecret@456",
        confirmPassword: "NewSecret@456",
      });
    });

    expect(apiClient.put).toHaveBeenCalledWith("/users/me/password", {
      currentPassword: "OldSecret@123",
      newPassword: "NewSecret@456",
      confirmPassword: "NewSecret@456",
    });
    expect(useAuthStore.getState().token).toBe("new-access-token");
    expect(useAuthStore.getState().refreshToken).toBe("new-refresh-token");
    expect(toast.success).toHaveBeenCalledWith("Password changed successfully!");
  });

  it("does not clear existing store tokens if backend omits rotated tokens in response", async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      data: {
        success: true,
        data: null,
      },
    } as any);

    const { result } = renderHook(() => useChangePassword(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        currentPassword: "OldSecret@123",
        newPassword: "NewSecret@456",
        confirmPassword: "NewSecret@456",
      });
    });

    expect(useAuthStore.getState().token).toBe("old-access-token");
    expect(useAuthStore.getState().refreshToken).toBe("old-refresh-token");
    expect(toast.success).toHaveBeenCalledWith("Password changed successfully!");
  });
});
