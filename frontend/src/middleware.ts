import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getCachedUrlRedirectMap,
  normalizeUrlRedirectPath,
} from "@/core/utils/urlRedirects";

const REDIRECT_SKIP_PREFIXES = [
  "/admin",
  "/api",
  "/_next",
  "/login",
  "/register",
  "/cart",
  "/checkout",
  "/account",
];

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const { pathname } = request.nextUrl;

  // Immediate Edge Defense: Block vulnerability scanners and exploit probes from invoking serverless origin
  const lowerPath = pathname.toLowerCase();
  if (
    lowerPath.endsWith(".php") ||
    lowerPath.endsWith(".env") ||
    lowerPath.endsWith(".git") ||
    lowerPath.endsWith(".asp") ||
    lowerPath.endsWith(".aspx") ||
    lowerPath.endsWith(".sql") ||
    lowerPath.startsWith("/wp-") ||
    lowerPath.startsWith("/cgi-bin") ||
    lowerPath.startsWith("/phpmyadmin") ||
    lowerPath.includes("xmlrpc.php")
  ) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // 301 Permanent Redirect: Strip legacy .html extension from old Magento/HTML URLs
  if (pathname.endsWith(".html") || lowerPath.endsWith(".html")) {
    const cleanPath = pathname.replace(/\.html$/i, "") || "/";
    const destinationUrl = new URL(`${cleanPath}${request.nextUrl.search}`, request.url);
    return NextResponse.redirect(destinationUrl, 301);
  }

  // Block known bandwidth-hogging crawlers that ignore robots.txt and drain origin bandwidth
  const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
  if (
    userAgent.includes("bytespider") ||
    userAgent.includes("semrushbot") ||
    userAgent.includes("dotbot") ||
    userAgent.includes("mj12bot")
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const secretPath = process.env.ADMIN_SECRET_PATH || process.env.NEXT_PUBLIC_ADMIN_SECRET_PATH || "rider-staff-gate";

  // Check environment: local development & Vercel previews allow testing without domain restrictions
  const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.includes(".local");
  const isVercelPreview = host.endsWith(".vercel.app");

  // Helper to attach development SEO headers (X-Robots-Tag: noindex, nofollow)
  const applySeoHeaders = (res: NextResponse) => {
    const isIndexingAllowed = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";
    if (!isIndexingAllowed) {
      res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    }
    return res;
  };

  // 1. If accessing via the dedicated admin domain (e.g. admin.store4riders.com)
  if (host.startsWith("admin.")) {
    // If navigating to root on the admin subdomain, rewrite to /admin
    if (pathname === "/") {
      return applySeoHeaders(NextResponse.rewrite(new URL("/admin", request.url)));
    }
    // Convenience: direct /secret-slug rewrites to /admin/secret-slug
    if (pathname === `/${secretPath}`) {
      return applySeoHeaders(NextResponse.rewrite(new URL(`/admin/${secretPath}`, request.url)));
    }
    return applySeoHeaders(NextResponse.next());
  }

  // 2. If accessing via the public storefront on IP 1 (store4riders.com / www)
  // Block any public attempt to access /admin or any admin subpath
  if (!isLocalhost && !isVercelPreview) {
    if (pathname.startsWith("/admin")) {
      return new NextResponse("Not Found", { status: 404 });
    }
  }

  // 3. Dynamic Page Redirects (301/302) for storefront GET/HEAD requests
  if (request.method === "GET" || request.method === "HEAD") {
    const shouldSkipRedirect =
      pathname === "/" ||
      REDIRECT_SKIP_PREFIXES.some(
        (prefix) => lowerPath === prefix || lowerPath.startsWith(`${prefix}/`)
      ) ||
      /\.[a-z0-9]{2,5}$/i.test(lowerPath);

    if (!shouldSkipRedirect) {
      const normalizedPath = normalizeUrlRedirectPath(pathname);
      const redirectMap = await getCachedUrlRedirectMap();
      const matched = redirectMap.get(normalizedPath);
      if (matched && matched.toPath && matched.toPath !== normalizedPath) {
        const destination = /^https?:\/\//i.test(matched.toPath)
          ? matched.toPath
          : new URL(
              matched.toPath.includes("?")
                ? matched.toPath
                : `${matched.toPath}${request.nextUrl.search}`,
              request.url
            );
        return NextResponse.redirect(destination, matched.statusCode || 301);
      }
    }
  }

  return applySeoHeaders(NextResponse.next());
}

export const config = {
  // Apply middleware to application routes, excluding static assets, images, icons, and api
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|api/).*)",
  ],
};
