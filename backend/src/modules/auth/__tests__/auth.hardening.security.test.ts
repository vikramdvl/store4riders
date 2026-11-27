import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ENV } from "../../../core/config/env";
import {
  generateTokens,
  verifyToken,
  resolveAuthScope,
} from "../../../core/utils/jwt";
import {
  extractAdminFromAuth,
  extractUserFromAuth,
  CUSTOMER_ACCESS_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
  ADMIN_ACCESS_COOKIE,
  ADMIN_REFRESH_COOKIE,
} from "../../../core/middlewares/auth";
import { AuthController } from "../auth.controller";
import { UserRepository } from "../../user/user.repository";
import { UserService } from "../../user/user.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { OrderRepository } from "../../order/order.repository";
import { AuthService } from "../auth.service";

const memCache = new Map<string, any>();

vi.mock("../../../core/cache/redis", () => ({
  getCache: vi.fn(async (key: string) => (memCache.has(key) ? memCache.get(key) : null)),
  setCache: vi.fn(async (key: string, val: any) => {
    memCache.set(key, val);
  }),
  deleteCache: vi.fn(async (key: string) => {
    memCache.delete(key);
  }),
  setCacheIfAbsent: vi.fn(async (key: string, val: any) => {
    if (memCache.has(key)) return false;
    memCache.set(key, val);
    return true;
  }),
  incrementCacheCounter: vi.fn(async () => 1),
  consumeCacheOnce: vi.fn(async () => null),
}));

