"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound, useRouter } from "next/navigation";
import { IBlogPost, IGuidePost } from "@store4riders/shared-types";
import { cleanRichContent, handleRichTextClick } from "@/core/utils/cleanRichContent";
import { normalizeExternalImageUrl } from "@/core/utils/mediaUrlHelper";
import { useRelatedBlogPosts } from "@/core/hooks/useBlog";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { getVideoEmbedInfo } from "../utils/video";
import { GuideAuthorCard } from "./GuideAuthorCard";
import { GuideCard } from "./GuideCard";
import {
  Calendar,
  Clock,
  Share2,
  Check,
  ArrowLeft,
  BookOpen,
  Tag,
} from "lucide-react";

interface GuideDetailModuleProps {
  slug: string;
  initialPost?: IBlogPost | IGuidePost | null;
  initialRelatedPosts?: IBlogPost[];
}

export const GuideDetailModule: React.FC<GuideDetailModuleProps> = ({
  slug,
  initialPost,
  initialRelatedPosts,
}) => {
  const router = useRouter();
  const post = initialPost;
  const [copied, setCopied] = useState(false);

  const { data: relatedPosts = [] } = useRelatedBlogPosts(post?.slug || slug, 3, {
    initialData: initialRelatedPosts,
    initialDataUpdatedAt: 0,
  });

  if (!post) {
    notFound();
  }

  const videoEmbed = getVideoEmbedInfo((post as IBlogPost)?.videoUrl);
  const heroImage = normalizeExternalImageUrl(post.featuredImage);
  const cleanedHtml = useMemo(
    () => cleanRichContent(post.content || "", { preserveFaqs: true }),
    [post.content]
  );
  const summaryText =
    (post as IBlogPost).excerpt || (post as IGuidePost).description || "";

  const rawPublishedDate =
    (post as IBlogPost).publishedAt || (post as IGuidePost).publishedDate;
  const formattedDate = rawPublishedDate
    ? new Date(rawPublishedDate).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const authorName = post.author?.name || "Store4Riders Editorial";
  const authorAvatar = normalizeExternalImageUrl(post.author?.avatar);
  const authorInitials =
    authorName
      .trim()
      .split(/\s+/)
      .map((part: string) => part[0]?.toUpperCase())
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "SR";

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareUrl =
    typeof window !== "undefined" ? encodeURIComponent(window.location.href) : "";
  const shareTitle = encodeURIComponent(post.title);

  const hasCategory = Boolean(post.categorySlug && post.categoryName);
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Guides", href: "/guides" },
    ...(hasCategory
      ? [
          {
            label: post.categoryName!,
            href: `/guides/category/${post.categorySlug}`,
          },
        ]
      : []),
    { label: post.title },
  ];

  const authorCardData = {
    name: post.author?.name || "Store4Riders Team",
    url: post.author?.url || "",
    jobTitle: post.author?.jobTitle,
    avatar: authorAvatar || undefined,
    bio: post.author?.bio,
    sameAs: Array.isArray(post.author?.sameAs) ? post.author.sameAs : [],
  };

  return (
    <article className="min-h-screen bg-neutral-50/50 pb-20">
      {/* Breadcrumb Navigation */}
      <Breadcrumb items={breadcrumbItems} containerClassName="max-w-4xl" />

      {/* Post Header */}
      <header className="bg-white border-b border-neutral-200/80 pt-6 pb-7 sm:pt-7 sm:pb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top navigation & category row */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <Link
              href={hasCategory ? `/guides/category/${post.categorySlug}` : "/guides"}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 hover:text-brand transition-colors uppercase tracking-wider"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{hasCategory ? `Back to ${post.categoryName}` : "Back to All Guides"}</span>
            </Link>

            {hasCategory && (
              <Link
                href={`/guides/category/${post.categorySlug}`}
                className="inline-block bg-brand/10 text-brand text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full hover:bg-brand hover:text-white transition-colors"
              >
                {post.categoryName}
              </Link>
            )}
          </div>

          {/* Headline - CSS Selector matched in speakable spec */}
          <h1 className="guide-headline text-xl sm:text-2xl lg:text-[28px] font-sans font-bold text-neutral-900 tracking-tight leading-snug mb-2.5">
            {post.title}
          </h1>

          {/* Excerpt / Summary */}
          {summaryText && (
            <p className="text-sm sm:text-[15px] text-neutral-600 leading-relaxed mb-5 font-normal">
              {summaryText}
            </p>
          )}

          {/* Metadata Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-neutral-100 text-xs text-neutral-600">
            {/* Author info */}
            <div className="flex items-center gap-2.5">
              {authorAvatar ? (
                <div className="relative w-8 h-8 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                  <Image
                    src={authorAvatar}
                    alt={authorName}
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[11px] tracking-wider shadow-2xs border border-slate-800 shrink-0">
                  {authorInitials}
                </div>
              )}
              <div>
                <p className="font-semibold text-neutral-900 leading-tight text-xs sm:text-[13px]">
                  {authorName}
                </p>
                <p className="text-[11px] text-brand font-medium">
                  {post.author?.jobTitle || "Motorcycle Gear Specialist"}
                </p>
              </div>
            </div>

            {/* Date and Reading Time */}
            <div className="flex items-center gap-3.5 text-[11px] sm:text-xs font-medium text-neutral-500">
              {formattedDate && (
                <span className="flex items-center gap-1.5" suppressHydrationWarning>
                  <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                  <span suppressHydrationWarning>{formattedDate}</span>
                </span>
              )}
              {post.readingTimeMinutes ? (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{post.readingTimeMinutes} min read</span>
                </span>
              ) : null}
              {post.wordCount ? (
                <span className="hidden sm:flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{post.wordCount.toLocaleString()} words</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8">
        {/* Featured Video Embed (if provided) or Featured Cover Image */}
        {videoEmbed ? (
          <div className="mb-7">
            <div className="relative aspect-video w-full rounded-xl overflow-hidden shadow-md border border-neutral-200/90 bg-neutral-950">
              {videoEmbed.type === "youtube" || videoEmbed.type === "vimeo" ? (
                <iframe
                  src={videoEmbed.embedUrl}
                  title={`${post.title} - Video Review`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              ) : (
                <video
                  src={videoEmbed.embedUrl}
                  controls
                  playsInline
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex items-center gap-2 mt-2.5 px-1 text-xs text-neutral-600">
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              <span className="font-semibold text-neutral-900">Featured Video Walkthrough / Review</span>
              <span className="text-neutral-400">•</span>
              <span className="text-neutral-500">Official Store4Riders Channel</span>
            </div>
          </div>
        ) : heroImage ? (
          <div className="relative aspect-[16/9] max-h-[420px] w-full rounded-xl overflow-hidden shadow-sm border border-neutral-200/80 mb-7 bg-neutral-100">
            <Image
              src={heroImage}
              alt={post.title}
              fill
              priority
              sizes="(max-width: 896px) 100vw, 832px"
              className="object-cover"
            />
          </div>
        ) : null}

        {/* Article Body - CSS Selector matched in speakable spec */}
        <div className="bg-white rounded-xl p-5 sm:p-7 lg:p-9 border border-neutral-200/80 shadow-xs mb-10">
          <div
            onClick={(e) => handleRichTextClick(e, router)}
            className="guide-article-body prose prose-neutral prose-sm sm:prose-base max-w-none 
              prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-neutral-900
              prose-h1:text-xl sm:prose-h1:text-2xl prose-h1:mt-5 prose-h1:mb-3
              prose-h2:text-lg sm:prose-h2:text-xl prose-h2:mt-7 prose-h2:mb-2.5 prose-h2:border-b prose-h2:border-neutral-100 prose-h2:pb-1.5
              prose-h3:text-base sm:prose-h3:text-[17px] prose-h3:mt-5 prose-h3:mb-2
              prose-p:text-[14.5px] sm:prose-p:text-[15.5px] prose-p:text-neutral-700 prose-p:leading-[1.7] prose-p:mb-3.5
              prose-ul:my-3.5 prose-ul:list-disc prose-ul:pl-5 prose-li:text-[14.5px] sm:prose-li:text-[15.5px] prose-li:text-neutral-700 prose-li:my-1
              prose-ol:my-3.5 prose-ol:list-decimal prose-ol:pl-5
              prose-strong:text-neutral-900 prose-strong:font-semibold
              prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-a:underline prose-a:font-medium
              prose-img:rounded-lg prose-img:shadow-sm prose-img:my-4 prose-img:mx-auto"
            dangerouslySetInnerHTML={{ __html: cleanedHtml }}
          />

          {/* Article Topic Tags */}
          {Array.isArray(post.tags) && post.tags.length > 0 && (
            <div className="mt-8 pt-6 border-t border-neutral-100">
              <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">
                <Tag className="w-3.5 h-3.5 text-brand" />
                <span>Related Topics &amp; Tags:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag: string) => (
                  <Link
                    key={tag}
                    href={`/guides?tag=${encodeURIComponent(tag)}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 hover:bg-brand/10 text-neutral-700 hover:text-brand border border-neutral-200/80 hover:border-brand/30 transition-all duration-200"
                    title={`View more guides tagged "${tag}"`}
                  >
                    <span>#{tag}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Social Share Bar */}
          <div className="mt-12 pt-8 border-t border-neutral-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-neutral-500" />
              <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Share this guide:
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`https://api.whatsapp.com/send?text=${shareTitle}%20${shareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-[#25D366] text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm"
              >
                WhatsApp
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-black text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm"
              >
                X / Twitter
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-[#1877F2] text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm"
              >
                Facebook
              </a>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : null}
                <span>{copied ? "Copied!" : "Copy Link"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Author Bio Card */}
        <div className="mb-14">
          <GuideAuthorCard
            author={authorCardData}
            publishedDate={typeof rawPublishedDate === "string" ? rawPublishedDate : rawPublishedDate?.toISOString?.()}
            readingTimeMinutes={post.readingTimeMinutes}
          />
        </div>

        {/* Related Guides Section */}
        {relatedPosts.length > 0 && (
          <section className="mt-14">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                  Related Guides &amp; Tips
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Continue exploring rider knowledge and gear recommendations.
                </p>
              </div>
              <Link
                href="/guides"
                className="text-xs font-bold text-banner hover:text-brand transition-colors"
              >
                View All Guides &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedPosts.map((relPost) => (
                <GuideCard key={relPost.slug} post={relPost} />
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
};
