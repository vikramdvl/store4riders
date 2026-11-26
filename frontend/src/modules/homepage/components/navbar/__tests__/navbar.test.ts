import { describe, it, expect } from "vitest";
import { DEFAULT_NAV_ITEMS, NAV_SUBMENU_SECTIONS } from "../nav.constants";
import { resolveStorefrontNavItems } from "../navOverlay.utils";
import { isLegacyNonMenuCategory } from "@/core/utils/navCategories";

describe("Navbar & Submenu Navigation Integrity Suite", () => {
  it("should have all primary navigation items defined with valid labels and hrefs", () => {
    expect(DEFAULT_NAV_ITEMS.length).toBeGreaterThanOrEqual(5);

    DEFAULT_NAV_ITEMS.forEach((item) => {
      // 1. Basic properties
      expect(item.id).toBeTruthy();
      expect(item.label.trim()).toBeTruthy();
      expect(item.href).toBeTruthy();
      expect(item.href.startsWith("/")).toBe(true);
      expect(item.href).not.toContain(" ");
      expect(item.href).not.toBe("#");
    });
  });

  it("should have valid megaMenu structure with valid subcategories and links", () => {
    const itemsWithDropdown = DEFAULT_NAV_ITEMS.filter((item) => item.hasDropdown);
    expect(itemsWithDropdown.length).toBeGreaterThan(0);

    itemsWithDropdown.forEach((item) => {
      expect(item.megaMenuItems).toBeDefined();
      expect(Array.isArray(item.megaMenuItems)).toBe(true);
      expect(item.megaMenuItems!.length).toBeGreaterThan(0);

      item.megaMenuItems!.forEach((group) => {
        // Group items validation
        expect(Array.isArray(group.items)).toBe(true);
        expect(group.items.length).toBeGreaterThan(0);

        group.items.forEach((subItem) => {
          expect(subItem.label.trim()).toBeTruthy();
          expect(subItem.href.trim()).toBeTruthy();
          expect(subItem.href.startsWith("/")).toBe(true);
          expect(subItem.href).not.toContain(" ");
          expect(subItem.href).not.toBe("#");
        });
      });
    });
  });

  it("should have valid brand links in 'Shop By Brand' section", () => {
    const brandNav = DEFAULT_NAV_ITEMS.find((item) => item.id === "shop-by-brand");
    expect(brandNav).toBeDefined();
    expect(brandNav?.megaMenuItems).toBeDefined();

    const brandGroups = brandNav!.megaMenuItems!;
    expect(brandGroups.length).toBeGreaterThanOrEqual(3);

    const allBrands = brandGroups.flatMap((g) => g.items);
    expect(allBrands.length).toBeGreaterThanOrEqual(15);

    allBrands.forEach((brand) => {
      expect(brand.label).toBeTruthy();
      expect(brand.href).toMatch(/^\/products\?brand=|^(\/brands\/)/);
    });
  });

  it("should contain critical top categories (Helmets, Riding Gear, Luggage, Accessories)", () => {
    const itemIds = DEFAULT_NAV_ITEMS.map((item) => item.id);
    expect(itemIds).toContain("helmets");
    expect(itemIds).toContain("riding-gear");
    expect(itemIds).toContain("luggage");
    expect(itemIds).toContain("accessories");
  });

  it("should have Riding Gear mega menu groups strictly ordered as Gloves -> Jackets -> Pants -> Boots -> Specialized Gear", () => {
    const ridingGearNav = DEFAULT_NAV_ITEMS.find((item) => item.id === "riding-gear");
    expect(ridingGearNav).toBeDefined();
    expect(ridingGearNav?.megaMenuItems).toBeDefined();

    const groupNames = ridingGearNav!.megaMenuItems!.map((g) => g.group);
    expect(groupNames).toEqual([
      "Riding Gloves",
      "Riding Jackets",
      "Riding Pants",
      "Riding Boots",
      "Specialized Gear",
    ]);

    // Verify Specialized Gear contains Touring Gear and Monsoon Gear
    const specializedGroup = ridingGearNav!.megaMenuItems!.find((g) => g.group === "Specialized Gear");
    expect(specializedGroup).toBeDefined();
    const specializedLabels = specializedGroup!.items.map((i) => i.label);
    expect(specializedLabels).toContain("Touring Gear");
    expect(specializedLabels).toContain("Monsoon Gear");
  });

  it("should have Exhausts as a standalone top-level item without duplicate submenu entries", () => {
    const exhaustNavItem = DEFAULT_NAV_ITEMS.find((item) => item.id === "exhausts");
    expect(exhaustNavItem).toBeDefined();
    expect(exhaustNavItem?.href).toBe("/exhausts");

    // Ensure it is not duplicated in other submenus
    DEFAULT_NAV_ITEMS.filter((item) => item.id !== "exhausts" && item.megaMenuItems).forEach((item) => {
      item.megaMenuItems!.forEach((group) => {
        const exhaustSubItem = group.items.find((sub) => sub.label.toLowerCase() === "exhausts");
        expect(exhaustSubItem).toBeUndefined();
      });
    });
  });

  it("should provide valid NAV_SUBMENU_SECTIONS mapping correctly to existing navbar items", () => {
    expect(NAV_SUBMENU_SECTIONS.length).toBeGreaterThanOrEqual(10);

    const validParentIds = new Set(DEFAULT_NAV_ITEMS.map((item) => item.id));

    NAV_SUBMENU_SECTIONS.forEach((section) => {
      expect(section.value).toContain(":");
      expect(validParentIds.has(section.parentNavId)).toBe(true);
      expect(section.label.trim()).toBeTruthy();
      expect(section.groupName.trim()).toBeTruthy();
    });
  });

  it("should filter out legacy Magento non-menu categories so they do not pollute the mega menu", () => {
    // Specific legacy slugs from Magento product-model/SEO collections
    expect(isLegacyNonMenuCategory("smk-stellar-helmet")).toBe(true);
    expect(isLegacyNonMenuCategory("smk-titan-carbon-fibre-helmets")).toBe(true);
    expect(isLegacyNonMenuCategory("axor-apex-helmet-sport-touring-performance")).toBe(true);
    expect(isLegacyNonMenuCategory("ls2-ff800-storm-ii-helmets-touring-range")).toBe(true);
    expect(isLegacyNonMenuCategory("ls2-ff320-stream-ii-daily-rider-range")).toBe(true);
    expect(isLegacyNonMenuCategory("best-helmets-under-rs5000")).toBe(true);

    // Official canonical categories should NOT be filtered
    expect(isLegacyNonMenuCategory("motorcycle-helmets")).toBe(false);
    expect(isLegacyNonMenuCategory("full-face-helmets")).toBe(false);
    expect(isLegacyNonMenuCategory("riding-gloves")).toBe(false);
  });

  it("should match brand columns in 'Shop By Brand' with preset admin menu groups", () => {
    const brandNav = DEFAULT_NAV_ITEMS.find((item) => item.id === "shop-by-brand");
    expect(brandNav).toBeDefined();
    const groups = brandNav!.megaMenuItems!.map((g) => g.group);
    expect(groups).toContain("Helmet Brands");
    expect(groups).toContain("Riding Gear");
    expect(groups).toContain("Boots & Protection");
    expect(groups).toContain("Luggage & Accessories");
    expect(groups).toContain("Parts & Performance");
  });

  describe("resolveStorefrontNavItems — DB Overlay & Deduplication", () => {
    it("shows custom subcategories created under Gadgets (e.g. Motorcycle Smart Display) both by parentId and by explicit gadgets:Gadgets section", () => {
      const dbCategories = [
        {
          _id: "cat_gadgets",
          name: "Gadgets",
          slug: "gadgets",
          includeInMenu: true,
          children: [
            {
              _id: "cat_smart_display",
              name: "Motorcycle Smart Display",
              slug: "motorcycle-smart-display",
              parentId: "cat_gadgets",
              includeInMenu: true,
              menuNavSection: "",
            },
            {
              _id: "cat_gps_tracker",
              name: "GPS Trackers",
              slug: "gps-trackers",
              parentId: "cat_gadgets",
              includeInMenu: true,
              menuNavSection: "gadgets:Gadgets",
            },
            {
              _id: "cat_bt_alias",
              name: "Bluetooth Intercoms",
              slug: "bluetooth-intercoms",
              parentId: "cat_gadgets",
              includeInMenu: true,
              menuNavSection: "",
            },
          ],
        },
      ];

      const resolved = resolveStorefrontNavItems(DEFAULT_NAV_ITEMS, [], dbCategories);
      const gadgetsNav = resolved.find((item) => item.id === "gadgets");
      const gadgetItems = gadgetsNav?.megaMenuItems?.[0]?.items || [];
      const hrefs = gadgetItems.map((i) => i.href);
      const labels = gadgetItems.map((i) => i.label);

      expect(hrefs).toContain("/gadgets/motorcycle-smart-display");
      expect(labels).toContain("Motorcycle Smart Display");
      expect(hrefs).toContain("/gadgets/gps-trackers");
      // Alias "bluetooth-intercoms" must NOT duplicate "Communicators"
      expect(hrefs).not.toContain("/gadgets/bluetooth-intercoms");
      expect(hrefs).toContain("/gadgets/communicators");
    });

    it("prevents duplicate Performance Air Filter and Touring Gear entries from legacy alias DB categories", () => {
      const dbCategories = [
        {
          _id: "cat_spares",
          name: "Bike Spare Parts Online",
          slug: "bike-spares",
          includeInMenu: true,
          children: [
            {
              _id: "cat_air_canonical",
              name: "Performance Air Filters",
              slug: "performance-air-filter-bike",
              parentId: "cat_spares",
              includeInMenu: true,
            },
            {
              _id: "cat_air_legacy",
              name: "Performance Air Filters for bikes",
              slug: "performance-air-filters-for-bikes",
              parentId: "cat_spares",
              includeInMenu: true,
            },
          ],
        },
        {
          _id: "cat_riding_gear",
          name: "Riding Gear",
          slug: "riding-gear",
          includeInMenu: true,
          children: [
            {
              _id: "cat_touring_legacy",
              name: "Motorcycle Touring Gear",
              slug: "motorcycle-touring-gear",
              parentId: "cat_riding_gear",
              includeInMenu: true,
              menuNavSection: "riding-gear:Specialized Gear",
            },
          ],
        },
      ];

      const resolved = resolveStorefrontNavItems(DEFAULT_NAV_ITEMS, [], dbCategories);

      const sparesNav = resolved.find((item) => item.id === "spares");
      const sparesItems = sparesNav?.megaMenuItems?.[0]?.items || [];
      const airFilterMatches = sparesItems.filter((i) =>
        i.label.toLowerCase().includes("air filter")
      );
      expect(airFilterMatches).toHaveLength(1);
      expect(airFilterMatches[0].href).toBe("/bike-spares/performance-air-filter-bike");

      const gearNav = resolved.find((item) => item.id === "riding-gear");
      const specializedGroup = gearNav?.megaMenuItems?.find(
        (g) => g.group === "Specialized Gear"
      );
      const touringMatches = (specializedGroup?.items || []).filter((i) =>
        i.label.toLowerCase().includes("touring gear")
      );
      expect(touringMatches).toHaveLength(1);
    });

    it("includes Carbon Fibre Helmets under Helmets -> Types and respects includeInMenu toggle", () => {
      const enabledTree = [
        {
          _id: "cat_helmets",
          name: "Motorcycle Helmets",
          slug: "motorcycle-helmets",
          includeInMenu: true,
          children: [
            {
              _id: "cat_carbon",
              name: "Carbon Fibre Helmets",
              slug: "carbon-fibre-helmets",
              parentId: "cat_helmets",
              includeInMenu: true,
              menuNavSection: "helmets:Types",
            },
          ],
        },
      ];

      const resolvedVisible = resolveStorefrontNavItems(DEFAULT_NAV_ITEMS, [], enabledTree);
      const typesVisible = resolvedVisible
        .find((i) => i.id === "helmets")
        ?.megaMenuItems?.find((g) => g.group === "Types")?.items || [];
      expect(typesVisible.some((i) => i.href === "/motorcycle-helmets/carbon-fibre-helmets")).toBe(true);

      const hiddenTree = [
        {
          ...enabledTree[0],
          children: [{ ...enabledTree[0].children[0], includeInMenu: false }],
        },
      ];
      const resolvedHidden = resolveStorefrontNavItems(DEFAULT_NAV_ITEMS, [], hiddenTree);
      const typesHidden = resolvedHidden
        .find((i) => i.id === "helmets")
        ?.megaMenuItems?.find((g) => g.group === "Types")?.items || [];
      expect(typesHidden.some((i) => i.href === "/motorcycle-helmets/carbon-fibre-helmets")).toBe(false);
    });
  });
});
