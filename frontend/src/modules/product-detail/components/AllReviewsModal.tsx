"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { StarIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { ReviewData } from "../types/product-detail.types";

interface AllReviewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviews: ReviewData[];
  productName?: string;
  averageRating: string | number;
  onWriteReview?: () => void;
}

export const AllReviewsModal: React.FC<AllReviewsModalProps> = ({
  isOpen,
  onClose,
  reviews,
  productName = "Product",
  averageRating,
  onWriteReview,
}) => {
  const [mounted, setMounted] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setSelectedFilter(null);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Filter reviews by rating if a filter chip is selected
  const filteredReviews = useMemo(() => {
    if (!reviews || reviews.length === 0) return [];
    if (selectedFilter === null) return reviews;
    return reviews.filter((r) => Math.round(Number(r.rating)) === selectedFilter);
  }, [reviews, selectedFilter]);

  // Star breakdown counts
  const starCounts = useMemo(() => {
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    (reviews || []).forEach((r) => {
      const rounded = Math.round(Number(r.rating));
      if (counts[rounded] !== undefined) {
        counts[rounded]++;
      }
    });
    return counts;
  }, [reviews]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="all-reviews-title"
    >
      <div
        className="bg-white w-full max-w-2xl max-h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-neutral-200 transform transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-neutral-200 bg-neutral-50 shrink-0">
          <div className="min-w-0 pr-4">
            <h3 id="all-reviews-title" className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
              <span>Customer Reviews</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700">
                {reviews.length}
              </span>
            </h3>
            <p className="text-xs text-neutral-500 truncate mt-0.5 font-medium">
              {productName}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors cursor-pointer shrink-0"
            aria-label="Close reviews modal"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Rating Summary & Filter Chips */}
        <div className="px-5 sm:px-6 py-3.5 bg-white border-b border-neutral-100 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Average Rating Score */}
            <div className="flex items-center gap-3">
              <span className="text-3xl font-extrabold text-neutral-900 leading-none">
                {averageRating}
              </span>
              <div>
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        i < Math.round(Number(averageRating))
                          ? "text-amber-400 fill-amber-400"
                          : "text-neutral-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                  Based on {reviews.length} verified reviews
                </p>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedFilter(null)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                  selectedFilter === null
                    ? "bg-neutral-900 text-white border-neutral-900 shadow-xs"
                    : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
                }`}
              >
                All ({reviews.length})
              </button>

              {[5, 4, 3, 2, 1].map((star) => {
                const count = starCounts[star] || 0;
                if (count === 0 && selectedFilter !== star) return null;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSelectedFilter(selectedFilter === star ? null : star)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1 ${
                      selectedFilter === star
                        ? "bg-[#ab1509] text-white border-[#ab1509] shadow-xs"
                        : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
                    }`}
                  >
                    <span>{star}</span>
                    <StarIcon className={`w-3 h-3 ${selectedFilter === star ? "text-white fill-white" : "text-amber-400 fill-amber-400"}`} />
                    <span className="opacity-80">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scrollable Reviews List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 divide-y divide-neutral-100">
          {filteredReviews.length > 0 ? (
            filteredReviews.map((review, idx) => (
              <div
                key={review.id || review._id || `modal-rev-${idx}`}
                className={idx > 0 ? "pt-3.5" : ""}
              >
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-[#ab1509] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    {(review.author || "R").charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <p className="font-semibold text-neutral-900 text-sm truncate">
                        {review.author}
                      </p>

                      {review.city && (
                        <span className="text-xs text-neutral-500 flex items-center gap-0.5">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-[#FF5429]"
                          >
                            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          {review.city}
                        </span>
                      )}

                      {review.isVerified === true && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-sm border border-emerald-200">
                          Verified Buyer
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex text-amber-400">
                        {[...Array(5)].map((_, i) => (
                          <StarIcon
                            key={i}
                            className={`w-3 h-3 ${
                              i < Math.round(Number(review.rating))
                                ? "text-amber-400 fill-amber-400"
                                : "text-neutral-200"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-neutral-400">
                        {review.date}
                      </span>
                    </div>
                  </div>
                </div>

                {review.title && (
                  <h4 className="font-bold text-neutral-900 text-xs sm:text-sm pl-12 mb-1">
                    {review.title}
                  </h4>
                )}

                <p className="text-neutral-600 text-xs sm:text-sm leading-relaxed pl-12 break-words">
                  {review.text}
                </p>
              </div>
            ))
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-neutral-600">
                No reviews found for {selectedFilter} stars.
              </p>
              <button
                type="button"
                onClick={() => setSelectedFilter(null)}
                className="mt-2 text-xs font-bold text-[#ab1509] hover:underline cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-neutral-500 font-medium hidden sm:block">
            Showing {filteredReviews.length} of {reviews.length} reviews
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onWriteReview && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onWriteReview();
                }}
                className="px-4 py-2 rounded-lg bg-[#ab1509] hover:bg-[#8b1007] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
              >
                Rate & Review
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-100 text-neutral-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
