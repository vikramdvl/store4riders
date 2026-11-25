import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { apiClient, refreshAccessToken } from "../client";
import { useAuthStore } from "@/stores/useAuthStore";

describe("apiClient - Token Refresh & Session Resilience", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: { email: "rider@example.com", role: "customer" },
      token: "expired_access_token",
      refreshToken: "valid_refresh_token",
      isAuthenticated: true,
      lastTokenRefreshAt: Date.now() - 20 * 60 * 1000,
    });
  });

  it("refreshes access token on 401 and retries original request without logging out", async () => {
    const postSpy = vi.spyOn(axios, "post").mockResolvedValue({
      data: {
        data: {
          accessToken: "fresh_access_token",
          refreshToken: "fresh_refresh_token",
        },
      },
    });

    let callCount = 0;
    apiClient.defaults.adapter = async (config) => {
      callCount += 1;
      if (callCount === 1) {
        const err: any = new Error("Unauthorized");
        err.config = config;
        err.response = { status: 401, data: { error: "Token expired" } };
        throw err;
      }
      return {
        data: { success: true, data: { ok: true } },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    const res = await apiClient.get("/users/me");
    expect(res.data.data.ok).toBe(true);
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().token).toBe("fresh_access_token");
  });

  it("does NOT log user out when /auth/refresh fails with 429 rate limit or 500", async () => {
    vi.spyOn(axios, "post").mockRejectedValueOnce({
      response: { status: 429, data: { error: "Too many requests" } },
    });

    await expect(refreshAccessToken()).rejects.toBeDefined();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    vi.spyOn(axios, "post").mockRejectedValueOnce({
      response: { status: 500, data: { error: "Server error" } },
    });

    await expect(refreshAccessToken()).rejects.toBeDefined();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("logs user out cleanly when /auth/refresh returns 401", async () => {
    vi.spyOn(axios, "post").mockRejectedValueOnce({
      response: { status: 401, data: { error: "Invalid refresh token" } },
    });

    await expect(refreshAccessToken()).rejects.toBeDefined();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });
});
