import { describe, it, expect } from "vitest";
import { DEFAULT_NAV_ITEMS, NAV_SUBMENU_SECTIONS } from "../nav.constants";
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
});
