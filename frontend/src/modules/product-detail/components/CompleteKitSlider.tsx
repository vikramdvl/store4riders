"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { KitProduct } from "../types/product-detail.types";

const KitImage = ({ src, alt }: { src: string, alt: string }) => {
  const [error, setError] = React.useState(false);
  
  return (
    <Image
      src={error ? "/no-image.svg" : src}
      alt={alt}
      fill
      unoptimized
      className={`object-contain mix-blend-multiply ${error ? 'opacity-50' : ''}`}
      sizes="(max-width: 768px) 115px, 125px"
      onError={() => setError(true)}
    />
  );
};

export const CompleteKitSlider: React.FC<{ products: KitProduct[] }> = ({ products }) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  if (!products || products.length === 0) return null;

  const handleScroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 140;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="w-full relative rounded-xl border border-[#e6e1da] bg-white p-3.5 sm:p-4 shadow-2xs overflow-hidden group/kit">
      {/* Header with badge */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-4.5 bg-[#d9480f] rounded-xs shrink-0" />
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#111111] leading-tight">
              Complete Your Kit
            </h3>
          </div>
        </div>

        {/* Scroll Arrows on Desktop */}
        {products.length > 2 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleScroll("left")}
              className="w-6 h-6 rounded-full bg-white border border-[#cfcfcf] shadow-2xs flex items-center justify-center text-[#111111] hover:border-[#111111] transition-all cursor-pointer"
              aria-label="Previous"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            <button
              onClick={() => handleScroll("right")}
              className="w-6 h-6 rounded-full bg-white border border-[#cfcfcf] shadow-2xs flex items-center justify-center text-[#111111] hover:border-[#111111] transition-all cursor-pointer"
              aria-label="Next"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
          </div>
        )}
      </div>
      
      {/* Products Row / Grid */}
      {products.length <= 4 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 relative z-10">
          {products.map((product) => (
            <Link 
              key={product.id} 
              href={product.productUrl}
              className="block group cursor-pointer transform-gpu"
            >
              {/* Image Container */}
              <div className="relative aspect-square w-full bg-[#f1eee9] rounded-lg overflow-hidden mb-2 border border-[#e6e1da] group-hover:border-neutral-400 transition-colors pointer-events-none">
                <KitImage src={product.imageUrl} alt={product.name} />
              </div>

              {/* Typography Details */}
              <div className="px-0.5">
                <h4 className="text-[11px] sm:text-xs font-semibold text-[#111111] font-sans line-clamp-2 leading-tight group-hover:underline transition-all">
                  {product.name}
                </h4>
                <div className="mt-1 pt-0.5">
                  <span className="text-xs sm:text-[13px] font-extrabold text-[#111111] font-sans">
                    {product.priceFormatted}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div 
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto scrollbar-none py-1 relative z-10"
        >
          {products.map((product) => (
            <Link 
              key={product.id} 
              href={product.productUrl}
              className="shrink-0 w-[115px] sm:w-[130px] block group cursor-pointer transform-gpu"
            >
              {/* Image Container */}
              <div className="relative aspect-square w-full bg-[#f1eee9] rounded-lg overflow-hidden mb-2 border border-[#e6e1da] group-hover:border-neutral-400 transition-colors pointer-events-none">
                <KitImage src={product.imageUrl} alt={product.name} />
              </div>

              {/* Typography Details */}
              <div className="px-0.5">
                <h4 className="text-[11px] sm:text-xs font-semibold text-[#111111] font-sans line-clamp-2 leading-tight group-hover:underline transition-all">
                  {product.name}
                </h4>
                <div className="mt-1 pt-0.5">
                  <span className="text-xs sm:text-[13px] font-extrabold text-[#111111] font-sans">
                    {product.priceFormatted}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
