"use client";

import { usePathname } from "next/navigation";
import ProductsLoading from "../products/loading";
import ProductDetailLoading from "../products/[slug]/loading";
import { ALL_CATEGORY_SLUGS, isKnownCategorySlug } from "@/core/utils/navCategories";

function isCategoryRoute(pathname: string): boolean {
  if (!pathname) return false;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return false;

  // Check last segment (candidate category slug)
  const lastSegment = segments[segments.length - 1].replace(/\.html$/i, "").toLowerCase().trim();
  if (isKnownCategorySlug(lastSegment)) {
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
