import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

/**
 * On-Demand Cache Invalidation Endpoint
 * Allows the Admin Panel to instantly purge and refresh Vercel/VPS cache
 * for a specific path in 0 seconds.
 * 
 * Usage: GET /api/revalidate?path=/agv-k1-s-helmet&secret=s4r-secret-revalidate-token
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
    // Revalidates the page at the specified path instantly
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path, timestamp: Date.now() });
  } catch (err: any) {
    return NextResponse.json({ message: "Error revalidating path", error: err?.message }, { status: 500 });
  }
}
