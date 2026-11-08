import { NextRequest, NextResponse } from "next/server";
/**
 * @file auth.route.ts
 * @description Defines API endpoints for Authentication and maps them to Controller methods.
 */
import { AuthController } from "./auth.controller";
import { checkRateLimit, checkAdminAuthRateLimit } from "../../core/middlewares/rateLimiter";

export async function authRouter(req: NextRequest, routePath: string[]): Promise<NextResponse | null> {
  const method = req.method;
  const pathLen = routePath.length;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

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
      // Intentionally NOT using checkRateLimit (which is 5 attempts / 15 mins) here.
      // It is already protected by the global GENERAL_API rate limit.
      // Otherwise, checking email on checkout easily blocks the user from logging in.
      return await AuthController.checkEmail(req);
    }
  }

  return null;
}
