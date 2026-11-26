import { useAuthStore } from "@/stores/useAuthStore";
import { CANONICAL_CATEGORY_PATHS } from "./navCategories";

const MAX_REVALIDATE_PATHS = 30;

function resolveCategoryPathsBySlugs(slugs: Array<string | undefined | null>): string[] {
  const cleanSlugs = Array.from(
    new Set(
      slugs
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim().toLowerCase().replace(/^\/+|\/+$/g, ""))
    )
  );
  if (cleanSlugs.length === 0) return [];

  const slugSet = new Set(cleanSlugs);
  const paths: string[] = [];

  for (const slug of cleanSlugs) {
    paths.push(`/${slug}`);
  }

  for (const canonicalPath of CANONICAL_CATEGORY_PATHS) {
    const lastSeg = canonicalPath.split("/").pop() || "";
    if (slugSet.has(canonicalPath) || slugSet.has(lastSeg)) {
      paths.push(`/${canonicalPath}`);
    }
  }

  return paths;
}

/**
 * Collects exact storefront paths impacted by creating/updating/deleting a product:
 * PDP, listing pages, and all matching parent/subcategory URLs + brand page.
 */
export function collectProductStorefrontPaths(product?: {
  slug?: string;
  categorySlug?: string;
  categorySlugs?: string[];
  brand?: string;
  brandSlug?: string;
} | null): string[] {
  const paths: string[] = ["/", "/products", "/sale"];
  if (!product) return paths;

  if (product.slug) {
    paths.push(`/${product.slug.replace(/^\/+/, "")}`);
  }

  const catSlugs = [
    ...(Array.isArray(product.categorySlugs) ? product.categorySlugs : []),
    product.categorySlug,
  ];
  paths.push(...resolveCategoryPathsBySlugs(catSlugs));

  const rawBrand = product.brandSlug || product.brand;
  if (rawBrand && typeof rawBrand === "string") {
    const brandSlug = rawBrand
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (brandSlug) {
      paths.push(`/brands/${brandSlug}`);
    }
  }

  return paths;
}

/**
 * Collects exact storefront paths impacted by creating/updating a category.
 */
export function collectCategoryStorefrontPaths(category?: { slug?: string } | null): string[] {
  const paths: string[] = ["/", "/products"];
  if (category?.slug) {
    paths.push(...resolveCategoryPathsBySlugs([category.slug]));
  }
  return paths;
}

/**
 * Triggers non-blocking Next.js on-demand ISR revalidation ONLY for the specified
 * storefront paths after an Admin save/delete. Never blocks UI and never purges
 * unrelated pages across the website.
 */
export function revalidateStorefrontPaths(paths: Array<string | undefined | null>): void {
  if (typeof window === "undefined") return;

  const cleanPaths = Array.from(
    new Set(
      paths
        .filter((p): p is string => typeof p === "string")
        .map((p) => p.trim())
        .filter((p) => p.startsWith("/") && !p.startsWith("//"))
    )
  ).slice(0, MAX_REVALIDATE_PATHS);

  if (cleanPaths.length === 0) return;

  const { token } = useAuthStore.getState();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  void fetch("/api/revalidate", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ paths: cleanPaths }),
  }).catch(() => {
    // Non-blocking: ISR TTL will still refresh within 1-5 minutes if offline
  });
}