vi.mock("../../../core/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Auth Hardening, Portal Isolation & Cookie Resilience", () => {
  beforeEach(() => {
    memCache.clear();
    vi.restoreAllMocks();
    vi.spyOn(AuditLogService, "record").mockResolvedValue(undefined as any);
    vi.spyOn(OrderRepository, "linkGuestOrders").mockResolvedValue(0);
    vi.spyOn(AuthService, "syncUserFromLinkedOrders").mockResolvedValue(undefined);
  });

  it("enforces tokenType so refresh tokens cannot be used as access tokens and vice versa", () => {
    const adminTokens = generateTokens("admin_1", "super_admin", 2);
    const decodedAccess = verifyToken(adminTokens.accessToken, false);
    const decodedRefresh = verifyToken(adminTokens.refreshToken, true);

    expect(decodedAccess.scope).toBe("admin");
    expect(decodedAccess.tokenType).toBe("access");
    expect(decodedAccess.tokenVersion).toBe(2);
    expect(decodedRefresh.scope).toBe("admin");
    expect(decodedRefresh.tokenType).toBe("refresh");

    expect(() => verifyToken(adminTokens.refreshToken, false)).toThrow();
    expect(() => verifyToken(adminTokens.accessToken, true)).toThrow();

    // Even if signed with the access secret directly, tokenType: "refresh" cannot be used as access token
    const confusedRefresh = jwt.sign(
      { userId: "admin_1", scope: "admin", tokenType: "refresh", tokenVersion: 2 },
      ENV.JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );
    expect(() => verifyToken(confusedRefresh, false)).toThrow("Token type mismatch");
  });

  it("blocks customer-scoped JWTs on admin extractors and isolates admin vs customer cookies", () => {
    const custTokens = generateTokens("cust_1", "customer", 0);
    const adminTokens = generateTokens("admin_1", "admin", 0);

    // 1. Customer token rejected by extractAdminFromAuth
    const reqWithCustomerBearer = new NextRequest("https://api.store4riders.com/api/v1/admin/users", {
      headers: { Authorization: `Bearer ${custTokens.accessToken}` },
    });
    expect(() => extractAdminFromAuth(reqWithCustomerBearer)).toThrow("Admin portal session required");

    // 2. When browser holds both cookies, admin extractor picks adminAccessToken and storefront extractor picks accessToken
    const dualCookieReq = new NextRequest("https://api.store4riders.com/api/v1/orders", {
      headers: {
        cookie: `${CUSTOMER_ACCESS_COOKIE}=${custTokens.accessToken}; ${ADMIN_ACCESS_COOKIE}=${adminTokens.accessToken}`,
      },
    });
    expect(extractAdminFromAuth(dualCookieReq)).toBe("admin_1");
    expect(extractUserFromAuth(dualCookieReq)).toBe("cust_1");
  });

  it("rejects staff login on customer form and customer login on admin portal", async () => {
    const hashed = await bcrypt.hash("StrongPass@1", 10);

    vi.spyOn(UserRepository, "findByEmailWithPassword").mockResolvedValueOnce({
      _id: "staff_1",
      email: "ops@store4riders.com",
      firstName: "Ops",
      role: "order_manager",
      isActive: true,
      password: hashed,
      tokenVersion: 0,
    });

    const customerLoginReq = new NextRequest("https://api.store4riders.com/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ops@store4riders.com", password: "StrongPass@1" }),
    });
    await expect(AuthController.login(customerLoginReq)).rejects.toThrow(
      "Staff and admin accounts must sign in through the Admin Portal"
    );

    vi.spyOn(UserRepository, "findByEmailWithPassword").mockResolvedValueOnce({
      _id: "cust_1",
      email: "rider@example.com",
      firstName: "Rider",
      role: "customer",
      isActive: true,
      password: hashed,
      tokenVersion: 0,
    });

    const adminLoginReq = new NextRequest("https://api.store4riders.com/api/v1/auth/login?scope=admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-auth-scope": "admin" },
      body: JSON.stringify({ email: "rider@example.com", password: "StrongPass@1", scope: "admin" }),
    });
    await expect(AuthController.login(adminLoginReq)).rejects.toThrow(
      "Customer accounts cannot access the Admin Portal"
    );
  });

  it("sets scoped cookies with cross-site SameSite=None only over HTTPS and isolates logout cookies", async () => {
    const hashed = await bcrypt.hash("AdminPass@1", 10);
    vi.spyOn(UserRepository, "findByEmailWithPassword").mockResolvedValue({
      _id: "admin_cookie_1",
      email: "admin@store4riders.com",
      firstName: "Admin",
      role: "super_admin",
      isActive: true,
      isEmailVerified: true,
      password: hashed,
      tokenVersion: 1,
    });
    vi.spyOn(UserRepository, "incrementTokenVersion").mockResolvedValue(2);

    // Cross-site HTTPS request (*.vercel.app -> api.store4riders.com) should use SameSite=None; Secure
    const crossSiteReq = new NextRequest("https://api.store4riders.com/api/v1/auth/login?scope=admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-scope": "admin",
        "x-forwarded-proto": "https",
        host: "api.store4riders.com",
        origin: "https://store4riders-preview.vercel.app",
      },
      body: JSON.stringify({ email: "admin@store4riders.com", password: "AdminPass@1", scope: "admin" }),
    });

    const loginRes = await AuthController.login(crossSiteReq);
    expect(loginRes.status).toBe(200);
    expect(loginRes.cookies.get(ADMIN_ACCESS_COOKIE)?.value).toBeTruthy();
    expect(loginRes.cookies.get(ADMIN_REFRESH_COOKIE)?.value).toBeTruthy();
    expect(loginRes.cookies.get(CUSTOMER_ACCESS_COOKIE)).toBeUndefined();
    const setCookieHeader = loginRes.headers.get("set-cookie") || "";
    expect(setCookieHeader.toLowerCase()).toContain("samesite=none");
    expect(setCookieHeader.toLowerCase()).toContain("secure");

    // Local HTTP request should NOT set Secure (even under production mode) and same-site uses Lax
    const localHttpReq = new NextRequest("http://localhost:4000/api/v1/auth/login?scope=admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-scope": "admin",
        host: "localhost:4000",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ email: "admin@store4riders.com", password: "AdminPass@1", scope: "admin" }),
    });
    const localRes = await AuthController.login(localHttpReq);
    const localCookieHeader = localRes.headers.get("set-cookie") || "";
    expect(localCookieHeader.toLowerCase()).toContain("samesite=lax");
    expect(localCookieHeader.toLowerCase()).not.toContain("; secure");

    // Customer logout should NOT clear admin cookies
    const custTokens = generateTokens("cust_9", "customer", 0);
    const custLogoutReq = new NextRequest("https://api.store4riders.com/api/v1/auth/logout?scope=customer", {
      method: "POST",
      headers: {
        "x-auth-scope": "customer",
        cookie: `${CUSTOMER_ACCESS_COOKIE}=${custTokens.accessToken}; ${CUSTOMER_REFRESH_COOKIE}=${custTokens.refreshToken}`,
      },
    });
    const logoutRes = await AuthController.logout(custLogoutReq);
    expect(logoutRes.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value).toBe("");
    expect(logoutRes.cookies.get(ADMIN_ACCESS_COOKIE)).toBeUndefined();
  });

  it("rejects disabled accounts via UserService.getRole and AuthController.me, and removes admin-bypass-id", async () => {
    vi.spyOn(UserRepository, "findById").mockResolvedValueOnce(null);
    await expect(UserService.getRole("admin-bypass-id")).rejects.toThrow("Account is disabled or no longer exists");

    vi.spyOn(UserRepository, "findById").mockResolvedValueOnce({
      _id: "user_disabled_1",
      email: "disabled@store4riders.com",
      role: "admin",
      isActive: false,
      tokenVersion: 0,
    } as any);
    await expect(UserService.getRole("user_disabled_1")).rejects.toThrow("Account is disabled or no longer exists");

    const staleAdminTokens = generateTokens("admin_live", "admin", 0);
    vi.spyOn(UserRepository, "findById").mockResolvedValueOnce({
      _id: "admin_live",
      email: "admin@store4riders.com",
      role: "admin",
      isActive: true,
      tokenVersion: 1, // Incremented on logout / password reset
    } as any);

    const meReq = new NextRequest("https://api.store4riders.com/api/v1/auth/me?scope=admin", {
      headers: {
        Authorization: `Bearer ${staleAdminTokens.accessToken}`,
        "x-auth-scope": "admin",
      },
    });
    await expect(AuthController.me(meReq)).rejects.toThrow("Session is no longer valid");
    expect(resolveAuthScope("marketing_manager")).toBe("admin");
  });
});
