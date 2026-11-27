import { IBrand } from "@store4riders/shared-types";
import { NavItem } from "../../types/homepage.types";
import {
  CORE_PRODUCT_PARENTS,
  areCategorySlugsEquivalent,
  isLegacyNonMenuCategory,
} from "@/core/utils/navCategories";

const BRAND_MATCH_SUFFIX_REGEX =
  /\s+(helmets|gear|gears|boots|protection|protectors|parts|performance|air filter|spark plugs|chains|exhaust)\b/gi;

function extractLeafSlug(href?: string): string {
  return (href || "").split("?")[0].split("/").filter(Boolean).pop()?.toLowerCase() || "";
}

function isBrandNavItem(item: NavItem): boolean {
  return (
    item.id === "shop-by-brand" ||
    item.href === "/brands" ||
    item.label.toLowerCase().includes("brand")
  );
}

function isExcludedAutoSection(item: NavItem): boolean {
  return (
    isBrandNavItem(item) ||
    item.id === "guides" ||
    item.href === "/guides"
  );
}

function isMatchingBrand(
  subItem: { href: string; label: string },
  brand: { slug?: string; name?: string; aliases?: string[] }
): boolean {
  const hrefSlug = (subItem.href || "").replace(/^\/brands\/?/, "").split("?")[0].toLowerCase().trim();
  const labelLower = (subItem.label || "").toLowerCase().trim();

  const bSlug = (brand.slug || "").toLowerCase().trim();
  const bName = (brand.name || "").toLowerCase().trim();
  const bAliases = Array.isArray(brand.aliases)
    ? brand.aliases.map((a) => a.toLowerCase().trim())
    : [];

  if (bSlug && hrefSlug) {
    if (bSlug === hrefSlug) return true;
    if (hrefSlug === `${bSlug}-helmets` || hrefSlug === `${bSlug}-gear` || hrefSlug === `${bSlug}-gears`) return true;
    if (bSlug === `${hrefSlug}-helmets` || bSlug === `${hrefSlug}-gear` || bSlug === `${hrefSlug}-gears`) return true;
  }

  if (hrefSlug && bAliases.includes(hrefSlug)) return true;

  if (bName && labelLower) {
    if (bName === labelLower) return true;
    const cleanLabel = labelLower.replace(BRAND_MATCH_SUFFIX_REGEX, "").trim();
    const cleanName = bName.replace(BRAND_MATCH_SUFFIX_REGEX, "").trim();
    if (cleanLabel && cleanName && cleanLabel === cleanName) return true;
    if (
      cleanLabel.length >= 3 &&
      cleanName.length >= 3 &&
      (cleanLabel.includes(cleanName) || cleanName.includes(cleanLabel))
    ) {
      return true;
    }
  }

  return false;
}

function isBrandGroupMatch(brandGroup: string, targetGroup: string): boolean {
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
}

function normalizeExplicitSectionKey(rawSection: string, baseItems: NavItem[]): string {
  const secKey = rawSection.trim().toLowerCase();
  if (!secKey.includes(":")) return secKey;

  const [navId, ...rest] = secKey.split(":");
  const groupPart = rest.join(":").trim();
  const matchingNav = baseItems.find((b) => b.id.toLowerCase() === navId);
  if (!matchingNav?.megaMenuItems?.length) return secKey;

  // Map sections like "gadgets:gadgets" to the unnamed single group key "gadgets:"
  if (
    matchingNav.megaMenuItems.length === 1 &&
    (matchingNav.megaMenuItems[0].group || "").trim() === "" &&
    (groupPart === navId || groupPart === matchingNav.label.toLowerCase().trim())
  ) {
    return `${navId}:`;
  }

  return secKey;
}

