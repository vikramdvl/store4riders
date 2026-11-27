import { NextRequest, NextResponse } from "next/server";

const isProd = process.env.NODE_ENV === "production";

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-auth-scope, X-Auth-Scope, x-request-id, idempotency-key, Idempotency-Key, Accept, Cache-Control, X-Requested-With, Pragma",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};

const verifyDocsSessionToken = async (tokenValue?: string): Promise<boolean> => {
  if (!tokenValue || !tokenValue.includes(".")) return false;
  const secret = process.env.JWT_ACCESS_SECRET || process.env.DOCS_PASS || "";
  if (!secret) return false;

  const [expStr, providedHex] = tokenValue.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) > exp) return false;
  if (!/^[a-f0-9]{64}$/i.test(providedHex || "")) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(`docs:${exp}`));
    const expectedHex = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const normalizedProvided = providedHex.toLowerCase();
    if (expectedHex.length !== normalizedProvided.length) return false;
    let diff = 0;
    for (let i = 0; i < expectedHex.length; i += 1) {
      diff |= expectedHex.charCodeAt(i) ^ normalizedProvided.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
};

function resolveOrigin(origin: string): string {
  if (!isProd && origin) return origin;
  const envOrigins = [
    ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",") : []),
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : []),
  ]
    .map((u) => u.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  const allowedSet = new Set([
    "https://store4riders.com",
    "https://www.store4riders.com",
    ...envOrigins,
  ]);

  const isAllowed =
    allowedSet.has(origin) ||
    origin === "https://store4riders.com" ||
    origin.endsWith(".store4riders.com") ||
    origin.endsWith(".vercel.app");

  if (origin && isAllowed) return origin;
  return envOrigins[0] || "https://www.store4riders.com";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Docs Protection Logic (from proxy.ts)
  if (pathname.startsWith("/docs") || pathname.startsWith("/api/docs")) {
    if (pathname !== "/docs/login") {
      const authCookie = req.cookies.get("docs_auth_session");
      const isValidDocsCookie = await verifyDocsSessionToken(authCookie?.value);
      if (!isValidDocsCookie) {
        const loginUrl = new URL("/docs/login", req.url);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  // 2. CORS Logic
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const origin = req.headers.get("origin") || "";
  const allowedOrigin = resolveOrigin(origin);

  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        ...CORS_HEADERS,
      },
    });
  }

  const response = NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/docs/:path*"],
};
