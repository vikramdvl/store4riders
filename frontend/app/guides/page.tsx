import type { Metadata } from "next";
import { getRobotsMetadata } from "@/core/utils/seo-schema";
import {
  GuidesHubModule,
  fetchGuidesPageSeo,
  fetchPublicBlogCategories,
  fetchPublicBlogPosts,
  buildBlogCollectionSchema,
  buildBreadcrumbSchema,
} from "@/modules/guides";

export const revalidate = 30;

export async function generateMetadata(): Promise<Metadata> {
  const seo = await fetchGuidesPageSeo();
  const title =
    seo?.metaTitle?.trim() || "Motorcycle Guides & Expert Advice | Store4Riders";
  const description =
    seo?.metaDescription?.trim() ||
    "Comprehensive buying guides, gear care advice, maintenance checklists, and touring preparation tips by Store4Riders.";
  const keywords = seo?.metaKeywords
    ? seo.metaKeywords.split(",").map((k: string) => k.trim()).filter(Boolean)
    : [
        "motorcycle guides",
        "riding gear guides",
        "helmet guide",
        "chain maintenance",
        "touring checklist",
        "store4riders",
      ];
  const canonical = "https://www.store4riders.com/guides";

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

export default async function GuidesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tag?: string; q?: string; page?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const initialTag = resolvedParams?.tag || "";
  const initialSearch = resolvedParams?.q || "";
  const parsedPage = parseInt(resolvedParams?.page || "1", 10);
  const initialPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [seo, postsData, categories] = await Promise.all([
    fetchGuidesPageSeo(),
    fetchPublicBlogPosts(initialPage, 18, "", initialTag, initialSearch.trim()),
    fetchPublicBlogCategories(),
  ]);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.store4riders.com";
  const title =
    seo?.metaTitle?.trim() || "Motorcycle Guides & Expert Advice";
  const description =
    seo?.metaDescription?.trim() ||
    "Comprehensive buying guides, gear care advice, maintenance checklists, and touring preparation tips by Store4Riders.";

  const blogSchema = buildBlogCollectionSchema(
    title,
    description,
    postsData.items,
    `${siteUrl}/guides`,
    siteUrl
  );
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: "Home", url: "/" },
      { name: "Guides", url: "/guides" },
    ],
    siteUrl
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <GuidesHubModule
        heroTitle={seo?.heroTitle}
        heroDescription={seo?.heroDescription}
        initialTag={initialTag}
        initialSearch={initialSearch}
        initialPage={initialPage}
        initialPostsData={postsData}
        initialCategories={categories}
      />
    </>
  );
}
