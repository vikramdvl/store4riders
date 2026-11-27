import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { AuthService } from "./auth.service";
import { ApiResponse } from "../../core/response/ApiResponse";
import { AuthValidator } from "./auth.validator";
import {
  CUSTOMER_REFRESH_TTL_SECONDS,
  resolveAuthScope,
  type AuthScope,
} from "../../core/utils/jwt";
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_REFRESH_COOKIE,
  CUSTOMER_ACCESS_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
  extractVerifiedAuth,
} from "../../core/middlewares/auth";

const MULTI_TENANT_PUBLIC_SUFFIXES = [".vercel.app", ".netlify.app", ".onrender.com", ".herokuapp.com"];

const getRegistrableSite = (hostname: string): string => {
  const normalized = hostname.toLowerCase();
  if (MULTI_TENANT_PUBLIC_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) {
    return normalized;
  }
  const parts = normalized.split(".");
  return parts.length <= 2 ? normalized : parts.slice(-2).join(".");
};

const getCookieOptions = (req: NextRequest, maxAge?: number) => {
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const isHttps = forwardedProto === "https" || req.nextUrl.protocol === "https:";
  const origin = req.headers.get("origin") || "";
  const reqHostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host || "";
  const reqHostname = reqHostHeader.split(":")[0]?.toLowerCase() || "";

  let isCrossSite = false;
  if (origin && reqHostname) {
    try {
      const originHostname = new URL(origin).hostname.toLowerCase();
      isCrossSite = getRegistrableSite(originHostname) !== getRegistrableSite(reqHostname);
    } catch {}
  }

  // Same-site subdomains/localhost use Lax; genuine cross-site HTTPS (e.g. *.vercel.app) requires None + Secure
  const sameSite: "none" | "lax" = isHttps && isCrossSite ? "none" : "lax";

  return {
    httpOnly: true,
    secure: isHttps,
    sameSite,
    path: "/",
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN.trim() } : {}),
    ...(typeof maxAge === "number" ? { maxAge } : {}),
  };
};

const getCookieNamesForScope = (scope: AuthScope) =>
  scope === "admin"
    ? { access: ADMIN_ACCESS_COOKIE, refresh: ADMIN_REFRESH_COOKIE }
    : { access: CUSTOMER_ACCESS_COOKIE, refresh: CUSTOMER_REFRESH_COOKIE };

const setCookies = (
  req: NextRequest,
  res: NextResponse,
  accessToken: string,
  refreshToken: string,
  maxAgeSeconds: number = CUSTOMER_REFRESH_TTL_SECONDS,
  scope: AuthScope = "customer"
) => {
  const { access, refresh } = getCookieNamesForScope(scope);
  const cookieOpts = getCookieOptions(req, maxAgeSeconds);
  res.cookies.set(access, accessToken, cookieOpts);
  res.cookies.set(refresh, refreshToken, cookieOpts);
};

const clearCookies = (req: NextRequest, res: NextResponse, scope?: AuthScope) => {
  const scopesToClear: AuthScope[] = scope ? [scope] : ["customer", "admin"];
  const expiredOpts = {
    ...getCookieOptions(req, 0),
    expires: new Date(0),
  };

  for (const s of scopesToClear) {
    const { access, refresh } = getCookieNamesForScope(s);
    res.cookies.set(access, "", expiredOpts);
    res.cookies.set(refresh, "", expiredOpts);
  }
};

