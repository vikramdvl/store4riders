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

async function fetchBlogWithRetry(url: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        next: { revalidate: BLOG_REVALIDATE_SECONDS },
        signal: AbortSignal.timeout(BLOG_FETCH_TIMEOUT_MS),
      });
      if (res.ok || res.status === 404 || !BLOG_TRANSIENT_RETRY_STATUSES.has(res.status)) {
        return res;
      }
      lastError = new Error(`Blog API responded with status ${res.status}`);
    } catch (err) {
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
  if (res.status === 404) return null;
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

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch blog post "${targetSlug}" (status ${res.status})`);
  }
  const json = await res.json();
  return json?.data || null;
});

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
