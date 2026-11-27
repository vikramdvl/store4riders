import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { registerSchema, checkEmailSchema } from "@store4riders/shared-validation";
import { AuthService } from "../auth.service";
import { UserRepository } from "../../user/user.repository";
import { UserModel } from "../../user/user.model";
import { OrderRepository } from "../../order/order.repository";
import { sendSmtpEmail } from "../../../core/email/smtp";

const cacheStore = new Map<string, any>();

vi.mock("../../../core/cache/redis", () => ({
  setCache: vi.fn(async (key: string, value: any) => {
    cacheStore.set(key, value);
  }),
  getCache: vi.fn(async (key: string) => cacheStore.get(key) ?? null),
  deleteCache: vi.fn(async (key: string) => {
    cacheStore.delete(key);
  }),
  setCacheIfAbsent: vi.fn(async (key: string, value: any) => {
    if (cacheStore.has(key)) return false;
    cacheStore.set(key, value);
    return true;
  }),
  incrementCacheCounter: vi.fn(async (key: string) => {
    const next = Number(cacheStore.get(key) || 0) + 1;
    cacheStore.set(key, next);
    return next;
  }),
  consumeCacheOnce: vi.fn(async (key: string) => {
    const val = cacheStore.get(key) ?? null;
    cacheStore.delete(key);
    return val;
  }),
}));

vi.mock("../../../core/utils/jwt", () => ({
  generateTokens: vi.fn((userId: string, role?: string) => ({
    accessToken: `access_${userId}`,
    refreshToken: `refresh_${userId}_${role || "customer"}`,
  })),
  verifyToken: vi.fn(),
  resolveAuthScope: vi.fn((role?: string) => (role && role !== "customer" ? "admin" : "customer")),
  getSessionConfigForRole: vi.fn(() => ({
    scope: "customer",
    refreshExpiresIn: "7d",
    refreshMaxAgeSeconds: 7 * 24 * 60 * 60,
  })),
}));

