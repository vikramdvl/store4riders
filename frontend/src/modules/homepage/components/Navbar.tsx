"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Bars3Icon, ShoppingBagIcon, MagnifyingGlassIcon, XMarkIcon, HeartIcon, UserIcon } from "@heroicons/react/24/outline";
import { NavbarProps } from "../types/homepage.types";
import { useCartStore } from "@/stores/useCartStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLogout } from "@/core/hooks/useAuth";
import { useBrands } from "@/core/hooks/useBrands";
import { useCategoryTree } from "@/core/hooks/useCategories";
import { SearchAutocomplete } from "@/modules/search/components/SearchAutocomplete";
import { NavItem } from "../types/homepage.types";
import { DEFAULT_NAV_ITEMS } from "./navbar/nav.constants";
import { NavDesktopLinks } from "./navbar/NavDesktopLinks";
import { NavUserMenu } from "./navbar/NavUserMenu";
import { NavMobileDrawer } from "./navbar/NavMobileDrawer";

/**
 * Navbar — thin orchestration shell.
 * All visual sub-sections live in ./navbar/:
 *   NavDesktopLinks  → desktop links + mega menu
 *   NavUserMenu      → desktop user dropdown
 *   NavMobileDrawer  → mobile slide-in drawer
 *   nav.constants    → DEFAULT_NAV_ITEMS data
 */
