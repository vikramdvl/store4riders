"use client";

import React, { useState } from "react";
import Link from "next/link";
import { StarIcon } from "@heroicons/react/24/solid";
import { ColorOption } from "../types/product-detail.types";
import { cleanRichContent, handleRichTextClick } from "@/core/utils/cleanRichContent";
import { SizeChartModal } from "./SizeChartModal";

interface ProductInfoProps {
  id: string;
  category: string;
  brand?: string;
  brandSlug?: string;
  brandLogo?: string;
  rating: number;
  name: string;
  originalPriceFormatted?: string;
  discountBadge?: string;
  priceFormatted: string;
  shortDescription: string;
  colors?: ColorOption[];
  sizes?: string[];
  selectedColor?: string;
  selectedSize?: string;
  disabledColors?: string[];
  disabledSizes?: string[];
  sizeChart?: string;
  isFreeShipping?: boolean;
  onColorChange?: (color: string) => void;
  onSizeChange?: (size: string) => void;
  onAddToCart?: (color: string, size: string) => void;
  stockStatus?: number;
  allowBackorders?: boolean;
}

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { apiClient } from "@/core/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { useWishlist } from "@/core/hooks/useWishlist";
import { useAuthStore } from "@/stores/useAuthStore";

export const ProductInfo: React.FC<ProductInfoProps> = ({
  id,
  category,
  brand,
  brandSlug,
  brandLogo,
  rating,
  name,
  originalPriceFormatted,
  discountBadge,
  priceFormatted,
  shortDescription,
  colors,
  sizes,
  selectedColor,
  selectedSize,
  disabledColors = [],
  disabledSizes = [],
  sizeChart,
  isFreeShipping = false,
  onColorChange,
  onSizeChange,
  onAddToCart,
  stockStatus = 1,
  allowBackorders = false,
}) => {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [showReadMore, setShowReadMore] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [showSizeModal, setShowSizeModal] = useState(false);
  const descRef = React.useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { data: wishlistIds = [] } = useWishlist();

  React.useEffect(() => {
    setIsWishlisted(wishlistIds.includes(id));
  }, [wishlistIds, id]);

  React.useEffect(() => {
    if (descRef.current) {
      if (descRef.current.scrollHeight > descRef.current.clientHeight) {
        setShowReadMore(true);
      }
    }
  }, [shortDescription]);

  const handleScrollToDetailedDescription = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("expand-product-detail-description"));
      const el =
        document.getElementById("product-detail-description") ||
        document.getElementById("product-description-card");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const handleAdd = () => {
    if (onAddToCart) {
      onAddToCart(selectedColor || "", selectedSize || "");
      setIsAdded(true);
      toast.success(`${name} added to cart!`);
      setTimeout(() => setIsAdded(false), 2500);
    }
  };

  const hasColors = Boolean(colors && colors.length > 0);
  const hasSizes = Boolean(sizes && sizes.length > 0);
  const isOutOfStock = React.useMemo(() => {
    if (allowBackorders) return false;
    if (hasColors && selectedColor && disabledColors.includes(selectedColor)) return true;
    if (hasSizes && selectedSize && disabledSizes.includes(selectedSize)) return true;
    if (!hasColors && !hasSizes) return stockStatus === 0;
    return false;
  }, [allowBackorders, hasColors, hasSizes, selectedColor, selectedSize, disabledColors, disabledSizes, stockStatus]);

  return (
    <>
      <div className="flex flex-col">
        {/* Header: Brand (Left) & Rating / Review prompt (Right) */}
        <div className="flex items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-[#6b6560] font-medium">Brand:</span>{" "}
            {brandSlug ? (
              <Link
                href={`/brands/${brandSlug}`}
                className="text-[#0000ff] hover:underline font-extrabold uppercase tracking-wide"
                title={`Explore ${brand} collection`}
              >
                {brand}
              </Link>
            ) : (
              <span className="text-[#111111] font-extrabold uppercase tracking-wide">
                {brand || "Genuine"}
              </span>
            )}
          </div>

          {rating > 0 ? (
            <div 
              onClick={() => {
                const el = document.getElementById("customer-reviews") || document.getElementById("customer-reviews-section");
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
              title="Click to view customer reviews"
            >
              <span className="text-[#f5a623] text-sm">★★★★★</span>
              <span className="text-[11px] font-bold text-[#111111]">{rating.toFixed(1)}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("customer-reviews") || document.getElementById("customer-reviews-section");
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="text-[11px] font-bold text-[#6b6560] uppercase tracking-wider hover:text-[#111111] transition-colors cursor-pointer"
            >
              Be the first to review
            </button>
          )}
        </div>

        {/* Title */}
        <h1
          title={name}
          className="font-sans font-bold text-2xl sm:text-[28px] uppercase tracking-tight text-[#111111] leading-tight mt-2.5 mb-2"
        >
          {name}
        </h1>

        {/* Price & Wishlist Row */}
        <div className="flex items-center justify-between w-full mt-1">
          <div className="flex items-baseline gap-2.5">
            <span className="font-sans font-extrabold text-[#111111] text-2xl sm:text-[28px]">
              {priceFormatted}
            </span>
            {originalPriceFormatted && discountBadge && (
              <>
                <span className="text-neutral-400 line-through text-sm sm:text-base font-medium">
                  {originalPriceFormatted}
                </span>
                <span className="bg-[#d9480f] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-xs relative -top-0.5">
                  {discountBadge} OFF
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            suppressHydrationWarning
            onClick={(e) => {
              e.preventDefault();
              if (!isAuthenticated) {
                toast.error("Please login to save to wishlist");
                const currentPath = typeof window !== "undefined" ? window.location.pathname : `/products/${id}`;
                router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
                return;
              }

              const prev = isWishlisted;
              setIsWishlisted(!prev);

              apiClient.post("/wishlist/toggle", { productId: id })
                .then((res) => {
                  queryClient.invalidateQueries({ queryKey: ["wishlist_ids"] });
                  queryClient.invalidateQueries({ queryKey: ["wishlist"] });
                  if (res.data?.data?.added || !prev) {
                    toast.success("Saved to wishlist!");
                  } else {
                    toast.error("Removed from wishlist");
                  }
                })
                .catch((err) => {
                  setIsWishlisted(prev);
                  if (err.response?.status === 401) {
                    toast.error("Please login to save to wishlist");
                    const currentPath = typeof window !== "undefined" ? window.location.pathname : `/products/${id}`;
                    router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
                  } else {
                    toast.error("Failed to update wishlist");
                  }
                });
            }}
            className="flex items-center justify-center w-[42px] h-[42px] rounded-full border border-[#e6e1da] bg-white text-[#111111] hover:border-neutral-400 transition-all cursor-pointer shadow-2xs active:scale-95"
            title={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
            aria-label={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="20"
              height="20"
              fill={isWishlisted ? "#d62828" : "none"} 
              viewBox="0 0 24 24" 
              strokeWidth={1.5} 
              stroke={isWishlisted ? "#d62828" : "currentColor"} 
              className={isWishlisted ? "text-[#d62828]" : "text-[#111111]"}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-4.4-9.3-9C1.2 8.8 3 5 6.5 5c2 0 3.4 1.1 4.2 2.3h.6C12.1 6.1 13.5 5 15.5 5 19 5 20.8 8.8 21.3 12c-2.3 4.6-9.3 9-9.3 9z" />
            </svg>
          </button>
        </div>

        {/* Trust Badges - Tactile Clay Cards (MOBILE ONLY) */}
        <div
          className={`grid md:hidden ${
            isFreeShipping ? "grid-cols-3 gap-2 sm:gap-3.5" : "grid-cols-2 gap-2 sm:gap-3.5"
          } w-full my-2.5`}
        >
          {/* 1. COD & EMI available */}
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-gradient-to-b from-orange-50/80 to-amber-50/30 border border-orange-100/60 shadow-xs text-center group">
            <div className="w-8 h-8 rounded-full bg-orange-100/80 flex items-center justify-center shadow-2xs mb-1.5 shrink-0 group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-orange-500 shrink-0">
                <path d="M4.5 3.75a3 3 0 0 0-3 3v.75h21v-.75a3 3 0 0 0-3-3h-15Z" />
                <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-7.5Zm-18 3.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-[9.5px] sm:text-[10.5px] font-bold text-neutral-800 leading-tight">
              COD & EMI available
            </span>
          </div>

          {/* 2. 100% genuine products */}
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-gradient-to-b from-blue-50/80 to-indigo-50/30 border border-blue-100/60 shadow-xs text-center group">
            <div className="w-8 h-8 rounded-full bg-blue-100/80 flex items-center justify-center shadow-2xs mb-1.5 shrink-0 group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-blue-600 shrink-0">
                <path d="m23 12-2.44-2.78.34-3.68-3.61-.82-1.89-3.18L12 3 8.6 1.54 6.71 4.72l-3.61.81.34 3.68L1 12l2.44 2.78-.34 3.69 3.61.82 1.89 3.18L12 21l3.4 1.46 1.89-3.18 3.61-.82-.34-3.68L23 12zm-13 5-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
              </svg>
            </div>
            <span className="text-[9.5px] sm:text-[10.5px] font-bold text-neutral-800 leading-tight">
              100% Genuine
            </span>
          </div>

          {/* 3. Free shipping */}
          {isFreeShipping && (
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-gradient-to-b from-emerald-50/80 to-teal-50/30 border border-emerald-100/60 shadow-xs text-center group">
              <div className="w-8 h-8 rounded-full bg-emerald-100/80 flex items-center justify-center shadow-2xs mb-1.5 shrink-0 group-hover:scale-105 transition-transform">
                <svg viewBox="0 0 256 256" fill="currentColor" className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-600 shrink-0">
                  <path d="M244.8,111.37l-25-35.75A15.91,15.91,0,0,0,206.67,69.5H176V56a16,16,0,0,0-16-16H24A16,16,0,0,0,8,56V184a16,16,0,0,0,16,16H42.79a32,32,0,1,0,58.42,0h53.58a32,32,0,1,0,58.42,0H232a16,16,0,0,0,16-16V117.8A16,16,0,0,0,244.8,111.37ZM72,216a16,16,0,1,1,16-16A16,16,0,0,1,72,216Zm112,0a16,16,0,1,1,16-16A16,16,0,0,1,184,216Zm48-32H213.21a32,32,0,1,0-58.42,0H176V85.5h30.67l25.33,36.19Z" />
                </svg>
              </div>
              <span className="text-[9.5px] sm:text-[10.5px] font-bold text-neutral-800 leading-tight">
                Free Shipping
              </span>
            </div>
          )}
        </div>

        {/* Trust Badges - Clean Horizontal List (DESKTOP ONLY) */}
        <div className="hidden md:flex flex-wrap items-center gap-4 w-full my-2.5">
          {/* 1. 100% genuine products */}
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-blue-600 shrink-0">
              <path d="m23 12-2.44-2.78.34-3.68-3.61-.82-1.89-3.18L12 3 8.6 1.54 6.71 4.72l-3.61.81.34 3.68L1 12l2.44 2.78-.34 3.69 3.61.82 1.89 3.18L12 21l3.4 1.46 1.89-3.18 3.61-.82-.34-3.68L23 12zm-13 5-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
            </svg>
            <span className="text-xs font-bold text-[#374151]">
              100% Genuine
            </span>
          </div>

          {/* 2. COD & EMI available */}
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-orange-500 shrink-0">
              <path d="M4.5 3.75a3 3 0 0 0-3 3v.75h21v-.75a3 3 0 0 0-3-3h-15Z" />
              <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-7.5Zm-18 3.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-bold text-[#374151]">
              COD & EMI Available
            </span>
          </div>

          {/* 3. Free shipping */}
          {isFreeShipping && (
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 256 256" fill="currentColor" className="w-4 h-4 text-emerald-600 shrink-0">
                <path d="M244.8,111.37l-25-35.75A15.91,15.91,0,0,0,206.67,69.5H176V56a16,16,0,0,0-16-16H24A16,16,0,0,0,8,56V184a16,16,0,0,0,16,16H42.79a32,32,0,1,0,58.42,0h53.58a32,32,0,1,0,58.42,0H232a16,16,0,0,0,16-16V117.8A16,16,0,0,0,244.8,111.37ZM72,216a16,16,0,1,1,16-16A16,16,0,0,1,72,216Zm112,0a16,16,0,1,1,16-16A16,16,0,0,1,184,216Zm48-32H213.21a32,32,0,1,0-58.42,0H176V85.5h30.67l25.33,36.19Z" />
              </svg>
              <span className="text-xs font-bold text-[#374151]">
                Free shipping
              </span>
            </div>
          )}
        </div>

        {/* Short Description & Detailed Description Link */}
        {shortDescription && (
          <div className="mt-1">
            <div
              ref={descRef}
              onClick={(e) => handleRichTextClick(e, router)}
              className="text-[#3a3631] text-[13px] md:text-[14px] leading-relaxed font-sans"
              dangerouslySetInnerHTML={{ __html: cleanRichContent(shortDescription) }}
            />
            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                onClick={handleScrollToDetailedDescription}
                className="text-[#0000ff] hover:underline text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Detailed description
              </button>
            </div>
          </div>
        )}

        {/* Color and Size Selectors */}
        {(hasColors || hasSizes) && (
          <div className="border-t border-[#e6e1da] pt-4 mt-4 flex flex-wrap items-start gap-y-4 gap-x-5 sm:gap-x-7">
            {/* Color Swatches */}
            {hasColors && colors && (
              <div className="flex flex-row sm:flex-col items-center sm:items-start gap-2.5 sm:gap-2 w-full sm:w-auto shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#6b6560] shrink-0">
                  Colour:{" "}
                  <span 
                    className="text-[#111111] font-extrabold max-w-[140px] sm:max-w-[240px] truncate inline-block align-bottom"
                    title={selectedColor || colors[0]?.name}
                  >
                    {selectedColor || colors[0]?.name}
                  </span>
                </span>
                <div className="flex items-center flex-wrap gap-2 max-w-full sm:max-w-[240px]">
                  {colors.map((c) => {
                    const isSelected = (selectedColor || colors[0]?.name)?.trim().toLowerCase() === c.name.trim().toLowerCase();
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => onColorChange?.(c.name)}
                        className={`w-[28px] h-[28px] sm:w-[34px] sm:h-[34px] shrink-0 rounded-full border-[3px] border-[#faf8f5] transition-all cursor-pointer ${
                          isSelected
                            ? "shadow-[0_0_0_2px_#111111] scale-105"
                            : "shadow-[0_0_0_1px_#cfcfcf] hover:shadow-[0_0_0_1px_#111111]"
                        }`}
                        style={{ backgroundColor: c.background || "#111111" }}
                        title={c.name}
                        aria-label={c.name}
                        aria-pressed={isSelected}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Chips */}
            {hasSizes && sizes && (
              <div className="flex-1 w-full sm:w-auto min-w-[210px] sm:min-w-[240px] max-w-full">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#6b6560]">Size</span>
                  {sizeChart && (
                    <button
                      type="button"
                      onClick={() => setShowSizeModal(true)}
                      className="text-[#0000ff] hover:underline text-xs font-bold uppercase tracking-wider cursor-pointer shrink-0"
                    >
                      Size chart
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {sizes.map((s) => {
                    const isSelected = selectedSize?.trim().toLowerCase() === s.trim().toLowerCase();
                    const isDisabled = disabledSizes.some((d) => d.trim().toLowerCase() === s.trim().toLowerCase());
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onSizeChange?.(s)}
                        className={`flex-1 sm:flex-none min-w-[38px] sm:min-w-[42px] min-h-[38px] sm:min-h-[42px] px-2 sm:px-2.5 text-xs sm:text-[13px] font-semibold uppercase rounded-[6px] border shrink-0 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#111111] text-white border-[#111111] font-bold shadow-xs"
                            : isDisabled
                            ? "bg-[#f1eee9] border-[#e6e1da] text-[#8c857b] line-through hover:border-neutral-400"
                            : "bg-white text-[#111111] border-[#cfcfcf] hover:border-[#111111]"
                        }`}
                        aria-pressed={isSelected}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add to Cart CTA Button */}
        <div className="mt-5">
          <button
            type="button"
            onClick={handleAdd}
            disabled={isOutOfStock}
            className={`w-full min-h-[52px] sm:min-h-[54px] rounded-lg font-extrabold uppercase tracking-wider text-base text-white shadow-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
              isOutOfStock
                ? "bg-[#e3c2b0] text-[#7a5a48] cursor-not-allowed"
                : isAdded
                ? "bg-[#16a34a] hover:bg-[#15803d] text-white shadow-md shadow-green-600/25 scale-[1.01]"
                : "bg-[#d9480f] hover:bg-[#b83b0a] active:scale-[0.99]"
            }`}
          >
            {isAdded ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Added to cart</span>
              </>
            ) : isOutOfStock ? (
              "Restocking soon"
            ) : (
              "Add to cart"
            )}
          </button>
        </div>

      </div>

      {/* Size Chart Modal */}
      {sizeChart && (
        <SizeChartModal
          isOpen={showSizeModal}
          onClose={() => setShowSizeModal(false)}
          sizeChart={sizeChart}
          productName={name}
        />
      )}
    </>
  );
};