function resolveSectionKeyFromParent(
  category: any,
  flatDbCategories: any[],
  baseItems: NavItem[]
): string {
  if (!category.parentId) return "";

  const pId = String(category.parentId).toLowerCase();
  const parentDoc = flatDbCategories.find(
    (p) =>
      String(p._id).toLowerCase() === pId ||
      String(p.slug).toLowerCase() === pId ||
      String(p.id).toLowerCase() === pId
  );
  const parentSlug = String(parentDoc?.slug || pId).toLowerCase().trim();
  const parentName = String(parentDoc?.name || "").toLowerCase().trim();

  // 1. Match specific mega-menu group or existing subcategory item first
  for (const baseNav of baseItems) {
    if (!baseNav.megaMenuItems || isExcludedAutoSection(baseNav)) continue;

    for (const grp of baseNav.megaMenuItems) {
      const grpHrefLeaf = extractLeafSlug(grp.groupHref);
      const grpNameLower = (grp.group || "").toLowerCase().trim();
      const matchesGroup =
        (grpHrefLeaf !== "" &&
          (grpHrefLeaf === parentSlug || areCategorySlugsEquivalent(grpHrefLeaf, parentSlug))) ||
        (grpNameLower !== "" && grpNameLower === parentName);

      const matchesSubItem = grp.items.some((sub) => {
        const subLeaf = extractLeafSlug(sub.href);
        return (
          (subLeaf !== "" &&
            (subLeaf === parentSlug || areCategorySlugsEquivalent(subLeaf, parentSlug))) ||
          (sub.label && sub.label.toLowerCase().trim() === parentName)
        );
      });

      if (matchesGroup || matchesSubItem) {
        return `${baseNav.id.toLowerCase()}:${grpNameLower}`;
      }
    }
  }

  // 2. Fallback: match top-level department parent (e.g. Gadgets, Helmets, Spares)
  for (const baseNav of baseItems) {
    if (!baseNav.megaMenuItems?.length || isExcludedAutoSection(baseNav)) continue;

    const navIdLower = baseNav.id.toLowerCase();
    const navHrefLeaf = extractLeafSlug(baseNav.href);
    const coreParent = CORE_PRODUCT_PARENTS[baseNav.id];
    const matchesTopNav =
      parentSlug === navIdLower ||
      parentSlug === navHrefLeaf ||
      areCategorySlugsEquivalent(parentSlug, navHrefLeaf) ||
      areCategorySlugsEquivalent(parentSlug, navIdLower) ||
      parentName === baseNav.label.toLowerCase().trim() ||
      (coreParent &&
        (parentSlug === coreParent.slug.toLowerCase() ||
          parentName === coreParent.name.toLowerCase()));

    if (!matchesTopNav) continue;

    const preferredGroup = String(category.menuGroup || "").toLowerCase().trim();
    const matchedGroup = preferredGroup
      ? baseNav.megaMenuItems.find((g) => (g.group || "").toLowerCase().trim() === preferredGroup)
      : undefined;
    const targetGroup = matchedGroup || baseNav.megaMenuItems[0];
    return `${navIdLower}:${(targetGroup.group || "").toLowerCase().trim()}`;
  }

  return "";
}

/**
 * Resolves the storefront navigation items by preserving the strict DEFAULT_NAV_ITEMS
 * skeleton while applying DB-driven brand badges, hidden items, and custom subcategories.
 */
