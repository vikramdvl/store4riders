"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cleanRichContent, handleRichTextClick } from "@/core/utils/cleanRichContent";
import { ISpecFieldDefinition, IProductSpecification } from "@store4riders/shared-types";
import { buildSpecificationsFromTemplate, isJunkSpecValue } from "@store4riders/shared-utils";
import { ReviewData } from "../types/product-detail.types";
import { WriteReviewModal } from "./WriteReviewModal";
import { AllReviewsModal } from "./AllReviewsModal";

/* ─── SVG Icon Components ─── */
const LayersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>
);

const cleanHtml = (html: string): string => {
  if (!html) return "";
  return cleanRichContent(html);
};

/**
 * DetailAndReviews Component
 *
 * Clean, modern e-commerce specifications & reviews module.
 * Technical Specifications & Standards are rendered strictly through the
 * Category Specifications & Attributes Template for a unified UX across each category.
 */
export const DetailAndReviews: React.FC<{
  fullDescription: string;
  reviews: ReviewData[];
  productId?: string;
  productName?: string;
  brand?: string;
  brandSlug?: string;
  brandLogo?: string;
  attributes?: Record<string, string>;
  specTemplate?: ISpecFieldDefinition[];
  specifications?: IProductSpecification[];
}> = ({
  fullDescription,
  reviews,
  productId,
  productName,
  brand,
  brandSlug,
  brandLogo,
  attributes,
  specTemplate,
  specifications,
}) => {
  const router = useRouter();
  const parsedDescription = React.useMemo(() => cleanHtml(fullDescription), [fullDescription]);
  const [isMobileDescExpanded, setIsMobileDescExpanded] = React.useState(false);

  // Strictly driven by the Category Specifications & Attributes Template
  const displayableSpecs = React.useMemo(() => {
    if (Array.isArray(specifications) && specifications.length > 0) {
      return specifications
        .filter((spec) => spec && spec.label?.trim() && spec.value?.trim() && !isJunkSpecValue(spec.value))
        .map((spec) => ({
          rawKey: spec.key,
          label: spec.label.trim(),
          value: spec.value.trim(),
          isHighlight: Boolean(spec.isHighlight),
        }));
    }

    if (Array.isArray(specTemplate) && specTemplate.length > 0 && attributes) {
      return buildSpecificationsFromTemplate(specTemplate, attributes).map((spec) => ({
        rawKey: spec.key,
        label: spec.label,
        value: spec.value,
        isHighlight: Boolean(spec.isHighlight),
      }));
    }

    return [];
  }, [specifications, specTemplate, attributes]);

  React.useEffect(() => {
    const handleExpand = () => setIsMobileDescExpanded(true);
    window.addEventListener("expand-product-detail-description", handleExpand);
    return () => window.removeEventListener("expand-product-detail-description", handleExpand);
  }, []);

  return (
    <div className="w-full">

      {/* ── Section Header Bar ── */}
      <div id="product-detail-description" className="w-full bg-[#161616] py-3.5 px-4 sm:px-8 rounded-xl shadow-xs scroll-mt-20 border border-[#2a2a2a]">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-12">
          <h2 className="font-heading text-xs sm:text-sm font-extrabold uppercase tracking-wider sm:tracking-[0.2em] text-white flex items-center justify-center lg:justify-start gap-2 sm:gap-3 whitespace-nowrap overflow-hidden">
            <span className="w-4 sm:w-6 md:w-8 h-[2px] bg-[#d9480f] shrink-0" />
            <span>Product Detail Description</span>
            <span className="w-4 h-[2px] bg-[#d9480f] shrink-0 lg:hidden" />
          </h2>
          <h2 className="hidden lg:flex font-heading text-xs sm:text-sm font-extrabold uppercase tracking-[0.2em] text-white items-center gap-3 pl-6">
            <span className="w-8 h-[2px] bg-[#d9480f]" />
            Customer Reviews
          </h2>
        </div>
      </div>

      {/* ── 2-Column Content ── */}
      <div className="max-w-[1400px] mx-auto px-0 sm:px-2 pt-3 md:pt-8 pb-0 md:pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-12 items-start">

          {/* ─── LEFT: Product Details Card ─── */}
          <div id="product-description-card" className="min-w-0 bg-white border border-neutral-200 rounded-xl p-3.5 sm:p-7 shadow-xs scroll-mt-20">
            {/* Inner Header - Hidden on mobile to prevent duplicate heading */}
            <div className="hidden md:flex items-center gap-3 pb-4 mb-6 border-b border-neutral-100">
              <span className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100/80 flex items-center justify-center text-[#d9480f]">
                <LayersIcon />
              </span>
              <div>
                <h3 className="font-heading text-sm md:text-base font-bold text-[#111111] uppercase tracking-wide">
                  Features & Specifications
                </h3>
                <p className="text-[11px] text-[#6b6560] font-medium">
                  Technical gear details & rider ergonomics
                </p>
              </div>
            </div>

            {/* Brand Banner with direct link to Brand Page */}
            {brand && (
              <div className="mb-5 p-3 sm:p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-[#111111] font-black text-xs shrink-0 shadow-2xs">
                    {brand.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-[10px] sm:text-[11px] font-bold text-[#6b6560] uppercase tracking-wider block">
                      Brand
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold text-[#111111] uppercase">
                      {brand}
                    </span>
                  </div>
                </div>

                {brandSlug && (
                  <Link
                    href={`/brands/${brandSlug}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#cfcfcf] hover:border-[#0000ff] text-xs font-bold text-[#0000ff] transition-all shadow-2xs group"
                  >
                    <span>View all {brand} products</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-[#0000ff] group-hover:translate-x-0.5 transition-all">
                      <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                    </svg>
                  </Link>
                )}
              </div>
            )}

            {/* Render legacy Magento HTML exactly as it is without accordions */}
            <div
              onClick={(e) => handleRichTextClick(e, router)}
              className="magento-layout text-neutral-700 text-[15px] sm:text-[16px] leading-[1.65]"
            >
                <div
                  className={!isMobileDescExpanded ? "max-h-[280px] sm:max-h-[380px] lg:max-h-none overflow-hidden lg:overflow-visible relative" : ""}
                  dangerouslySetInnerHTML={{
                    __html:
                      parsedDescription ||
                      "<p class='text-neutral-400 italic'>Detailed specifications will be updated shortly.</p>",
                  }}
                />
                
                {!isMobileDescExpanded && parsedDescription.length > 300 && (
                  <div className="relative mt-2 lg:hidden">
                    <div className="absolute bottom-full left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={() => setIsMobileDescExpanded(true)}
                        className="flex items-center gap-2 text-xs font-extrabold text-[#d9480f] uppercase tracking-wider py-2.5 px-6 border border-[#d9480f] bg-white hover:bg-[#d9480f] hover:text-white rounded-md transition-all duration-100 active:scale-95 select-none shadow-2xs cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
                        View More
                      </button>
                    </div>
                  </div>
                )}
                
                {isMobileDescExpanded && (
                  <div className="flex justify-center mt-6 pt-4 border-t border-neutral-100 lg:hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileDescExpanded(false);
                        setTimeout(() => {
                          document.getElementById("product-description-card")?.scrollIntoView({ 
                            behavior: "smooth", 
                            block: "center" 
                          });
                        }, 100);
                      }}
                      className="flex items-center gap-2 text-xs font-extrabold text-[#d9480f] uppercase tracking-wider py-2.5 px-6 border border-[#d9480f] bg-white hover:bg-[#d9480f] hover:text-white rounded-md transition-all duration-100 active:scale-95 select-none shadow-2xs cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/></svg>
                      View Less
                    </button>
                  </div>
                )}
              </div>

            {/* ─── Technical Specifications & Attributes Table ─── */}
            {displayableSpecs.length > 0 && (
              <section
                aria-labelledby="technical-specs-heading"
                className="mt-6 sm:mt-7 pt-5 sm:pt-6 border-t border-neutral-200/90"
              >
                <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                  <div className="bg-neutral-50/90 border-b border-neutral-200/80 px-3.5 py-3 sm:px-5 sm:py-3.5 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        aria-hidden="true"
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-[#ab1509] shrink-0"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                          <path d="m9 12 2 2 4-4"/>
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <h4
                          id="technical-specs-heading"
                          className="spec-heading-balance font-heading text-xs sm:text-sm font-bold text-neutral-900 uppercase tracking-wide leading-snug"
                        >
                          Technical Specifications & Standards
                        </h4>
                        <p className="text-[11px] text-neutral-500 font-medium leading-snug mt-0.5">
                          Verified manufacturer parameters &amp; rider protection
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] sm:text-[11px] font-bold shrink-0 whitespace-nowrap">
                      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Verified Gear Specs
                    </span>
                  </div>

                  <div
                    className="specs-table-container w-full"
                    role="region"
                    aria-labelledby="technical-specs-heading"
                  >
                    <table
                      aria-labelledby="technical-specs-heading"
                      className="specs-table w-full border-collapse text-left"
                    >
                      <thead className="sr-only">
                        <tr>
                          <th scope="col">Specification</th>
                          <th scope="col">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {displayableSpecs.map(({ rawKey, label, value, isHighlight }, idx) => (
                          <tr
                            key={rawKey}
                            className={`specs-row transition-colors ${
                              idx % 2 === 0 ? "bg-white" : "bg-neutral-50/40"
                            }`}
                          >
                            <th
                              scope="row"
                              className="specs-label w-[44%] sm:w-[40%] px-3.5 sm:px-5 py-2.5 sm:py-3 align-top text-left font-semibold text-[11.5px] sm:text-[13px] text-neutral-600 bg-neutral-50/60 border-r border-neutral-100 leading-snug break-words"
                            >
                              {label}
                            </th>
                            <td className="specs-value w-[56%] sm:w-[60%] px-3.5 sm:px-5 py-2.5 sm:py-3 align-top font-semibold text-xs sm:text-sm text-neutral-900 leading-snug break-words">
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <span className="min-w-0 break-words">{value}</span>
                                {isHighlight && (
                                  <span className="text-[9.5px] sm:text-[10px] uppercase tracking-wider font-extrabold text-[#ab1509] bg-red-50 border border-red-200/80 px-1.5 sm:px-2 py-0.5 rounded-sm shrink-0">
                                    Core Spec
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* ─── RIGHT: Reviews (Desktop only: sticky on scroll) ─── */}
          <div className="hidden lg:flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start min-w-0">
            <CustomerReviews reviews={reviews} productId={productId} productName={productName} />
          </div>

        </div>
      </div>
    </div>
  );
};

/**
 * CustomerReviews Component
 * Rendered side-by-side on desktop, or below Recently Viewed on mobile.
 */
export const CustomerReviews: React.FC<{
  reviews: ReviewData[];
  productId?: string;
  productName?: string;
}> = ({ reviews, productId, productName }) => {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isAllReviewsModalOpen, setIsAllReviewsModalOpen] = React.useState(false);

  const averageRating = React.useMemo(() => {
    if (!reviews || reviews.length === 0) return 0;
    const total = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
    return (total / reviews.length).toFixed(1);
  }, [reviews]);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Rating Summary Card */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="text-center shrink-0 pr-3 border-r border-neutral-100">
            <p className="text-2xl sm:text-3xl font-extrabold text-[#111111] leading-none">{reviews?.length > 0 ? averageRating : "–"}</p>
            <div className="flex text-[#f5a623] mt-1 justify-center">
              {[...Array(5)].map((_, i) => (
                <svg key={i} xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
                  fill={reviews?.length > 0 && i < Math.round(Number(averageRating)) ? "currentColor" : "none"}
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                ><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              ))}
            </div>
            <p className="text-[10px] text-[#6b6560] mt-0.5 font-medium">{reviews?.length || 0} reviews</p>
          </div>
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviews?.filter(r => Math.round(r.rating) === star).length || 0;
              const percent = reviews?.length ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#6b6560] w-2.5 font-medium">{star}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" className="text-[#f5a623] shrink-0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                  <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#f5a623] rounded-full transition-all" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="text-[10px] text-[#6b6560] w-4 text-right font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {reviews && reviews.length > 0 ? (
        <>
          {reviews.slice(0, 3).map((review) => (
            <div key={review.id || review._id} className="border border-neutral-200 rounded-xl p-3 hover:shadow-xs transition-shadow bg-white">
              <div className="flex items-start gap-2.5 mb-1.5">
                <div className="w-7 h-7 rounded-full bg-[#ab1509] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                  {(review.author || "R").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-1.5">
                    <p className="font-semibold text-neutral-900 text-xs truncate">{review.author}</p>
                    {review.city && (
                      <span className="text-[10px] text-neutral-500 flex items-center gap-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#FF5429]">
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        {review.city}
                      </span>
                    )}
                    {review.isVerified === true && (
                      <span className="text-[8px] font-bold uppercase tracking-wider text-green-700 bg-green-50 px-1 py-0.5 rounded-xs border border-green-200">
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="flex text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                          fill={i < Math.round(review.rating) ? "currentColor" : "none"}
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        ><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                      ))}
                    </div>
                    <span className="text-[10px] text-neutral-400 ml-1">{review.date}</span>
                  </div>
                </div>
              </div>
              <p className="text-neutral-600 text-xs leading-relaxed pl-9.5 break-words line-clamp-2">{review.text}</p>
            </div>
          ))}

          {/* Action Buttons: Compact layout fitting directly in the viewport frame */}
          <div className="flex flex-col gap-2 pt-0.5">
            {reviews.length > 3 && (
              <button
                type="button"
                onClick={() => setIsAllReviewsModalOpen(true)}
                className="w-full py-2 px-3 text-xs font-bold text-[#ab1509] hover:text-white bg-red-50 hover:bg-[#ab1509] border border-red-200 rounded-lg transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-98"
              >
                <span>See all product reviews ({reviews.length})</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </button>
            )}

            {/* Write a Review CTA Button */}
            <button 
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="w-full py-2 px-3 border border-[#d9480f] text-[#d9480f] bg-white hover:bg-[#d9480f] hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 shadow-2xs"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                <path d="m15 5 4 4"/>
              </svg>
              <span>Write a Review</span>
            </button>
          </div>
        </>
      ) : (
        <div className="border border-neutral-200 rounded-lg p-6 text-center bg-white">
          <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <p className="text-neutral-700 font-semibold text-xs">No reviews yet</p>
          <p className="text-neutral-400 text-[11px] mt-1 max-w-[220px] mx-auto">Be the first rider to review this product.</p>
          <div className="mt-3">
            <button 
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="w-full py-2 px-3 border border-[#d9480f] text-[#d9480f] bg-white hover:bg-[#d9480f] hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 shadow-2xs"
            >
              <span>Write a Review</span>
            </button>
          </div>
        </div>
      )}

      {/* Write Review Modal */}
      <WriteReviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productId={productId || ""}
        productName={productName || "Product"}
      />

      {/* All Reviews Modal */}
      <AllReviewsModal
        isOpen={isAllReviewsModalOpen}
        onClose={() => setIsAllReviewsModalOpen(false)}
        reviews={reviews}
        productName={productName || "Product"}
        averageRating={averageRating}
        onWriteReview={() => setIsModalOpen(true)}
      />
    </div>
  );
};
