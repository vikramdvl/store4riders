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

export const fetchGuidesPageSeo = cache(async (): Promise<GuidesPageSeoData | null> => {
  try {
    const res = await fetch(`${getBlogApiBase()}/blog/page-seo`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(3000),
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
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(4000),
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
  try {
    const res = await fetch(
      `${getBlogApiBase()}/blog/categories/${encodeURIComponent(slug)}`,
      {
        next: { revalidate: 30 },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch {
    return null;
  }
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
        next: { revalidate: 30 },
        signal: AbortSignal.timeout(5000),
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

  try {
    const res = await fetch(
      `${getBlogApiBase()}/blog/posts/${encodeURIComponent(slug)}`,
      {
        next: { revalidate: 30 },
        signal: AbortSignal.timeout(4000),
      }
    );

    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch {
    return null;
  }
});

export const fetchRelatedBlogPosts = cache(
  async (slug: string, limit = 3): Promise<IBlogPost[]> => {
    if (!slug) return [];
    try {
      const res = await fetch(
        `${getBlogApiBase()}/blog/posts/${encodeURIComponent(slug)}/related?limit=${limit}`,
        {
          next: { revalidate: 30 },
          signal: AbortSignal.timeout(4000),
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
