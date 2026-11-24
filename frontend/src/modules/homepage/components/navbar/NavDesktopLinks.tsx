"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { NavItem } from "../../types/homepage.types";

interface NavDesktopLinksProps {
  items: NavItem[];
  isLight: boolean;
  isDarkSolid?: boolean;
  hoveredNavId: string | null;
  hoveredMenuId: string | null;
  onNavEnter: (id: string, hasMega: boolean) => void;
  onNavLeave: () => void;
}

/**
 * Desktop navigation links with hardware-accelerated animations
 * and high-performance mega menu dropdowns.
 * Rendered only on lg+ screens (hidden on mobile).
 */
export const NavDesktopLinks: React.FC<NavDesktopLinksProps> = ({
  items,
  isLight,
  isDarkSolid = false,
  hoveredNavId,
  hoveredMenuId,
  onNavEnter,
  onNavLeave,
}) => {
  return (
    <div
      className="hidden lg:flex flex-1 items-center justify-center px-0.5 xl:px-1 pointer-events-auto whitespace-nowrap static min-w-0"
      onMouseLeave={onNavLeave}
    >
      <div
        className={`relative flex items-center gap-0 xl:gap-0.5 2xl:gap-1 transition-all duration-300 ${
          isDarkSolid
            ? ""
            : isLight
            ? ""
            : "bg-black/45 backdrop-blur-md border border-white/20 shadow-[0_8px_30px_rgba(0,0,0,0.3)] rounded-full px-1 lg:px-1.5 xl:px-2 py-0.5 xl:py-1 ring-1 ring-white/10"
        }`}
      >
        {items.map((item) => {
          const isHovered = hoveredNavId === item.id;
          const isMenuOpen = hoveredMenuId === item.id;

          return (
            <div
              key={item.id}
              className={`group ${(item.megaMenuItems?.length ?? 0) <= 2 ? "relative" : "static"} ${
                isMenuOpen ? "z-50" : "z-10"
              }`}
              onMouseEnter={() => onNavEnter(item.id, !!(item.megaMenuItems || item.megaMenuFeatured))}
            >
              <Link
                href={item.href}
                className={`relative flex items-center gap-0.5 text-[9px] lg:text-[9.5px] xl:text-[10px] 2xl:text-[11px] font-sans font-semibold xl:font-bold leading-none tracking-tight xl:tracking-normal 2xl:tracking-wide uppercase px-1.5 lg:px-2 xl:px-2.5 py-1.5 rounded-md transition-all duration-150 z-10 cursor-pointer select-none active:scale-95 antialiased ${
                  isDarkSolid
                    ? isHovered
                      ? "text-white bg-white/20 shadow-xs"
                      : "text-white/90 hover:text-white hover:bg-white/10"
                    : isLight
                    ? isHovered
                      ? "text-neutral-950 bg-neutral-900/[0.08]"
                      : "text-neutral-700 hover:text-neutral-950 hover:bg-neutral-900/[0.05]"
                    : isHovered
                      ? "text-white bg-white/20 shadow-xs"
                      : "text-white/90 hover:text-white hover:bg-white/10"
                }`}
              >
                <span>{item.label}</span>
                {item.hasDropdown && (
                  <ChevronDownIcon
                    className={`hidden 2xl:inline-block w-2.5 h-2.5 transition-transform duration-200 stroke-[2] pointer-events-none ${
                      isMenuOpen
                        ? `rotate-180 ${isDarkSolid ? "text-white" : isLight ? "text-neutral-950" : "text-white"}`
                        : isDarkSolid
                        ? "text-white/70 group-hover:text-white"
                        : isLight
                        ? "text-neutral-400 group-hover:text-neutral-700"
                        : "text-white/70 group-hover:text-white"
                    }`}
                  />
                )}
              </Link>

              {/* Mega Menu Dropdown — mounts strictly when isMenuOpen is true to prevent any possibility of overlapping submenus */}
              {item.hasDropdown && (item.megaMenuItems || item.megaMenuFeatured) && isMenuOpen && (() => {
                // Pre-process mega menu groups: calculate visible items, headers, and column spans
                const processedGroups = (item.megaMenuItems || []).map((menuGroup) => {
                  const visibleItems = menuGroup.items.filter((link) => {
                    const cleanLabel = link.label.trim().toLowerCase();
                    const cleanGroup = menuGroup.group?.trim().toLowerCase();
                    const cleanParent = item.label.trim().toLowerCase();

                    if (cleanGroup && (cleanLabel === cleanGroup || (menuGroup.groupHref && link.href === menuGroup.groupHref))) {
                      return false;
                    }
                    if (cleanLabel === cleanParent || link.href === item.href) {
                      return false;
                    }
                    return true;
                  });

                  const shouldShowHeader = Boolean(
                    menuGroup.group &&
                    menuGroup.group.trim().toLowerCase() !== item.label.trim().toLowerCase()
                  );

                  // A group is dense/wide if it has more than 7 items and total groups is 3 or less
                  const isWide = visibleItems.length > 7 && (item.megaMenuItems?.length ?? 0) <= 3;
                  const isDense = visibleItems.length > 7;

                  return {
                    menuGroup,
                    visibleItems,
                    shouldShowHeader,
                    isWide,
                    isDense,
                  };
                });

                const totalCols = processedGroups.reduce((acc, g) => acc + (g.isWide ? 2 : 1), 0);

                let widthClass = "w-[280px]";
                if (item.megaMenuFeatured) {
                  widthClass = totalCols >= 3 ? "w-[980px] xl:w-[1120px]" : "w-[860px] xl:w-[980px]";
                } else if (totalCols >= 5) {
                  widthClass = "w-[980px] xl:w-[1120px]";
                } else if (totalCols === 4) {
                  widthClass = "w-[940px] xl:w-[1060px]";
                } else if (totalCols === 3) {
                  widthClass = "w-[760px] xl:w-[860px]";
                } else if (totalCols === 2) {
                  widthClass = "w-[540px] xl:w-[620px]";
                }

                const gridColsClass =
                  totalCols === 1
                    ? "grid-cols-1"
                    : totalCols === 2
                    ? "grid-cols-2"
                    : totalCols === 3
                    ? "grid-cols-3"
                    : totalCols === 4
                    ? "grid-cols-4"
                    : "grid-cols-5";

                return (
                  <div
                    className={`absolute top-full pt-3 z-50 pointer-events-auto ${
                      item.id === "helmets"
                        ? "left-0"
                        : item.id === "guides"
                        ? "right-0"
                        : "left-1/2 -translate-x-1/2"
                    }`}
                    onMouseEnter={() => onNavEnter(item.id, true)}
                    onMouseLeave={onNavLeave}
                  >
                    <div
                      className={`${widthClass} max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.22)] border border-neutral-200 overflow-hidden ring-1 ring-black/5 animate-mega-menu flex flex-col`}
                    >
                      <div className={`flex ${item.megaMenuFeatured ? "flex-row" : "flex-col"} max-h-[min(560px,calc(100vh-125px))] overflow-y-auto overscroll-contain scrollbar-thin`}>
                        {/* Left Side: Links */}
                        {item.megaMenuItems && (
                          <div className={`grid ${gridColsClass} ${
                            totalCols === 1 && !processedGroups[0]?.menuGroup.group
                              ? "gap-y-1 p-3"
                              : totalCols === 2
                              ? "gap-x-6 gap-y-6 p-6"
                              : "gap-x-6 gap-y-6 p-6 xl:p-8"
                          } ${item.megaMenuFeatured ? "w-[65%] border-r border-neutral-200/60" : "w-full"}`}>
                            {processedGroups.map((groupData, idx) => {
                              const { menuGroup, visibleItems, shouldShowHeader, isWide, isDense } = groupData;

                              return (
                                <div key={idx} className={`min-w-0 w-full ${isWide ? "col-span-2" : "col-span-1"}`}>
                                  {shouldShowHeader ? (
                                    menuGroup.groupHref ? (
                                      <Link href={menuGroup.groupHref} className="mb-3.5 block cursor-pointer">
                                        <h4 className="text-[12.5px] font-bold text-neutral-900 uppercase tracking-widest border-b border-neutral-200/60 pb-2 flex items-start gap-2 leading-snug hover:text-brand transition-colors">
                                          <span className="w-1.5 h-1.5 rounded-full bg-banner shadow-xs shrink-0 mt-1.5" />
                                          <span className="flex-1 min-w-0 break-words whitespace-normal">{menuGroup.group}</span>
                                        </h4>
                                      </Link>
                                    ) : (
                                      <h4 className="text-[12.5px] font-bold text-neutral-900 uppercase tracking-widest mb-3.5 border-b border-neutral-200/60 pb-2 flex items-start gap-2 leading-snug">
                                        <span className="w-1.5 h-1.5 rounded-full bg-banner shadow-xs shrink-0 mt-1.5" />
                                        <span className="flex-1 min-w-0 break-words whitespace-normal">{menuGroup.group}</span>
                                      </h4>
                                    )
                                  ) : null}
                                  <ul className={isWide ? "grid grid-cols-2 gap-x-5 gap-y-0.5 w-full" : "flex flex-col gap-1 w-full"}>
                                    {visibleItems.map((link, lIdx) => (
                                      <li key={lIdx} className="w-full">
                                        <Link
                                          href={link.href}
                                          className={`cursor-pointer ${
                                            !shouldShowHeader
                                              ? "text-[13px] font-medium text-neutral-700 hover:text-brand hover:bg-neutral-50 rounded-xl px-3 py-2 transition-colors duration-150 flex items-start gap-2 group w-full"
                                              : isDense
                                              ? "text-[12px] xl:text-[12.5px] font-medium text-neutral-600 hover:text-neutral-950 hover:bg-neutral-50 rounded-lg px-2 py-1 transition-colors duration-150 flex items-start gap-2 group w-full"
                                              : "text-[13px] font-medium text-neutral-600 hover:text-neutral-950 hover:bg-neutral-50 rounded-xl px-2 py-1.5 transition-colors duration-150 flex items-start gap-2.5 group w-full"
                                          }`}
                                        >
                                          {link.logoUrl ? (
                                            <div className="w-11 h-6 flex items-center justify-center shrink-0 mt-0.5">
                                              <Image 
                                                src={link.logoUrl} 
                                                alt={link.label} 
                                                width={44} 
                                                height={24} 
                                                unoptimized
                                                className="object-contain max-h-full max-w-full group-hover:scale-105 transition-transform duration-150"
                                              />
                                            </div>
                                          ) : link.imageUrl ? (
                                            <div className="relative w-6 h-6 rounded-md overflow-hidden shrink-0 mt-0.5 border border-neutral-200/80 bg-neutral-100">
                                              <Image 
                                                src={link.imageUrl} 
                                                alt={link.label} 
                                                fill 
                                                sizes="24px" 
                                                unoptimized
                                                className="object-cover group-hover:scale-105 transition-transform duration-150" 
                                              />
                                            </div>
                                          ) : null}
                                          <span className="group-hover:translate-x-1 transition-transform duration-150 flex-1 min-w-0 break-words whitespace-normal leading-snug flex items-center gap-1.5">
                                            <span>{link.label}</span>
                                            {link.badge && (
                                              <span className={`inline-flex items-center text-[8.5px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wide text-white shadow-2xs leading-none shrink-0 ${link.badgeColor || "bg-brand"}`}>
                                                {link.badge}
                                              </span>
                                            )}
                                          </span>
                                        </Link>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Right Side: Featured / Trending Products / Banner */}
                        {item.megaMenuFeatured && (
                          <div className="w-[35%] p-6 bg-neutral-50 flex flex-col h-full">
                            {item.megaMenuFeatured.title && (
                              <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-widest mb-4 flex items-center gap-1.5 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-banner" />
                                {item.megaMenuFeatured.title}
                              </h4>
                            )}
                            
                            {item.megaMenuFeatured.bannerImage ? (
                              <Link 
                                href={item.megaMenuFeatured.bannerImage.href}
                                className="relative w-full h-full min-h-[250px] rounded-xl overflow-hidden group flex-1 cursor-pointer"
                              >
                                <Image
                                  src={item.megaMenuFeatured.bannerImage.imageUrl}
                                  alt={item.megaMenuFeatured.bannerImage.altText || "Promotional Banner"}
                                  fill
                                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              </Link>
                            ) : item.megaMenuFeatured.items ? (
                              <div className="grid grid-cols-2 gap-4">
                                {item.megaMenuFeatured.items.map((feat, fIdx) => (
                                  <Link 
                                    key={fIdx} 
                                    href={feat.href}
                                    className="group flex flex-col gap-2 p-2 bg-white rounded-xl shadow-sm border border-neutral-100 hover:shadow-md hover:border-neutral-200 transition-all duration-200 cursor-pointer"
                                  >
                                    <div className="relative w-full aspect-square bg-neutral-100 rounded-lg overflow-hidden flex items-center justify-center">
                                      {feat.imageUrl ? (
                                        <Image 
                                          src={feat.imageUrl}
                                          alt={feat.name}
                                          fill
                                          sizes="120px"
                                          className="object-contain group-hover:scale-105 transition-transform duration-300 p-1"
                                        />
                                      ) : (
                                        <span className="text-xs text-neutral-400">No Image</span>
                                      )}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[11px] font-semibold text-neutral-800 leading-tight line-clamp-2">
                                        {feat.name}
                                      </span>
                                      {feat.priceFormatted && (
                                        <span className="text-xs font-bold text-neutral-900 mt-1">
                                          {feat.priceFormatted}
                                        </span>
                                      )}
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                      {item.id === "shop-by-brand" && (
                        <div className="w-full bg-neutral-50/90 border-t border-neutral-200/70 px-8 py-3 flex items-center justify-between">
                          <span className="text-xs text-neutral-500 font-medium">
                            Looking for all riding gear & accessory brands?
                          </span>
                          <Link 
                            href="/brands" 
                            className="text-xs font-bold text-brand hover:text-red-700 flex items-center gap-1.5 transition-colors group cursor-pointer"
                          >
                            <span>Explore All Brands (A–Z Directory)</span>
                            <span className="group-hover:translate-x-1 transition-transform">→</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
};
