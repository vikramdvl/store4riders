import type { Metadata } from "next";
import { cache, Suspense } from "react";
import { BrandsDirectoryModule } from "@/modules/brands";
import { getRobotsMetadata } from "@/core/utils/seo-schema";

export const revalidate = 1800;

const rawApiBase = (
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000/api/v1"
).replace(/\/+$/, "");
const API_BASE = rawApiBase.includes("/v1")
  ? rawApiBase
  : rawApiBase.endsWith("/api")
  ? `${rawApiBase}/v1`
  : `${rawApiBase}/api/v1`;

const getBrandsPageSeo = cache(async () => {
  try {
    const res = await fetch(`${API_BASE}/brands/page-seo`, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch {
    return null;
  }
});

const getPublicBrands = cache(async () => {
  try {
    const res = await fetch(`${API_BASE}/brands`, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return undefined;
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : undefined;
  } catch {
    return undefined;
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getBrandsPageSeo();
  const title =
    seo?.metaTitle?.trim() || "Shop By Brand | All Motorcycle Brands A–Z | Store4Riders";
  const description =
    seo?.metaDescription?.trim() ||
    "Browse authentic motorcycle helmets, riding gear, accessories, and performance parts by brand. Explore our complete A-Z brand directory at Store4Riders.";
  const keywords = seo?.metaKeywords
    ? seo.metaKeywords.split(",").map((k: string) => k.trim()).filter(Boolean)
    : [
        "motorcycle brands",
        "riding gear brands",
        "helmet brands",
        "store4riders",
        "buy motorcycle gear by brand",
      ];
  const canonical = "https://www.store4riders.com/brands";

  return {
    title: {
      absolute: title,
    },
    description,
    keywords,
    alternates: {
      canonical,
    },
    robots: getRobotsMetadata(),
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Store4Riders",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function BrandsPage() {
  const [pageConfig, initialBrands] = await Promise.all([
    getBrandsPageSeo(),
    getPublicBrands(),
  ]);
  return (
    <Suspense fallback={null}>
      <BrandsDirectoryModule initialConfig={pageConfig} initialBrands={initialBrands} />
    </Suspense>
  );
}