const resolveRequestedScope = (req: NextRequest, explicit?: string): AuthScope | undefined => {
  const candidate = explicit || req.headers.get("x-auth-scope") || req.nextUrl.searchParams.get("scope");
  if (candidate === "admin") return "admin";
  if (candidate === "customer") return "customer";
  return undefined;
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
  
  static async sendRegisterOtp(req: NextRequest) {
    const validatedData = await AuthValidator.validateSendRegisterOtp(req);
    try {
      const result = await AuthService.sendRegisterOtp(validatedData);
      return ApiResponse.success(result, "Verification code sent to your email", 200);
    } catch (err: any) {
      if (err?.statusCode === 429) {
        try {
          const { AuditLogService } = await import("../audit-log/audit-log.service");
          await AuditLogService.record({
            category: "AUTH",
            action: "REGISTER_OTP_RATE_LIMITED",
            severity: "warning",
            status: "failure",
            actor: { email: validatedData.email },
            resource: { type: "User", label: validatedData.email },
            req,
            message: `OTP rate limit/cooldown triggered for ${validatedData.email}: ${err?.message}`,
          });
        } catch {}
      }
      throw err;
    }
  }

  static async register(req: NextRequest) {
    const validatedData = await AuthValidator.validateRegister(req);
    try {
      const result = await AuthService.register(validatedData);

      try {
        const { AuditLogService } = await import("../audit-log/audit-log.service");
        await AuditLogService.record({
          category: "AUTH",
          action: "USER_REGISTER",
          severity: "info",
          status: "success",
          actor: {
            userId: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
          },
          resource: { type: "User", id: result.user.id, label: result.user.email },
          req,
          message: `Registered verified account for ${result.user.email}`,
        });
      } catch {}

      // Return tokens and user in data payload for mobile apps / frontend, while also setting cookies for web
      const res = ApiResponse.success({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        user: result.user,
      }, "Registered successfully", 201);
      setCookies(req, res, result.tokens.accessToken, result.tokens.refreshToken, result.sessionMaxAgeSeconds, "customer");
      return res;
    } catch (err: any) {
      try {
        const { AuditLogService } = await import("../audit-log/audit-log.service");
        await AuditLogService.record({
          category: "AUTH",
          action: "REGISTER_FAILED",
          severity: "warning",
          status: "failure",
          actor: { email: validatedData.email },
          resource: { type: "User", label: validatedData.email },
          req,
          message: `Registration failed for ${validatedData.email}: ${err?.message || "Verification failed"}`,
        });
      } catch {}
      throw err;
    }
  }

  static async login(req: NextRequest) {
    const validatedData = await AuthValidator.validateLogin(req);
    const requestScope = resolveRequestedScope(req, validatedData.scope) || "customer";
    try {
      const result = await AuthService.login(validatedData, requestScope);

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
        user: result.user,
        scope: result.scope,
      }, "Logged in successfully");
      setCookies(req, res, result.tokens.accessToken, result.tokens.refreshToken, result.sessionMaxAgeSeconds, result.scope);
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
        message: `Failed login attempt (${requestScope}) for ${validatedData.email}: ${err?.message || "Invalid credentials"}`,
      });
      throw err;
    }
  }

  static async refresh(req: NextRequest) {
    const requestedScope = resolveRequestedScope(req);
    let oldRefreshToken =
      requestedScope === "admin"
        ? req.cookies.get(ADMIN_REFRESH_COOKIE)?.value
        : requestedScope === "customer"
        ? req.cookies.get(CUSTOMER_REFRESH_COOKIE)?.value
        : req.cookies.get(CUSTOMER_REFRESH_COOKIE)?.value || req.cookies.get(ADMIN_REFRESH_COOKIE)?.value;

    if (!oldRefreshToken) {
      try {
        const body = await req.json();
        oldRefreshToken = body?.refreshToken;
      } catch (e) {}
    }

    if (!oldRefreshToken) {
      const res = ApiResponse.error("No refresh token", 401);
      clearCookies(req, res, requestedScope);
      return res;
    }

    try {
      const tokens = await AuthService.refreshToken(oldRefreshToken, requestedScope);

      const res = ApiResponse.success({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        scope: tokens.scope,
      }, "Token refreshed");
      setCookies(req, res, tokens.accessToken, tokens.refreshToken, tokens.sessionMaxAgeSeconds, tokens.scope);
      return res;
    } catch (error: any) {
      const status = typeof error?.statusCode === "number" ? error.statusCode : 401;
      const message = error?.message || "Invalid refresh token";
      const res = ApiResponse.error(message, status);
      if (status === 401 || status === 403) {
        clearCookies(req, res, requestedScope);
      }
      return res;
    }
  }

  static async logout(req: NextRequest) {
    const requestedScope = resolveRequestedScope(req);
    let refreshToken =
      requestedScope === "admin"
        ? req.cookies.get(ADMIN_REFRESH_COOKIE)?.value
        : requestedScope === "customer"
        ? req.cookies.get(CUSTOMER_REFRESH_COOKIE)?.value
        : req.cookies.get(CUSTOMER_REFRESH_COOKIE)?.value || req.cookies.get(ADMIN_REFRESH_COOKIE)?.value;

    if (!refreshToken) {
      try {
        const body = await req.json();
        refreshToken = body?.refreshToken;
      } catch {}
    }

    let loggedOutUserId: string | undefined;
    let resolvedClearScope: AuthScope | undefined = requestedScope;
    try {
      const { extractAuthContext } = await import("../../core/middlewares/auth");
      const decoded = extractAuthContext(req, { requiredScope: requestedScope });
      if (decoded?.userId) {
        loggedOutUserId = decoded.userId;
        if (!resolvedClearScope && decoded.scope) {
          resolvedClearScope = decoded.scope;
        }
        await AuthService.logout(decoded.userId);
      }
    } catch {
      // Access token may already be expired; fall back to refresh token subject if present
      if (refreshToken) {
        try {
          const { verifyToken } = await import("../../core/utils/jwt");
          const decoded = verifyToken(refreshToken, true);
          if (decoded?.userId) {
            loggedOutUserId = decoded.userId;
            if (!resolvedClearScope && decoded.scope) {
              resolvedClearScope = decoded.scope;
            }
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
        const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
        await Promise.all([
          setCache(`bl_token_${refreshToken}`, "1", CUSTOMER_REFRESH_TTL_SECONDS),
          setCache(`bl_rt_used_${tokenHash}`, String(Date.now()), CUSTOMER_REFRESH_TTL_SECONDS),
        ]);
      } catch {}
    }

    const res = ApiResponse.success(null, "Logged out successfully");
    clearCookies(req, res, resolvedClearScope);
    return res;
  }

  static async me(req: NextRequest) {
    const requestedScope = resolveRequestedScope(req);
    const { userId } = await extractVerifiedAuth(req, { requiredScope: requestedScope });
    const { UserRepository } = await import("../user/user.repository");
    const user = await UserRepository.findById(userId);
    if (!user || user.isActive === false) {
      return ApiResponse.error("Account is disabled or not found", 401);
    }

    return ApiResponse.success(
      {
        user: {
          id: (user as any)._id?.toString() || user.id || userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName || "",
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
          role: user.role || "customer",
          phone: user.phone || "",
          isEmailVerified: user.isEmailVerified !== false,
          addresses: user.addresses || [],
        },
        scope: resolveAuthScope(user.role),
      },
      "Session verified"
    );
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
    const validatedData = await AuthValidator.validateCheckEmail(req);
    const email = validatedData.email.toLowerCase().trim();

    const { UserRepository } = await import("../user/user.repository");
    const user = await UserRepository.findByEmail(email);

    return ApiResponse.success({ exists: !!user }, "Email checked successfully");
  }
}
