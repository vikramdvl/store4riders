import { NextRequest, NextResponse } from "next/server";

function resolvePublicOrigin(req: NextRequest): string {
  const forwardedHost =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host")?.split(",")[0]?.trim();
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const fallbackOrigin = req.nextUrl.origin || "http://localhost:3000";

  if (forwardedHost && !forwardedHost.startsWith("127.0.0.1") && !forwardedHost.startsWith("0.0.0.0")) {
    const proto = forwardedProto || (fallbackOrigin.startsWith("https") ? "https" : "http");
    return `${proto}://${forwardedHost}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || fallbackOrigin;
}

function normalizeBackendBase(): string {
  const backendApiUrl =
    process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
  return backendApiUrl.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
}

function buildSafeRedirectFromBackendLocation(location: string, publicOrigin: string): string | null {
  try {
    const parsed = new URL(location, publicOrigin);
    if (parsed.pathname.startsWith("/checkout") || parsed.pathname.startsWith("/account")) {
      return `${publicOrigin}${parsed.pathname}${parsed.search}`;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ status: string }> }
) {
  const { status } = await params;
  const origin = resolvePublicOrigin(req);

  try {
    const rawBody = await req.text();
    const parsedParams = new URLSearchParams(rawBody);
    const txnid = parsedParams.get("txnid") || "";
    const payuStatus = (parsedParams.get("status") || "").trim().toLowerCase();
    const unmappedstatus = (parsedParams.get("unmappedstatus") || "").trim().toLowerCase();
    const errorMsg = (parsedParams.get("error_Message") || "").trim().toLowerCase();

    const isCancelled =
      unmappedstatus.includes("cancel") ||
      errorMsg.includes("cancel") ||
      status === "cancel" ||
      status === "cancelled" ||
      payuStatus === "cancel" ||
      payuStatus === "cancelled";

    const orderParam = txnid ? `&orderId=${encodeURIComponent(txnid)}` : "";
    const cleanBackend = normalizeBackendBase();

    // Forward to backend only when backend lives on a separate origin (avoid recursive loop)
    if (cleanBackend && cleanBackend !== origin) {
      try {
        const clientIp = req.headers.get("x-forwarded-for") || "";
        const backendRes = await fetch(`${cleanBackend}/api/v1/orders/webhook/payu/${status}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...(clientIp ? { "x-forwarded-for": clientIp } : {}),
          },
          body: rawBody,
          redirect: "manual",
          signal: AbortSignal.timeout(15000),
        });

        const location = backendRes.headers.get("location");
        if (location) {
          const targetUrl = buildSafeRedirectFromBackendLocation(location, origin);
          if (targetUrl) {
            return NextResponse.redirect(targetUrl, 303);
          }
        }

        if (backendRes.ok && status === "success" && payuStatus === "success") {
          return NextResponse.redirect(`${origin}/checkout?success=true${orderParam}`, 303);
        }
      } catch {
        // Fall through to verifying flow so frontend reconciles via sync-payment
      }
    }

    if (isCancelled) {
      return NextResponse.redirect(`${origin}/checkout?cancelled=true${orderParam}`, 303);
    }

    if (txnid) {
      return NextResponse.redirect(`${origin}/checkout?verifying=true${orderParam}`, 303);
    }

    return NextResponse.redirect(`${origin}/checkout?failed=true`, 303);
  } catch {
    return NextResponse.redirect(`${origin}/checkout?failed=true`, 303);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ status: string }> }
) {
  const { status } = await params;
  const origin = resolvePublicOrigin(req);
  const txnid = req.nextUrl.searchParams.get("txnid") || req.nextUrl.searchParams.get("orderId") || "";
  const orderParam = txnid ? `&orderId=${encodeURIComponent(txnid)}` : "";
  const cleanBackend = normalizeBackendBase();

  if (cleanBackend && cleanBackend !== origin && req.nextUrl.search) {
    try {
      const backendRes = await fetch(
        `${cleanBackend}/api/v1/orders/webhook/payu/${status}${req.nextUrl.search}`,
        {
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.timeout(15000),
        }
      );
      const location = backendRes.headers.get("location");
      if (location) {
        const targetUrl = buildSafeRedirectFromBackendLocation(location, origin);
        if (targetUrl) {
          return NextResponse.redirect(targetUrl, 303);
        }
      }
    } catch {
      // Fall through safely
    }
  }

  if (status === "cancel" || status === "cancelled") {
    return NextResponse.redirect(`${origin}/checkout?cancelled=true${orderParam}`, 303);
  }
  if (txnid) {
    return NextResponse.redirect(`${origin}/checkout?verifying=true${orderParam}`, 303);
  }
  if (status === "success") {
    return NextResponse.redirect(`${origin}/checkout?success=true${orderParam}`, 303);
  }
  return NextResponse.redirect(`${origin}/checkout?failed=true${orderParam}`, 303);
}
