import { DEFAULT_NAV_ITEMS } from "@/modules/homepage/components/navbar/nav.constants";

export interface IStoreCategoryNode {
  _id: string;
  id: string;
  name: string;
  slug: string;
  linkUrl: string;
  parentId?: string;
  image?: string;
  bannerImage?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  videoUrl?: string;
  groupName?: string;
  badge?: string;
  badgeColor?: string;
  attributeSetCode?: string;
  hsnCode?: string;
  taxClassName?: string;
  weightUnit?: "kg" | "g" | "ml" | "L";
  sizeChart?: string;
  specDefinitions?: any[];
  faqs?: any[];
  heroCategoryIds?: string[];
  heroCategories?: any[];
  includeInMenu?: boolean;
  menuGroup?: string;
  menuLabel?: string;
  menuNavSection?: string;
  children?: IStoreCategoryNode[];
  hasDbRecord?: boolean;
  isCustom?: boolean;
}

/**
 * Authoritative mapping of Core Product Catalog Parents
 * Strictly filters out non-catalog sections like "Shop By Brand" and "Guides".
 */
export const CORE_PRODUCT_PARENTS: Record<string, { name: string; slug: string; linkUrl: string }> = {
  helmets: {
    name: "Motorcycle Helmets",
    slug: "motorcycle-helmets",
    linkUrl: "/motorcycle-helmets",
  },
  "riding-gear": {
    name: "Riding Gear",
    slug: "riding-gear",
    linkUrl: "/riding-gear",
  },
  luggage: {
    name: "Motorcycle Bags / Bike Luggage",
    slug: "motorcycle-bags-bike-luggage",
    linkUrl: "/motorcycle-bags-bike-luggage",
  },
  accessories: {
    name: "Bike Accessories",
    slug: "motorcycle-accessories-online",
    linkUrl: "/motorcycle-accessories-online",
  },
  spares: {
    name: "Spares & Parts",
    slug: "spares",
    linkUrl: "/bike-spares",
  },
  exhausts: {
    name: "Exhausts",
    slug: "exhausts",
    linkUrl: "/exhausts",
  },
  gadgets: {
    name: "Gadgets",
    slug: "gadgets",
    linkUrl: "/gadgets",
  },
};

/**
 * Comprehensive mapping of category slug aliases to bridge legacy/imported database slugs
 * with the official Storefront Navbar and Submenu taxonomy.
 */
