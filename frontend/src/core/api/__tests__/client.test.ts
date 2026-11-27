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

  it("does NOT broadcast global logout when a newly opened public tab fails refresh solely due to missing in-memory/cookie refresh token", async () => {
    useAuthStore.setState({
      user: { email: "admin@store4riders.com", role: "super_admin" },
      token: null,
      refreshToken: null,
      isAuthenticated: true,
      lastTokenRefreshAt: null,
    });

    vi.spyOn(axios, "post").mockRejectedValueOnce({
      response: { status: 401, data: { error: "No refresh token" } },
    });

    await expect(refreshAccessToken()).rejects.toBeDefined();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("sends x-auth-scope: admin on admin routes, does not leak customer Bearer tokens, and redirects expired admin sessions to Admin Gate", async () => {
    const originalLocation = window.location;
    let assignedHref = "";
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: "/admin/orders",
        hostname: "store4riders.com",
        get href() {
          return assignedHref;
        },
        set href(val: string) {
          assignedHref = val;
        },
      },
    });

    try {
      // Customer token in memory must NOT be attached as Bearer on admin routes
      useAuthStore.setState({
        user: { email: "cust@example.com", role: "customer" },
        token: "cust_bearer_should_not_leak",
        refreshToken: "cust_refresh",
        isAuthenticated: true,
        lastTokenRefreshAt: Date.now(),
      });

      let seenAuthHeader: any;
      let seenScopeHeader: any;
      apiClient.defaults.adapter = async (config) => {
        seenAuthHeader = config.headers?.Authorization;
        seenScopeHeader = config.headers?.["x-auth-scope"];
        return { data: { success: true }, status: 200, statusText: "OK", headers: {}, config };
      };

      await apiClient.get("/admin/orders");
      expect(seenScopeHeader).toBe("admin");
      expect(seenAuthHeader).toBeUndefined();

      // Expired admin session redirects to admin secret gate, NOT /login
      useAuthStore.setState({
        user: { email: "admin@store4riders.com", role: "super_admin" },
        token: "expired_admin_token",
        refreshToken: "expired_admin_refresh",
        isAuthenticated: true,
        lastTokenRefreshAt: Date.now(),
      });
      vi.spyOn(axios, "post").mockRejectedValueOnce({
        response: { status: 401, data: { error: "Invalid refresh token" } },
      });

      await expect(refreshAccessToken("admin")).rejects.toBeDefined();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(assignedHref).toContain("/admin/rider-staff-gate?expired=true");
      expect(assignedHref).not.toContain("/login");
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  it("never broadcasts an admin LOGOUT when a customer storefront session expires", async () => {
    const originalLocation = window.location;
    let assignedHref = "";
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: "/account",
        hostname: "store4riders.com",
        get href() {
          return assignedHref;
        },
        set href(val: string) {
          assignedHref = val;
        },
      },
    });

    const postedMessages: any[] = [];
    const OriginalBroadcastChannel = globalThis.BroadcastChannel;
    class MockBroadcastChannel {
      onmessage: ((ev: any) => void) | null = null;
      postMessage(msg: any) {
        postedMessages.push(msg);
      }
      close() {}
    }
    (globalThis as any).BroadcastChannel = MockBroadcastChannel;

    try {
      useAuthStore.setState({
        user: { email: "admin@store4riders.com", role: "super_admin" },
        token: "stale_token",
        refreshToken: "stale_refresh",
        isAuthenticated: true,
        lastTokenRefreshAt: Date.now(),
      });

      vi.spyOn(axios, "post").mockRejectedValueOnce({
        response: { status: 401, data: { error: "Invalid refresh token" } },
      });

      await expect(refreshAccessToken("customer")).rejects.toBeDefined();
      expect(assignedHref).toContain("/login?expired=true");

      // Even if logout() is invoked directly on storefront, scope defaults to "customer", not "admin"
      useAuthStore.getState().logout("customer");
      expect(postedMessages.every((m) => m.scope !== "admin")).toBe(true);
    } finally {
      (globalThis as any).BroadcastChannel = OriginalBroadcastChannel;
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    }
  });
});
