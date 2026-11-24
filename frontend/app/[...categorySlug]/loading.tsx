"use client";

import { usePathname } from "next/navigation";
import ProductsLoading from "../products/loading";
import ProductDetailLoading from "../products/[slug]/loading";
import { CATEGORY_SLUG_ALIASES, CORE_PRODUCT_PARENTS } from "@/core/utils/navCategories";
import { DEFAULT_NAV_ITEMS } from "@/modules/homepage/components/navbar/nav.constants";

// Fast lookup set of all known category slugs
const ALL_CATEGORY_SLUGS = new Set<string>();

// 1. Core category parents
Object.values(CORE_PRODUCT_PARENTS).forEach((c) => {
  ALL_CATEGORY_SLUGS.add(c.slug.toLowerCase());
  const clean = c.linkUrl.replace(/^\//, "").toLowerCase();
  if (clean) ALL_CATEGORY_SLUGS.add(clean);
});

// 2. Category aliases & taxonomy keys
Object.entries(CATEGORY_SLUG_ALIASES).forEach(([key, aliases]) => {
  ALL_CATEGORY_SLUGS.add(key.toLowerCase());
  aliases.forEach((a) => ALL_CATEGORY_SLUGS.add(a.toLowerCase()));
});

// 3. Navbar item URLs & subcategory links
DEFAULT_NAV_ITEMS.forEach((item) => {
  const itemSlug = item.href.replace(/^\//, "").split("/").pop()?.toLowerCase();
  if (itemSlug) ALL_CATEGORY_SLUGS.add(itemSlug);
  item.megaMenuItems?.forEach((group) => {
    if (group.groupHref) {
      const gSlug = group.groupHref.replace(/^\//, "").split("/").pop()?.toLowerCase();
      if (gSlug) ALL_CATEGORY_SLUGS.add(gSlug);
    }
    group.items?.forEach((sub) => {
      const sSlug = sub.href.replace(/^\//, "").split("/").pop()?.toLowerCase();
      if (sSlug) ALL_CATEGORY_SLUGS.add(sSlug);
    });
  });
});

function isCategoryRoute(pathname: string): boolean {
  if (!pathname) return false;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return false;

  // Check last segment (candidate category slug)
  const lastSegment = segments[segments.length - 1].replace(/\.html$/i, "").toLowerCase().trim();
  if (ALL_CATEGORY_SLUGS.has(lastSegment)) {
    return true;
  }

  // Check full path without leading slash
  const fullPath = segments.join("/").replace(/\.html$/i, "").toLowerCase().trim();
  if (ALL_CATEGORY_SLUGS.has(fullPath)) {
    return true;
  }

  return false;
}

export default function CategoryOrProductLoading() {
  const pathname = usePathname() || (typeof window !== "undefined" ? window.location.pathname : "");
  const isCategory = isCategoryRoute(pathname);

  if (isCategory) {
    return <ProductsLoading />;
  }

  return <ProductDetailLoading />;
}
