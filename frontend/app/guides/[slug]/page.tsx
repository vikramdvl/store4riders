import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { redirectIfMatchedOrNotFound } from "@/core/utils/urlRedirects";
import { getRobotsMetadata } from "@/core/utils/seo-schema";
import { normalizeExternalImageUrl } from "@/core/utils/mediaUrlHelper";
import {
  GuidesCategoryModule,
  GuideDetailModule,
  fetchBlogCategoryBySlug,
  fetchGuideOrBlogPost,
  fetchPublicBlogCategories,
  fetchPublicBlogPosts,
  fetchStaticBlogCategorySlugs,
  fetchStaticBlogPostSlugs,
  fetchRelatedBlogPosts,
  buildAuthorSchema,
  buildBlogPostingSchema,
  buildBlogCollectionSchema,
  buildBreadcrumbSchema,
} from "@/modules/guides";

export const revalidate = 3600;
export const dynamicParams = true;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const [catSlugs, postSlugs] = await Promise.all([
    fetchStaticBlogCategorySlugs(),
    fetchStaticBlogPostSlugs(),
  ]);
  return [
    ...catSlugs.map((slug) => ({ slug })),
    ...postSlugs.map((slug) => ({ slug })),
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [category, post] = await Promise.all([
    fetchBlogCategoryBySlug(slug),
    fetchGuideOrBlogPost(slug),
  ]);

  if (category && category.isActive !== false) {
    const title = category.metaTitle?.trim() || `${category.name} Guides | Store4Riders`;
    const description =
      category.metaDescription?.trim() ||
      category.description ||
      `Expert motorcycle guides and advice for ${category.name} at Store4Riders.`;
    const canonical = `https://www.store4riders.com/guides/category/${category.slug}`;

    return {
      title,
      description,
      alternates: { canonical },
      robots: getRobotsMetadata(),
      openGraph: {
        title,
        description,
        url: canonical,
        siteName: "Store4Riders",
        type: "website",
      },
    };
  }

  if (post) {
    const title = post.metaTitle?.trim() || `${post.title} | Store4Riders Guides`;
    const description =
      post.metaDescription?.trim() ||
      post.excerpt?.trim() ||
      "Expert motorcycle riding guides, gear care advice, and maintenance tips by Store4Riders.";
    const canonical = `https://www.store4riders.com/guides/post/${post.slug}`;
    const rawPublished = post.publishedAt || new Date().toISOString();
    const rawModified = post.updatedAt || rawPublished;
    const ogImage = normalizeExternalImageUrl(post.featuredImage);

    return {
      title,
      description,
      keywords: post.tags,
      alternates: { canonical },
      robots: getRobotsMetadata(),
      openGraph: {
        title,
        description,
        url: canonical,
        siteName: "Store4Riders",
        type: "article",
        publishedTime: typeof rawPublished === "string" ? rawPublished : rawPublished.toISOString?.() || undefined,
        modifiedTime: typeof rawModified === "string" ? rawModified : rawModified.toISOString?.() || undefined,
        authors: [post.author?.name || "Store4Riders Team"],
        section: post.categoryName || "Motorcycle Guides",
        images: ogImage
          ? [{ url: ogImage, width: 1200, height: 630, alt: post.title }]
          : [],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: ogImage ? [ogImage] : [],
      },
    };
  }

  return {
    title: "Guide Not Found | Store4Riders",
    description: "The requested guide could not be found.",
  };
}

export default async function GuidesDynamicSlugPage({ params }: Props) {
  const { slug } = await params;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.store4riders.com";

  const [category, post, categories] = await Promise.all([
    fetchBlogCategoryBySlug(slug),
    fetchGuideOrBlogPost(slug),
    fetchPublicBlogCategories(),
  ]);

  if (category && category.isActive !== false) {
    const postsData = await fetchPublicBlogPosts(1, 18, category.slug);

    const collectionSchema = buildBlogCollectionSchema(
      `${category.name} Guides`,
      category.metaDescription?.trim() ||
        category.description ||
        `Expert motorcycle guides and advice for ${category.name}`,
      postsData.items,
      `${siteUrl}/guides/${category.slug}`,
      siteUrl
    );
    const breadcrumbSchema = buildBreadcrumbSchema(
      [
        { name: "Home", url: "/" },
        { name: "Guides", url: "/guides" },
        { name: category.name, url: `/guides/${category.slug}` },
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
          initialCategory={category}
          initialPostsData={postsData}
          initialCategories={categories}
        />
      </>
    );
  }

  if (post) {
    const relatedPosts = await fetchRelatedBlogPosts(post.slug, 3);
    const authorSchema = buildAuthorSchema(post.author, siteUrl);
    const blogPostingSchema = buildBlogPostingSchema(post, siteUrl);
    const breadcrumbItems = [
      { name: "Home", url: "/" },
      { name: "Guides", url: "/guides" },
      ...(post.categorySlug && post.categoryName
        ? [{ name: post.categoryName, url: `/guides/category/${post.categorySlug}` }]
        : []),
      { name: post.title, url: `/guides/post/${post.slug}` },
    ];
    const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbItems, siteUrl);

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(authorSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
        <GuideDetailModule
          slug={slug}
          initialPost={post}
          initialRelatedPosts={relatedPosts}
        />
      </>
    );
  }

  await redirectIfMatchedOrNotFound(`/guides/${slug}`);
  notFound();
}