export const Navbar: React.FC<NavbarProps> = ({
  logoText = "Store4Riders",
  navItems,
  onSearch,
  onAccountClick,
  theme = "dark-solid",
  hasTopBanner = true,
}) => {
  const items = useCartStore((state) => state.items);
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
    logoutMutation.mutate();
  };

  const [mounted, setMounted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [hoveredNavId, setHoveredNavId] = useState<string | null>(null);
  const [hoveredMenuId, setHoveredMenuId] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null!);
  const navCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleNavEnter = (id: string, hasMega: boolean) => {
    if (navCloseTimeoutRef.current) {
      clearTimeout(navCloseTimeoutRef.current);
      navCloseTimeoutRef.current = null;
    }
    setHoveredNavId(id);
    setHoveredMenuId(hasMega ? id : null);
  };

  const handleNavLeave = () => {
    if (navCloseTimeoutRef.current) {
      clearTimeout(navCloseTimeoutRef.current);
    }
    navCloseTimeoutRef.current = setTimeout(() => {
      setHoveredNavId(null);
      setHoveredMenuId(null);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (navCloseTimeoutRef.current) clearTimeout(navCloseTimeoutRef.current);
    };
  }, []);

  useEffect(() => { setMounted(true); }, []);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMobileMenuOpen]);

  // Optimized scroll listener (rAF-based, zero jitter)
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const totalItemCount = mounted ? items.reduce((sum, i) => sum + (i.quantity || 1), 0) : 0;
  const isLight = theme === "light" || (theme !== "dark-solid" && isScrolled);
  
  const { data: dbBrands } = useBrands(true);
  const { data: dbCategories } = useCategoryTree();

  // Preserves strict DEFAULT_NAV_ITEMS structure, overlaying dynamic subcategories, badges & visibility from DB
  const activeNavItems = useMemo(() => {
    const baseItems = navItems || DEFAULT_NAV_ITEMS;

    // Helper to check if a menu link matches a database brand
    const isMatchingBrand = (
      subItem: { href: string; label: string },
      b: { slug?: string; name?: string; aliases?: string[] }
    ): boolean => {
      const hrefSlug = (subItem.href || "").replace(/^\/brands\/?/, "").split("?")[0].toLowerCase().trim();
      const labelLower = (subItem.label || "").toLowerCase().trim();

      const bSlug = (b.slug || "").toLowerCase().trim();
      const bName = (b.name || "").toLowerCase().trim();
      const bAliases = Array.isArray(b.aliases)
        ? b.aliases.map((a) => a.toLowerCase().trim())
        : [];

      if (bSlug && hrefSlug) {
        if (bSlug === hrefSlug) return true;
        if (hrefSlug === `${bSlug}-helmets` || hrefSlug === `${bSlug}-gear` || hrefSlug === `${bSlug}-gears`) return true;
        if (bSlug === `${hrefSlug}-helmets` || bSlug === `${hrefSlug}-gear` || bSlug === `${hrefSlug}-gears`) return true;
      }

      if (hrefSlug && bAliases.includes(hrefSlug)) return true;

      if (bName && labelLower) {
        if (bName === labelLower) return true;
        const cleanLabel = labelLower.replace(/\s+(helmets|gear|gears|boots|protection|protectors|parts|performance|air filter|spark plugs|chains|exhaust)\b/gi, "").trim();
        const cleanName = bName.replace(/\s+(helmets|gear|gears|boots|protection|protectors|parts|performance|air filter|spark plugs|chains|exhaust)\b/gi, "").trim();
        if (cleanLabel && cleanName && cleanLabel === cleanName) return true;
        if (cleanLabel.length >= 3 && cleanName.length >= 3 && (cleanLabel.includes(cleanName) || cleanName.includes(cleanLabel))) return true;
      }

      return false;
    };

    // Helper to match a brand's menuGroup with a column group in shop-by-brand
    const isGroupMatch = (brandGroup: string, targetGroup: string): boolean => {
      const bg = brandGroup.toLowerCase().trim();
      const tg = targetGroup.toLowerCase().trim();
      if (bg === tg) return true;
      if (bg.includes("helmet") && tg.includes("helmet")) return true;
      if (bg.includes("gear") && tg.includes("gear")) return true;
      if (bg.includes("boot") && tg.includes("boot")) return true;
      if (bg.includes("protection") && tg.includes("protection")) return true;
      if (bg.includes("luggage") && tg.includes("luggage")) return true;
      if (bg.includes("accessor") && tg.includes("accessor")) return true;
      if (bg.includes("part") && tg.includes("part")) return true;
      if (bg.includes("performance") && tg.includes("performance")) return true;
      if (bg.includes("maintenance") && tg.includes("performance")) return true;
      if (bg.includes("care") && tg.includes("performance")) return true;
      return false;
    };

    // Flatten DB categories
    const flatDbCategories: any[] = [];
    const traverse = (nodes: any[]) => {
      if (!Array.isArray(nodes)) return;
      for (const n of nodes) {
        flatDbCategories.push(n);
        if (n.children && n.children.length > 0) traverse(n.children);
      }
    };
    if (dbCategories && Array.isArray(dbCategories)) {
      traverse(dbCategories);
    }

    // Set of slugs explicitly hidden from menu
    const hiddenSlugs = new Set<string>();
    flatDbCategories.forEach((c) => {
      if (c.includeInMenu === false && c.slug) {
        hiddenSlugs.add(c.slug.trim().toLowerCase());
      }
    });

    // Custom items mapped by Target Submenu Section (e.g. "helmets:types")
    const customBySection = new Map<string, any[]>();
    flatDbCategories.forEach((c) => {
      if (c.includeInMenu === false) return;

      let secKey = c.menuNavSection ? c.menuNavSection.trim().toLowerCase() : "";

      // If no explicit menuNavSection, auto-resolve section from parent category
      if (!secKey && c.parentId) {
        const pId = String(c.parentId).toLowerCase();
        const parentDoc = flatDbCategories.find(
          (p) =>
            String(p._id).toLowerCase() === pId ||
            String(p.slug).toLowerCase() === pId ||
            String(p.id).toLowerCase() === pId
        );
        const parentSlug = (parentDoc?.slug || pId).toLowerCase().trim();
        const parentName = (parentDoc?.name || "").toLowerCase().trim();

        for (const baseNav of baseItems) {
          if (!baseNav.megaMenuItems) continue;
          // Strictly exclude Brand navigation and Guides from category auto-resolution
          if (
            baseNav.id === "shop-by-brand" ||
            baseNav.id === "guides" ||
            baseNav.href === "/brands" ||
            baseNav.href === "/guides" ||
            baseNav.label.toLowerCase().includes("brand")
          ) {
            continue;
          }

          for (const grp of baseNav.megaMenuItems) {
            const grpHrefLeaf = grp.groupHref ? grp.groupHref.split("?")[0].split("/").filter(Boolean).pop()?.toLowerCase() || "" : "";
            const matchesGroup = grpHrefLeaf === parentSlug || (grp.group && grp.group.toLowerCase().trim() === parentName);
            const matchesSubItem = grp.items.some((sub) => {
              const subLeaf = sub.href.split("?")[0].split("/").filter(Boolean).pop()?.toLowerCase() || "";
              return subLeaf === parentSlug || (sub.label && sub.label.toLowerCase().trim() === parentName);
            });

            // Auto-resolve when parent matches a group or an existing subcategory item in this group
            if (matchesGroup || matchesSubItem) {
              secKey = `${baseNav.id.toLowerCase()}:${(grp.group || "").toLowerCase().trim()}`;
              break;
            }
          }
          if (secKey) break;
        }
      }

      if (
        secKey &&
        !secKey.startsWith("shop-by-brand") &&
        !secKey.startsWith("brands") &&
        !secKey.startsWith("guides")
      ) {
        if (!customBySection.has(secKey)) customBySection.set(secKey, []);
        customBySection.get(secKey)!.push(c);
      }
    });

    const popularBrandsList = Array.isArray(dbBrands)
      ? dbBrands.filter(
          (b) =>
            b.isActive !== false &&
            ((b.menuGroups && b.menuGroups.some((g) => g.toLowerCase().includes("popular"))) ||
              (b.menuGroup && b.menuGroup.toLowerCase().includes("popular")))
        )
      : [];

    return baseItems.map((item) => {
      if (!item.megaMenuItems) return item;

      const isBrandNav =
        item.id === "shop-by-brand" ||
        item.href === "/brands" ||
        item.label.toLowerCase().includes("brand");

      const updatedMegaMenuItems = item.megaMenuItems.map((group) => {
        const groupKey = `${item.id.toLowerCase()}:${(group.group || "").toLowerCase().trim()}`;
        const currentGroupLower = (group.group || "").toLowerCase().trim();
        const sectionCustomCategories = customBySection.get(groupKey) || [];

        // 1. Filter out hidden items (Categories + Brands)
        let visibleItems = group.items.filter((subItem) => {
          const leaf = subItem.href.split("?")[0].split("/").filter(Boolean).pop()?.toLowerCase() || "";
          if (hiddenSlugs.has(leaf)) return false;

          // For brand navigation: enforce showInMenu, isActive, and column placement
          if (isBrandNav && Array.isArray(dbBrands)) {
            const matchedDbBrand = dbBrands.find((b) => isMatchingBrand(subItem, b));
            if (matchedDbBrand) {
              // Unticked in Admin OR Inactive -> HIDE IMMEDIATELY
              if (matchedDbBrand.showInMenu === false || matchedDbBrand.isActive === false) {
                return false;
              }

              // If the brand is explicitly assigned to specific groups, check if it belongs to this column
              const brandGroups = (
                Array.isArray(matchedDbBrand.menuGroups) && matchedDbBrand.menuGroups.length > 0
                  ? matchedDbBrand.menuGroups
                  : matchedDbBrand.menuGroup
                  ? [matchedDbBrand.menuGroup]
                  : []
              ).filter((g) => !g.toLowerCase().includes("popular"));

              if (brandGroups.length > 0) {
                const belongsHere = brandGroups.some((bg) => isGroupMatch(bg, currentGroupLower));
                if (!belongsHere) {
                  return false;
                }
              }
            }
          }

          return true;
        });

        // 2. Overlay brand popular badges, update logos/names, and append new brands
        if (isBrandNav && Array.isArray(dbBrands)) {
          // A. Update existing items in visibleItems with DB data (logo, name, popular badge)
          visibleItems = visibleItems.map((subItem) => {
            const matchedDbBrand = dbBrands.find((b) => isMatchingBrand(subItem, b));
            const isPopular = popularBrandsList.some((pb) => isMatchingBrand(subItem, pb));

            return {
              ...subItem,
              label: matchedDbBrand?.name || subItem.label,
              href: matchedDbBrand?.slug ? `/brands/${matchedDbBrand.slug}` : subItem.href,
              logoUrl: matchedDbBrand?.logo || subItem.logoUrl,
              badge: isPopular ? "Popular" : subItem.badge,
              badgeColor: isPopular ? "bg-brand" : subItem.badgeColor,
            };
          });

          // B. Append active brands assigned to this group in DB that aren't already in visibleItems
          dbBrands.forEach((b) => {
            if (b.isActive === false || b.showInMenu === false) return;

            const brandGroups = (
              Array.isArray(b.menuGroups) && b.menuGroups.length > 0
                ? b.menuGroups
                : b.menuGroup
                ? [b.menuGroup]
                : []
            ).filter((g) => !g.toLowerCase().includes("popular"));

            const belongsToThisGroup = brandGroups.some((bg) => isGroupMatch(bg, currentGroupLower));
            if (!belongsToThisGroup) return;

            const alreadyInGroup = visibleItems.some((sub) => isMatchingBrand(sub, b));
            if (!alreadyInGroup) {
              const isPopular = popularBrandsList.some((pb) => isMatchingBrand({ href: `/brands/${b.slug}`, label: b.name }, pb));
              visibleItems.push({
                label: b.name,
                href: `/brands/${b.slug}`,
                logoUrl: b.logo || undefined,
                badge: isPopular ? "Popular" : undefined,
                badgeColor: isPopular ? "bg-brand" : undefined,
              });
            }
          });
        }

        // 3. Append custom categories configured for this section (Never into Brands or Guides)
        if (!isBrandNav && item.id !== "guides" && item.href !== "/guides" && sectionCustomCategories.length > 0) {
          sectionCustomCategories.forEach((cat) => {
            const catSlug = (cat.slug || "").trim().toLowerCase();
            const existingIndex = visibleItems.findIndex((sub) => {
              const subLeaf = sub.href.split("?")[0].split("/").filter(Boolean).pop()?.toLowerCase() || "";
              return subLeaf === catSlug;
            });

            if (existingIndex >= 0) {
              // Update label/badge if already in menu
              visibleItems[existingIndex] = {
                ...visibleItems[existingIndex],
                label: cat.menuLabel || visibleItems[existingIndex].label,
                badge: cat.badge || visibleItems[existingIndex].badge,
                badgeColor: cat.badgeColor || visibleItems[existingIndex].badgeColor,
              };
            } else {
              // Append new submenu item
              visibleItems.push({
                label: cat.menuLabel || cat.name,
                href: cat.linkUrl || `/${item.href.replace(/^\//, '')}/${cat.slug}`,
                badge: cat.badge || undefined,
                badgeColor: cat.badgeColor || undefined,
              });
            }
          });
        }

        return {
          ...group,
          items: visibleItems,
        };
      });

      return {
        ...item,
        megaMenuItems: updatedMegaMenuItems,
      };
    });
  }, [navItems, dbBrands, dbCategories]);

  return (
    <>
      <header
        className={`w-full z-50 ${theme === "dark-solid"
            ? "sticky top-0 bg-[#161616]"
            : theme === "light"
              ? "sticky top-0"
              : `fixed left-0 right-0 transition-all duration-300 ${isScrolled ? "top-0" : hasTopBanner ? "top-[36px] sm:top-[40px]" : "top-0"}`
          }`}
      >
        {/* Glassmorphic backdrop */}
        <div
          className={`absolute inset-0 transition-all duration-300 ease-in-out pointer-events-none ${theme === "dark-solid"
              ? "bg-[#161616] border-b border-[#2a2a2a] shadow-sm"
              : theme === "light"
                ? "bg-white/95 backdrop-blur-md border-b border-neutral-200/80 shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
                : isScrolled
                  ? "opacity-100 bg-white/90 backdrop-blur-md border-b border-neutral-200/60 shadow-sm"
                  : "opacity-0 bg-white/0"
            }`}
        />

        <nav className="relative z-10 w-full max-w-[1600px] 2xl:max-w-[1720px] mx-auto px-3 sm:px-4 lg:px-2.5 xl:px-4 2xl:px-6 py-2 sm:py-2.5 xl:py-3 flex items-center justify-between gap-1.5 lg:gap-2 xl:gap-3 2xl:gap-5">
                    {/* Logo (Fades out on mobile when search is open) */}
          <Link
            href="/"
            className={`shrink-0 items-center group transition-all duration-200 cursor-pointer ${isMobileSearchOpen ? "opacity-0 pointer-events-none sm:flex sm:opacity-100 sm:pointer-events-auto" : "flex opacity-100"
              }`}
          >
            <div className="relative h-[31.74px] w-[119.6px] sm:h-[36.8px] sm:w-[138px] md:h-[41.4px] md:w-[155px] lg:h-[34px] lg:w-[128px] xl:h-[42px] xl:w-[158px] 2xl:h-[46px] 2xl:w-[175px] transition-transform duration-300 group-hover:scale-105 will-change-transform rounded-xs overflow-hidden">
              <Image
                src="/Store4riders-Logo.jpg"
                alt={logoText || "Store4Riders Logo"}
                fill
                className="object-contain object-left"
                sizes="(max-width: 768px) 160px, 200px"
                priority
              />
            </div>
          </Link>

          {/* Desktop nav links */}
          <NavDesktopLinks
            items={activeNavItems}
            isLight={isLight}
            isDarkSolid={theme === "dark-solid"}
            hoveredNavId={hoveredNavId}
            hoveredMenuId={hoveredMenuId}
            onNavEnter={handleNavEnter}
            onNavLeave={handleNavLeave}
          />

          {/* Right actions (Fades out on mobile when search is open) */}
          <div className={`flex items-center gap-1 sm:gap-1.5 lg:gap-1 xl:gap-2 shrink-0 transition-opacity duration-200 ${isMobileSearchOpen ? "opacity-0 pointer-events-none sm:opacity-100 sm:pointer-events-auto" : "opacity-100"
            }`}>

            {/* Desktop Search Input (Hidden on tablets/small laptops to save space) */}
            <div className="hidden sm:block shrink-0">
              <SearchAutocomplete isLight={isLight} />
            </div>

            {/* Mobile/Tablet Search Toggle Icon */}
            <button
              type="button"
              onClick={() => setIsMobileSearchOpen(true)}
              aria-label="Search"
              suppressHydrationWarning
              className={`sm:hidden p-2 rounded-full transition-all duration-200 cursor-pointer active:scale-90 ${isLight
                  ? "text-neutral-700 hover:text-neutral-950 hover:bg-neutral-900/[0.06]"
                  : "text-white bg-black/45 backdrop-blur-md border border-white/20 hover:bg-black/70 shadow-md"
                }`}
            >
              <MagnifyingGlassIcon className="w-5 h-5 stroke-[1.75]" />
            </button>

            {/* Cart */}
            <Link
              href="/cart"
              aria-label="Shopping Cart"
              className={`relative p-2 xl:p-2.5 rounded-full transition-all duration-200 cursor-pointer active:scale-95 ${theme === "dark-solid"
                  ? "text-white hover:text-white hover:bg-neutral-800"
                  : isLight
                  ? "text-neutral-700 hover:text-neutral-950 hover:bg-neutral-900/[0.06]"
                  : "text-white bg-black/45 backdrop-blur-md border border-white/20 hover:bg-black/70 shadow-md ring-1 ring-white/10"
                }`}
            >
              <ShoppingBagIcon className="w-5 h-5 stroke-[1.75]" />
              {totalItemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-brand text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                  {totalItemCount > 99 ? "99+" : totalItemCount}
                </span>
              )}
            </Link>

            {/* User Account Link (mobile only) */}
            <Link
              href={mounted && isAuthenticated ? "/account" : "/login"}
              aria-label="User Account"
              suppressHydrationWarning
              className={`lg:hidden relative p-2 rounded-full transition-all duration-200 cursor-pointer active:scale-95 ${theme === "dark-solid"
                  ? "text-white hover:text-white hover:bg-neutral-800"
                  : isLight
                  ? "text-neutral-700 hover:text-neutral-950 hover:bg-neutral-900/[0.06]"
                  : "text-white bg-black/45 backdrop-blur-md border border-white/20 hover:bg-black/70 shadow-md"
                }`}
            >
              <UserIcon className="w-5 h-5 stroke-[1.75]" />
              {mounted && isAuthenticated && user && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-1.5 right-1.5 ring-2 ring-white" />
              )}
            </Link>

            {/* User menu (desktop only) */}
            <NavUserMenu
              isLight={isLight}
              isDarkSolid={theme === "dark-solid"}
              isOpen={isUserMenuOpen}
              mounted={mounted}
              isAuthenticated={isAuthenticated}
              user={user}
              onToggle={() => {
                if (onAccountClick) onAccountClick();
                else setIsUserMenuOpen((v) => !v);
              }}
              onClose={() => setIsUserMenuOpen(false)}
              onLogout={handleLogout}
              menuRef={userMenuRef}
            />

            {/* Hamburger (mobile only) */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
              suppressHydrationWarning
              className={`lg:hidden p-2.5 rounded-full transition-all active:scale-95 ${theme === "dark-solid"
                  ? "text-white hover:bg-neutral-800"
                  : isLight
                  ? "text-neutral-700 hover:bg-neutral-900/[0.06]"
                  : "text-white bg-black/55 backdrop-blur-xl border border-white/20 hover:bg-black/70 shadow-md"
                }`}
            >
              <Bars3Icon className="w-5 h-5 stroke-[2]" />
            </button>
          </div>

          {/* Mobile Full-Screen Search Modal */}
          {isMobileSearchOpen && (
            <div className="fixed inset-0 z-[100] sm:hidden bg-white animate-in fade-in duration-200">
              <SearchAutocomplete
                isLight={true}
                isMobileFull={true}
                onClose={() => setIsMobileSearchOpen(false)}
              />
            </div>
          )}
        </nav>
      </header>

      {/* Mobile drawer */}
      <NavMobileDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        items={activeNavItems}
        mounted={mounted}
        isAuthenticated={isAuthenticated}
        user={user}
        onLogout={handleLogout}
      />
    </>
  );
};

export default Navbar;
