import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getClientIp } from "../../../core/utils/clientIp";
import { authRouter } from "../auth.route";
import { AuthController } from "../auth.controller";
import { AuthService } from "../auth.service";
import { AuthValidator } from "../auth.validator";
import { checkEmailRateLimit } from "../../../core/middlewares/rateLimiter";
import { UserRepository } from "../../user/user.repository";
import { UserService } from "../../user/user.service";
import { OrderController } from "../../order/order.controller";
import { OrderRepository } from "../../order/order.repository";
import { UserModel } from "../../user/user.model";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { AppError } from "../../../core/errors/AppError";

vi.mock("../../../core/middlewares/rateLimiter", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(undefined),
  checkAdminAuthRateLimit: vi.fn().mockResolvedValue(undefined),
  checkRegisterOtpRateLimit: vi.fn().mockResolvedValue(undefined),
  checkEmailRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../core/middlewares/auth", () => ({
  extractUserFromAuth: vi.fn(() => "user_test_1"),
}));

vi.mock("../../user/user.repository", () => ({
  UserRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock("../../user/user.model", () => ({
  UserModel: {
    findById: vi.fn(),
  },
}));

vi.mock("../../order/order.repository", () => ({
  OrderRepository: {
    linkGuestOrders: vi.fn().mockResolvedValue(1),
    findByUserId: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../audit-log/audit-log.service", () => ({
  AuditLogService: {
    record: vi.fn().mockResolvedValue(undefined),
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

describe("Auth Route, Validator & Guest-Order Linking Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers platform single-IP headers before falling back to X-Forwarded-For", () => {
    const cfReq = new NextRequest("https://api.store4riders.com/api/v1/auth/login", {
      headers: {
        "cf-connecting-ip": "203.0.113.10",
        "x-forwarded-for": "198.51.100.1, 10.0.0.1",
      },
    });
    expect(getClientIp(cfReq)).toBe("203.0.113.10");

    const xffReq = new NextRequest("https://api.store4riders.com/api/v1/auth/login", {
      headers: {
        "x-forwarded-for": "198.51.100.77, 10.0.0.1",
      },
    });
    expect(getClientIp(xffReq)).toBe("198.51.100.77");

    const fallbackReq = new NextRequest("https://api.store4riders.com/api/v1/auth/login");
    expect(getClientIp(fallbackReq)).toBe("127.0.0.1");
  });

  it("applies dedicated rate limiting and Zod email validation on POST /auth/check-email", async () => {
    vi.mocked(UserRepository.findByEmail).mockResolvedValue({ id: "u1", email: "rider@example.com" } as any);

    const validReq = new NextRequest("https://api.store4riders.com/api/v1/auth/check-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-real-ip": "203.0.113.55",
      },
      body: JSON.stringify({ email: "Rider@Example.com" }),
    });

    const res = await authRouter(validReq, ["check-email"]);
    expect(checkEmailRateLimit).toHaveBeenCalledWith("203.0.113.55");
    expect(res?.status).toBe(200);
    const json = await res?.json();
    expect(json?.data?.exists).toBe(true);

    const invalidReq = new NextRequest("https://api.store4riders.com/api/v1/auth/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid-email" }),
    });

    await expect(authRouter(invalidReq, ["check-email"])).rejects.toThrow();
  });

  it("returns 400 ValidationError instead of 500 on malformed JSON bodies across auth validators", async () => {
    const makeMalformedReq = () =>
      new NextRequest("https://api.store4riders.com/api/v1/auth/send-register-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad-json",
      });

    await expect(AuthValidator.validateSendRegisterOtp(makeMalformedReq())).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid JSON payload",
    });
    await expect(AuthValidator.validateCheckEmail(makeMalformedReq())).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid JSON payload",
    });
    await expect(AuthValidator.validateRegister(makeMalformedReq())).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid JSON payload",
    });
    await expect(AuthValidator.validateLogin(makeMalformedReq())).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid JSON payload",
    });
  });

  it("records audit log events when OTP rate limit hits 429 or registration fails", async () => {
    const otpSpy = vi.spyOn(AuthService, "sendRegisterOtp").mockRejectedValueOnce(
      new AppError("Please wait 45 seconds", 429)
    );

    const otpReq = new NextRequest("https://api.store4riders.com/api/v1/auth/send-register-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "spammer@example.com" }),
    });

    await expect(AuthController.sendRegisterOtp(otpReq)).rejects.toMatchObject({ statusCode: 429 });
    expect(AuditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "AUTH",
        action: "REGISTER_OTP_RATE_LIMITED",
        status: "failure",
      })
    );
    otpSpy.mockRestore();

    const regSpy = vi.spyOn(AuthService, "register").mockRejectedValueOnce(
      new AppError("Invalid verification code", 400)
    );
    const regReq = new NextRequest("https://api.store4riders.com/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "spammer@example.com",
        password: "Password@123",
        firstName: "Vikram",
        otp: "000000",
      }),
    });

    await expect(AuthController.register(regReq)).rejects.toMatchObject({ statusCode: 400 });
    expect(AuditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "AUTH",
        action: "REGISTER_FAILED",
        status: "failure",
      })
    );
    regSpy.mockRestore();
  });

  it("blocks guest order linking in OrderController.myOrders and UserService.getProfile when isEmailVerified is false", async () => {
    vi.mocked(UserModel.findById).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({
            _id: "user_test_1",
            email: "unverified@example.com",
            isEmailVerified: false,
          }),
        }),
      }),
    } as any);

    const ordersReq = new NextRequest("https://api.store4riders.com/api/v1/orders/me");
    const ordersRes = await OrderController.myOrders(ordersReq);
    expect(ordersRes.status).toBe(200);
    expect(OrderRepository.linkGuestOrders).not.toHaveBeenCalled();

    vi.mocked(UserRepository.findById).mockResolvedValue({
      id: "user_test_1",
      email: "unverified@example.com",
      firstName: "Vikram",
      lastName: "Kumar",
      phone: "",
      addresses: [],
      role: "customer",
      isActive: true,
      isEmailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await UserService.getProfile("user_test_1");
    expect(OrderRepository.linkGuestOrders).not.toHaveBeenCalled();
  });

  it("allows guest order linking for OTP-verified and legacy (undefined isEmailVerified) accounts", async () => {
    vi.mocked(UserModel.findById).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({
            _id: "user_test_1",
            email: "verified@example.com",
            isEmailVerified: true,
          }),
        }),
      }),
    } as any);

    await OrderController.myOrders(new NextRequest("https://api.store4riders.com/api/v1/orders/me"));
    expect(OrderRepository.linkGuestOrders).toHaveBeenCalledWith("verified@example.com", "user_test_1");

    vi.clearAllMocks();
    vi.mocked(UserRepository.findById).mockResolvedValue({
      id: "user_legacy_1",
      email: "legacy@example.com",
      firstName: "Legacy",
      lastName: "User",
      phone: "",
      addresses: [],
      role: "customer",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await UserService.getProfile("user_legacy_1");
    expect(OrderRepository.linkGuestOrders).toHaveBeenCalledWith("legacy@example.com", "user_legacy_1");
  });
});
