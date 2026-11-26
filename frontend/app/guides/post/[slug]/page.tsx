import { getRobotsMetadata } from "@/core/utils/seo-schema";
import { normalizeExternalImageUrl } from "@/core/utils/mediaUrlHelper";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  GuideDetailModule,
  fetchGuideOrBlogPost,
  fetchPublicBlogPosts,
  fetchRelatedBlogPosts,
  buildAuthorSchema,
  buildBlogPostingSchema,
  buildBreadcrumbSchema,
} from "@/modules/guides";

export const revalidate = 30;
export const dynamicParams = true;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const postsData = await fetchPublicBlogPosts(1, 100);
  return postsData.items.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchGuideOrBlogPost(slug);

  if (!post) {
    return {
      title: "Guide Not Found | Store4Riders",
      description: "The requested motorcycle guide could not be found.",
    };
  }

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
    alternates: {
      canonical,
    },
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
        ? [
            {
              url: ogImage,
              width: 1200,
              height: 630,
              alt: post.title,
            },
          ]
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

export default async function GuidePostPage({ params }: Props) {
  const { slug } = await params;
  const post = await fetchGuideOrBlogPost(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = await fetchRelatedBlogPosts(post.slug, 3);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.store4riders.com";
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
