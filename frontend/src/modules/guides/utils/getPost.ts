import { cache } from "react";
import { IBlogCategory, IBlogPost } from "@store4riders/shared-types";

export interface PaginatedBlogResult {
  items: IBlogPost[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GuidesPageSeoData {
  heroTitle?: string;
  heroDescription?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
}

export function getBlogApiBase(): string {
  const rawApiBase = (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000/api/v1"
  ).replace(/\/+$/, "");

  if (rawApiBase.includes("/v1")) return rawApiBase;
  if (rawApiBase.endsWith("/api")) return `${rawApiBase}/v1`;
  return `${rawApiBase}/api/v1`;
}

const BLOG_FETCH_TIMEOUT_MS = 10000;
const BLOG_REVALIDATE_SECONDS = 3600;
const BLOG_TRANSIENT_RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const STATIC_BLOG_PRERENDER_LIMIT = 15;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRateLimitDelayMs(res: Response, attempt: number, isBuildPhase: boolean): number {
  const retryAfterRaw = res.headers?.get?.("retry-after");
  if (retryAfterRaw) {
    const parsedSec = Number(retryAfterRaw);
    if (Number.isFinite(parsedSec) && parsedSec >= 0) {
      return Math.min(parsedSec * 1000, 65_000);
    }
  }
  return isBuildPhase ? 15_000 * (attempt + 1) : 1_500 * (attempt + 1);
}

function isConnectionRefusedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { code?: string; cause?: { code?: string; errors?: Array<{ code?: string }> } };
  if (anyErr.code === "ECONNREFUSED" || anyErr.code === "ENOTFOUND") return true;
  if (anyErr.cause) {
    if (anyErr.cause.code === "ECONNREFUSED" || anyErr.cause.code === "ENOTFOUND") return true;
    if (Array.isArray(anyErr.cause.errors)) {
      return anyErr.cause.errors.some(
        (e) => e?.code === "ECONNREFUSED" || e?.code === "ENOTFOUND"
      );
    }
  }
  return false;
}

async function fetchBlogWithRetry(url: string): Promise<Response | null> {
  let lastError: unknown;
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  let maxAttempts = 2;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        next: { revalidate: BLOG_REVALIDATE_SECONDS },
        signal: AbortSignal.timeout(BLOG_FETCH_TIMEOUT_MS),
      });
      if (res.ok || res.status === 404 || !BLOG_TRANSIENT_RETRY_STATUSES.has(res.status)) {
        return res;
      }
      lastError = new Error(`Blog API responded with status ${res.status}`);
      if (res.status === 429) {
        maxAttempts = 4;
        if (attempt + 1 < maxAttempts) {
          await sleep(getRateLimitDelayMs(res, attempt, isBuildPhase));
        }
      }
    } catch (err) {
      if (isBuildPhase && isConnectionRefusedError(err)) {
        return null;
      }
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Failed to fetch blog resource");
}

const BLOG_SLUG_ALIASES: Record<string, string> = {
  "motorcycle-rain-riding-what-to-wear": "stay-dry-while-riding-motorcycle-in-rains",
  "motorcycle-security-touring-theft-prevention": "motorcycle-security-while-touring",
  "motorcycle-touring-with-dslr-camera": "carrying-dslr-lenses-drone-motorcycle-tour",
};

export function resolveBlogSlugAlias(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  return BLOG_SLUG_ALIASES[normalized] || slug;
}

export const fetchGuidesPageSeo = cache(async (): Promise<GuidesPageSeoData | null> => {
  try {
    const res = await fetch(`${getBlogApiBase()}/blog/page-seo`, {
      next: { revalidate: BLOG_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(BLOG_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch {
    return null;
  }
});

export const fetchPublicBlogCategories = cache(async (): Promise<IBlogCategory[]> => {
  try {
    const res = await fetch(`${getBlogApiBase()}/blog/categories`, {
      next: { revalidate: BLOG_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(BLOG_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch {
    return [];
  }
});

export const fetchBlogCategoryBySlug = cache(async (slug: string): Promise<IBlogCategory | null> => {
  if (!slug) return null;
  const res = await fetchBlogWithRetry(
    `${getBlogApiBase()}/blog/categories/${encodeURIComponent(slug)}`
  );
  if (!res || res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch blog category "${slug}" (status ${res.status})`);
  }
  const json = await res.json();
  return json?.data || null;
});

export const fetchPublicBlogPosts = cache(
  async (
    page = 1,
    limit = 18,
    categorySlug = "",
    tag = "",
    search = ""
  ): Promise<PaginatedBlogResult> => {
    const query = new URLSearchParams();
    query.set("page", String(page));
    query.set("limit", String(limit));
    if (categorySlug) query.set("categorySlug", categorySlug);
    if (tag) query.set("tag", tag);
    if (search) query.set("search", search);

    try {
      const res = await fetch(`${getBlogApiBase()}/blog/posts?${query.toString()}`, {
        next: { revalidate: BLOG_REVALIDATE_SECONDS },
        signal: AbortSignal.timeout(BLOG_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        return { items: [], totalCount: 0, page, limit, totalPages: 1 };
      }
      const json = await res.json();
      const data = json?.data;
      return {
        items: Array.isArray(data?.items) ? data.items : [],
        totalCount: typeof data?.totalCount === "number" ? data.totalCount : 0,
        page: typeof data?.page === "number" ? data.page : page,
        limit: typeof data?.limit === "number" ? data.limit : limit,
        totalPages: typeof data?.totalPages === "number" ? data.totalPages : 1,
      };
    } catch {
      return { items: [], totalCount: 0, page, limit, totalPages: 1 };
    }
  }
);

export const fetchGuideOrBlogPost = cache(async (slug: string): Promise<IBlogPost | null> => {
  if (!slug) return null;
  const targetSlug = resolveBlogSlugAlias(slug);

  const res = await fetchBlogWithRetry(
    `${getBlogApiBase()}/blog/posts/${encodeURIComponent(targetSlug)}`
  );

  if (!res || res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch blog post "${targetSlug}" (status ${res.status})`);
  }
  const json = await res.json();
  return json?.data || null;
});

/**
 * Fetches live category slugs specifically for generateStaticParams without
 * relying on stale `.next/cache` entries when the backend API is offline during build.
 */
export async function fetchStaticBlogCategorySlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${getBlogApiBase()}/blog/categories`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const categories: IBlogCategory[] = Array.isArray(json?.data) ? json.data : [];
    return categories.map((cat) => cat.slug).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Fetches live post slugs specifically for generateStaticParams without
 * relying on stale `.next/cache` entries when the backend API is offline during build.
 */
export async function fetchStaticBlogPostSlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${getBlogApiBase()}/blog/posts?page=1&limit=${STATIC_BLOG_PRERENDER_LIMIT}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const items: IBlogPost[] = Array.isArray(json?.data?.items) ? json.data.items : [];
    return items.map((post) => post.slug).filter(Boolean);
  } catch {
    return [];
  }
}

export const fetchRelatedBlogPosts = cache(
  async (slug: string, limit = 3): Promise<IBlogPost[]> => {
    if (!slug) return [];
    const targetSlug = resolveBlogSlugAlias(slug);
    try {
      const res = await fetch(
        `${getBlogApiBase()}/blog/posts/${encodeURIComponent(targetSlug)}/related?limit=${limit}`,
        {
          next: { revalidate: BLOG_REVALIDATE_SECONDS },
          signal: AbortSignal.timeout(BLOG_FETCH_TIMEOUT_MS),
        }
      );
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : [];
    } catch {
      return [];
    }
  }
);