export const CATEGORY_SLUG_ALIASES: Record<string, string[]> = {
  // Helmets
  "motorcycle-helmets": ["motorcycle-helmets", "helmets"],
  "full-face-helmets": [
    "full-face-helmets",
    "full-face-helmet",
    "full-face",
    "axor-agera-full-face-helmets",
    "axor-agera-helmets",
    "axor-agera-helmet",
    "axor-agera",
    "axor-street-helmets",
    "axor-rage-helmets",
    "axor-stealth-motorcycle-helmet",
    "axor-apex-helmet-sport-touring-performance",
    "axor-brutale-dual-spoiler-helmet",
    "smk-twister-helmet",
    "smk-stellar-helmet",
    "smk-typhoon-helmet",
    "smk-agnar-helmet-full-face-protection-with-race-ready-styling",
    "smk-nova-helmets",
    "ls2-ff800-storm-ii-helmets-touring-range",
    "ls2-ff320-stream-ii-daily-rider-range",
  ],
  "modular-helmets": ["modular-helmets", "modular-helmets-flip-up-helmets", "modular-flip-up", "modular-helmet"],
  "off-road-helmets": ["off-road-helmets", "off-road-helmets-motocross-helmet", "motocross-helmet", "off-road-helmet", "motocross-helmets"],
  "open-face-helmets": ["open-face-helmets", "half-face-helmets", "open-face", "open-face-helmet", "half-face-helmet"],
  "carbon-fibre-helmets": ["carbon-fibre-helmets", "carbon-fibre-helmet", "carbon-fiber-helmets", "carbon-fiber-helmet"],
  "helmet-accessories": ["helmet-accessories", "helmet-accessories-helmet-visors", "helmet-visors", "visors", "visor"],
  "balaclava": ["balaclava", "balaclavas", "face-mask", "head-mask"],
  "bluetooth-intercoms": ["bluetooth-intercoms", "communicators", "communicator", "intercom", "bluetooth", "motorcycle-intercoms"],
  "helmet-cleaners": ["helmet-cleaners", "helmet-cleaner", "motorcycle-care", "cleaner"],

  // Riding Gear
  "riding-gear": ["riding-gear"],
  "riding-gloves": ["riding-gloves", "riding-gloves-biker-gloves", "motorcycle-riding-gloves", "gloves", "biker-gloves"],
  "full-gauntlet-gloves": ["full-gauntlet-gloves", "premium-full-gauntlet-riding-gloves"],
  "semi-gauntlet-gloves": ["semi-gauntlet-gloves", "semi-gauntlet-bike-riding-gloves", "semi-gauntlet"],
  "short-motorbike-gloves": ["short-motorbike-gloves", "short-cuff-biker-gloves", "short-cuff-biker-glove"],
  "riding-jackets": ["riding-jackets", "riding-jacket", "riding-jackets-bike-jackets", "riding-jackets-motorcycle-jackets", "motorcycle-jackets"],
  "protectors-armour": ["protectors-armour", "protectors", "armour", "armor"],
  "riding-pants": ["riding-pants", "touring-pants", "touring-pant"],
  "motorcycle-riding-jeans": ["motorcycle-riding-jeans", "riding-jeans", "riding-jean"],
  "touring-pants": ["touring-pants", "touring-pant"],
  "knee-guards-bikers": ["knee-guards-bikers", "knee-guards-for-bikers", "knee-guard", "knee-guards"],
  "motorcycle-riding-boots": ["motorcycle-riding-boots", "riding-boots"],
  "short-biking-boots": ["short-biking-boots", "short-riding-boots-city-riding-shoes", "short-city-riding-biking-boots", "short-biking-boot"],
  "short-riding-boots-city-riding-shoes": ["short-biking-boots", "short-city-riding-biking-boots", "short-biking-boot", "sports-riding-shoes"],
  "sports-riding-shoes": ["sports-riding-shoes", "sport-riding-shoes", "sport-riding-shoe", "sports-riding-shoe", "short-riding-boots-city-riding-shoes"],
  "off-road-riding-boots": ["off-road-riding-boots", "off-road-boots", "adventure-off-road-riding-boots", "off-road-riding-boots-motocross-boots", "motocross-boots"],
  "adventure-off-road-riding-boots": ["off-road-riding-boots", "off-road-boots", "off-road-riding-boots-motocross-boots", "motocross-boots"],
  "touring-gear": ["touring-gear", "touring-gears", "motorcycle-touring-gear", "motorcycle-touring-gears"],
  "motorcycle-touring-gear": ["touring-gear", "touring-gears", "motorcycle-touring-gear"],
  "monsoon-gear-for-riders": ["monsoon-gear-for-riders", "monsoon-gear", "monsoon-gear-for-rider", "motorcycle-rain-gear-for-bikers", "rain-gear", "rain-wear", "motorcycle-rain-wear"],
  "monsoon-gear": ["monsoon-gear-for-riders", "monsoon-gear", "monsoon-gear-for-rider", "motorcycle-rain-gear-for-bikers", "rain-gear", "rain-wear", "motorcycle-rain-wear"],
  "riding-gear-for-women": ["riding-gear-for-women", "women-riding-gear"],
  "off-road-motocross-riding-gear": ["off-road-motocross-riding-gear", "off-road-motocross"],

  // Luggage
  "motorcycle-bags-bike-luggage": ["motorcycle-bags-bike-luggage", "motorcycle-bags", "bike-luggage", "luggage"],
  "tank-bags-bikes": ["tank-bags-bikes", "tank-bags", "tank-bags-for-bike"],
  "saddle-bags-bikes": ["saddle-bags-bikes", "saddle-bags", "saddle-bags-for-bikes-panniers"],
  "motorcycle-tail-bags": ["motorcycle-tail-bags", "tail-bags"],
  "bike-top-box": ["bike-top-box", "bike-top-boxes-aluminium-top-box", "bike-top-box-cases", "top-box", "top-boxes", "top-case"],
  "bike-top-boxes-aluminium-top-box": ["bike-top-box", "top-box", "top-boxes", "bike-top-box-cases"],
  "crash-bar-bags": ["crash-bar-bags", "crash-bar-bags-for-motorcycles", "crash-bar-bag", "frame-bags"],
  "crash-bar-bags-for-motorcycles": ["crash-bar-bags", "crash-bar-bag", "frame-bags"],
  "thigh-bags": ["thigh-bags", "thigh-bags-for-motorcycle-riders", "thigh-bag", "thigh-pouch"],
  "thigh-bags-for-motorcycle-riders": ["thigh-bags", "thigh-bag", "thigh-pouch"],
  "helmet-bags": ["helmet-bags", "helmet-bag", "helmet-bags-for-bike-riders"],
  "hydration-bag": ["hydration-bag", "hydration-bags"],
  "motorcycle-other-luggage": ["motorcycle-other-luggage", "other-luggage", "other-luggages"],

  // Accessories
  "motorcycle-accessories-online": ["motorcycle-accessories-online", "motorcycle-accessories-bike-accessories", "motorcycle-accessories", "accessories", "bike-accessories"],
  "bike-auxiliary-lights-filters-flashers": ["bike-auxiliary-lights-filters-flashers", "auxiliary-lights-filters-flashers"],
  "bike-auxiliary-lights": ["bike-auxiliary-lights", "auxiliary-lights", "auxiliary-light"],
  "auxiliary-light-filters": ["auxiliary-light-filters", "auxiliary-light-filter"],
  "bike-auxiliary-light-clamps-mounts": ["bike-auxiliary-light-clamps-mounts", "clamps-and-mounts-for-lights"],
  "auxiliary-light-wiring-harness-switch": ["auxiliary-light-wiring-harness-switch", "auxiliary-light-wiring-harness-and-switch"],
  "off-beat-motorcycle-accessories": ["off-beat-motorcycle-accessories", "off-beat-accessories"],
  "performance-parts": ["performance-parts"],
  "rally-tower": ["rally-tower", "rally-towers-navigation-tower", "rally-tower-navigation-tower"],
  "bike-covers": ["bike-covers", "bike-cover"],
  "chain-care": ["chain-care"],

  // Spares
  "spares": ["spares", "bike-spares", "bike-spare-parts-online"],
  "bike-spares": ["spares", "bike-spares", "bike-spare-parts-online"],
  "chain-sprocket-kits": ["chain-sprocket-kits", "chain-sprockets", "sprockets"],
  "iridium-spark-plug": ["iridium-spark-plug", "spark-plugs", "spark-plug"],
  "performance-air-filter-bike": ["performance-air-filter-bike", "performance-air-filters-for-bikes", "performance-air-filters", "air-filter", "air-filters"],
  "performance-air-filters-for-bikes": ["performance-air-filter-bike", "performance-air-filters"],
  "brake-pads": ["brake-pads", "brake-pad"],

  // Exhausts
  "exhausts": ["exhausts", "exhaust", "bike-exhausts", "bike-exhaust"],

  // Gadgets
  "gadgets": ["gadgets"],
  "bike-phone-holders": ["bike-phone-holders", "phone-holders", "mobile-holder"],
  "communicators": ["communicators", "communicator", "bluetooth-intercoms", "intercom"],
  "action-cameras": ["action-cameras", "action-camera"],

  // Merchandise
  "biker-t-shirts-motorcycle-t-shirts": ["biker-t-shirts-motorcycle-t-shirts", "biker-t-shirts", "motorcycle-t-shirts"],
  "keychains-for-bike": ["keychains-for-bike", "biker-key-chain", "keychains"],
};

