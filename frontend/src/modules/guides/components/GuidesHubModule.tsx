"use client";

import React, { useState, useEffect } from "react";
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
import { MagnifyingGlassIcon, BookOpenIcon } from "@heroicons/react/24/outline";

const GUIDES_PER_PAGE = 18;

interface GuidesHubModuleProps {
  heroTitle?: string;
  heroDescription?: string;
  initialTag?: string;
  initialSearch?: string;
  initialPage?: number;
  initialPostsData?: PaginatedBlogResponse;
  initialCategories?: IBlogCategory[];
}

export const GuidesHubModule: React.FC<GuidesHubModuleProps> = ({
  heroTitle = "Motorcycle Guides & Expert Advice",
  heroDescription = "Real-world gear tests, sizing walkthroughs, maintenance checklists, and touring preparation guides curated by riders for Indian roads and conditions.",
  initialTag = "",
  initialSearch = "",
  initialPage = 1,
  initialPostsData,
  initialCategories,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeTag, setActiveTag] = useState<string>(initialTag);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch.trim());
  const [page, setPage] = useState<number>(initialPage);
  const [allGuidesTotal, setAllGuidesTotal] = useState<number | null>(
    !initialTag && !initialSearch.trim() && initialPostsData
      ? initialPostsData.totalCount
      : null
  );

  // Debounce search query (300ms) and reset page to 1 on change
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchQuery.trim();
      setDebouncedSearch((prev) => {
        if (prev !== trimmed) {
          setPage(1);
          syncPageQueryParam(1);
        }
        return trimmed;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const urlPage = parseInt(params.get("page") || "1", 10);
      setPage(Number.isFinite(urlPage) && urlPage > 0 ? urlPage : 1);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const matchesInitialSsrQuery =
    page === initialPage &&
    selectedCategory === "all" &&
    activeTag === initialTag &&
    debouncedSearch === initialSearch.trim();

  const {
    data: postsData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = usePublicBlogPosts(
    {
      page,
      limit: GUIDES_PER_PAGE,
      categorySlug: selectedCategory !== "all" ? selectedCategory : undefined,
      tag: activeTag || undefined,
      search: debouncedSearch || undefined,
    },
    matchesInitialSsrQuery && initialPostsData
      ? { initialData: initialPostsData, initialDataUpdatedAt: 0 }
      : undefined
  );

  const { data: categories = [] } = usePublicBlogCategories(
    initialCategories
      ? { initialData: initialCategories, initialDataUpdatedAt: 0 }
      : undefined
  );

  useEffect(() => {
    if (
      selectedCategory === "all" &&
      !activeTag &&
      !debouncedSearch &&
      typeof postsData?.totalCount === "number"
    ) {
      setAllGuidesTotal(postsData.totalCount);
    }
  }, [selectedCategory, activeTag, debouncedSearch, postsData?.totalCount]);

  const posts: IBlogPost[] = postsData?.items || [];
  const totalPages = postsData?.totalPages || 1;
  const totalCount = postsData?.totalCount || 0;

  const handleCategoryChange = (slug: string) => {
    setSelectedCategory(slug);
    setPage(1);
    syncPageQueryParam(1);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setActiveTag("");
    setSelectedCategory("all");
    setPage(1);
    syncPageQueryParam(1);
  };

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
          { label: "Guides" },
        ]}
      />

      {/* Hero Banner */}
      <section className="bg-gradient-to-b from-neutral-100/70 via-white to-neutral-50/50 border-b border-neutral-200/80 py-8 sm:py-10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-brand shadow-xs" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-brand">
                Store4Riders Editorial &amp; Field Guides
              </span>
              <span className="text-neutral-300">•</span>
              <span className="text-xs font-medium text-neutral-500">
                Gear Manuals &amp; Rider Advice
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-sans font-bold tracking-tight text-neutral-900 mb-3 leading-snug">
              {heroTitle}
            </h1>

            <p className="text-sm sm:text-[15px] text-neutral-600 leading-relaxed mb-6">
              {heroDescription}
            </p>

            {/* Search Input */}
            <div className="relative max-w-xl">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search guides (e.g. helmets, chain care, touring, CE armour)..."
                suppressHydrationWarning
                className="w-full bg-white border border-neutral-300 text-neutral-900 placeholder-neutral-400 pl-11 pr-16 py-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all shadow-sm"
              />
              <MagnifyingGlassIcon className="w-5 h-5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  suppressHydrationWarning
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-700"
                >
                  Clear
                </button>
              )}
            </div>

            {activeTag && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-neutral-500 font-medium">Filtered by tag:</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTag("");
                    setPage(1);
                    syncPageQueryParam(1);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand/10 text-brand border border-brand/20 hover:bg-brand hover:text-white transition-colors"
                >
                  <span>#{activeTag}</span>
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 pt-1 scrollbar-none">
          <button
            type="button"
            onClick={() => handleCategoryChange("all")}
            suppressHydrationWarning
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              selectedCategory === "all"
                ? "bg-brand text-white shadow-sm"
                : "bg-white text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 border border-neutral-200"
            }`}
          >
            All Guides{allGuidesTotal !== null ? ` (${allGuidesTotal})` : ""}
          </button>

          {categories.map((cat) => (
            <button
              key={cat._id || cat.slug}
              type="button"
              onClick={() => handleCategoryChange(cat.slug)}
              suppressHydrationWarning
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                selectedCategory === cat.slug
                  ? "bg-brand text-white shadow-sm"
                  : "bg-white text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 border border-neutral-200"
              }`}
            >
              {cat.name} {cat.articleCount ? `(${cat.articleCount})` : ""}
            </button>
          ))}
        </div>

        {/* Guides Grid / Loading / Error / Empty */}
        {isLoading && !postsData ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-neutral-500">Loading motorcycle guides...</p>
          </div>
        ) : isError && posts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-neutral-200 max-w-md mx-auto my-12">
            <BookOpenIcon className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              Unable to load guides right now
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Connection failed, please try again.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand/90 transition-colors shadow-sm"
            >
              Retry
            </button>
          </div>
        ) : posts.length > 0 ? (
          <>
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mt-6 transition-opacity duration-200 ${
                isFetching ? "opacity-75" : "opacity-100"
              }`}
            >
              {posts.map((post, idx) => (
                <GuideCard key={post._id || post.slug} post={post} priority={idx < 3} />
              ))}
            </div>

            {/* Backend Pagination Controls */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={GUIDES_PER_PAGE}
              itemLabel="guides"
              isLoading={isFetching}
              ariaLabel="Guides pagination"
              onPageChange={handlePageChange}
            />
          </>
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center border border-neutral-200 max-w-md mx-auto my-12">
            <BookOpenIcon className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              No matching guides found
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              {selectedCategory !== "all" || debouncedSearch || activeTag
                ? "Try searching with a different keyword or choose another category."
                : "No published guides are available yet."}
            </p>
            {(selectedCategory !== "all" || debouncedSearch || activeTag) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand/90 transition-colors shadow-sm"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}

        {/* Author Spotlight */}
        {spotlightAuthor && (
          <div className="mt-16 pt-10 border-t border-neutral-200">
            <GuideAuthorCard author={spotlightAuthor} />
          </div>
        )}
      </div>
    </div>
  );
};
