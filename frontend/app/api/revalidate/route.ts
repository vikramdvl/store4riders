import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

const rawApiBase = (
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000/api/v1"
).replace(/\/+$/, "");

const API_BASE = rawApiBase.includes("/v1")
  ? rawApiBase
  : rawApiBase.endsWith("/api")
  ? `${rawApiBase}/v1`
  : `${rawApiBase}/api/v1`;

function sanitizePaths(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const valid = input
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim())
    .filter(
      (p) =>
        p.startsWith("/") &&
        !p.startsWith("//") &&
        !p.includes("..") &&
        p.length <= 300
    );
  return Array.from(new Set(valid)).slice(0, 30);
}

async function verifyAdminRequest(request: NextRequest): Promise<boolean> {
  const configuredSecret = process.env.REVALIDATION_SECRET;
  const headerSecret = request.headers.get("x-revalidate-secret");
  if (configuredSecret && headerSecret && headerSecret === configuredSecret) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  const cookieToken = request.cookies.get("accessToken")?.value;
  if (!authHeader && !cookieToken) {
    return false;
  }

  const headers: Record<string, string> = {};
  if (authHeader) {
    headers.Authorization = authHeader;
  } else if (cookieToken) {
    headers.Authorization = `Bearer ${cookieToken}`;
  }
  const rawCookie = request.headers.get("cookie");
  if (rawCookie) {
    headers.Cookie = rawCookie;
  }

  try {
    const res = await fetch(`${API_BASE}/users/me`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return false;
    const json = await res.json();
    const role = json?.data?.role;
    return Boolean(role && role !== "customer");
  } catch {
    return false;
  }
}

/**
 * On-Demand Cache Invalidation Endpoint
 * Allows the Admin Panel to instantly purge and refresh Next.js ISR cache
 * for specific edited paths in 0 seconds without affecting the rest of the site.
 *
 * Usage: GET /api/revalidate?path=/agv-k1-s-helmet&secret=...
 *    or: POST /api/revalidate { paths: ["/guides", "/guides/post/my-post"] }
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const path = request.nextUrl.searchParams.get("path");

  const expectedSecret = process.env.REVALIDATION_SECRET || "s4r-secret-revalidate-token";
  if (secret !== expectedSecret) {
    return NextResponse.json({ message: "Invalid revalidation secret" }, { status: 401 });
  }

  if (!path) {
    return NextResponse.json({ message: "Missing path parameter" }, { status: 400 });
  }

  try {
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path, timestamp: Date.now() });
  } catch (err: any) {
    return NextResponse.json({ message: "Error revalidating path", error: err?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const isAuthorized = await verifyAdminRequest(request);
  if (!isAuthorized) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const paths = sanitizePaths(body?.paths);
  if (paths.length === 0) {
    return NextResponse.json({ message: "At least one valid path is required" }, { status: 400 });
  }

  try {
    for (const path of paths) {
      revalidatePath(path);
    }
    return NextResponse.json({
      revalidated: true,
      paths,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json({ message: "Error revalidating paths", error: err?.message }, { status: 500 });
  }
}