/**
 * Set of legacy Magento categories that are NOT part of the storefront menu / taxonomy.
 */
export const LEGACY_NON_MENU_SLUGS = new Set<string>([
  "helmets",
  "saddle-bags-for-bikes-panniers",
  "tank-bags-for-bike",
  "other-luggage",
  "hydration-bags",
  "saddle-stay-crash-guard-leg-guard",
  "riding-jackets-bike-jackets",
  "riding-jackets-motorcycle-jackets",
  "knee-guards-for-bikers",
  "riding-jeans",
  "racing-suits",
  "sport-riding-shoes",
  "premium-riding-boots",
  "off-road-riding-boots-motocross-boots",
  "short-city-riding-biking-boots",
  "riding-gloves-biker-gloves",
  "short-cuff-biker-gloves",
  "premium-full-gauntlet-riding-gloves",
  "semi-gauntlet-bike-riding-gloves",
  "rynox-riding-jacket",
  "rynox-saddle-bags",
  "tank-bags",
  "rynox-tail-bags",
  "rynox-tank-bags",
  "helmet-accessories-helmet-visors",
  "full-face-helmet",
  "off-road-helmets-motocross-helmet",
  "smk-glide-modular-helmet",
  "smk-twister-helmet",
  "smk-stellar-helmet",
  "sale",
  "women-riding-gear",
  "merchandise",
  "biker-t-shirts-motorcycle-t-shirts",
  "protectors",
  "radiator-guard",
  "bike-auxiliary-light-clamps-and-mounts",
  "auxiliary-light-wiring-harness-and-switch",
  "off-beat-bike-accessories-online",
  "bike-phone-holders-mobile-holder-for-bike",
  "smk-hybrid-evo-helmet",
  "royal-enfield-himalayan-accessories",
  "smk-titan-carbon-fibre-helmets",
  "axor-apex-helmet-sport-touring-performance",
  "certified-safety",
  "axor-stealth-motorcycle-helmet",
  "axor-retro-helmets",
  "oils-lubes",
  "motorcycle-care",
  "axor-street-helmets",
  "performance-air-filters-for-bikes",
  "smk-gullwing-helmets",
  "smk-typhoon-helmets",
  "ls2-ff800-storm-ii-helmets-touring-range",
  "ls2-ff320-stream-ii-daily-rider-range",
  "axor-brutale-dual-spoiler-helmet",
  "smk-agnar-helmet-full-face-protection-with-race-ready-styling",
  "smk-nova-helmets",
  "axor-agera-full-face-helmets",
  "best-helmets-under-rs5000",
  "best-helmets-under-rs-5000",
  "bike-exhausts",
  "bike-spare-parts-online",
  "motorcycle-accessories-bike-accessories",
  "helmet-bags-for-bike-riders",
  "bike-top-boxes-aluminium-top-box",
  "crash-bar-bags-for-motorcycles",
  "thigh-bags-for-motorcycle-riders",
  "adventure-off-road-riding-boots",
  "motorcycle-touring-gear",
  "bluetooth-intercoms",
  "short-riding-boots-city-riding-shoes",
  "motorcycle-riding-jeans-4428",
  "test-category",
]);

export function isLegacyNonMenuCategory(slug?: string): boolean {
  if (!slug) return false;
  return LEGACY_NON_MENU_SLUGS.has(slug.toLowerCase().trim());
}

