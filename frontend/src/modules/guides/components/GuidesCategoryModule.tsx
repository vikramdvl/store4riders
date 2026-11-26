"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IBlogCategory, IBlogPost } from "@store4riders/shared-types";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Pagination } from "@/components/ui/Pagination";
import {
  PaginatedBlogResponse,
  usePublicBlogCategories,
  usePublicBlogPosts,
} from "@/core/hooks/useBlog";
import { normalizeExternalImageUrl } from "@/core/utils/mediaUrlHelper";
import { syncPageQueryParam } from "@/core/utils/shallowUrl";
import { GuideCard } from "./GuideCard";
import { GuideAuthorCard } from "./GuideAuthorCard";
import { GuideCardsGridSkeleton } from "./GuideCardsGridSkeleton";
import { BookOpen } from "lucide-react";

const CATEGORY_GUIDES_PER_PAGE = 18;

interface GuidesCategoryModuleProps {
  categorySlug: string;
  initialPage?: number;
  initialCategory?: IBlogCategory | null;
  initialPostsData?: PaginatedBlogResponse;
  initialCategories?: IBlogCategory[];
}

export const GuidesCategoryModule: React.FC<GuidesCategoryModuleProps> = ({
  categorySlug,
  initialPage = 1,
  initialCategory,
  initialPostsData,
  initialCategories,
}) => {
  const [page, setPage] = useState<number>(initialPage);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const urlPage = parseInt(params.get("page") || "1", 10);
      setPage(Number.isFinite(urlPage) && urlPage > 0 ? urlPage : 1);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const { data: categories = [] } = usePublicBlogCategories(
    initialCategories ? { initialData: initialCategories } : undefined
  );

  const category =
    initialCategory ||
    categories.find((c) => c.slug.toLowerCase() === categorySlug.toLowerCase());

  if (!category) {
    notFound();
  }

  const {
    data: postsData,
    isLoading,
    isFetching,
  } = usePublicBlogPosts(
    {
      page,
      limit: CATEGORY_GUIDES_PER_PAGE,
      categorySlug: category.slug,
    },
    page === initialPage && initialPostsData
      ? { initialData: initialPostsData }
      : undefined
  );

  const posts: IBlogPost[] = postsData?.items || [];
  const totalCount = postsData?.totalCount ?? category.articleCount ?? 0;
  const totalPages = postsData?.totalPages || 1;

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    syncPageQueryParam(nextPage);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 280, behavior: "smooth" });
    }
  };

  const spotlightAuthor = posts[0]?.author
    ? {
        name: posts[0].author.name || "Store4Riders Team",
        url: posts[0].author.url || "",
        jobTitle: posts[0].author.jobTitle,
        avatar: normalizeExternalImageUrl(posts[0].author.avatar) || undefined,
        bio: posts[0].author.bio,
        sameAs: Array.isArray(posts[0].author.sameAs) ? posts[0].author.sameAs : [],
      }
    : null;

  return (
    <div className="min-h-screen bg-neutral-50/60 pb-20">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Guides", href: "/guides" },
          { label: category.name },
        ]}
      />

      {/* Header Banner */}
      <header className="bg-gradient-to-b from-neutral-100/70 via-white to-neutral-50/50 border-b border-neutral-200/80 py-8 sm:py-10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-brand shadow-xs" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-brand">
                {category.name} Guides &amp; Manuals
              </span>
              <span className="text-neutral-300">•</span>
              <span className="text-xs font-medium text-neutral-500">
                Store4Riders Editorial
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-sans font-bold tracking-tight text-neutral-900 mb-2.5">
              {category.name}
            </h1>

            {category.description && (
              <p className="text-sm sm:text-[15px] text-neutral-600 leading-relaxed mb-5">
                {category.description}
              </p>
            )}

            <span className="inline-block text-xs font-bold px-3 py-1.5 bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-lg">
              {totalCount} {totalCount === 1 ? "Guide" : "Guides"} Available
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Category Navigation Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 pt-1 scrollbar-none mb-6">
          <Link
            href="/guides"
            className="px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200"
          >
            All Guides
          </Link>

          {categories.map((cat) => (
            <Link
              key={cat._id || cat.slug}
              href={`/guides/category/${cat.slug}`}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                cat.slug === category.slug
                  ? "bg-brand text-white shadow-sm"
                  : "bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>

        {/* Posts Grid */}
        {isLoading && !postsData ? (
          <GuideCardsGridSkeleton count={6} />
        ) : posts.length > 0 ? (
          <>
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 transition-opacity duration-200 ${
                isFetching ? "opacity-75" : "opacity-100"
              }`}
            >
              {posts.map((post, idx) => (
                <GuideCard key={post._id || post.slug} post={post} priority={idx < 3} />
              ))}
            </div>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={CATEGORY_GUIDES_PER_PAGE}
              itemLabel="guides"
              isLoading={isFetching}
              ariaLabel="Category guides pagination"
              onPageChange={handlePageChange}
            />
          </>
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center border border-neutral-200 max-w-md mx-auto my-12">
            <BookOpen className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              No guides in this category yet
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Articles published in {category.name} will appear here automatically.
            </p>
            <Link
              href="/guides"
              className="inline-block px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand/90 transition-colors shadow-sm"
            >
              Browse All Guides
            </Link>
          </div>
        )}

        {/* Author Card */}
        {spotlightAuthor && (
          <div className="mt-16 pt-10 border-t border-neutral-200">
            <GuideAuthorCard author={spotlightAuthor} />
          </div>
        )}
      </div>
    </div>
  );
};
