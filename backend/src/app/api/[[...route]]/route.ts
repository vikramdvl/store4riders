import { NextRequest, NextResponse } from "next/server";
import { centralRouter } from "@/router";
import { applyCors } from "@/core/middlewares/cors";
import { applySecurityHeaders } from "@/core/middlewares/security";
import { applyRequestId } from "@/core/middlewares/requestId";
import { errorHandler } from "@/core/middlewares/errorHandler";
import { connectToDatabase } from "@/core/database/connection";
import { logger } from "@/core/utils/logger";
import { checkGeneralApiRateLimit } from "@/core/middlewares/rateLimiter";

export const dynamic = "force-dynamic";

const applyHeaders = (response: NextResponse, req: NextRequest): NextResponse => {
  applyCors(req, response);
  applySecurityHeaders(response);
  applyRequestId(req, response);
  return response;
};

const handleRequest = async (
  req: NextRequest, 
  props: { params: Promise<{ route?: string[] }> }
) => {
  // Handle OPTIONS (Preflight) immediately without waiting for database connection
  if (req.method === "OPTIONS") {
    const res = new NextResponse("", { status: 200 });
    return applyHeaders(res, req);
  }

  try {
    await connectToDatabase();
    
    const resolvedParams = props?.params ? await props.params : undefined;
    let routePath = (resolvedParams?.route || []).filter(Boolean);
    
    // Normalize path by stripping any leading 'api' or version prefixes ('v1', 'v2')
    while (routePath.length > 0 && (routePath[0] === "api" || /^v\d+$/i.test(routePath[0]))) {
      routePath = routePath.slice(1);
    }
    
    // Request Logger
    logger.info(`[${req.method}] ${req.nextUrl.pathname}`);

    // Global Baseline Rate Limiter (Protects ALL endpoints from DDoS / scraping)
    // Only internal build/SSG on localhost bypasses; all external internet IPs are strictly rate limited
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const isInternalLocal = ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
    if (!isInternalLocal || !routePath.includes('products')) {
      await checkGeneralApiRateLimit(ip);
    }
    
    // Route to Central Router
    let res = await centralRouter(req, routePath);
    
    if (!res) {
      logger.warn(`[404] Route not found: ${req.method} ${req.nextUrl.pathname} (routePath: ${routePath.join('/')})`);
      res = NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    return applyHeaders(res, req);
  } catch (error) {
    const errorRes = errorHandler(error);
    return applyHeaders(errorRes, req);
  }
};

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
export const OPTIONS = handleRequest;
