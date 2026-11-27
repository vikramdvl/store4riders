import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { generateTokens, verifyToken } from "../../../core/utils/jwt";
import {
  verifySessionState,
  CUSTOMER_ACCESS_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
} from "../../../core/middlewares/auth";
import { UnauthorizedError, ValidationError } from "../../../core/errors/AppError";
import { UserRepository } from "../user.repository";
import { UserService } from "../user.service";
import { UserController } from "../user.controller";
import { userRouter } from "../user.route";
import { AuthService } from "../../auth/auth.service";
import { AuditLogService } from "../../audit-log/audit-log.service";

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

describe("Customer User Auth Hardening", () => {
  beforeEach(() => {
    memCache.clear();
    vi.restoreAllMocks();
    vi.spyOn(AuditLogService, "record").mockResolvedValue(undefined as any);
  });

  it("rejects disabled accounts (isActive === false) in getProfile and updateProfile", async () => {
    const disabledUser: any = {
      _id: "507f1f77bcf86cd799439011",
      email: "disabled@example.com",
      firstName: "Rider",
      lastName: "Kumar",
      phone: "+919876543210",
      addresses: [
        {
          id: "addr-1",
          street: "MG Road",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          country: "India",
          isDefault: true,
        },
      ],
      role: "customer",
      isActive: false,
    };

    vi.spyOn(UserRepository, "findById").mockResolvedValue(disabledUser);
    const updateSpy = vi.spyOn(UserRepository, "update");

    await expect(UserService.getProfile("507f1f77bcf86cd799439011")).rejects.toBeInstanceOf(
      UnauthorizedError
    );
    await expect(
      UserService.updateProfile("507f1f77bcf86cd799439011", { firstName: "Updated" })
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("rejects disabled accounts or wrong current password in changePassword without touching tokenVersion", async () => {
    const hashedPassword = await bcrypt.hash("OldSecret@123", 10);
    const incrementSpy = vi.spyOn(UserRepository, "incrementTokenVersion");
    const updateSpy = vi.spyOn(UserRepository, "update");

    vi.spyOn(UserRepository, "findByIdWithPassword").mockResolvedValueOnce({
      _id: "user-disabled",
      email: "disabled@example.com",
      password: hashedPassword,
      role: "customer",
      isActive: false,
      tokenVersion: 1,
    });

    await expect(
      UserService.changePassword("user-disabled", "OldSecret@123", "NewSecret@123")
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(incrementSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();

    vi.spyOn(UserRepository, "findByIdWithPassword").mockResolvedValueOnce({
      _id: "user-active",
      email: "active@example.com",
      password: hashedPassword,
      role: "customer",
      isActive: true,
      tokenVersion: 1,
    });

    await expect(
      UserService.changePassword("user-active", "WrongPass@123", "NewSecret@123")
    ).rejects.toBeInstanceOf(ValidationError);
    expect(incrementSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("revokes prior access/refresh tokens via tokenVersion & blacklist while keeping the new rotated session valid", async () => {
    const userId = "507f1f77bcf86cd799439099";
    const oldHashed = await bcrypt.hash("OldSecret@123", 10);
    let storedTokenVersion = 1;
    let storedHash = oldHashed;

    vi.spyOn(UserRepository, "findByIdWithPassword").mockImplementation(async () => ({
      _id: userId,
      email: "rider@store4riders.com",
      password: storedHash,
      role: "customer",
      isActive: true,
      tokenVersion: storedTokenVersion,
    }));

    vi.spyOn(UserRepository, "findById").mockImplementation(async () => ({
      id: userId,
      email: "rider@store4riders.com",
      firstName: "Vikram",
      lastName: "Kumar",
      phone: "+919876543210",
      addresses: [],
      role: "customer",
      isActive: true,
      isEmailVerified: true,
      tokenVersion: storedTokenVersion,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    vi.spyOn(UserRepository, "update").mockImplementation(async (_id, data: any) => {
      if (data.password) storedHash = data.password;
      memCache.delete(`auth_user_state:${userId}`);
      return {
        id: userId,
        email: "rider@store4riders.com",
        firstName: "Vikram",
        role: "customer",
        tokenVersion: storedTokenVersion,
      } as any;
    });

    vi.spyOn(UserRepository, "incrementTokenVersion").mockImplementation(async () => {
      storedTokenVersion += 1;
      memCache.delete(`auth_user_state:${userId}`);
      return storedTokenVersion;
    });

    const oldSessionTokens = generateTokens(userId, "customer", 1);

    const req = new NextRequest("https://api.store4riders.com/api/v1/users/me/password", {
      method: "PUT",
      headers: {
        authorization: `Bearer ${oldSessionTokens.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: "OldSecret@123",
        newPassword: "NewSecret@456",
        confirmPassword: "NewSecret@456",
      }),
    });

    const res = await UserController.changePassword(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeDefined();
    expect(body.data.scope).toBe("customer");

    // Updated password works & tokenVersion advanced
    expect(await bcrypt.compare("NewSecret@456", storedHash)).toBe(true);
    expect(storedTokenVersion).toBe(2);

    // Rotated HttpOnly cookies issued for the current browser
    expect(res.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value).toBe(body.data.accessToken);
    expect(res.cookies.get(CUSTOMER_REFRESH_COOKIE)?.value).toBe(body.data.refreshToken);

    // Audit trail recorded
    expect(AuditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "AUTH",
        action: "PASSWORD_CHANGED",
      })
    );

    // Old device/stolen tokens are immediately rejected across auth verification, refresh, and /users/me routes
    const oldDecoded = verifyToken(oldSessionTokens.accessToken, false);
    await expect(verifySessionState(oldDecoded)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(
      AuthService.refreshToken(oldSessionTokens.refreshToken, "customer")
    ).rejects.toBeInstanceOf(UnauthorizedError);

    // Old token calling GET /users/me, GET /users/me/addresses, PUT /users/me/password, DELETE /users/me/addresses/1 is blocked
    await expect(
      userRouter(
        new NextRequest("https://api.store4riders.com/api/v1/users/me", {
          method: "GET",
          headers: { authorization: `Bearer ${oldSessionTokens.accessToken}` },
        }),
        ["me"]
      )
    ).rejects.toBeInstanceOf(UnauthorizedError);

    await expect(
      userRouter(
        new NextRequest("https://api.store4riders.com/api/v1/users/me/addresses", {
          method: "GET",
          headers: { authorization: `Bearer ${oldSessionTokens.accessToken}` },
        }),
        ["me", "addresses"]
      )
    ).rejects.toBeInstanceOf(UnauthorizedError);

    await expect(
      userRouter(
        new NextRequest("https://api.store4riders.com/api/v1/users/me/addresses/addr-1", {
          method: "DELETE",
          headers: { authorization: `Bearer ${oldSessionTokens.accessToken}` },
        }),
        ["me", "addresses", "addr-1"]
      )
    ).rejects.toBeInstanceOf(UnauthorizedError);

    // Fresh tokens returned by changePassword work immediately (even in the same second)
    const newDecoded = verifyToken(body.data.accessToken, false);
    expect(newDecoded.tokenVersion).toBe(2);
    const verifiedNewState = await verifySessionState(newDecoded);
    expect(verifiedNewState.userId).toBe(userId);
    expect(verifiedNewState.tokenVersion).toBe(2);

    const refreshed = await AuthService.refreshToken(body.data.refreshToken, "customer");
    expect(refreshed.accessToken).toBeDefined();
    expect(refreshed.refreshToken).toBeDefined();
  });
});
