import React from "react";

interface GuideCardsGridSkeletonProps {
  count?: number;
}

export const GuideCardsGridSkeleton: React.FC<GuideCardsGridSkeletonProps> = ({
  count = 6,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mt-6">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden animate-pulse"
        >
          <div className="aspect-[16/10] w-full bg-neutral-200" />
          <div className="p-5 sm:p-6 space-y-3">
            <div className="h-3 w-28 bg-neutral-100 rounded" />
            <div className="h-5 w-full bg-neutral-200 rounded" />
            <div className="h-4 w-5/6 bg-neutral-100 rounded" />
            <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
              <div className="h-4 w-24 bg-neutral-100 rounded" />
              <div className="h-4 w-20 bg-neutral-100 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
