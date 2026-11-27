import { NextRequest } from "next/server";

/**
 * Extracts a normalized client IP address from trusted platform/proxy headers.
 * Prefers platform-injected single-IP headers before falling back to X-Forwarded-For.
 */
export function getClientIp(req: NextRequest): string {
  const runtimeIp = (req as { ip?: string }).ip;
  const candidate =
    runtimeIp ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    "127.0.0.1";

  const clean = candidate.trim().slice(0, 64);
  return clean || "127.0.0.1";
}
