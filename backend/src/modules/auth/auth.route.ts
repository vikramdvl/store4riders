import { NextRequest, NextResponse } from "next/server";
/**
 * @file auth.route.ts
 * @description Defines API endpoints for Authentication and maps them to Controller methods.
 */
import { AuthController } from "./auth.controller";
import {
  checkRateLimit,
  checkAdminAuthRateLimit,
  checkRegisterOtpRateLimit,
  checkEmailRateLimit,
} from "../../core/middlewares/rateLimiter";
import { getClientIp } from "../../core/utils/clientIp";

export async function authRouter(req: NextRequest, routePath: string[]): Promise<NextResponse | null> {
  const method = req.method;
  const pathLen = routePath.length;
  const ip = getClientIp(req);

  if (method === "POST" && pathLen === 1) {
    const action = routePath[0];

    if (action === "login") {
      const scope = req.headers.get("x-auth-scope") || req.nextUrl.searchParams.get("scope");
      if (scope === "admin") {
        await checkAdminAuthRateLimit(ip);
      } else {
        await checkRateLimit(ip);
      }
      return await AuthController.login(req);
    }

    if (action === "send-register-otp") {
      await checkRegisterOtpRateLimit(ip);
      return await AuthController.sendRegisterOtp(req);
    }

    if (action === "register") {
      await checkRateLimit(ip);
      return await AuthController.register(req);
    }

    if (action === "refresh") {
      return await AuthController.refresh(req);
    }

    if (action === "logout") {
      return await AuthController.logout(req);
    }

    if (action === "forgot-password") {
      await checkRateLimit(ip);
      return await AuthController.forgotPassword(req);
    }

    if (action === "reset-password") {
      await checkRateLimit(ip);
      return await AuthController.resetPassword(req);
    }

    if (action === "check-email") {
      await checkEmailRateLimit(ip);
      return await AuthController.checkEmail(req);
    }
  }

  if (method === "GET" && pathLen === 1 && routePath[0] === "me") {
    return await AuthController.me(req);
  }

  return null;
}