vi.mock("../../../core/email/smtp", () => ({
  sendSmtpEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../core/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../user/user.repository", () => ({
  UserRepository: {
    findByEmail: vi.fn(),
    findByEmailWithPassword: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../../user/user.model", () => ({
  UserModel: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock("../../order/order.repository", () => ({
  OrderRepository: {
    linkGuestOrders: vi.fn().mockResolvedValue(1),
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

function extractOtpFromLastEmail(): string {
  const calls = vi.mocked(sendSmtpEmail).mock.calls;
  const lastHtml = calls[calls.length - 1]?.[2] || "";
  const match = lastHtml.match(/>\s*(\d{6})\s*</);
  if (!match) {
    throw new Error("Could not extract 6-digit OTP from email HTML");
  }
  return match[1];
}

describe("AuthService - Registration Email OTP Flow & Hardening", () => {
  beforeEach(() => {
    cacheStore.clear();
    vi.clearAllMocks();
  });

  it("sends a 6-digit OTP email, stores only salted hash in cache, and completes verified registration", async () => {
    vi.mocked(UserRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(UserRepository.create).mockResolvedValue({
      _id: "user_verified_1",
      email: "rider@example.com",
      firstName: "Vikram",
      lastName: "Kumar",
      role: "customer",
      isActive: true,
      isEmailVerified: true,
      addresses: [],
    } as any);

    const otpResult = await AuthService.sendRegisterOtp({ email: "  Rider@Example.COM " });
    expect(otpResult.email).toBe("rider@example.com");
    expect(otpResult.expiresInSeconds).toBe(600);
    expect(otpResult.cooldownSeconds).toBe(60);

    expect(sendSmtpEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendSmtpEmail).mock.calls[0][0]).toBe("rider@example.com");
    const otp = extractOtpFromLastEmail();

    const storedRecord = cacheStore.get("reg_otp:rider@example.com");
    expect(storedRecord).toBeDefined();
    expect(storedRecord.otpHash).not.toBe(otp);
    expect(storedRecord.salt).toBeTypeOf("string");

    const regResult = await AuthService.register({
      email: "Rider@Example.COM",
      password: "Password@123",
      firstName: "Vikram",
      lastName: "Kumar",
      otp: ` ${otp} `,
    });

    expect(UserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "rider@example.com",
        firstName: "Vikram",
        lastName: "Kumar",
        isEmailVerified: true,
        emailVerifiedAt: expect.any(Date),
      })
    );
    expect(OrderRepository.linkGuestOrders).toHaveBeenCalledWith("rider@example.com", "user_verified_1");
    expect(cacheStore.has("reg_otp:rider@example.com")).toBe(false);
    expect(regResult.user.isEmailVerified).toBe(true);
    expect(regResult.tokens.accessToken).toBe("access_user_verified_1");
  });

  it("rejects sendRegisterOtp with 409 if email is already registered", async () => {
    vi.mocked(UserRepository.findByEmail).mockResolvedValue({
      id: "existing_1",
      email: "rider@example.com",
    } as any);

    await expect(AuthService.sendRegisterOtp({ email: "rider@example.com" })).rejects.toMatchObject({
      statusCode: 409,
      message: "Email already in use",
    });
    expect(sendSmtpEmail).not.toHaveBeenCalled();
  });

  it("rejects register if OTP was never requested or already expired, cleaning cache", async () => {
    vi.mocked(UserRepository.findByEmail).mockResolvedValue(null);

    await expect(
      AuthService.register({
        email: "nootp@example.com",
        password: "Password@123",
        firstName: "Vikram",
        otp: "123456",
      })
    ).rejects.toThrow("Verification code expired or not found");

    // Simulate expired OTP still sitting in cache
    cacheStore.set("reg_otp:expired@example.com", {
      otpHash: "abcd",
      salt: "ef01",
      maxAttempts: 5,
      expiresAt: Date.now() - 1000,
    });
    cacheStore.set("reg_otp_att:expired@example.com", 2);

    await expect(
      AuthService.register({
        email: "expired@example.com",
        password: "Password@123",
        firstName: "Vikram",
        otp: "123456",
      })
    ).rejects.toThrow("Verification code expired or not found");

    expect(cacheStore.has("reg_otp:expired@example.com")).toBe(false);
    expect(cacheStore.has("reg_otp_att:expired@example.com")).toBe(false);
    expect(UserRepository.create).not.toHaveBeenCalled();
  });

  it("invalidates previous OTP and resets attempts counter when a new OTP is resent", async () => {
    vi.mocked(UserRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(UserRepository.create).mockResolvedValue({
      _id: "user_resend_1",
      email: "resend@example.com",
      firstName: "Vikram",
      lastName: "",
      role: "customer",
      isActive: true,
      isEmailVerified: true,
      addresses: [],
    } as any);

    await AuthService.sendRegisterOtp({ email: "resend@example.com" });
    const firstOtp = extractOtpFromLastEmail();
    const wrongOtp = firstOtp === "000000" ? "999999" : "000000";

    // Burn 4 attempts on first OTP
    for (let i = 0; i < 4; i++) {
      await expect(
        AuthService.register({
          email: "resend@example.com",
          password: "Password@123",
          firstName: "Vikram",
          otp: wrongOtp,
        })
      ).rejects.toThrow("Invalid verification code");
    }

    // Cooldown clears and user requests a new OTP
    cacheStore.delete("reg_otp_cd:resend@example.com");
    await AuthService.sendRegisterOtp({ email: "resend@example.com" });
    const secondOtp = extractOtpFromLastEmail();

    // First OTP should no longer work (unless randomInt happened to generate identical 6 digits)
    if (firstOtp !== secondOtp) {
      await expect(
        AuthService.register({
          email: "resend@example.com",
          password: "Password@123",
          firstName: "Vikram",
          otp: firstOtp,
        })
      ).rejects.toThrow("Invalid verification code. 4 attempts remaining.");
    }

    // Second OTP succeeds with fresh attempt budget
    const res = await AuthService.register({
      email: "resend@example.com",
      password: "Password@123",
      firstName: "Vikram",
      otp: secondOtp,
    });
    expect(res.user.email).toBe("resend@example.com");
  });

  it("prevents concurrent sendRegisterOtp race bursts (only 1 email sent)", async () => {
    vi.mocked(UserRepository.findByEmail).mockResolvedValue(null);

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => AuthService.sendRegisterOtp({ email: "burst@example.com" }))
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(9);
    expect(sendSmtpEmail).toHaveBeenCalledTimes(1);
  });

  it("enforces 60s resend cooldown and per-email send cap", async () => {
    vi.mocked(UserRepository.findByEmail).mockResolvedValue(null);

    await AuthService.sendRegisterOtp({ email: "cooldown@example.com" });
    await expect(AuthService.sendRegisterOtp({ email: "cooldown@example.com" })).rejects.toMatchObject({
      statusCode: 429,
    });

    for (let i = 0; i < 4; i++) {
      cacheStore.delete("reg_otp_cd:cooldown@example.com");
      await AuthService.sendRegisterOtp({ email: "cooldown@example.com" });
    }

    cacheStore.delete("reg_otp_cd:cooldown@example.com");
    await expect(AuthService.sendRegisterOtp({ email: "cooldown@example.com" })).rejects.toMatchObject({
      statusCode: 429,
      message: "Too many verification codes requested for this email. Please try again after 15 minutes.",
    });
  });

  it("rolls back OTP and cooldown cache keys if email delivery fails", async () => {
    vi.mocked(UserRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(sendSmtpEmail).mockRejectedValueOnce(new Error("SMTP connection refused"));

    await expect(AuthService.sendRegisterOtp({ email: "smtpfail@example.com" })).rejects.toMatchObject({
      statusCode: 500,
    });

    expect(cacheStore.has("reg_otp:smtpfail@example.com")).toBe(false);
    expect(cacheStore.has("reg_otp_cd:smtpfail@example.com")).toBe(false);
  });

  it("invalidates OTP after 5 wrong verification attempts including parallel brute-force bursts", async () => {
    vi.mocked(UserRepository.findByEmail).mockResolvedValue(null);
    await AuthService.sendRegisterOtp({ email: "brute@example.com" });
    const realOtp = extractOtpFromLastEmail();
    const wrongOtp = realOtp === "000000" ? "999999" : "000000";

    const parallelResults = await Promise.allSettled(
      Array.from({ length: 15 }, () =>
        AuthService.register({
          email: "brute@example.com",
          password: "Password@123",
          firstName: "Brute",
          lastName: "Test",
          otp: wrongOtp,
        })
      )
    );

    expect(parallelResults.every((r) => r.status === "rejected")).toBe(true);
    expect(cacheStore.has("reg_otp:brute@example.com")).toBe(false);
    expect(UserRepository.create).not.toHaveBeenCalled();

    await expect(
      AuthService.register({
        email: "brute@example.com",
        password: "Password@123",
        firstName: "Brute",
        lastName: "Test",
        otp: realOtp,
      })
    ).rejects.toThrow("Verification code expired or not found");
  });

  it("consumes valid OTP atomically so parallel replay attempts cannot create duplicate registrations", async () => {
    vi.mocked(UserRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(UserRepository.create).mockResolvedValue({
      _id: "user_single_1",
      email: "replay@example.com",
      firstName: "Replay",
      lastName: "Guard",
      role: "customer",
      isActive: true,
      isEmailVerified: true,
      addresses: [],
    } as any);

    await AuthService.sendRegisterOtp({ email: "replay@example.com" });
    const realOtp = extractOtpFromLastEmail();

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        AuthService.register({
          email: "replay@example.com",
          password: "Password@123",
          firstName: "Replay",
          lastName: "Guard",
          otp: realOtp,
        })
      )
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    expect(UserRepository.create).toHaveBeenCalledTimes(1);
  });

  it("skips guest order linking on login when account is explicitly marked unverified", async () => {
    const hashedPassword = await bcrypt.hash("Rider@123", 4);
    vi.mocked(UserRepository.findByEmailWithPassword).mockResolvedValue({
      _id: "unverified_1",
      email: "unverified@example.com",
      password: hashedPassword,
      role: "customer",
      isActive: true,
      isEmailVerified: false,
    });

    const loginRes = await AuthService.login({
      email: "unverified@example.com",
      password: "Rider@123",
    });

    expect(loginRes.user.isEmailVerified).toBe(false);
    expect(OrderRepository.linkGuestOrders).not.toHaveBeenCalled();
  });

  it("applies silent 60s cooldown and escapes HTML in forgotPassword emails", async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    vi.mocked(UserModel.findOne).mockResolvedValue({
      _id: "fp_user_1",
      email: "rider@example.com",
      firstName: '<script>alert("xss")</script>',
      save: mockSave,
    } as any);

    await AuthService.forgotPassword({ email: "  RIDER@Example.com " });
    expect(sendSmtpEmail).toHaveBeenCalledTimes(1);
    const htmlSent = vi.mocked(sendSmtpEmail).mock.calls[0][2];
    expect(htmlSent).not.toContain("<script>");
    expect(htmlSent).toContain("&lt;script&gt;");

    // Second request within 60s is silently dropped without throwing
    await AuthService.forgotPassword({ email: "rider@example.com" });
    expect(sendSmtpEmail).toHaveBeenCalledTimes(1);
  });

  it("enforces strong password and 6-digit OTP format in shared validation schemas", () => {
    expect(() =>
      registerSchema.parse({
        email: "rider@example.com",
        password: "weakpassword",
        firstName: "Vikram",
        otp: "123456",
      })
    ).toThrow();

    expect(() =>
      registerSchema.parse({
        email: "rider@example.com",
        password: "Password@123",
        firstName: "Vikram",
        otp: "12ab56",
      })
    ).toThrow();

    expect(() => checkEmailSchema.parse({ email: "not-an-email" })).toThrow();
    expect(checkEmailSchema.parse({ email: "  Test@Example.com " })).toEqual({
      email: "Test@Example.com",
    });
  });
});
