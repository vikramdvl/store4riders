import { permanentRedirect, redirect } from "next/navigation";
import { IUrlRedirectResolveResult } from "@store4riders/shared-types";

export function getApiBaseUrl(): string {
  const rawApiBase = (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000/api/v1"
  ).replace(/\/+$/, "");

  if (rawApiBase.includes("/v1")) return rawApiBase;
  if (rawApiBase.endsWith("/api")) return `${rawApiBase}/v1`;
  return `${rawApiBase}/api/v1`;
}

export function normalizeUrlRedirectPath(pathname: string): string {
  const clean = (pathname || "")
    .split("?")[0]
    .split("#")[0]
    .replace(/\.html$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/")
    .toLowerCase();
  return clean ? `/${clean}` : "/";
}

export interface CachedRedirectRule {
  fromPath: string;
  toPath: string;
  statusCode: 301 | 302;
}

const REDIRECT_MAP_TTL_MS = 300_000;
let cachedMap: Map<string, CachedRedirectRule> | null = null;
let cachedMapExpiresAt = 0;

/**
 * Lightweight in-memory TTL cache for Edge/Middleware URL redirect lookups.
 * Keeps normal storefront page loads at 0ms overhead while syncing admin changes within 5 minutes.
 */
export async function getCachedUrlRedirectMap(): Promise<Map<string, CachedRedirectRule>> {
  const now = Date.now();
  if (cachedMap && now < cachedMapExpiresAt) {
    return cachedMap;
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/url-redirects/active-map`, {
      cache: "no-store",
      signal: AbortSignal.timeout(600),
    });
    if (res.ok) {
      const json = await res.json();
      const items: CachedRedirectRule[] = Array.isArray(json?.data) ? json.data : [];
      const nextMap = new Map<string, CachedRedirectRule>();
      for (const item of items) {
        if (item?.fromPath && item?.toPath) {
          nextMap.set(normalizeUrlRedirectPath(item.fromPath), item);
        }
      }
      cachedMap = nextMap;
      cachedMapExpiresAt = now + REDIRECT_MAP_TTL_MS;
      return nextMap;
    }
  } catch {
    // Non-blocking: return stale cache or empty map if API is unreachable
  }

  return cachedMap || new Map();
}

export async function resolveServerUrlRedirect(
  pathname: string
): Promise<IUrlRedirectResolveResult> {
  const normalized = normalizeUrlRedirectPath(pathname);
  if (!normalized || normalized === "/") {
    return { matched: false };
  }

  try {
    const res = await fetch(
      `${getApiBaseUrl()}/url-redirects/resolve?path=${encodeURIComponent(normalized)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(1500),
      }
    );
    if (!res.ok) return { matched: false };
    const json = await res.json();
    const data = json?.data;
    if (data?.matched && data?.toPath) {
      return {
        matched: true,
        toPath: data.toPath,
        statusCode: data.statusCode === 302 ? 302 : 301,
      };
    }
  } catch {
    // Graceful fallback when backend is unreachable
  }

  return { matched: false };
}

export async function redirectIfMatchedOrNotFound(pathname: string): Promise<void> {
  const match = await resolveServerUrlRedirect(pathname);
  if (match.matched && match.toPath) {
    if (match.statusCode === 302) {
      redirect(match.toPath);
    }
    permanentRedirect(match.toPath);
  }
}
