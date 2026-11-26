import { GuideCardsGridSkeleton } from "@/modules/guides/components/GuideCardsGridSkeleton";

export default function GuidesLoading() {
  return (
    <div className="min-h-screen bg-neutral-50/60 pb-20">
      {/* Breadcrumb Skeleton */}
      <div className="bg-white border-b border-neutral-200/60 py-3">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-2 animate-pulse">
          <div className="h-3 w-10 bg-neutral-100 rounded" />
          <div className="h-3 w-2 bg-neutral-100 rounded" />
          <div className="h-3 w-20 bg-neutral-200 rounded" />
        </div>
      </div>

      {/* Hero Banner Skeleton */}
      <div className="bg-white border-b border-neutral-200/80 py-8 sm:py-10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-3 animate-pulse">
          <div className="h-3.5 w-48 bg-neutral-200 rounded-full" />
          <div className="h-9 w-2/3 max-w-xl bg-neutral-200 rounded-xl" />
          <div className="h-4 w-full max-w-2xl bg-neutral-100 rounded-lg" />
          <div className="h-11 w-full max-w-xl bg-neutral-100 rounded-xl mt-4" />
        </div>
      </div>

      {/* Category Pills + Cards Grid Skeleton */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex items-center gap-2 overflow-hidden pb-4 pt-1 animate-pulse">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-8 w-28 sm:w-36 bg-neutral-200/80 rounded-full shrink-0" />
          ))}
        </div>

        <GuideCardsGridSkeleton count={6} />
      </div>
    </div>
  );
}
