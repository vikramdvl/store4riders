import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { redirectIfMatchedOrNotFound } from "@/core/utils/urlRedirects";
import { getRobotsMetadata } from "@/core/utils/seo-schema";
import {
  GuidesCategoryModule,
  fetchBlogCategoryBySlug,
  fetchPublicBlogCategories,
  fetchPublicBlogPosts,
  fetchStaticBlogCategorySlugs,
  buildBlogCollectionSchema,
  buildBreadcrumbSchema,
} from "@/modules/guides";

export const revalidate = 3600;
export const dynamicParams = true;

interface Props {
  params: Promise<{ categorySlug: string }>;
  searchParams?: Promise<{ page?: string }>;
}

export async function generateStaticParams() {
  const categorySlugs = await fetchStaticBlogCategorySlugs();
  return categorySlugs.map((categorySlug) => ({
    categorySlug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = await fetchBlogCategoryBySlug(categorySlug);

  if (!category || category.isActive === false) {
    return {
      title: "Guides Category Not Found | Store4Riders",
      description: "The requested guides category could not be found.",
    };
  }

  const title = category.metaTitle?.trim() || `${category.name} Guides | Store4Riders`;
  const description =
    category.metaDescription?.trim() ||
    category.description?.trim() ||
    `Expert motorcycle guides and advice for ${category.name} at Store4Riders.`;
  const keywords = category.metaKeywords
    ? category.metaKeywords
        .split(",")
        .map((k: string) => k.trim())
        .filter(Boolean)
    : [category.name, "motorcycle guides", "riding advice", "store4riders"];
  const canonical = `https://www.store4riders.com/guides/category/${category.slug}`;

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

export default async function GuidesCategoryPage({ params, searchParams }: Props) {
  const [{ categorySlug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve<{ page?: string }>({}),
  ]);
  const parsedPage = parseInt(resolvedSearchParams?.page || "1", 10);
  const initialPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [category, categories, initialPostsResult] = await Promise.all([
    fetchBlogCategoryBySlug(categorySlug),
    fetchPublicBlogCategories(),
    fetchPublicBlogPosts(initialPage, 18, categorySlug.toLowerCase()),
  ]);

  if (!category || category.isActive === false) {
    await redirectIfMatchedOrNotFound(`/guides/category/${categorySlug}`);
    notFound();
  }

  const postsData =
    category.slug.toLowerCase() === categorySlug.toLowerCase()
      ? initialPostsResult
      : await fetchPublicBlogPosts(initialPage, 18, category.slug);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.store4riders.com";

  const collectionSchema = buildBlogCollectionSchema(
    `${category.name} Guides`,
    category.metaDescription?.trim() ||
      category.description ||
      `Expert motorcycle guides and advice for ${category.name}`,
    postsData.items,
    `${siteUrl}/guides/category/${category.slug}`,
    siteUrl
  );
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: "Home", url: "/" },
      { name: "Guides", url: "/guides" },
      { name: category.name, url: `/guides/category/${category.slug}` },
    ],
    siteUrl
  );

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
      <GuidesCategoryModule
        categorySlug={category.slug}
        initialPage={initialPage}
        initialCategory={category}
        initialPostsData={postsData}
        initialCategories={categories}
      />
    </>
  );
}