export function isCanonicalMenuAlias(slug?: string): boolean {
  if (!slug) return false;
  const s = slug.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(CATEGORY_SLUG_ALIASES)) {
    if (canonical.toLowerCase() !== s && aliases.map((a) => a.toLowerCase()).includes(s)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether two category slugs represent the same canonical category via alias mapping.
 */
export function areCategorySlugsEquivalent(slugA?: string, slugB?: string): boolean {
  const a = (slugA || "").toLowerCase().trim();
  const b = (slugB || "").toLowerCase().trim();
  if (!a || !b) return false;
  if (a === b) return true;

  const aliasesA = CATEGORY_SLUG_ALIASES[a]?.map((s) => s.toLowerCase().trim()) || [];
  const aliasesB = CATEGORY_SLUG_ALIASES[b]?.map((s) => s.toLowerCase().trim()) || [];
  if (aliasesA.includes(b) || aliasesB.includes(a)) return true;

  for (const [canonical, aliases] of Object.entries(CATEGORY_SLUG_ALIASES)) {
    const normalizedCanonical = canonical.toLowerCase().trim();
    const normalizedAliases = aliases.map((s) => s.toLowerCase().trim());
    const hasA = normalizedCanonical === a || normalizedAliases.includes(a);
    const hasB = normalizedCanonical === b || normalizedAliases.includes(b);
    if (hasA && hasB) return true;
  }

  return false;
}

/**
 * Returns the authoritative Store Category Tree strictly based on the
 * official Storefront Navigation taxonomy (Helmets, Riding Gear, Luggage, etc.)
 * with their organized subcategories and groups.
 * 
 * Merges matching database category documents to populate real ObjectIds, images,
 * SEO metadata, FAQs, and blueprints.
 * 
 * Also dynamically attaches custom categories created by the admin in the database.
 * 
 * @param dbCategories Raw category records from database.
 */
export function getStoreNavbarCategoryTree(dbCategories: any[] = []): IStoreCategoryNode[] {
  // 1. Flatten all DB categories for quick O(1) lookup
  const flatDbList: any[] = [];
  const traverseDb = (nodes: any[]) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      flatDbList.push(node);
      if (Array.isArray(node.children) && node.children.length > 0) {
        traverseDb(node.children);
      }
    }
  };
  traverseDb(dbCategories);

  const dbById = new Map<string, any>();
  const dbBySlug = new Map<string, any>();
  const dbByName = new Map<string, any>();

  flatDbList.forEach((cat) => {
    if (cat._id) dbById.set(String(cat._id), cat);
    if (cat.id) dbById.set(String(cat.id), cat);
    if (cat.slug) dbBySlug.set(String(cat.slug).toLowerCase().trim(), cat);
    if (cat.name) dbByName.set(String(cat.name).toLowerCase().trim(), cat);
  });

  const matchedDbIds = new Set<string>();

  const resolveDbCategory = (slug: string, name: string): any | null => {
    const cleanSlug = slug.toLowerCase().trim();
    const cleanName = name.toLowerCase().trim();
    const leafSlug = cleanSlug.split("/").filter(Boolean).pop() || cleanSlug;

    const isAvailable = (doc: any) => {
      if (!doc || !doc._id) return false;
      return !matchedDbIds.has(String(doc._id));
    };

    const tryClaim = (doc: any) => {
      if (isAvailable(doc)) {
        matchedDbIds.add(String(doc._id));
        return doc;
      }
      return null;
    };

    // 1. Direct slug match
    if (dbBySlug.has(cleanSlug)) {
      const match = tryClaim(dbBySlug.get(cleanSlug));
      if (match) return match;
    }
    if (dbBySlug.has(leafSlug)) {
      const match = tryClaim(dbBySlug.get(leafSlug));
      if (match) return match;
    }

    // 2. Alias match (direct + reverse)
    const aliases = CATEGORY_SLUG_ALIASES[leafSlug] || CATEGORY_SLUG_ALIASES[cleanSlug] || [];
    for (const alias of aliases) {
      const aliasClean = alias.toLowerCase().trim();
      if (dbBySlug.has(aliasClean)) {
        const match = tryClaim(dbBySlug.get(aliasClean));
        if (match) return match;
      }
    }
    for (const [key, aliasList] of Object.entries(CATEGORY_SLUG_ALIASES)) {
      if (aliasList.includes(leafSlug) || aliasList.includes(cleanSlug)) {
        if (dbBySlug.has(key)) {
          const match = tryClaim(dbBySlug.get(key));
          if (match) return match;
        }
        for (const a of aliasList) {
          if (dbBySlug.has(a)) {
            const match = tryClaim(dbBySlug.get(a));
            if (match) return match;
          }
        }
      }
    }

    // 3. Singular / plural slug variant
    const singular = leafSlug.endsWith("s") ? leafSlug.slice(0, -1) : `${leafSlug}s`;
    if (dbBySlug.has(singular)) {
      const match = tryClaim(dbBySlug.get(singular));
      if (match) return match;
    }

    // 4. Exact name match
    if (dbByName.has(cleanName)) {
      const match = tryClaim(dbByName.get(cleanName));
      if (match) return match;
    }

    // 5. Normalized exact name match (ignoring special characters & casing)
    for (const [dbCatName, doc] of dbByName.entries()) {
      if (!isAvailable(doc)) continue;
      const strippedDb = dbCatName.replace(/[^a-z0-9]/g, "");
      const strippedClean = cleanName.replace(/[^a-z0-9]/g, "");
      if (strippedDb && strippedDb === strippedClean) {
        return tryClaim(doc);
      }
    }

    return null;
  };

  const mergeDbProps = (node: Partial<IStoreCategoryNode>, dbDoc: any | null): IStoreCategoryNode => {
    if (dbDoc && dbDoc._id) {
      matchedDbIds.add(String(dbDoc._id));
    }
    const resolvedName = (dbDoc?.name && dbDoc.name.trim()) || node.name || "";
    const normalizedName =
      (node.slug === "motorcycle-riding-boots" || dbDoc?.slug === "motorcycle-riding-boots") && resolvedName === "Riding Boots"
        ? "Motorcycle riding boots"
        : (node.slug === "motorcycle-bags-bike-luggage" || dbDoc?.slug === "motorcycle-bags-bike-luggage") && resolvedName === "Luggage & Bags"
        ? "Motorcycle Bags / Bike Luggage"
        : resolvedName;

    return {
      _id: dbDoc?._id ? String(dbDoc._id) : node.slug || node.id || "",
      id: node.id || node.slug || "",
      name: normalizedName,
      slug: node.slug || dbDoc?.slug || "",
      linkUrl: node.linkUrl || `/${node.slug}`,
      parentId: node.parentId || (dbDoc?.parentId ? String(dbDoc.parentId) : undefined),
      image: dbDoc?.image || node.image || "",
      bannerImage: dbDoc?.bannerImage || "",
      description: dbDoc?.description || "",
      metaTitle: dbDoc?.metaTitle || "",
      metaDescription: dbDoc?.metaDescription || "",
      metaKeywords: dbDoc?.metaKeywords || "",
      videoUrl: dbDoc?.videoUrl || "",
      groupName: node.groupName || dbDoc?.menuGroup || "",
      badge: dbDoc?.badge || "",
      badgeColor: dbDoc?.badgeColor || "",
      attributeSetCode: dbDoc?.attributeSetCode || "",
      hsnCode: dbDoc?.hsnCode || "",
      taxClassName: dbDoc?.taxClassName || "",
      weightUnit: dbDoc?.weightUnit || "kg",
      sizeChart: dbDoc?.sizeChart || "",
      specDefinitions: dbDoc?.specDefinitions || [],
      faqs: dbDoc?.faqs || [],
      heroCategoryIds: dbDoc?.heroCategoryIds || [],
      heroCategories: (dbDoc?.heroCategories || []).map((hc: any) => {
        const hcSlug = String(hc.slug || "").toLowerCase().trim();
        const dbMatch = dbBySlug.get(hcSlug) || (hc._id ? dbById.get(String(hc._id)) : null);
        return {
          ...hc,
          image: hc.image || dbMatch?.image || "",
          bannerImage: hc.bannerImage || dbMatch?.bannerImage || "",
        };
      }),
      includeInMenu: dbDoc?.includeInMenu === true || (dbDoc?.includeInMenu !== false && !isLegacyNonMenuCategory(node.slug || dbDoc?.slug)),
      menuGroup: dbDoc?.menuGroup || node.groupName || "",
      menuLabel: dbDoc?.menuLabel || "",
      menuNavSection: dbDoc?.menuNavSection || "",
      children: node.children || [],
      hasDbRecord: Boolean(dbDoc && dbDoc._id),
      isCustom: Boolean(node.isCustom),
    };
  };

  const seenSlugs = new Set<string>();

  // 2. Build authoritative tree from Storefront Navbar Product Categories
  const tree: IStoreCategoryNode[] = DEFAULT_NAV_ITEMS
    .filter((nav) => Boolean(CORE_PRODUCT_PARENTS[nav.id]))
    .map((nav) => {
      const config = CORE_PRODUCT_PARENTS[nav.id];
      const parentSlug = config.slug;
      seenSlugs.add(parentSlug);
      seenSlugs.add(nav.id);

      const parentDbDoc = resolveDbCategory(parentSlug, config.name);

      const subcategoryNodes: IStoreCategoryNode[] = [];

      if (nav.megaMenuItems) {
        nav.megaMenuItems.forEach((section) => {
          // If section has groupHref, it forms a clickable group category (e.g. Riding Gloves, Riding Jackets, etc.)
          if (section.groupHref) {
            const groupSlug = section.groupHref.replace(/^\//, "").split("?")[0].split("/").filter(Boolean).pop() || section.groupHref;
            const groupDbDoc = resolveDbCategory(groupSlug, section.group);

            const groupChildNodes: IStoreCategoryNode[] = [];

            section.items.forEach((item) => {
              const pathParts = item.href.replace(/^\//, "").split("?")[0].split("/").filter(Boolean);
              const leafSlug = pathParts[pathParts.length - 1] || item.href;
              const fullSlug = pathParts.join("/");

              if (!seenSlugs.has(leafSlug) && !seenSlugs.has(fullSlug)) {
                seenSlugs.add(leafSlug);
                seenSlugs.add(fullSlug);
                const itemDbDoc = resolveDbCategory(leafSlug, item.label);
                groupChildNodes.push(
                  mergeDbProps(
                    {
                      id: leafSlug,
                      name: item.label,
                      slug: leafSlug,
                      linkUrl: item.href,
                      parentId: groupDbDoc?._id ? String(groupDbDoc._id) : groupSlug,
                      image: item.logoUrl,
                      groupName: section.group || undefined,
                      children: [],
                    },
                    itemDbDoc
                  )
                );
              }
            });

            if (!seenSlugs.has(groupSlug)) {
              seenSlugs.add(groupSlug);
              subcategoryNodes.push(
                mergeDbProps(
                  {
                    id: groupSlug,
                    name:
                      groupSlug === "motorcycle-riding-boots" && section.group === "Riding Boots"
                        ? "Motorcycle riding boots"
                        : section.group,
                    slug: groupSlug,
                    linkUrl: section.groupHref,
                    parentId: parentDbDoc?._id ? String(parentDbDoc._id) : nav.id,
                    children: groupChildNodes,
                  },
                  groupDbDoc
                )
              );
            }
          } else {
            // Flat group (e.g. Types, Accessories & Care, Touring Bags, etc.)
            section.items.forEach((item) => {
              const pathParts = item.href.replace(/^\//, "").split("?")[0].split("/").filter(Boolean);
              const leafSlug = pathParts[pathParts.length - 1] || item.href;
              const fullSlug = pathParts.join("/");

              if (!seenSlugs.has(leafSlug) && !seenSlugs.has(fullSlug)) {
                seenSlugs.add(leafSlug);
                seenSlugs.add(fullSlug);
                const itemDbDoc = resolveDbCategory(leafSlug, item.label);
                subcategoryNodes.push(
                  mergeDbProps(
                    {
                      id: leafSlug,
                      name: item.label,
                      slug: leafSlug,
                      linkUrl: item.href,
                      parentId: parentDbDoc?._id ? String(parentDbDoc._id) : nav.id,
                      image: item.logoUrl,
                      groupName: section.group || undefined,
                      children: [],
                    },
                    itemDbDoc
                  )
                );
              }
            });
          }
        });
      }

      return mergeDbProps(
        {
          id: nav.id,
          name: config.name,
          slug: parentSlug,
          linkUrl: config.linkUrl,
          children: subcategoryNodes,
        },
        parentDbDoc
      );
    });

  // 3. Dynamically merge custom categories created by admin in MongoDB
  if (flatDbList.length > 0) {
    flatDbList.forEach((dbCat) => {
      const dbId = String(dbCat._id || "");
      if (!dbId || matchedDbIds.has(dbId)) return;

      const dbSlug = dbCat.slug || dbId;
      // Skip duplicate aliases of existing menu items (e.g. "full-face-helmet", "helmets", "riding-jacket")
      if (seenSlugs.has(dbSlug) || isCanonicalMenuAlias(dbSlug)) return;

      // Skip legacy non-menu categories so they remain in "Unmapped Legacy Categories" tab unless explicitly placed into a menuNavSection by admin
      if (isLegacyNonMenuCategory(dbSlug) && !dbCat.menuNavSection) return;

      // Parse menuNavSection (e.g. "helmets:Types")
      const navSection = (dbCat.menuNavSection || "").trim();
      let targetNavId = "";
      let targetSectionGroup = "";
      if (navSection && navSection.includes(":")) {
        const [navId, ...grpParts] = navSection.split(":");
        targetNavId = navId.trim().toLowerCase();
        targetSectionGroup = grpParts.join(":").trim();
      }

      // Case A: Custom Subcategory created under an existing parent or group
      if (dbCat.parentId) {
        const pId = String(dbCat.parentId).toLowerCase();

        const attachToParent = (nodes: IStoreCategoryNode[]): boolean => {
          for (const node of nodes) {
            if (
              String(node._id).toLowerCase() === pId ||
              String(node.id).toLowerCase() === pId ||
              String(node.slug).toLowerCase() === pId
            ) {
              node.children = node.children || [];
              node.children.push(
                mergeDbProps(
                  {
                    id: dbSlug,
                    name: dbCat.name,
                    slug: dbSlug,
                    linkUrl: `/${node.slug}/${dbSlug}`,
                    parentId: node._id || node.id,
                    groupName: targetSectionGroup || dbCat.menuGroup || undefined,
                    children: [],
                    isCustom: true,
                  },
                  dbCat
                )
              );
              matchedDbIds.add(dbId);
              seenSlugs.add(dbSlug);
              return true;
            }
            if (node.children && node.children.length > 0) {
              if (attachToParent(node.children)) return true;
            }
          }
          return false;
        };

        attachToParent(tree);
      } else if (targetNavId) {
        // Case B: Category has Target Submenu Section (e.g. "helmets:Types") without explicit parentId
        const rootNode = tree.find(
          (n) =>
            n.id.toLowerCase() === targetNavId ||
            n.slug.toLowerCase() === targetNavId ||
            (CORE_PRODUCT_PARENTS[n.id] && CORE_PRODUCT_PARENTS[n.id].slug.toLowerCase() === targetNavId)
        );

        if (rootNode) {
          const matchingGroupChild = rootNode.children?.find(
            (c) =>
              c.name.toLowerCase() === targetSectionGroup.toLowerCase() ||
              (c.groupName && c.groupName.toLowerCase() === targetSectionGroup.toLowerCase())
          );

          if (matchingGroupChild && matchingGroupChild.children) {
            matchingGroupChild.children.push(
              mergeDbProps(
                {
                  id: dbSlug,
                  name: dbCat.name,
                  slug: dbSlug,
                  linkUrl: `/${rootNode.slug}/${matchingGroupChild.slug}/${dbSlug}`,
                  parentId: matchingGroupChild._id || matchingGroupChild.id,
                  groupName: targetSectionGroup,
                  children: [],
                  isCustom: true,
                },
                dbCat
              )
            );
          } else {
            rootNode.children = rootNode.children || [];
            rootNode.children.push(
              mergeDbProps(
                {
                  id: dbSlug,
                  name: dbCat.name,
                  slug: dbSlug,
                  linkUrl: `/${rootNode.slug}/${dbSlug}`,
                  parentId: rootNode._id || rootNode.id,
                  groupName: targetSectionGroup || undefined,
                  children: [],
                  isCustom: true,
                },
                dbCat
              )
            );
          }
          matchedDbIds.add(dbId);
          seenSlugs.add(dbSlug);
        }
      } else if (dbCat.menuGroup === "admin-custom") {
        // Case B: Explicit custom Root Parent category created by Admin
        tree.push(
          mergeDbProps(
            {
              id: dbSlug,
              name: dbCat.name,
              slug: dbSlug,
              linkUrl: `/${dbSlug}`,
              children: [],
              isCustom: true,
            },
            dbCat
          )
        );
        matchedDbIds.add(dbId);
        seenSlugs.add(dbSlug);
      }
    });
  }

  return tree;
}

/**
 * Returns any database categories that are NOT mapped to the authoritative Storefront Menu.
 * Used for the secondary "Unmapped Legacy Categories" tab in AdminCategories.
 */
export function getUnmappedLegacyCategories(
  dbCategories: any[] = [],
  menuTree: IStoreCategoryNode[] = []
): any[] {
  const menuSlugs = new Set<string>();
  const menuIds = new Set<string>();

  const collectMenuKeys = (nodes: IStoreCategoryNode[]) => {
    for (const n of nodes) {
      if (n.slug) menuSlugs.add(n.slug.toLowerCase().trim());
      if (n._id) menuIds.add(String(n._id));
      if (n.id) menuIds.add(String(n.id).toLowerCase().trim());
      if (n.children && n.children.length > 0) {
        collectMenuKeys(n.children);
      }
    }
  };

  collectMenuKeys(menuTree);

  const flatList: any[] = [];
  const traverseDb = (nodes: any[], depth = 0) => {
    if (!Array.isArray(nodes)) return;
    for (const n of nodes) {
      flatList.push({ ...n, depth });
      if (Array.isArray(n.children) && n.children.length > 0) {
        traverseDb(n.children, depth + 1);
      }
    }
  };
  traverseDb(dbCategories);

  const seenUnmapped = new Set<string>();
  return flatList.filter((cat) => {
    const slug = (cat.slug || "").toLowerCase().trim();
    const id = String(cat._id || cat.id || "");
    if (menuSlugs.has(slug) || (id && menuIds.has(id))) return false;
    const uniqueKey = id || slug;
    if (!uniqueKey || seenUnmapped.has(uniqueKey)) return false;
    seenUnmapped.add(uniqueKey);
    return true;
  });
}

export interface BreadcrumbLink {
  label: string;
  href?: string;
}

/**
 * Resolves clean, canonical, enterprise-grade breadcrumb links for a Product Detail Page.
 *
 * Guarantees:
 * 1. Strict e-commerce hierarchy: HOME > [Main Category] > [Subcategory] > [Product Name]
 * 2. Matches the authoritative storefront navigation (/motorcycle-helmets/full-face-helmets)
 * 3. NO generic "PRODUCTS" link
 * 4. NO Brand injected into category breadcrumbs (Brand is an attribute, not a category node)
 * 5. Automatically filters out legacy non-menu categories (e.g. "Axor Agera Full Face Helmets")
 * 6. Eliminates duplicate or redundant adjacent items
 */
export function resolveProductBreadcrumbs(product: {
  name: string;
  category?: string;
  categorySlug?: string;
  subCategory?: string;
  subCategorySlug?: string;
  categoryHierarchy?: Array<{ name: string; slug: string }>;
  categorySlugs?: string[];
  magentoCategories?: string;
  brand?: string;
}): BreadcrumbLink[] {
  const items: BreadcrumbLink[] = [{ label: "HOME", href: "/" }];

  // 1. Build a lookup index from authoritative DEFAULT_NAV_ITEMS
  type NavPath = Array<{ label: string; href: string }>;
  const navMap = new Map<string, NavPath>();

  DEFAULT_NAV_ITEMS.forEach((topItem) => {
    const topSlug = topItem.href.replace(/^\//, "").toLowerCase().trim();
    const topLabel = topItem.label.toUpperCase();
    const topHref = topItem.href.startsWith("/") ? topItem.href : `/${topItem.href}`;

    const topPath: NavPath = [{ label: topLabel, href: topHref }];
    navMap.set(topSlug, topPath);
    navMap.set(topItem.id.toLowerCase().trim(), topPath);
    navMap.set(topItem.label.toLowerCase().trim(), topPath);

    if (topItem.megaMenuItems) {
      topItem.megaMenuItems.forEach((group) => {
        const groupHref = group.groupHref
          ? (group.groupHref.startsWith("/") ? group.groupHref : `/${group.groupHref}`)
          : undefined;
        const groupSlug = groupHref ? groupHref.replace(/^\//, "").toLowerCase().trim() : undefined;
        const groupLabel = group.group.trim().toUpperCase();

        const groupPath: NavPath = groupHref && group.group.trim()
          ? [
              { label: topLabel, href: topHref },
              { label: groupLabel, href: groupHref },
            ]
          : [{ label: topLabel, href: topHref }];

        if (groupSlug) {
          navMap.set(groupSlug, groupPath);
          navMap.set(group.group.toLowerCase().trim(), groupPath);
          const lastGroupPart = groupSlug.split("/").pop();
          if (lastGroupPart) navMap.set(lastGroupPart, groupPath);
        }

        if (group.items) {
          group.items.forEach((subItem) => {
            const subHref = subItem.href.startsWith("/") ? subItem.href : `/${subItem.href}`;
            const subSlug = subHref.replace(/^\//, "").toLowerCase().trim();
            const subLabel = subItem.label.trim().toUpperCase();
            const leafPath: NavPath = [...groupPath, { label: subLabel, href: subHref }];

            navMap.set(subSlug, leafPath);
            navMap.set(subItem.label.toLowerCase().trim(), leafPath);
            const lastSubPart = subSlug.split("/").pop();
            if (lastSubPart) navMap.set(lastSubPart, leafPath);
          });
        }
      });
    }
  });

  // 2. Collect candidate keys from product in priority order
  const candidates: string[] = [];
  const addCandidate = (val?: string) => {
    if (!val || typeof val !== "string") return;
    const clean = val.toLowerCase().trim();
    if (clean && !candidates.includes(clean)) {
      candidates.push(clean);
    }
  };

  // Inspect subcategory and category first
  addCandidate(product.subCategorySlug);
  addCandidate(product.subCategory);
  addCandidate(product.categorySlug);
  addCandidate(product.category);

  if (Array.isArray(product.categorySlugs)) {
    product.categorySlugs.forEach(addCandidate);
  }
  if (Array.isArray(product.categoryHierarchy)) {
    product.categoryHierarchy.forEach((c) => {
      addCandidate(c.slug);
      addCandidate(c.name);
    });
  }
  if (product.magentoCategories) {
    product.magentoCategories.split(",").forEach((catPath) => {
      catPath.split("/").forEach(addCandidate);
    });
  }

  // 3. Match candidate against navMap
  let matchedPath: NavPath | null = null;
  for (const raw of candidates) {
    const slugForm = raw.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const leafSegment = slugForm.split("/").pop() || slugForm;

    // Resolve alias if present (e.g. full-face -> full-face-helmets)
    let canonical = leafSegment;
    for (const [targetCanonical, aliases] of Object.entries(CATEGORY_SLUG_ALIASES)) {
      if (aliases.some((a) => a.toLowerCase() === leafSegment || a.toLowerCase() === raw)) {
        canonical = targetCanonical;
        break;
      }
    }

    if (navMap.has(canonical)) {
      matchedPath = navMap.get(canonical)!;
      break;
    }
    if (navMap.has(leafSegment)) {
      matchedPath = navMap.get(leafSegment)!;
      break;
    }
    if (navMap.has(raw)) {
      matchedPath = navMap.get(raw)!;
      break;
    }
    if (navMap.has(slugForm)) {
      matchedPath = navMap.get(slugForm)!;
      break;
    }
  }

  if (matchedPath && matchedPath.length > 0) {
    items.push(...matchedPath);
  } else {
    // Fallback for custom or unmapped categories
    if (product.categoryHierarchy && product.categoryHierarchy.length > 0) {
      product.categoryHierarchy.forEach((node) => {
        const uName = (node.name || "").toUpperCase().trim();
        if (uName && uName !== "PRODUCTS" && uName !== "HOME") {
          items.push({
            label: uName,
            href: node.slug ? (node.slug.startsWith("/") ? node.slug : `/${node.slug}`) : undefined,
          });
        }
      });
    } else {
      if (product.category) {
        items.push({
          label: product.category.toUpperCase().trim(),
          href: product.categorySlug ? (product.categorySlug.startsWith("/") ? product.categorySlug : `/${product.categorySlug}`) : `/${product.category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        });
      }
      if (
        product.subCategory &&
        !isLegacyNonMenuCategory(product.subCategorySlug || product.subCategory) &&
        product.subCategory.toLowerCase().trim() !== product.category?.toLowerCase().trim()
      ) {
        items.push({
          label: product.subCategory.toUpperCase().trim(),
          href: product.subCategorySlug ? (product.subCategorySlug.startsWith("/") ? product.subCategorySlug : `/${product.subCategorySlug}`) : `/${product.subCategory.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        });
      }
    }
  }

  // 4. Deduplicate consecutive items with identical labels or hrefs
  const deduped: BreadcrumbLink[] = [];
  items.forEach((item) => {
    const prev = deduped[deduped.length - 1];
    if (!prev || (prev.label !== item.label && prev.href !== item.href)) {
      deduped.push(item);
    }
  });

  // 5. Append current product name (terminal item, no link)
  deduped.push({ label: product.name });

  return deduped;
}

// Fast lookup set of known category slugs (used for loading skeletons)
export const ALL_CATEGORY_SLUGS = new Set<string>();

// Strict set of canonical full category URL paths from official storefront navigation
// (excludes shop-by-brand and guides to prevent any collision with product/brand/guide slugs)
export const CANONICAL_CATEGORY_PATHS = new Set<string>();

// 1. Core category parents
Object.values(CORE_PRODUCT_PARENTS).forEach((c) => {
  ALL_CATEGORY_SLUGS.add(c.slug.toLowerCase());
  const cleanUrl = c.linkUrl.replace(/^\/+|\/+$/g, "").toLowerCase();
  if (cleanUrl) {
    ALL_CATEGORY_SLUGS.add(cleanUrl);
    CANONICAL_CATEGORY_PATHS.add(cleanUrl);
  }
});

// 2. Category aliases & taxonomy keys (for skeleton detection)
Object.entries(CATEGORY_SLUG_ALIASES).forEach(([key, aliases]) => {
  ALL_CATEGORY_SLUGS.add(key.toLowerCase());
  aliases.forEach((a) => ALL_CATEGORY_SLUGS.add(a.toLowerCase()));
});

// 3. Official catalog navbar URLs & subcategory paths
DEFAULT_NAV_ITEMS.forEach((item) => {
  if (item.id === "shop-by-brand" || item.id === "guides") return;

  const cleanItemPath = item.href.replace(/^\/+|\/+$/g, "").toLowerCase();
  if (cleanItemPath && cleanItemPath !== "#") {
    CANONICAL_CATEGORY_PATHS.add(cleanItemPath);
    const itemSlug = cleanItemPath.split("/").pop();
    if (itemSlug) ALL_CATEGORY_SLUGS.add(itemSlug);
  }

  item.megaMenuItems?.forEach((group) => {
    if (group.groupHref) {
      const cleanGroupPath = group.groupHref.replace(/^\/+|\/+$/g, "").toLowerCase();
      if (cleanGroupPath && cleanGroupPath !== "#") {
        CANONICAL_CATEGORY_PATHS.add(cleanGroupPath);
        const gSlug = cleanGroupPath.split("/").pop();
        if (gSlug) ALL_CATEGORY_SLUGS.add(gSlug);
      }
    }
    group.items?.forEach((sub) => {
      const cleanSubPath = sub.href.replace(/^\/+|\/+$/g, "").toLowerCase();
      if (cleanSubPath && cleanSubPath !== "#" && !cleanSubPath.startsWith("brands/") && !cleanSubPath.startsWith("guides/")) {
        CANONICAL_CATEGORY_PATHS.add(cleanSubPath);
        const sSlug = cleanSubPath.split("/").pop();
        if (sSlug) ALL_CATEGORY_SLUGS.add(sSlug);
      }
    });
  });
});

/**
 * Used in loading.tsx to show the catalog skeleton instead of product skeleton.
 */
export function isKnownCategorySlug(slug?: string): boolean {
  if (!slug) return false;
  const clean = slug.toLowerCase().trim().replace(/\.html$/i, "");
  return ALL_CATEGORY_SLUGS.has(clean);
}

/**
 * Strictly checks whether a URL segment array matches an unambiguous canonical
 * category path from the storefront navigation. Safe for skipping product lookups.
 */
export function isCanonicalCategoryPath(slugSegments: string[]): boolean {
  if (!slugSegments || slugSegments.length === 0) return false;
  const cleanFullPath = slugSegments
    .map((s) => s.replace(/\.html$/i, "").toLowerCase().trim())
    .filter(Boolean)
    .join("/");
  return CANONICAL_CATEGORY_PATHS.has(cleanFullPath);
}


