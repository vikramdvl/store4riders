import { NextRequest, NextResponse } from "next/server";

/**
 * Helper to normalize origin URLs (strips trailing slashes and trims whitespace)
 */
const normalizeOrigin = (url: string): string => url.trim().replace(/\/+$/, "");

/**
 * Checks whether an incoming browser Origin header is permitted to perform credentialed CORS / mutating calls.
 */
export const isOriginAllowed = (rawOrigin: string): boolean => {
  const origin = normalizeOrigin(rawOrigin);
  if (!origin) return true;

  const envOrigins = [
    ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",") : []),
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : []),
  ]
    .map(normalizeOrigin)
    .filter(Boolean);

  const productionDomains = [
    "https://store4riders.com",
    "https://www.store4riders.com",
  ];

  const allowedSet = new Set([...productionDomains, ...envOrigins]);

  const isLocalDev =
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:") ||
    origin.startsWith("http://192.168.") ||
    origin.startsWith("http://10.") ||
    origin.startsWith("http://172.") ||
    origin.includes(".local:") ||
    origin === "http://localhost" ||
    origin === "http://127.0.0.1";

  const isStore4RidersDomain =
    origin === "https://store4riders.com" ||
    origin.endsWith(".store4riders.com");

  const isVercelPreview = origin.endsWith(".vercel.app");

  return (
    allowedSet.has(origin) ||
    isStore4RidersDomain ||
    isLocalDev ||
    isVercelPreview
  );
};

/**
 * Enterprise Dynamic CORS Middleware
 * Supports:
 * - Production: store4riders.com & any subdomain (*.store4riders.com)
 * - Environment: FRONTEND_URL & ALLOWED_ORIGINS (supports comma-separated origins for VPS / Hostinger / AWS)
 * - Local Development: localhost & 127.0.0.1 on any port
 * - Testing: *.vercel.app preview branches
 */
export const applyCors = (req: NextRequest, res: NextResponse): NextResponse => {
  const rawOrigin = req.headers.get("origin") || "";
  const origin = normalizeOrigin(rawOrigin);

  const envOrigins = [
    ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",") : []),
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : []),
  ]
    .map(normalizeOrigin)
    .filter(Boolean);

  const isAllowed = isOriginAllowed(origin);

  // Echo matching origin so credentialed requests (cookies/auth) succeed
  if (origin && isAllowed) {
    res.headers.set("Access-Control-Allow-Origin", origin);
  } else if (envOrigins.length > 0) {
    res.headers.set("Access-Control-Allow-Origin", envOrigins[0]);
  } else {
    res.headers.set("Access-Control-Allow-Origin", "https://www.store4riders.com");
  }

  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-auth-scope, X-Auth-Scope, x-request-id, idempotency-key, Idempotency-Key, Accept, Cache-Control, X-Requested-With, Pragma"
  );
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Max-Age", "86400"); // Cache preflight for 24 hours
  return res;
};
