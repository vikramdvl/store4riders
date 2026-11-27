import { describe, it, expect } from "vitest";
import {
  CATEGORY_SPEC_DEFINITIONS,
  resolveCategorySpecDefinitions,
  buildSpecificationsFromTemplate,
  resolveProductSpecificationsFromTree,
} from "../spec-templates";

describe("Category Specifications & Attributes Template Utilities", () => {
  it("prioritizes explicit specDefinitions on primary category over default blueprints", () => {
    const customFields = [
      { key: "capacity", label: "Dry Bag Volume" },
      { key: "waterproof", label: "Waterproof Rating" },
    ];

    const resolved = resolveCategorySpecDefinitions({
      categories: [
        { name: "Dry Bags", slug: "dry-bags", attributeSetCode: "Saddle Bag", specDefinitions: customFields },
        { name: "Luggage", slug: "luggage", attributeSetCode: "Saddle Bag", specDefinitions: CATEGORY_SPEC_DEFINITIONS["Saddle Bag"].fields },
      ],
    });

    expect(resolved).toHaveLength(2);
    expect(resolved[0].label).toBe("Dry Bag Volume");
    expect(resolved[1].label).toBe("Waterproof Rating");
  });

  it("inherits parent category specDefinitions when subcategory template is empty", () => {
    const parentCustomFields = [
      { key: "capacity", label: "Storage Volume" },
      { key: "magnetic_non_magnetic", label: "Mounting System" },
    ];

    const resolved = resolveCategorySpecDefinitions({
      categories: [
        { name: "Dry Bags", slug: "dry-bags", specDefinitions: [] },
        { name: "Luggage", slug: "motorcycle-bags-bike-luggage", specDefinitions: parentCustomFields },
      ],
    });

    expect(resolved).toEqual(parentCustomFields);
  });

  it("falls back to detected category blueprint when DB categories have no saved specDefinitions", () => {
    const resolved = resolveCategorySpecDefinitions({
      categories: [{ name: "Motorcycle Bags / Bike Luggage", slug: "motorcycle-bags-bike-luggage", specDefinitions: [] }],
    });

    expect(resolved.map((f) => f.key)).toEqual([
      "capacity",
      "magnetic_non_magnetic",
      "waterproof",
      "closure_type",
      "rain_cover",
      "convertible_in_backpack",
      "material",
      "country_of_origin",
    ]);
  });

  it("normalizes Magento legacy attributeSetCode aliases like Tank Bag and Pants cleanly", () => {
    const bagTemplate = resolveCategorySpecDefinitions({
      categories: [{ name: "Tank Bags", slug: "tank-bags", attributeSetCode: "Tank Bag" }],
    });
    expect(bagTemplate.some((f) => f.key === "capacity")).toBe(true);
    expect(bagTemplate.some((f) => f.key === "magnetic_non_magnetic")).toBe(true);

    const pantTemplate = resolveCategorySpecDefinitions({
      categories: [],
      productAttributeSetCode: "Pants",
    });
    expect(pantTemplate.some((f) => f.key === "certification")).toBe(true);
  });

  it("smartly extracts factual product specs for Luggage/Dry Bag without exposing unconfigured keys", () => {
    const template = CATEGORY_SPEC_DEFINITIONS["Saddle Bag"].fields;
    const rawAttributes = {
      condition: "New",
      brand: "Rynox Gear",
      suitable_for_tank: "No", // Unconfigured key — must NOT leak
      convertible_in_backpack: "No",
      magnetic_non_magnetic: "Non Magnetic",
      ship_cost: "0.000000",
    };

    const specs = buildSpecificationsFromTemplate(template, rawAttributes, {
      name: "Rynox Expedition Dry Bag 2 - Stormproof - 15 ltr",
      shortDescription:
        "<p>Rynox Dry Bag 2 - 100% waterproof 15 ltr. capacity dry bag for riders who need more luggage space.</p>",
      description:
        "<p>It is made from super strong vinyl coated waterproof fabric and the main compartment has roll-top closure. Radio frequency heat welded seams ensure that water can't get inside. Result - 100% waterproof.</p>",
      countryOfManufacture: "India",
    });

    expect(specs).toEqual([
      { key: "capacity", label: "Luggage Volume / Capacity", value: "15 Litres", isHighlight: false },
      { key: "magnetic_non_magnetic", label: "Mounting System", value: "Non Magnetic", isHighlight: false },
      {
        key: "waterproof",
        label: "Water Resistance",
        value: "100% Waterproof (Heat-Welded Seams)",
        isHighlight: true,
      },
      { key: "closure_type", label: "Closure / Fastening", value: "Roll-Top Closure", isHighlight: false },
      {
        key: "convertible_in_backpack",
        label: "Backpack / Shoulder Conversion",
        value: "No",
        isHighlight: false,
      },
      {
        key: "material",
        label: "Fabric & Outer Construction",
        value: "Vinyl-Coated Waterproof Fabric",
        isHighlight: false,
      },
      { key: "country_of_origin", label: "Country of Origin", value: "India", isHighlight: false },
    ]);
    expect(specs.find((s) => s.key === "suitable_for_tank")).toBeUndefined();
  });

  it("extracts rich specs even when category only uses Default fields and DB attributes only contain Origin", () => {
    const specs = buildSpecificationsFromTemplate(
      CATEGORY_SPEC_DEFINITIONS.Default.fields,
      { country_of_origin: "India", condition: "New" },
      {
        name: "Rynox Expedition Dry Bag 2 - Stormproof - 15 ltr",
        shortDescription: "<p>100% waterproof 15 ltr. capacity dry bag.</p>",
        description:
          "<p>Made from super strong vinyl coated waterproof fabric with heat welded seams. Comes with 1 year manufacturer warranty.</p>",
        countryOfManufacture: "India",
      }
    );

    expect(specs.map((s) => ({ label: s.label, value: s.value }))).toEqual([
      { label: "Material / Construction", value: "Vinyl-Coated Waterproof Fabric" },
      { label: "Water Resistance", value: "100% Waterproof (Heat-Welded Seams)" },
      { label: "Country of Origin", value: "India" },
      { label: "Warranty Period", value: "1 Year Manufacturer Warranty" },
    ]);
  });

  it("respects custom admin field keys and negations when extracting helmet and glove specs", () => {
    const customGloveTemplate = [
      { key: "shell_construction", label: "Construction Material" },
      { key: "touchscreen_support", label: "Touchscreen Friendly" },
      { key: "warranty_info", label: "Warranty Period" },
    ];

    const gloveSpecs = buildSpecificationsFromTemplate(
      customGloveTemplate,
      { condition: "New" },
      {
        name: "BBG Breeze Gloves",
        description:
          "<p>Constructed from perforated leather and nylon mesh. The mobile touchscreen will not work due to coating wear. There is no warranty.</p>",
      }
    );

    expect(gloveSpecs.map((s) => ({ key: s.key, value: s.value }))).toEqual([
      { key: "shell_construction", value: "Nylon Mesh / Perforated Leather" },
      { key: "touchscreen_support", value: "No" },
      { key: "warranty_info", value: "No Warranty" },
    ]);
  });

  it("orders deeper child category before shallow root category when resolving category tree specs", () => {
    const parentCustom = [{ key: "warranty", label: "General Warranty" }];
    const childCustom = [
      { key: "capacity", label: "Dry Bag Capacity" },
      { key: "waterproof", label: "Waterproof Rating" },
    ];

    const categoryTree = [
      {
        _id: "root_lug",
        name: "Motorcycle Bags / Bike Luggage",
        slug: "motorcycle-bags-bike-luggage",
        specDefinitions: parentCustom,
        children: [
          {
            _id: "leaf_dry",
            name: "Dry Bags",
            slug: "dry-bags",
            specDefinitions: childCustom,
          },
        ],
      },
    ];

    const resolved = resolveProductSpecificationsFromTree(categoryTree, {
      categorySlugs: ["motorcycle-bags-bike-luggage", "dry-bags"],
      name: "Rynox Dry Bag 15 Ltr",
      description: "<p>100% waterproof 15 ltr dry bag with heat welded seams.</p>",
    });

    expect(resolved.categorySpecTemplate).toEqual(childCustom);
    expect(resolved.specifications.map((s) => ({ label: s.label, value: s.value }))).toEqual([
      { label: "Dry Bag Capacity", value: "15 Litres" },
      { label: "Waterproof Rating", value: "100% Waterproof (Heat-Welded Seams)" },
    ]);
  });

  it("builds PDP specifications strictly from the category template and excludes unconfigured raw attributes", () => {
    const template = CATEGORY_SPEC_DEFINITIONS["Saddle Bag"].fields;
    const rawAttributes = {
      suitable_for_tank: "No", // Not in Saddle Bag template -> must NOT appear
      convertible_in_backpack: "No",
      magnetic_non_magnetic: "Non Magnetic",
      Condition: "New", // Junk value -> must NOT appear
      size_chart_01: "<table><tr><td>M</td></tr></table>", // HTML -> must NOT appear
    };

    const specs = buildSpecificationsFromTemplate(template, rawAttributes);

    expect(specs).toEqual([
      {
        key: "magnetic_non_magnetic",
        label: "Mounting System",
        value: "Non Magnetic",
        isHighlight: false,
      },
      {
        key: "convertible_in_backpack",
        label: "Backpack / Shoulder Conversion",
        value: "No",
        isHighlight: false,
      },
    ]);
    expect(specs.find((s) => s.key === "suitable_for_tank")).toBeUndefined();
  });

  it("uses exact template order and custom labels even when attributes map has different insertion order", () => {
    const template = [
      { key: "certification", label: "Homologation Standard" },
      { key: "material", label: "Shell Compound" },
      { key: "closure_type", label: "Strap Lock" },
    ];

    const specs = buildSpecificationsFromTemplate(template, {
      closure_type: "Double D-Ring",
      material: "Carbon Fiber",
      certification: "ECE 22.06",
      extra_unconfigured_key: "Ignored Value",
    });

    expect(specs.map((s) => s.label)).toEqual([
      "Homologation Standard",
      "Shell Compound",
      "Strap Lock",
    ]);
    expect(specs[0].isHighlight).toBe(true);
    expect(specs[1].isHighlight).toBe(true);
    expect(specs[2].isHighlight).toBe(true);
  });

  it("resolves category spec template and specifications from a nested categoryTree using category alias or parent", () => {
    const categoryTree = [
      {
        _id: "lug_root",
        name: "Motorcycle Bags / Bike Luggage",
        slug: "motorcycle-bags-bike-luggage",
        specDefinitions: [
          { key: "capacity", label: "Capacity" },
          { key: "magnetic_non_magnetic", label: "Mounting System" },
          { key: "convertible_in_backpack", label: "Backpack / Shoulder Conversion" },
        ],
        children: [
          {
            _id: "dry_leaf",
            name: "Dry Bags",
            slug: "dry-bags",
            specDefinitions: [],
          },
        ],
      },
    ];

    const resolved = resolveProductSpecificationsFromTree(categoryTree, {
      categoryId: "dry-bags",
      categorySlugs: ["dry-bags", "motorcycle-bags-bike-luggage"],
      attributes: {
        suitable_for_tank: "No",
        convertible_in_backpack: "No",
        magnetic_non_magnetic: "Non Magnetic",
      },
    });

    expect(resolved.categorySpecTemplate).toHaveLength(3);
    expect(resolved.specifications).toEqual([
      {
        key: "magnetic_non_magnetic",
        label: "Mounting System",
        value: "Non Magnetic",
        isHighlight: false,
      },
      {
        key: "convertible_in_backpack",
        label: "Backpack / Shoulder Conversion",
        value: "No",
        isHighlight: false,
      },
    ]);
  });
});
