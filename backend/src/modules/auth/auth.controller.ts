import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "./auth.service";
import { ApiResponse } from "../../core/response/ApiResponse";
import { AuthValidator } from "./auth.validator";
import { CUSTOMER_REFRESH_TTL_SECONDS } from "../../core/utils/jwt";

const isProd = process.env.NODE_ENV === "production";

const setCookies = (
  res: NextResponse,
  accessToken: string,
  refreshToken: string,
  maxAgeSeconds: number = CUSTOMER_REFRESH_TTL_SECONDS
) => {
  res.cookies.set("accessToken", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
  res.cookies.set("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
};

const clearCookies = (res: NextResponse) => {
  res.cookies.set("accessToken", "", {
    maxAge: 0,
    expires: new Date(0),
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
  });
  res.cookies.set("refreshToken", "", {
    maxAge: 0,
    expires: new Date(0),
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
  });
};

/**
 * @class AuthController
 * @description Minimal HTTP controller for Authentication.
 * Responsibilities:
 * 1. Validate payloads via AuthValidator.
 * 2. Delegate to AuthService for business logic and JWT generation.
 * 3. Securely attach tokens to `httpOnly` cookies before returning the response.
 */
export class AuthController {
  
  static async register(req: NextRequest) {
    const validatedData = await AuthValidator.validateRegister(req);
    const result = await AuthService.register(validatedData);
    
    // Return tokens and user in data payload for mobile apps / frontend, while also setting cookies for web
    const res = ApiResponse.success({ 
      accessToken: result.tokens.accessToken, 
      refreshToken: result.tokens.refreshToken,
      user: result.user 
    }, "Registered successfully", 201);
    setCookies(res, result.tokens.accessToken, result.tokens.refreshToken, result.sessionMaxAgeSeconds);
    return res;
  }

  static async login(req: NextRequest) {
    const validatedData = await AuthValidator.validateLogin(req);
    try {
      const result = await AuthService.login(validatedData);

      if (result.user.role && result.user.role !== "customer") {
        const { AuditLogService } = await import("../audit-log/audit-log.service");
        await AuditLogService.record({
          category: "AUTH",
          action: "ADMIN_LOGIN_SUCCESS",
          severity: "info",
          status: "success",
          actor: {
            userId: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
          },
          resource: { type: "Session", id: result.user.id, label: result.user.email },
          req,
          message: `Staff login succeeded for ${result.user.email} (${result.user.role})`,
        });
      }

      const res = ApiResponse.success({ 
        accessToken: result.tokens.accessToken, 
        refreshToken: result.tokens.refreshToken,
        user: result.user 
      }, "Logged in successfully");
      setCookies(res, result.tokens.accessToken, result.tokens.refreshToken, result.sessionMaxAgeSeconds);
      return res;
    } catch (err: any) {
      const { AuditLogService } = await import("../audit-log/audit-log.service");
      await AuditLogService.record({
        category: "AUTH",
        action: "LOGIN_FAILED",
        severity: "warning",
        status: "failure",
        actor: { email: validatedData.email },
        resource: { type: "Session", label: validatedData.email },
        req,
        message: `Failed login attempt for ${validatedData.email}: ${err?.message || "Invalid credentials"}`,
      });
      throw err;
    }
  }

  static async refresh(req: NextRequest) {
    let oldRefreshToken = req.cookies.get("refreshToken")?.value;
    if (!oldRefreshToken) {
      try {
        const body = await req.json();
        oldRefreshToken = body?.refreshToken;
      } catch (e) {}
    }

    if (!oldRefreshToken) {
      const res = ApiResponse.error("No refresh token", 401);
      clearCookies(res);
      return res;
    }

    try {
      const tokens = await AuthService.refreshToken(oldRefreshToken);

      const res = ApiResponse.success({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }, "Token refreshed");
      setCookies(res, tokens.accessToken, tokens.refreshToken, tokens.sessionMaxAgeSeconds);
      return res;
    } catch (error: any) {
      const status = typeof error?.statusCode === "number" ? error.statusCode : 401;
      const message = error?.message || "Invalid refresh token";
      const res = ApiResponse.error(message, status);
      if (status === 401 || status === 403) {
        clearCookies(res);
      }
      return res;
    }
  }

  static async logout(req: NextRequest) {
    let refreshToken = req.cookies.get("refreshToken")?.value;
    if (!refreshToken) {
      try {
        const body = await req.json();
        refreshToken = body?.refreshToken;
      } catch {}
    }

    let loggedOutUserId: string | undefined;
    try {
      const { extractUserFromAuth } = await import("../../core/middlewares/auth");
      const userId = extractUserFromAuth(req);
      if (userId) {
        loggedOutUserId = userId;
        await AuthService.logout(userId);
      }
    } catch {
      // Access token may already be expired; fall back to refresh token subject if present
      if (refreshToken) {
        try {
          const { verifyToken } = await import("../../core/utils/jwt");
          const decoded = verifyToken(refreshToken, true);
          if (decoded?.userId) {
            loggedOutUserId = decoded.userId;
            await AuthService.logout(decoded.userId);
          }
        } catch {}
      }
    }

    if (loggedOutUserId) {
      const { AuditLogService } = await import("../audit-log/audit-log.service");
      await AuditLogService.record({
        category: "AUTH",
        action: "USER_LOGOUT",
        severity: "info",
        status: "success",
        actorUserId: loggedOutUserId,
        resource: { type: "Session", id: loggedOutUserId },
        req,
        message: "User signed out and session tokens were revoked",
      });
    }

    if (refreshToken) {
      try {
        const { setCache } = await import("../../core/cache/redis");
        await setCache(`bl_token_${refreshToken}`, "1", CUSTOMER_REFRESH_TTL_SECONDS);
      } catch {}
    }

    const res = ApiResponse.success(null, "Logged out successfully");
    clearCookies(res);
    return res;
  }

  static async forgotPassword(req: NextRequest) {
    const validatedData = await AuthValidator.validateForgotPassword(req);
    await AuthService.forgotPassword(validatedData);
    return ApiResponse.success(null, "If an account exists with that email, a reset link has been sent");
  }

  static async resetPassword(req: NextRequest) {
    const validatedData = await AuthValidator.validateResetPassword(req);
    await AuthService.resetPassword(validatedData);
    return ApiResponse.success(null, "Password reset successfully");
  }

  static async checkEmail(req: NextRequest) {
    try {
      const body = await req.json();
      const email = body?.email?.toLowerCase()?.trim();
      if (!email) {
        return ApiResponse.error("Email is required", 400);
      }
      
      const { UserModel } = await import("../user/user.model");
      const user = await UserModel.findOne({ email }).select("_id").lean().exec();
      
      return ApiResponse.success({ exists: !!user }, "Email checked successfully");
    } catch (e: any) {
      return ApiResponse.error("Failed to check email", 500);
    }
  }
}
