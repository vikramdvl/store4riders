import { describe, it, expect } from "vitest";
import {
  getStoreNavbarCategoryTree,
  getUnmappedLegacyCategories,
  isLegacyNonMenuCategory,
  CORE_PRODUCT_PARENTS,
  resolveProductBreadcrumbs,
  isCanonicalCategoryPath,
  isKnownCategorySlug,
  areCategorySlugsEquivalent,
} from "../navCategories";

describe("navCategories Suite — Storefront Navbar & Admin Categories Tree", () => {
  it("strictly includes only the core catalog parent categories in the main tree", () => {
    const tree = getStoreNavbarCategoryTree([]);
    const parentSlugs = tree.map((p) => p.slug);

    // Main catalog categories
    expect(parentSlugs).toContain("motorcycle-helmets");
    expect(parentSlugs).toContain("riding-gear");
    expect(parentSlugs).toContain("motorcycle-bags-bike-luggage");
    expect(parentSlugs).toContain("motorcycle-accessories-online");
    expect(parentSlugs).toContain("spares");
    expect(parentSlugs).toContain("exhausts");
    expect(parentSlugs).toContain("gadgets");

    // Non-catalog categories (brands, guides) must NOT be in the catalog tree
    expect(parentSlugs).not.toContain("brands");
    expect(parentSlugs).not.toContain("guides");
  });

  it("builds the correct subcategory and group hierarchy matching the Storefront Navbar", () => {
    const tree = getStoreNavbarCategoryTree([]);

    // 1. Helmets
    const helmetsNode = tree.find((n) => n.slug === "motorcycle-helmets");
    expect(helmetsNode).toBeDefined();
    const helmetSubSlugs = helmetsNode?.children?.map((c) => c.slug);
    expect(helmetSubSlugs).toContain("full-face-helmets");
    expect(helmetSubSlugs).toContain("modular-helmets");
    expect(helmetSubSlugs).toContain("off-road-helmets");
    expect(helmetSubSlugs).toContain("open-face-helmets");
    expect(helmetSubSlugs).toContain("carbon-fibre-helmets");
    expect(helmetSubSlugs).toContain("helmet-accessories");
    expect(helmetSubSlugs).toContain("balaclava");
    expect(helmetSubSlugs).toContain("helmet-cleaners");

    // Gadgets has communicators
    const gadgetsNode = tree.find((n) => n.slug === "gadgets");
    expect(gadgetsNode).toBeDefined();
    const gadgetSubSlugs = gadgetsNode?.children?.map((c) => c.slug);
    expect(gadgetSubSlugs).toContain("communicators");

    // 2. Riding Gear has groups and subcategories
    const ridingGearNode = tree.find((n) => n.slug === "riding-gear");
    expect(ridingGearNode).toBeDefined();
    const gearGroupSlugs = ridingGearNode?.children?.map((c) => c.slug);
    expect(gearGroupSlugs).toContain("riding-gloves");
    expect(gearGroupSlugs).toContain("riding-jackets");
    expect(gearGroupSlugs).toContain("riding-pants");
    expect(gearGroupSlugs).toContain("motorcycle-riding-boots");

    // Check nested glove items
    const glovesGroup = ridingGearNode?.children?.find((c) => c.slug === "riding-gloves");
    expect(glovesGroup).toBeDefined();
    const gloveChildSlugs = glovesGroup?.children?.map((c) => c.slug);
    expect(gloveChildSlugs).toContain("full-gauntlet-gloves");
    expect(gloveChildSlugs).toContain("semi-gauntlet-gloves");
    expect(gloveChildSlugs).toContain("short-motorbike-gloves");
  });

  it("merges database category properties (real _id, image, SEO metadata, FAQs) into matching nodes", () => {
    const mockDbCategories = [
      {
        _id: "672cb0a123456789abcdef01",
        name: "Motorcycle Helmets",
        slug: "helmets", // alias
        image: "https://s3.amazonaws.com/store4riders/helmets-cat.webp",
        metaTitle: "Buy Motorcycle Helmets Online",
        faqs: [{ question: "How to choose a helmet?", answer: "Measure your head." }],
      },
      {
        _id: "672cb0a123456789abcdef02",
        name: "Full Face Helmets",
        slug: "full-face-helmets",
        image: "https://s3.amazonaws.com/store4riders/full-face.webp",
        hsnCode: "6506",
        taxClassName: "Taxable Goods (GST 18%)",
      },
    ];

    const tree = getStoreNavbarCategoryTree(mockDbCategories);

    // Check parent merge
    const helmetsNode = tree.find((n) => n.slug === "motorcycle-helmets");
    expect(helmetsNode?._id).toBe("672cb0a123456789abcdef01");
    expect(helmetsNode?.image).toBe("https://s3.amazonaws.com/store4riders/helmets-cat.webp");
    expect(helmetsNode?.metaTitle).toBe("Buy Motorcycle Helmets Online");
    expect(helmetsNode?.faqs?.length).toBe(1);
    expect(helmetsNode?.hasDbRecord).toBe(true);

    // Check child merge
    const fullFaceNode = helmetsNode?.children?.find((c) => c.slug === "full-face-helmets");
    expect(fullFaceNode?._id).toBe("672cb0a123456789abcdef02");
    expect(fullFaceNode?.image).toBe("https://s3.amazonaws.com/store4riders/full-face.webp");
    expect(fullFaceNode?.hsnCode).toBe("6506");
    expect(fullFaceNode?.hasDbRecord).toBe(true);
  });

  it("attaches newly created custom subcategories under their parent", () => {
    const mockDbCategories = [
      {
        _id: "672cb0a123456789abcdef99",
        name: "Action Cameras & Accessories",
        slug: "action-cameras",
        parentId: "gadgets",
      },
    ];

    const tree = getStoreNavbarCategoryTree(mockDbCategories);
    const gadgetsNode = tree.find((n) => n.slug === "gadgets");
    expect(gadgetsNode).toBeDefined();

    const customChild = gadgetsNode?.children?.find((c) => c.slug === "action-cameras");
    expect(customChild).toBeDefined();
    expect(customChild?.name).toBe("Action Cameras & Accessories");
    expect(customChild?.isCustom).toBe(true);
  });

  it("correctly identifies unmapped legacy categories so they do not pollute the main menu tree", () => {
    const mockDbCategories = [
      {
        _id: "672cb0a123456789abcdef10",
        name: "SMK Stellar Helmet",
        slug: "smk-stellar-helmet",
      },
      {
        _id: "672cb0a123456789abcdef11",
        name: "Clearance Sale 2024",
        slug: "sale",
      },
      {
        _id: "672cb0a123456789abcdef12",
        name: "Full Face Helmets",
        slug: "full-face-helmets",
      },
    ];

    const tree = getStoreNavbarCategoryTree(mockDbCategories);
    const unmapped = getUnmappedLegacyCategories(mockDbCategories, tree);

    const unmappedSlugs = unmapped.map((c) => c.slug);
    expect(unmappedSlugs).toContain("smk-stellar-helmet");
    expect(unmappedSlugs).toContain("sale");
    // Full face helmet is in the main tree, so it must NOT be in unmapped
    expect(unmappedSlugs).not.toContain("full-face-helmets");
  });

  it("correctly nests SEO subcategories under Full Face Helmets without polluting unmapped list", () => {
    const fullFaceId = "6ac9de6835b1b42fa90ac6d3";
    const mockDbCategories = [
      {
        _id: fullFaceId,
        name: "Full Face Helmets",
        slug: "full-face-helmets",
      },
      {
        _id: "6aedbb838479a115cba9da95",
        name: "Full Face Helmets Under Rs.4000",
        slug: "helmets-below-rs-4000",
        parentId: fullFaceId,
        includeInMenu: false,
        menuGroup: "SEO / Price",
      },
      {
        _id: "6aedbb838479a115cba9da87",
        name: "Axor Apex Dual Visor Full Face Helmets",
        slug: "axor-apex-dual-visor-full-face-helmets",
        parentId: fullFaceId,
        includeInMenu: false,
        menuGroup: "SEO / Model",
      },
      {
        _id: "6ac49c25ed338a8e53f2e833",
        name: "Premium Full Face Helmets",
        slug: "premium-full-face-helmets",
        parentId: fullFaceId,
        includeInMenu: false,
        menuGroup: "SEO / Feature",
      },
    ];

    const tree = getStoreNavbarCategoryTree(mockDbCategories);
    const helmetsNode = tree.find((n) => n.slug === "motorcycle-helmets");
    expect(helmetsNode).toBeDefined();

    const fullFaceNode = helmetsNode?.children?.find((c) => c.slug === "full-face-helmets");
    expect(fullFaceNode).toBeDefined();
    expect(fullFaceNode?.children?.length).toBe(3);

    const childSlugs = fullFaceNode?.children?.map((c) => c.slug);
    expect(childSlugs).toContain("helmets-below-rs-4000");
    expect(childSlugs).toContain("axor-apex-dual-visor-full-face-helmets");
    expect(childSlugs).toContain("premium-full-face-helmets");

    // Must NOT be in unmapped
    const unmapped = getUnmappedLegacyCategories(mockDbCategories, tree);
    const unmappedSlugs = unmapped.map((c) => c.slug);
    expect(unmappedSlugs).not.toContain("helmets-below-rs-4000");
    expect(unmappedSlugs).not.toContain("axor-apex-dual-visor-full-face-helmets");
    expect(unmappedSlugs).not.toContain("premium-full-face-helmets");
  });

  it("correctly identifies legacy non-menu slugs via isLegacyNonMenuCategory", () => {
    expect(isLegacyNonMenuCategory("smk-stellar-helmet")).toBe(true);
    expect(isLegacyNonMenuCategory("sale")).toBe(true);
    expect(isLegacyNonMenuCategory("merchandise")).toBe(true);
    expect(isLegacyNonMenuCategory("full-face-helmets")).toBe(false);
    expect(isLegacyNonMenuCategory("carbon-fibre-helmets")).toBe(false);
    expect(isLegacyNonMenuCategory("premium-full-face-helmets")).toBe(false);
  });

  it("correctly identifies equivalent category aliases without false positives", () => {
    expect(areCategorySlugsEquivalent("performance-air-filter-bike", "performance-air-filters-for-bikes")).toBe(true);
    expect(areCategorySlugsEquivalent("communicators", "bluetooth-intercoms")).toBe(true);
    expect(areCategorySlugsEquivalent("touring-gear", "motorcycle-touring-gear")).toBe(true);
    expect(areCategorySlugsEquivalent("full-face-helmets", "carbon-fibre-helmets")).toBe(false);
    expect(areCategorySlugsEquivalent("bike-phone-holders", "motorcycle-smart-display")).toBe(false);
  });

  it("prioritizes database category name when admin renames categories", () => {
    const mockDbCategories = [
      {
        _id: "cat_boots_01",
        name: "Motorcycle riding boots",
        slug: "motorcycle-riding-boots",
      },
      {
        _id: "cat_luggage_01",
        name: "Motorcycle Bags / Bike Luggage",
        slug: "motorcycle-bags-bike-luggage",
      },
      {
        _id: "cat_jackets_01",
        name: "Custom Armor & Jackets",
        slug: "riding-jackets",
      },
    ];

    const tree = getStoreNavbarCategoryTree(mockDbCategories);

    // 1. Check boots
    const gearNode = tree.find((n) => n.slug === "riding-gear");
    const bootsNode = gearNode?.children?.find((c) => c.slug === "motorcycle-riding-boots");
    expect(bootsNode?.name).toBe("Motorcycle riding boots");

    // 2. Check luggage
    const luggageNode = tree.find((n) => n.slug === "motorcycle-bags-bike-luggage");
    expect(luggageNode?.name).toBe("Motorcycle Bags / Bike Luggage");

    // 3. Check custom rename on jackets
    const jacketsNode = gearNode?.children?.find((c) => c.slug === "riding-jackets");
    expect(jacketsNode?.name).toBe("Custom Armor & Jackets");
  });

  describe("resolveProductBreadcrumbs Suite", () => {
    it("resolves canonical Helmets hierarchy for Axor Agera Rush Helmet without brand or PRODUCTS clutter", () => {
      const product = {
        name: "Axor Agera Rush Full Face Helmet",
        category: "Full Face Helmets",
        categorySlug: "full-face-helmets",
        subCategory: "Axor Agera Full Face Helmets",
        subCategorySlug: "axor-agera-full-face-helmets",
        brand: "Axor Helmets",
      };

      const breadcrumbs = resolveProductBreadcrumbs(product);

      expect(breadcrumbs).toEqual([
        { label: "HOME", href: "/" },
        { label: "HELMETS", href: "/motorcycle-helmets" },
        { label: "FULL FACE HELMETS", href: "/motorcycle-helmets/full-face-helmets" },
        { label: "Axor Agera Rush Full Face Helmet" },
      ]);
    });

    it("resolves 3-level hierarchy for Full Gauntlet Riding Gloves", () => {
      const product = {
        name: "Shima RS-2 Full Gauntlet Gloves",
        category: "Riding Gloves",
        categorySlug: "riding-gloves",
        subCategory: "Full Gauntlet Gloves",
        subCategorySlug: "full-gauntlet-gloves",
        brand: "Shima",
      };

      const breadcrumbs = resolveProductBreadcrumbs(product);

      expect(breadcrumbs).toEqual([
        { label: "HOME", href: "/" },
        { label: "RIDING GEAR", href: "/riding-gear" },
        { label: "RIDING GLOVES", href: "/riding-gear/riding-gloves" },
        { label: "FULL GAUNTLET GLOVES", href: "/riding-gear/riding-gloves/full-gauntlet-gloves" },
        { label: "Shima RS-2 Full Gauntlet Gloves" },
      ]);
    });

    it("resolves top-level category for Exhausts without redundant subcategories", () => {
      const product = {
        name: "Barrel Exhaust Canon 2.0",
        category: "Exhausts",
        categorySlug: "exhausts",
      };

      const breadcrumbs = resolveProductBreadcrumbs(product);

      expect(breadcrumbs).toEqual([
        { label: "HOME", href: "/" },
        { label: "EXHAUSTS", href: "/exhausts" },
        { label: "Barrel Exhaust Canon 2.0" },
      ]);
    });

    it("filters out legacy non-menu subcategory when category matches canonical parent", () => {
      const product = {
        name: "Axor Apex Sport Helmet",
        category: "Helmets",
        categorySlug: "motorcycle-helmets",
        subCategory: "Axor Apex Helmet Sport Touring Performance",
        subCategorySlug: "axor-apex-helmet-sport-touring-performance",
      };

      const breadcrumbs = resolveProductBreadcrumbs(product);

      expect(breadcrumbs).toEqual([
        { label: "HOME", href: "/" },
        { label: "HELMETS", href: "/motorcycle-helmets" },
        { label: "FULL FACE HELMETS", href: "/motorcycle-helmets/full-face-helmets" },
        { label: "Axor Apex Sport Helmet" },
      ]);
    });
  });

  describe("isCanonicalCategoryPath — Fast-Path Safety", () => {
    it("matches canonical official navbar category paths strictly", () => {
      expect(isCanonicalCategoryPath(["motorcycle-helmets"])).toBe(true);
      expect(isCanonicalCategoryPath(["motorcycle-helmets", "full-face-helmets"])).toBe(true);
      expect(isCanonicalCategoryPath(["motorcycle-helmets", "carbon-fibre-helmets"])).toBe(true);
      expect(isCanonicalCategoryPath(["motorcycle-helmets", "full-face-helmets.html"])).toBe(true);
      expect(isCanonicalCategoryPath(["riding-gear"])).toBe(true);
      expect(isCanonicalCategoryPath(["riding-gear", "riding-jackets"])).toBe(true);
      expect(isCanonicalCategoryPath(["riding-gear", "riding-jackets", "protectors-armour"])).toBe(true);
      expect(isCanonicalCategoryPath(["riding-gear-for-women"])).toBe(true);
      expect(isCanonicalCategoryPath(["bike-spares", "brake-pads"])).toBe(true);
      expect(isCanonicalCategoryPath(["motorcycle-helmets", "balaclava"])).toBe(true);
    });

    it("does NOT match product slugs, multi-segment product URLs, brands, or guides", () => {
      expect(isCanonicalCategoryPath(["furygan-jet-d3o-riding-gloves"])).toBe(false);
      expect(isCanonicalCategoryPath(["riding-gear", "gloves", "furygan-jet-d3o-riding-gloves"])).toBe(false);
      expect(isCanonicalCategoryPath(["axor-apex-helmet-sport-touring-performance"])).toBe(false);
      expect(isCanonicalCategoryPath(["smk-twister-helmet"])).toBe(false);
      expect(isCanonicalCategoryPath(["balaclava"])).toBe(false);
      expect(isCanonicalCategoryPath(["brake-pads"])).toBe(false);
      expect(isCanonicalCategoryPath(["motul"])).toBe(false);
      expect(isCanonicalCategoryPath(["brands", "motul"])).toBe(false);
      expect(isCanonicalCategoryPath(["guides", "category", "expert-tips"])).toBe(false);
      expect(isCanonicalCategoryPath([])).toBe(false);
    });

    it("keeps brand/guide slugs excluded from isKnownCategorySlug", () => {
      expect(isKnownCategorySlug("motul")).toBe(false);
      expect(isKnownCategorySlug("furygan")).toBe(false);
      expect(isKnownCategorySlug("expert-tips")).toBe(false);
      expect(isKnownCategorySlug("full-face-helmets")).toBe(true);
    });
  });

  describe("Mapped Legacy Categories & Deleted Template Categories", () => {
    it("removes legacy and alias categories from unmapped list once mapped to a parent category", () => {
      const fullFaceId = "6ac9de6835b1b42fa90ac6d3";
      const mockDbCategories = [
        {
          _id: fullFaceId,
          name: "Full Face Helmets",
          slug: "full-face-helmets",
          children: [
            {
              _id: "c_ls2_800",
              name: "LS2 FF800 Storm II Helmets (Touring Range)",
              slug: "ls2-ff800-storm-ii-helmets-touring-range",
              parentId: fullFaceId,
            },
            {
              _id: "c_ls2_320",
              name: "LS2 FF320 Stream II (Daily Rider Range)",
              slug: "ls2-ff320-stream-ii-daily-rider-range",
              parentId: fullFaceId,
            },
            {
              _id: "c_axor_brutale",
              name: "Axor Brutale Dual Spoiler Helmet",
              slug: "axor-brutale-dual-spoiler-helmet",
              parentId: fullFaceId,
            },
            {
              _id: "c_smk_nova",
              name: "SMK Nova Helmets",
              slug: "smk-nova-helmets",
              parentId: fullFaceId,
            },
            {
              _id: "c_axor_agera",
              name: "Axor Agera Full Face Helmets",
              slug: "axor-agera-full-face-helmets",
              parentId: fullFaceId,
            },
            {
              _id: "c_under_5000",
              name: "Best helmets under Rs.5000",
              slug: "best-helmets-under-rs-5000",
              parentId: fullFaceId,
            },
            {
              _id: "c_smk_gullwing",
              name: "SMK Gullwing helmets",
              slug: "smk-gullwing-helmets",
              parentId: "full-face-helmets",
            },
          ],
        },
        {
          _id: "c_still_unmapped",
          name: "SMK Stellar Helmet",
          slug: "smk-stellar-helmet",
        },
      ];

      const tree = getStoreNavbarCategoryTree(mockDbCategories);
      const helmetsNode = tree.find((n) => n.slug === "motorcycle-helmets");
      const fullFaceNode = helmetsNode?.children?.find((c) => c.slug === "full-face-helmets");
      const nestedSlugs = fullFaceNode?.children?.map((c) => c.slug) || [];

      expect(nestedSlugs).toContain("ls2-ff800-storm-ii-helmets-touring-range");
      expect(nestedSlugs).toContain("ls2-ff320-stream-ii-daily-rider-range");
      expect(nestedSlugs).toContain("axor-brutale-dual-spoiler-helmet");
      expect(nestedSlugs).toContain("smk-nova-helmets");
      expect(nestedSlugs).toContain("axor-agera-full-face-helmets");
      expect(nestedSlugs).toContain("best-helmets-under-rs-5000");
      expect(nestedSlugs).toContain("smk-gullwing-helmets");

      const unmapped = getUnmappedLegacyCategories(mockDbCategories, tree);
      const unmappedSlugs = unmapped.map((c) => c.slug);
      expect(unmappedSlugs).toEqual(["smk-stellar-helmet"]);
    });

    it("excludes soft-deleted template categories (e.g. helmet-cleaners) from Storefront Menu and unmapped list without hijacking aliases", () => {
      const mockDbCategories = [
        {
          _id: "cat_cleaners_tombstone",
          name: "Helmet Cleaners",
          slug: "helmet-cleaners",
          includeInMenu: false,
          isDeleted: true,
        },
        {
          _id: "cat_moto_care",
          name: "Motorcycle Care",
          slug: "motorcycle-care",
        },
      ];

      const tree = getStoreNavbarCategoryTree(mockDbCategories);
      const helmetsNode = tree.find((n) => n.slug === "motorcycle-helmets");
      const helmetSubSlugs = helmetsNode?.children?.map((c) => c.slug) || [];

      expect(helmetSubSlugs).not.toContain("helmet-cleaners");

      const unmapped = getUnmappedLegacyCategories(mockDbCategories, tree);
      const unmappedSlugs = unmapped.map((c) => c.slug);
      expect(unmappedSlugs).not.toContain("helmet-cleaners");
      expect(unmappedSlugs).toContain("motorcycle-care");
    });
  });
});
