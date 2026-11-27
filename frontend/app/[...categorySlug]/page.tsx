import type { Metadata } from "next";
import { Suspense, cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { redirectIfMatchedOrNotFound } from "@/core/utils/urlRedirects";
import { ProductsPageModule } from "@/modules/catalog/components/ProductsPageModule";
import { ProductDetailPageModule } from "@/modules/product-detail/components/ProductDetailPageModule";
import { PolicyPageLayout } from "@/components/layout/PolicyPageLayout";
import ProductsLoading from "../products/loading";
import ProductDetailLoading from "../products/[slug]/loading";
import {
  buildProductSchema,
  buildBreadcrumbSchema,
  buildCollectionSchema,
  buildFAQSchema,
  cleanText,
  getRobotsMetadata,
} from "@/core/utils/seo-schema";
import {
  CATEGORY_SLUG_ALIASES,
  resolveProductBreadcrumbs,
  isCanonicalCategoryPath,
  isKnownCategorySlug,
} from "@/core/utils/navCategories";
import { resolveProductSpecificationsFromTree } from "@store4riders/shared-utils";

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

const getProduct = cache(async (slug: string) => {
  try {
    const res = await fetch(`${API_BASE}/products/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch {
    return null;
  }
});

const getCategoryTree = cache(async (): Promise<any[]> => {
  try {
    const res = await fetch(`${API_BASE}/categories/tree`, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  } catch {
    return [];
  }
});

const getCategoryNode = cache(async (categorySlug: string) => {
  try {
    const tree = await getCategoryTree();
    if (tree.length > 0) {
      const cleanTarget = categorySlug.toLowerCase().trim();
      const targetAliases = CATEGORY_SLUG_ALIASES[cleanTarget] || [];
      const findCategory = (nodes: any[]): any => {
        for (const n of nodes) {
          if (n?.isDeleted) continue;
          const nSlug = (n.slug || "").toLowerCase().trim();
          if (
            nSlug === cleanTarget ||
            nSlug.replace(/s$/, "") === cleanTarget.replace(/s$/, "") ||
            targetAliases.includes(nSlug)
          ) {
            return n;
          }
          if (n.children) {
            const found = findCategory(n.children);
            if (found) return found;
          }
        }
        return null;
      };
      const node = findCategory(tree);
      if (node) return node;
    }

    const singleRes = await fetch(`${API_BASE}/categories/${encodeURIComponent(categorySlug)}`, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(5000),
    });
    if (singleRes.ok) {
      const singleData = await singleRes.json();
      if (singleData?.data) return singleData.data;
    }
    return null;
  } catch {
    return null;
  }
});

const getCategoryInitialProducts = cache(async (category: string) => {
  try {
    const prodRes = await fetch(
      `${API_BASE}/products?category=${encodeURIComponent(category)}&limit=12`,
      {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!prodRes.ok) return undefined;
    const prodData = await prodRes.json();
    const raw = prodData?.data;
    if (!raw) return undefined;

    const items = Array.isArray(raw.items) ? raw.items : Array.isArray(raw) ? raw : [];
    return {
      items,
      totalCount: raw.totalCount ?? items.length,
      page: raw.page ?? 1,
      limit: raw.limit ?? 12,
      totalPages: raw.totalPages ?? Math.max(1, Math.ceil((raw.totalCount ?? items.length) / 12)),
    };
  } catch {
    return undefined;
  }
});

const getPolicyPage = cache(async (candidateSlug: string) => {
  try {
    const res = await fetch(`${API_BASE}/settings`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const cleanTarget = candidateSlug.toLowerCase().trim();
    const policyPages: any[] = json?.data?.policyPages || [];
    return (
      policyPages.find(
        (p: any) =>
          ((p.slug || "").toLowerCase().trim() === cleanTarget ||
            (p.slug || "").toLowerCase().trim().replace(/-/g, "") === cleanTarget.replace(/-/g, "")) &&
          p.isActive !== false
      ) || null
    );
  } catch {
    return null;
  }
});

function hasCategoryFilterParams(resolvedSearchParams: Record<string, string | string[] | undefined>): boolean {
  return Boolean(
    resolvedSearchParams.brand ||
      resolvedSearchParams.search ||
      resolvedSearchParams.q ||
      resolvedSearchParams.colour ||
      resolvedSearchParams.color ||
      resolvedSearchParams.size ||
      resolvedSearchParams.minPrice ||
      resolvedSearchParams.maxPrice ||
      resolvedSearchParams.sort ||
      resolvedSearchParams.helmet_type ||
      resolvedSearchParams.material ||
      resolvedSearchParams.riding_style ||
      resolvedSearchParams.certification ||
      resolvedSearchParams.gender ||
      resolvedSearchParams.motorcycle_model ||
      resolvedSearchParams.inStock ||
      resolvedSearchParams.onSale ||
      (resolvedSearchParams.page && resolvedSearchParams.page !== "1")
  );
}

function buildProductMetadata(product: any, candidateSlug: string): Metadata {
  const title = product.metaTitle?.trim() || `${product.name} | Store4Riders`;
  const cleanDescription =
    product.metaDescription?.trim() ||
    cleanText(product.shortDescription) ||
    `Buy ${product.name} at Store4Riders. Certified motorcycle riding gear with best prices & express delivery.`;
  const keywords = product.metaKeywords
    ? product.metaKeywords
        .split(",")
        .map((k: string) => k.trim())
        .filter(Boolean)
    : ["riding gear", "motorcycle", "store4riders", product.name];
  const imageUrl = product.images?.[0]?.url;
  const canonicalPath = `/${candidateSlug}`;

  return {
    title: {
      absolute: title,
    },
    description: cleanDescription,
    keywords,
    alternates: {
      canonical: canonicalPath,
    },
    robots: getRobotsMetadata(),
    openGraph: {
      title,
      description: cleanDescription,
      url: canonicalPath,
      type: "website",
      siteName: "Store4Riders",
      images: imageUrl ? [{ url: imageUrl, alt: product.name }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: cleanDescription,
      images: imageUrl ? [imageUrl] : [],
    },
  };
}

function buildCategoryMetadata(categoryNode: any, slugArray: string[]): Metadata {
  const title = categoryNode.metaTitle || `${categoryNode.name} - Motorcycle Gear | Store4Riders`;
  const description =
    categoryNode.metaDescription ||
    `Explore the best collection of ${categoryNode.name} at Store4Riders. Certified gear, best prices & express delivery across India.`;
  const canonicalPath = `/${slugArray.join("/")}`;

  return {
    title: {
      absolute: title,
    },
    description,
    keywords: categoryNode.metaKeywords
      ? categoryNode.metaKeywords.split(",").map((k: string) => k.trim())
      : [],
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: "website",
      siteName: "Store4Riders",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: getRobotsMetadata(),
  };
}

function buildPolicyMetadata(policyPage: any, candidateSlug: string): Metadata {
  const title = policyPage.title ? `${policyPage.title} | Store4Riders` : "Store Policy | Store4Riders";
  const description = policyPage.subtitle || "Official Store4Riders policy information.";
  const canonicalPath = `/${candidateSlug}`;

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: canonicalPath,
    },
    robots: getRobotsMetadata(),
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: "website",
      siteName: "Store4Riders",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

async function renderProductPage(
  rawProduct: any,
  candidateSlug: string,
  slugArray: string[],
  resolvedSearchParams: Record<string, string | string[] | undefined>
) {
  // If accessed via a multi-segment path (e.g. /riding-gear/gloves/furygan-jet-d3o-riding-gloves),
  // permanently redirect (HTTP 301) to the canonical root-level product URL: /furygan-jet-d3o-riding-gloves
  if (slugArray.length > 1) {
    const qsParams = new URLSearchParams();
    for (const [key, val] of Object.entries(resolvedSearchParams)) {
      if (Array.isArray(val)) {
        val.forEach((v) => qsParams.append(key, v));
      } else if (typeof val === "string") {
        qsParams.append(key, val);
      }
    }
    const qs = qsParams.toString() ? `?${qsParams.toString()}` : "";
    permanentRedirect(`/${candidateSlug}${qs}`);
  }

  let product = rawProduct;
  const hasBackendTemplate = Array.isArray(product?.categorySpecTemplate) && product.categorySpecTemplate.length > 0;
  const hasBackendSpecs = Array.isArray(product?.specifications);
  const needsTreeResolution = Boolean(product && !hasBackendTemplate && !hasBackendSpecs);
  const needsSpecEnrichment = Boolean(
    product &&
      (needsTreeResolution ||
        (hasBackendTemplate && (!hasBackendSpecs || product.specifications.length <= 1)))
  );
  if (needsSpecEnrichment) {
    const tree = needsTreeResolution ? await getCategoryTree() : [];
    if (!needsTreeResolution || tree.length > 0) {
      const resolved = resolveProductSpecificationsFromTree(tree, product, CATEGORY_SLUG_ALIASES);
      product = {
        ...product,
        categorySpecTemplate: resolved.categorySpecTemplate,
        specifications: resolved.specifications,
      };
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://store4riders.com";
  const productSchema = buildProductSchema(product, siteUrl);

  const breadcrumbLinks = resolveProductBreadcrumbs(product);
  const schemaBreadcrumbItems = breadcrumbLinks.map((b) => ({
    name: b.label,
    url: b.href ? (b.href.startsWith("/") ? b.href : `/${b.href}`) : `/${candidateSlug}`,
  }));

  const breadcrumbSchema = buildBreadcrumbSchema(schemaBreadcrumbItems, siteUrl);
  const faqSchema = buildFAQSchema(product.faqs);

  return (
    <>
      {productSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <Suspense fallback={<ProductDetailLoading />}>
        <ProductDetailPageModule initialProduct={product} slug={candidateSlug} />
      </Suspense>
    </>
  );
}

function renderPolicyPage(policyPage: any, candidateSlug: string) {
  return (
    <PolicyPageLayout
      title={policyPage.title}
      subtitle={policyPage.subtitle}
      badge={policyPage.badge || "Official Store Policy"}
      lastUpdated={policyPage.lastUpdated || "October 2026"}
      currentSlug={`/${candidateSlug}`}
      summaryAlert={
        policyPage.summaryAlertText
          ? {
              type: (policyPage.summaryAlertType || "info") as any,
              title: policyPage.summaryAlertTitle,
              text: policyPage.summaryAlertText,
            }
          : undefined
      }
    >
      <div
        className="policy-content prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-4"
        dangerouslySetInnerHTML={{ __html: policyPage.contentHtml || "" }}
      />
    </PolicyPageLayout>
  );
}

interface CategoryPageProps {
  params: Promise<{ categorySlug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slugArray = resolvedParams.categorySlug || [];
  const candidateSlug = (slugArray[slugArray.length - 1] || "").replace(/\.html$/i, "");

  if (!candidateSlug) {
    return {
      title: "Page Not Found | Store4Riders",
      robots: getRobotsMetadata(false),
    };
  }

  const isCanonicalCategory = isCanonicalCategoryPath(slugArray);

  if (isCanonicalCategory) {
    // Fast-path for unambiguous official storefront category URLs
    const categoryNode = await getCategoryNode(candidateSlug);
    if (categoryNode) {
      return buildCategoryMetadata(categoryNode, slugArray);
    }
    // Symmetrical fallback in case category node isn't in DB
    const product = await getProduct(candidateSlug);
    if (product) {
      return buildProductMetadata(product, candidateSlug);
    }
  } else if (isKnownCategorySlug(candidateSlug)) {
    // Legacy/known category slug: check product & category in parallel preserving Product > Category
    const [product, categoryNode] = await Promise.all([
      getProduct(candidateSlug),
      getCategoryNode(candidateSlug),
    ]);
    if (product) {
      return buildProductMetadata(product, candidateSlug);
    }
    if (categoryNode) {
      return buildCategoryMetadata(categoryNode, slugArray);
    }
  } else {
    // Product slug fast-path: resolve product directly without triggering a 404 category fallback fetch
    const product = await getProduct(candidateSlug);
    if (product) {
      return buildProductMetadata(product, candidateSlug);
    }
    const categoryNode = await getCategoryNode(candidateSlug);
    if (categoryNode) {
      return buildCategoryMetadata(categoryNode, slugArray);
    }
  }

  const policyPage = await getPolicyPage(candidateSlug);
  if (policyPage) {
    return buildPolicyMetadata(policyPage, candidateSlug);
  }

  return {
    title: "Page Not Found | Store4Riders",
    robots: getRobotsMetadata(false),
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const slugArray = resolvedParams.categorySlug || [];
  const candidateSlug = (slugArray[slugArray.length - 1] || "").replace(/\.html$/i, "");

  if (!candidateSlug) {
    notFound();
  }

  const isCanonicalCategory = isCanonicalCategoryPath(slugArray);
  const hasFilterParams = hasCategoryFilterParams(resolvedSearchParams);

  let categoryNode: any = null;
  let initialProductsData: any = undefined;

  if (isCanonicalCategory) {
    // Fast-path for official storefront category URLs: fetch category node + initial products in parallel
    const [resolvedCat, resolvedProds] = await Promise.all([
      getCategoryNode(candidateSlug),
      !hasFilterParams ? getCategoryInitialProducts(candidateSlug) : Promise.resolve(undefined),
    ]);
    categoryNode = resolvedCat;
    initialProductsData = resolvedProds;

    if (!categoryNode) {
      // Fallback: check product then policy page
      const [product, policyPage] = await Promise.all([
        getProduct(candidateSlug),
        getPolicyPage(candidateSlug),
      ]);
      if (product) {
        return renderProductPage(product, candidateSlug, slugArray, resolvedSearchParams);
      }
      if (policyPage) {
        return renderPolicyPage(policyPage, candidateSlug);
      }
      await redirectIfMatchedOrNotFound(`/${slugArray.join("/")}`);
      if (slugArray.length > 1) {
        await redirectIfMatchedOrNotFound(`/${candidateSlug}`);
      }
      notFound();
    }
  } else if (isKnownCategorySlug(candidateSlug)) {
    // Legacy/known category URLs: fetch in parallel while preserving Product -> Category precedence
    const [product, resolvedCat, prefetchedProducts] = await Promise.all([
      getProduct(candidateSlug),
      getCategoryNode(candidateSlug),
      !hasFilterParams ? getCategoryInitialProducts(candidateSlug) : Promise.resolve(undefined),
    ]);

    if (product) {
      return await renderProductPage(product, candidateSlug, slugArray, resolvedSearchParams);
    }

    categoryNode = resolvedCat;
    if (!categoryNode) {
      const policyPage = await getPolicyPage(candidateSlug);
      if (policyPage) {
        return renderPolicyPage(policyPage, candidateSlug);
      }
      await redirectIfMatchedOrNotFound(`/${slugArray.join("/")}`);
      if (slugArray.length > 1) {
        await redirectIfMatchedOrNotFound(`/${candidateSlug}`);
      }
      notFound();
    }

    if (!hasFilterParams) {
      initialProductsData = prefetchedProducts;
    }
  } else {
    // Product slug fast-path: resolve product directly without awaiting category 404 or settings fetches
    const product = await getProduct(candidateSlug);
    if (product) {
      return await renderProductPage(product, candidateSlug, slugArray, resolvedSearchParams);
    }

    const [resolvedCat, policyPage] = await Promise.all([
      getCategoryNode(candidateSlug),
      getPolicyPage(candidateSlug),
    ]);

    categoryNode = resolvedCat;
    if (categoryNode) {
      if (!hasFilterParams) {
        initialProductsData = await getCategoryInitialProducts(candidateSlug);
      }
    } else if (policyPage) {
      return renderPolicyPage(policyPage, candidateSlug);
    } else {
      await redirectIfMatchedOrNotFound(`/${slugArray.join("/")}`);
      if (slugArray.length > 1) {
        await redirectIfMatchedOrNotFound(`/${candidateSlug}`);
      }
      notFound();
    }
  }

  const collectionProducts: any[] = initialProductsData?.items || [];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://store4riders.com";

  // Schema: CollectionPage with ItemList
  const categoryName =
    categoryNode.name || candidateSlug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const cleanRawDesc = (categoryNode.metaDescription || categoryNode.description || "")
    .replace(/<[^>]*>?/gm, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const categoryDescription =
    cleanRawDesc ||
    `Explore our certified range of ${categoryName} at Store4Riders. High quality motorcycle gear with fast delivery across India.`;
  const currentUrl = `${siteUrl}/${slugArray.join("/")}`;

  const collectionSchema = buildCollectionSchema({
    title: categoryName,
    description: categoryDescription,
    url: currentUrl,
    siteUrl,
    products: collectionProducts,
  });

  // Schema: BreadcrumbList
  const breadcrumbElements: Array<{ name: string; url: string }> = [
    {
      name: "Home",
      url: "/",
    },
  ];

  let accumulatedPath = "";
  slugArray.forEach((seg, idx) => {
    accumulatedPath += `/${seg}`;
    const isLast = idx === slugArray.length - 1;
    const segName =
      isLast && categoryNode?.name
        ? categoryNode.name
        : seg.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    breadcrumbElements.push({
      name: segName,
      url: accumulatedPath,
    });
  });

  const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbElements, siteUrl);
  const faqSchema = buildFAQSchema(categoryNode?.faqs);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <Suspense fallback={<ProductsLoading />}>
        <ProductsPageModule
          initialCategoryNode={categoryNode}
          initialProductsData={initialProductsData}
        />
      </Suspense>
    </>
  );
}
