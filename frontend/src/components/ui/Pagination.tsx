"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount?: number;
  pageSize?: number;
  itemLabel?: string;
  isLoading?: boolean;
  ariaLabel?: string;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Computes compact numbered pagination ranges with ellipses for large page counts.
 */
export function getPaginationRange(
  currentPage: number,
  totalPages: number
): Array<number | "..."> {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  itemLabel = "items",
  isLoading = false,
  ariaLabel = "Pagination",
  onPageChange,
  className = "",
}) => {
  if (totalPages <= 1) return null;

  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginationRange = getPaginationRange(safeCurrentPage, totalPages);

  const hasItemCounts =
    typeof totalCount === "number" &&
    typeof pageSize === "number" &&
    totalCount > 0 &&
    pageSize > 0;
  const startItem = hasItemCounts
    ? Math.min((safeCurrentPage - 1) * pageSize + 1, totalCount)
    : 0;
  const endItem = hasItemCounts
    ? Math.min(safeCurrentPage * pageSize, totalCount)
    : 0;

  return (
    <div
      className={`mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs ${className}`}
    >
      <p className="text-xs text-neutral-600 font-medium text-center sm:text-left">
        {hasItemCounts ? (
          <>
            Showing{" "}
            <span className="font-bold text-neutral-900">
              {startItem}–{endItem}
            </span>{" "}
            of <span className="font-bold text-neutral-900">{totalCount}</span>{" "}
            {itemLabel}
          </>
        ) : (
          <>
            Showing page{" "}
            <span className="font-bold text-neutral-900">{safeCurrentPage}</span>{" "}
            of <span className="font-bold text-neutral-900">{totalPages}</span>
          </>
        )}
      </p>

      <nav
        aria-label={ariaLabel}
        className="flex flex-wrap items-center justify-center gap-1.5"
      >
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
          disabled={safeCurrentPage <= 1 || isLoading}
          aria-label="Previous"
          className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {paginationRange.map((item, index) => {
          if (item === "...") {
            return (
              <span
                key={`ellipsis-${index}`}
                aria-hidden="true"
                className="min-w-[28px] h-9 flex items-center justify-center text-xs font-bold text-neutral-400 select-none"
              >
                ...
              </span>
            );
          }

          const isActive = item === safeCurrentPage;

          return (
            <button
              key={item}
              type="button"
              onClick={() => {
                if (!isActive) onPageChange(item);
              }}
              disabled={isLoading && !isActive}
              aria-current={isActive ? "page" : undefined}
              className={`min-w-[36px] h-9 px-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center ${
                isActive
                  ? "bg-brand text-white border-brand shadow-xs"
                  : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-900"
              }`}
            >
              {item}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
          disabled={safeCurrentPage >= totalPages || isLoading}
          aria-label="Next"
          className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
};

export default Pagination;