export function resolveStorefrontNavItems(
  baseItems: NavItem[],
  dbBrands?: IBrand[],
  dbCategories?: any[]
): NavItem[] {
  const flatDbCategories: any[] = [];
  const traverse = (nodes: any[]) => {
    if (!Array.isArray(nodes)) return;
    for (const n of nodes) {
      flatDbCategories.push(n);
      if (Array.isArray(n.children) && n.children.length > 0) traverse(n.children);
    }
  };
  if (Array.isArray(dbCategories)) {
    traverse(dbCategories);
  }

  const hiddenSlugs = new Set<string>();
  flatDbCategories.forEach((c) => {
    if ((c.includeInMenu === false || c.isDeleted === true) && c.slug) {
      hiddenSlugs.add(String(c.slug).trim().toLowerCase());
    }
  });

  const customBySection = new Map<string, any[]>();
  flatDbCategories.forEach((c) => {
    if (c.includeInMenu === false || c.isDeleted === true) return;

    const catSlug = String(c.slug || "").trim().toLowerCase();
    const explicitSection = typeof c.menuNavSection === "string" ? c.menuNavSection.trim() : "";

    // Keep legacy non-menu categories out unless explicitly placed into a menu section
    if (isLegacyNonMenuCategory(catSlug) && !explicitSection) return;

    const secKey = explicitSection
      ? normalizeExplicitSectionKey(explicitSection, baseItems)
      : resolveSectionKeyFromParent(c, flatDbCategories, baseItems);

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

    const isBrandNav = isBrandNavItem(item);
    const existingItemSlugsInMenu = item.megaMenuItems.flatMap((g) =>
      g.items.map((sub) => extractLeafSlug(sub.href))
    );

    const updatedMegaMenuItems = item.megaMenuItems.map((group) => {
      const groupKey = `${item.id.toLowerCase()}:${(group.group || "").toLowerCase().trim()}`;
      const currentGroupLower = (group.group || "").toLowerCase().trim();
      const sectionCustomCategories = customBySection.get(groupKey) || [];

      let visibleItems = group.items.filter((subItem) => {
        const leaf = extractLeafSlug(subItem.href);
        if (hiddenSlugs.has(leaf)) return false;

        if (isBrandNav && Array.isArray(dbBrands) && dbBrands.length > 0) {
          const matchedDbBrand = dbBrands.find((b) => isMatchingBrand(subItem, b));
          if (!matchedDbBrand) {
            return false;
          }
          const isHidden =
            matchedDbBrand.isDeleted === true ||
            matchedDbBrand.showInMenu === false ||
            (matchedDbBrand.showInMenu as any) === "false" ||
            matchedDbBrand.isActive === false;
          if (isHidden) {
            return false;
          }

          const brandGroups = (
            Array.isArray(matchedDbBrand.menuGroups) && matchedDbBrand.menuGroups.length > 0
              ? matchedDbBrand.menuGroups
              : matchedDbBrand.menuGroup
              ? [matchedDbBrand.menuGroup]
              : []
          ).filter((g) => !g.toLowerCase().includes("popular"));

          if (brandGroups.length > 0) {
            const belongsHere = brandGroups.some((bg) => isBrandGroupMatch(bg, currentGroupLower));
            if (!belongsHere) return false;
          }
        }

        return true;
      });

      if (isBrandNav && Array.isArray(dbBrands)) {
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

        dbBrands.forEach((b) => {
          const isInMenu = b.showInMenu === true || (b.showInMenu as any) === "true";
          if (b.isActive === false || !isInMenu) return;

          const brandGroups = (
            Array.isArray(b.menuGroups) && b.menuGroups.length > 0
              ? b.menuGroups
              : b.menuGroup
              ? [b.menuGroup]
              : []
          ).filter((g) => !g.toLowerCase().includes("popular"));

          const belongsToThisGroup = brandGroups.some((bg) => isBrandGroupMatch(bg, currentGroupLower));
          if (!belongsToThisGroup) return;

          const alreadyInGroup = visibleItems.some((sub) => isMatchingBrand(sub, b));
          if (!alreadyInGroup) {
            const isPopular = popularBrandsList.some((pb) =>
              isMatchingBrand({ href: `/brands/${b.slug}`, label: b.name }, pb)
            );
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

      if (!isExcludedAutoSection(item) && sectionCustomCategories.length > 0) {
        sectionCustomCategories.forEach((cat) => {
          const catSlug = String(cat.slug || "").trim().toLowerCase();
          if (!catSlug) return;

          const existingIndex = visibleItems.findIndex(
            (sub) => extractLeafSlug(sub.href) === catSlug
          );

          if (existingIndex >= 0) {
            visibleItems[existingIndex] = {
              ...visibleItems[existingIndex],
              label: cat.menuLabel || visibleItems[existingIndex].label,
              badge: cat.badge || visibleItems[existingIndex].badge,
              badgeColor: cat.badgeColor || visibleItems[existingIndex].badgeColor,
            };
            return;
          }

          // Skip if an equivalent canonical/alias slug is already present in this dropdown or group
          const catDisplayLabel = String(cat.menuLabel || cat.name || "").trim().toLowerCase();
          const alreadyRepresentedInGroup = visibleItems.some((sub) => {
            const subLeaf = extractLeafSlug(sub.href);
            const subLabel = String(sub.label || "").trim().toLowerCase();
            return (
              areCategorySlugsEquivalent(subLeaf, catSlug) ||
              (catDisplayLabel !== "" && subLabel === catDisplayLabel)
            );
          });
          const alreadyRepresentedInMenu = existingItemSlugsInMenu.some(
            (menuSlug) =>
              !hiddenSlugs.has(menuSlug) && areCategorySlugsEquivalent(menuSlug, catSlug)
          );

          if (!alreadyRepresentedInGroup && !alreadyRepresentedInMenu) {
            visibleItems.push({
              label: cat.menuLabel || cat.name,
              href: cat.linkUrl || `/${item.href.replace(/^\//, "")}/${cat.slug}`,
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
}
