import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { AuthService } from "../auth.service";
import { UserRepository } from "../../user/user.repository";

const cacheStore = new Map<string, string>();

vi.mock("../../../core/cache/redis", () => ({
  setCache: vi.fn(async (key: string, value: string) => {
    cacheStore.set(key, value);
  }),
  getCache: vi.fn(async (key: string) => cacheStore.get(key) ?? null),
  deleteCache: vi.fn(async (key: string) => {
    cacheStore.delete(key);
  }),
}));

vi.mock("../../../core/utils/jwt", async () => {
  const actual = await vi.importActual<typeof import("../../../core/utils/jwt")>("../../../core/utils/jwt");
  return {
    ...actual,
    generateTokens: vi.fn((userId: string, role?: string) => ({
      accessToken: `access_${userId}`,
      refreshToken: `refresh_${userId}_${role || "customer"}`,
    })),
    verifyToken: vi.fn((token: string) => {
      const parts = token.split("|");
      return {
        userId: parts[0],
        iat: Number(parts[1] || Math.floor(Date.now() / 1000)),
      };
    }),
  };
});

vi.mock("../../user/user.repository", () => ({
  UserRepository: {
    findByEmail: vi.fn(),
    findByEmailWithPassword: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../../order/order.repository", () => ({
  OrderRepository: {
    linkGuestOrders: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../order/order.model", () => ({
  OrderModel: {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  },
}));

describe("AuthService - Session & Blacklist Lifecycle", () => {
  beforeEach(() => {
    cacheStore.clear();
    vi.clearAllMocks();
  });

  it("clears user-level logout blacklist on login so token refresh works after 15m", async () => {
    const hashedPassword = await bcrypt.hash("Rider@123", 4);
    vi.mocked(UserRepository.findByEmailWithPassword).mockResolvedValue({
      _id: "user_1",
      email: "rider@example.com",
      password: hashedPassword,
      firstName: "Rider",
      lastName: "One",
      role: "customer",
      isActive: true,
    });
    vi.mocked(UserRepository.findById).mockResolvedValue({
      _id: "user_1",
      email: "rider@example.com",
      isActive: true,
    } as any);

    // Simulate a previous logout setting a 7-day blacklist
    await AuthService.logout("user_1");
    expect(cacheStore.has("blacklist:user_1")).toBe(true);

    // User logs in again
    await AuthService.login({ email: "rider@example.com", password: "Rider@123" });
    expect(cacheStore.has("blacklist:user_1")).toBe(false);

    // Later when accessToken expires, refreshToken succeeds
    const refreshed = await AuthService.refreshToken(`user_1|${Math.floor(Date.now() / 1000)}`);
    expect(refreshed.accessToken).toBe("access_user_1");
    expect(refreshed.refreshToken).toBe("refresh_user_1_customer");
    expect(refreshed.sessionMaxAgeSeconds).toBe(7 * 24 * 60 * 60);
  });

  it("rejects refresh tokens issued before logout timestamp", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue({
      _id: "user_2",
      email: "rider2@example.com",
      isActive: true,
    } as any);

    const issuedBeforeLogoutSec = Math.floor(Date.now() / 1000) - 60;
    await AuthService.logout("user_2");

    await expect(
      AuthService.refreshToken(`user_2|${issuedBeforeLogoutSec}`)
    ).rejects.toThrow("Session has expired or was logged out");
  });

  it("rejects explicitly blacklisted refresh token string", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue({
      _id: "user_3",
      email: "rider3@example.com",
      isActive: true,
    } as any);

    const token = `user_3|${Math.floor(Date.now() / 1000)}`;
    cacheStore.set(`bl_token_${token}`, "1");

    await expect(AuthService.refreshToken(token)).rejects.toThrow(
      "Session has expired or was logged out"
    );
  });

  it("rejects legacy 'true' user blacklist until next login clears it", async () => {
    const hashedPassword = await bcrypt.hash("Rider@123", 4);
    vi.mocked(UserRepository.findByEmailWithPassword).mockResolvedValue({
      _id: "user_4",
      email: "rider4@example.com",
      password: hashedPassword,
      role: "customer",
      isActive: true,
    });
    vi.mocked(UserRepository.findById).mockResolvedValue({
      _id: "user_4",
      email: "rider4@example.com",
      isActive: true,
    } as any);

    cacheStore.set("blacklist:user_4", "true");
    await expect(
      AuthService.refreshToken(`user_4|${Math.floor(Date.now() / 1000)}`)
    ).rejects.toThrow("Session has expired or was logged out");

    await AuthService.login({ email: "rider4@example.com", password: "Rider@123" });
    const refreshed = await AuthService.refreshToken(`user_4|${Math.floor(Date.now() / 1000)}`);
    expect(refreshed.accessToken).toBe("access_user_4");
  });

  it("applies 7d idle session for customers and 24h idle session for admin/staff", async () => {
    const hashedPassword = await bcrypt.hash("Admin@123", 4);
    vi.mocked(UserRepository.findByEmailWithPassword).mockResolvedValue({
      _id: "admin_1",
      email: "admin@store4riders.com",
      password: hashedPassword,
      role: "admin",
      isActive: true,
    });
    vi.mocked(UserRepository.findById).mockResolvedValue({
      _id: "admin_1",
      email: "admin@store4riders.com",
      role: "admin",
      isActive: true,
    } as any);

    const loginRes = await AuthService.login({ email: "admin@store4riders.com", password: "Admin@123" });
    expect(loginRes.sessionMaxAgeSeconds).toBe(24 * 60 * 60);

    const refreshed = await AuthService.refreshToken(`admin_1|${Math.floor(Date.now() / 1000)}`);
    expect(refreshed.sessionMaxAgeSeconds).toBe(24 * 60 * 60);
    expect(refreshed.refreshToken).toBe("refresh_admin_1_admin");
  });
});
