/**
 * @fileoverview Shared Category Specifications & Attributes Template definitions and resolvers.
 *
 * Single source of truth used by:
 * - Admin Categories Manager ("Category Specifications & Attributes Template")
 * - Admin Product Form ("Specs & Attrs" tab)
 * - Backend ProductService (PDP API specification resolution)
 * - Frontend PDP DetailAndReviews component
 */

import {
  buildSpecificationsFromTemplate,
  isJunkSpecValue,
  isHighlightSpec,
  inferSpecConcept,
  type ProductSpecExtractionContext,
  type SpecConcept,
} from "./spec-smart-resolver";

export {
  buildSpecificationsFromTemplate,
  isJunkSpecValue,
  isHighlightSpec,
  inferSpecConcept,
  type ProductSpecExtractionContext,
  type SpecConcept,
};

export interface SpecFieldDefinition {
  key: string;
  label: string;
  placeholder?: string;
  presets?: string[];
}

export interface ProductSpecificationItem {
  key: string;
  label: string;
  value: string;
  isHighlight?: boolean;
}

export interface CategorySpecTemplateGroup {
  title: string;
  subtitle: string;
  icon: "shield" | "package" | "wrench" | "sliders";
  fields: Array<{
    key: string;
    label: string;
    placeholder: string;
    presets: string[];
  }>;
}

export const CATEGORY_SPEC_DEFINITIONS: Record<string, CategorySpecTemplateGroup> = {
  Helmets: {
    title: "Helmets & Visors Technical Specifications",
    subtitle: "Shell construction, safety certifications, pinlock anti-fog & Bluetooth readiness",
    icon: "shield",
    fields: [
      {
        key: "material",
        label: "Shell Material",
        placeholder: "e.g. Advanced Polycarbonate / Carbon Fiber",
        presets: [
          "Advanced Polycarbonate",
          "High-Impact ABS",
          "Tri-Composite Fiberglass",
          "100% Carbon Fiber",
          "Kevlar & Carbon Composite",
        ],
      },
      {
        key: "certification",
        label: "Safety Certification",
        placeholder: "e.g. ECE 22.06 & DOT & ISI",
        presets: [
          "ECE 22.06 & DOT & ISI",
          "ECE 22.06 & ISI",
          "ECE 22.05 & DOT",
          "DOT & ISI",
          "ISI (IS 4151:2015)",
          "Snell M2020",
        ],
      },
      {
        key: "pinlock_ready",
        label: "Pinlock Anti-Fog Ready",
        placeholder: "e.g. Pinlock 70 MaxVision Ready",
        presets: [
          "Pinlock 70 MaxVision Ready",
          "Pinlock 30 Ready",
          "Pinlock Lens Included in Box",
          "Not Pinlock Ready",
        ],
      },
      {
        key: "sun_visor",
        label: "Internal Sun Visor",
        placeholder: "e.g. Internal Retractable Sun Visor",
        presets: [
          "Internal Retractable UV400 Sun Visor",
          "No Sun Visor (Track/Race Spec)",
        ],
      },
      {
        key: "bluetooth_ready",
        label: "Bluetooth / Intercom Ready",
        placeholder: "e.g. Integrated Speaker Pockets",
        presets: [
          "Integrated Speaker Pockets & Mic Cavities",
          "Dedicated Intercom Slot",
          "No Speaker Pockets",
        ],
      },
      {
        key: "closure_type",
        label: "Chin Strap Fastening",
        placeholder: "e.g. Double D-Ring",
        presets: [
          "Double D-Ring (Track Approved)",
          "Micrometric Quick-Release Ratchet Buckle",
        ],
      },
      {
        key: "country_of_origin",
        label: "Country of Origin",
        placeholder: "e.g. India / Italy / Spain",
        presets: ["India", "Italy", "Spain", "Japan"],
      },
    ],
  },
  Jackets: {
    title: "Riding Gear & Apparel Technical Specifications",
    subtitle: "Outer textile/leather, CE armours, thermal liners & weatherproofing",
    icon: "shield",
    fields: [
      {
        key: "material",
        label: "Outer Shell Material",
        placeholder: "e.g. 600D Cordura Polyester",
        presets: [
          "600D Cordura Polyester Fabric",
          "Heavy Duty 3D Air Mesh & 600D Poly",
          "Full Grain 1.2-1.4mm Cowhide Leather",
          "500D High Tenacity Nylon",
          "Waxed Cotton & Kevlar Lining",
        ],
      },
      {
        key: "certification",
        label: "Armor Protection Level",
        placeholder: "e.g. CE Level 2",
        presets: [
          "CE Level 2 (Back, Shoulders & Elbows)",
          "CE Level 1 (Back, Shoulders & Elbows)",
          "Sas-Tec Level 2 Viscoelastic Protectors",
          "Knox Micro-Lock CE Level 2",
          "Ready for Armours (Pockets Only)",
        ],
      },
      {
        key: "waterproof",
        label: "Waterproofing & Rain Protection",
        placeholder: "e.g. 100% Waterproof (Reissa)",
        presets: [
          "100% Waterproof (Reissa Membrane)",
          "External Standalone Rain Liner Included",
          "Water-Resistant Coating",
          "Non-Waterproof (Summer Airflow Mesh)",
        ],
      },
      {
        key: "thermal_liner",
        label: "Thermal / Warm Liner",
        placeholder: "e.g. Detachable Winter Liner",
        presets: [
          "Detachable Thermal Winter Liner Included",
          "Standalone Thermal Vest Included",
          "Non-Thermal",
        ],
      },
      {
        key: "ventilation",
        label: "Ventilation System",
        placeholder: "e.g. High-Flow Air Mesh Panels",
        presets: [
          "High-Flow Perforated 3D Air Mesh Panels",
          "Chest, Arm & Back Zippered Air Vents",
          "Laser Perforated Leather Panels",
        ],
      },
      {
        key: "country_of_origin",
        label: "Country of Origin",
        placeholder: "e.g. India",
        presets: ["India", "Vietnam", "Italy"],
      },
    ],
  },
  Gloves: {
    title: "Riding Gloves Technical Specifications",
    subtitle: "Glove cut, knuckle armor, abrasion palm & touchscreen tech",
    icon: "shield",
    fields: [
      {
        key: "glove_type",
        label: "Glove Style / Cut",
        placeholder: "e.g. Full Gauntlet Racing",
        presets: [
          "Full Gauntlet Track & Racing Glove",
          "Short Cuff Street / Urban Glove",
          "Adventure Touring Glove",
          "Off-Road / MX Lightweight Glove",
        ],
      },
      {
        key: "knuckle_protection",
        label: "Knuckle & Finger Armor",
        placeholder: "e.g. Carbon Fiber Molded Knuckles",
        presets: [
          "Carbon Fiber Molded Knuckles",
          "TPU Hard Molded Knuckle Protector",
          "Knox SPS Scaphoid Palm Sliders",
          "Soft Viscoelastic TPR Protectors",
          "High-Density Foam Padded",
        ],
      },
      {
        key: "material",
        label: "Construction Material",
        placeholder: "e.g. Premium Goatskin Leather",
        presets: [
          "Premium Goatskin Leather & Clarino",
          "Full Grain Cowhide Leather",
          "3D Air Mesh & Synthetic Microfiber",
          "Kangaroo Leather Palm & Cowhide",
        ],
      },
      {
        key: "touchscreen_friendly",
        label: "Touchscreen Compatibility",
        placeholder: "e.g. Yes",
        presets: [
          "Yes - Conductive Index Finger & Thumb",
          "No",
        ],
      },
      {
        key: "country_of_origin",
        label: "Country of Origin",
        placeholder: "e.g. India",
        presets: ["India", "Pakistan", "Vietnam", "Italy"],
      },
    ],
  },
  Boots: {
    title: "Riding Boots Technical Specifications",
    subtitle: "Boot classification, leather upper, armor plates & closure systems",
    icon: "package",
    fields: [
      {
        key: "boot_type",
        label: "Boot Classification",
        placeholder: "e.g. Adventure Touring High Boots",
        presets: [
          "Sport / Track Racing Riding Boots",
          "Adventure Touring High Boots",
          "City / Short Urban Riding Boots",
          "Off-Road / Enduro MX Boots",
        ],
      },
      {
        key: "material",
        label: "Upper Material",
        placeholder: "e.g. Full Grain Leather & Microfiber",
        presets: [
          "Full Grain Leather & Microfiber",
          "High-Tenacity Microfiber Synthetic Leather",
          "Suede Leather & Cordura Inserts",
        ],
      },
      {
        key: "waterproof",
        label: "Waterproofing",
        placeholder: "e.g. 100% Waterproof Membrane",
        presets: [
          "100% Waterproof Breathable Membrane",
          "Water-Resistant Treatment",
          "Perforated / Breathable (Non-Waterproof)",
        ],
      },
      {
        key: "ankle_protection",
        label: "Ankle & Shin Protection",
        placeholder: "e.g. TPU Ankle Cups & Shin Guard",
        presets: [
          "TPU Ankle Cups, Shin Guard & Heel Counter",
          "Ankle Brace Torsion System",
          "Reinforced Toe Box & Internal Ankle Disc",
        ],
      },
      {
        key: "closure_type",
        label: "Fastening System",
        placeholder: "e.g. BOA Quick Dial / Ratchet Buckles",
        presets: [
          "BOA Quick Dial Lacing System",
          "Micro-Metric Adjustable Ratchet Buckles",
          "YKK Zipper with Velcro Storm Flap",
          "Dual Cam-Lock Straps",
        ],
      },
      {
        key: "country_of_origin",
        label: "Country of Origin",
        placeholder: "e.g. India / Italy",
        presets: ["India", "Italy", "Romania", "Vietnam"],
      },
    ],
  },
  "Saddle Bag": {
    title: "Motorcycle Bags & Luggage Technical Specifications",
    subtitle: "Storage volume, mounting system, weatherproofing, closure & materials",
    icon: "package",
    fields: [
      {
        key: "capacity",
        label: "Luggage Volume / Capacity",
        placeholder: "e.g. 15 Litres / 60 Litres",
        presets: [
          "15 Litres",
          "21 Litres",
          "30 Litres",
          "40 Litres",
          "60 Litres",
          "14L - 21L Expandable",
          "2 Litres (Hydration Bladder)",
        ],
      },
      {
        key: "magnetic_non_magnetic",
        label: "Mounting System",
        placeholder: "e.g. Magnetic / Strap-on",
        presets: [
          "Magnetic (Neodymium Tank Magnets)",
          "Non-Magnetic (Universal Straps)",
          "Hybrid (Magnetic Flaps + Straps)",
          "Quick-Release Universal Tail Straps",
        ],
      },
      {
        key: "waterproof",
        label: "Water Resistance",
        placeholder: "e.g. 100% Waterproof (Heat-Welded Seams)",
        presets: [
          "100% Waterproof (Heat-Welded Seams)",
          "100% Waterproof",
          "Water-Resistant with Rain Cover",
        ],
      },
      {
        key: "closure_type",
        label: "Closure / Fastening",
        placeholder: "e.g. Roll-Top Closure / YKK Zippers",
        presets: [
          "Roll-Top Closure",
          "Heavy-Duty YKK Zippers",
          "Quick-Release Buckles",
        ],
      },
      {
        key: "rain_cover",
        label: "Rain Cover",
        placeholder: "e.g. Included (100% Waterproof)",
        presets: [
          "Included (100% Waterproof Hi-Viz with Seam Sealing)",
          "100% Waterproof Roll-Top Inner Bag Included",
          "Water-Resistant Fabric",
          "Not Included",
        ],
      },
      {
        key: "convertible_in_backpack",
        label: "Backpack / Shoulder Conversion",
        placeholder: "e.g. Yes - Converts to Backpack",
        presets: [
          "Yes - Converts to Backpack with Concealable Straps",
          "Yes - Detachable Shoulder Sling Included",
          "No",
        ],
      },
      {
        key: "material",
        label: "Fabric & Outer Construction",
        placeholder: "e.g. 1680D Ballistic Nylon / Vinyl-Coated Fabric",
        presets: [
          "1680D Ballistic Nylon with PVC Coating",
          "1000D Cordura with PU Coating",
          "500D PVC Tarpaulin (Seamless Welded)",
          "Vinyl-Coated Waterproof Fabric",
        ],
      },
      {
        key: "country_of_origin",
        label: "Country of Origin",
        placeholder: "e.g. India",
        presets: ["India", "Vietnam", "China"],
      },
    ],
  },
  "Chain Lubes / Liquids": {
    title: "Chain Lubes, Oils & Bike Care Technical Specifications",
    subtitle: "Net volume in ml, lubricant chemistry, chain ring safety & dispenser",
    icon: "wrench",
    fields: [
      {
        key: "weight_in_ml",
        label: "Net Volume / Quantity",
        placeholder: "e.g. 150 ml / 400 ml",
        presets: [
          "150 ml (Pocket / Touring Can)",
          "400 ml (Standard Aerosol Can)",
          "500 ml (Workshop Can)",
          "1000 ml / 1 Litre",
        ],
      },
      {
        key: "formulation",
        label: "Chemical Formulation",
        placeholder: "e.g. Synthetic White Chain Lube",
        presets: [
          "Synthetic White Chain Lube (O/X/Z Ring Safe)",
          "Clear / Dry Chain Lube (High Anti-Fling)",
          "Heavy Duty Foaming Chain Cleaner",
          "Waterless Bike Wash & Detailer",
        ],
      },
      {
        key: "application_type",
        label: "Application Method",
        placeholder: "e.g. Aerosol Spray with Nozzle Tube",
        presets: [
          "Aerosol Spray with Precision Nozzle Straw",
          "High-Pressure Aerosol Spray",
          "Trigger Spray Bottle",
          "Pour Bottle with Measuring Cap",
        ],
      },
      {
        key: "country_of_origin",
        label: "Country of Origin",
        placeholder: "e.g. India / Germany",
        presets: ["India", "Germany", "France", "Spain"],
      },
    ],
  },
  "Spares, Accessories, Exhausts": {
    title: "Bike Spares, Exhausts & Guards Technical Specifications",
    subtitle: "Motorcycle model compatibility, bolt-on fitment, placement & materials",
    icon: "wrench",
    fields: [
      {
        key: "motorcycle_model",
        label: "Compatible Motorcycle Model(s)",
        placeholder: "e.g. Royal Enfield Himalayan 450 / KTM Duke 390",
        presets: [
          "Royal Enfield Himalayan 450",
          "Royal Enfield Hunter / Classic 350",
          "KTM Duke 250 / 390",
          "KTM Adventure 390",
          "Honda CBR 250R",
          "Universal Fit",
        ],
      },
      {
        key: "bike_compatibility",
        label: "Fitment Type",
        placeholder: "e.g. Direct Bolt-on",
        presets: [
          "Direct Bolt-on (No Modifications Required)",
          "Universal Fitment (Fits Most Motorcycles)",
          "Specific Clamp / Bracket Required",
        ],
      },
      {
        key: "placement",
        label: "Mounting Location / Position",
        placeholder: "e.g. Radiator Guard / Exhaust",
        presets: [
          "Radiator (Radiator Guard)",
          "Exhaust / Slip-on Mid-Pipe",
          "Handlebar / Risers",
          "Engine Frame (Crash Guard / Slider)",
          "Wheel / Axle Slider",
        ],
      },
      {
        key: "material",
        label: "Construction Material & Finish",
        placeholder: "e.g. T304 Stainless Steel / CNC Aluminum",
        presets: [
          "T304 Stainless Steel",
          "CNC Machined 6061-T6 Billet Aluminum",
          "Carbon Fiber Shell",
          "Powder Coated Mild Steel",
        ],
      },
      {
        key: "country_of_origin",
        label: "Country of Origin",
        placeholder: "e.g. India",
        presets: ["India", "Italy", "Taiwan"],
      },
    ],
  },
  Communicator: {
    title: "Communicators & Electronics Technical Specifications",
    subtitle: "Bluetooth specification, intercom range, rider mesh & battery endurance",
    icon: "sliders",
    fields: [
      {
        key: "bluetooth_ready",
        label: "Bluetooth Specification",
        placeholder: "e.g. Bluetooth 5.2",
        presets: [
          "Bluetooth 5.2",
          "Bluetooth 5.1",
          "Bluetooth 5.0",
          "Bluetooth 4.1",
        ],
      },
      {
        key: "intercom_range",
        label: "Intercom Mesh & Range",
        placeholder: "e.g. Up to 1.2 km (4 Riders)",
        presets: [
          "Up to 1.2 km (4 Riders Conference)",
          "Up to 1.6 km (Mesh Intercom 24+ Riders)",
          "Up to 800m (2 Riders Rider-to-Pillion)",
          "Universal Intercom Pairing",
        ],
      },
      {
        key: "battery_runtime",
        label: "Battery Life / Talk Time",
        placeholder: "e.g. Up to 15 Hours Talk Time",
        presets: [
          "Up to 15 Hours Talk Time (1000mAh)",
          "Up to 20 Hours Talk Time",
          "Up to 10 Hours Talk Time",
        ],
      },
      {
        key: "waterproof",
        label: "Weather Resistance",
        placeholder: "e.g. IP67 Waterproof",
        presets: [
          "IP67 Waterproof & Dustproof",
          "IP65 Water Resistant",
          "Weatherproof Sealed",
        ],
      },
      {
        key: "country_of_origin",
        label: "Country of Origin",
        placeholder: "e.g. China / South Korea",
        presets: ["India", "South Korea", "China", "Israel"],
      },
    ],
  },
  Default: {
    title: "General Product Specifications",
    subtitle: "Standard material, waterproofing, warranty and country of origin",
    icon: "sliders",
    fields: [
      {
        key: "material",
        label: "Material / Construction",
        placeholder: "e.g. High-Grade Polymer / Aluminum",
        presets: [
          "High-Grade Polymer",
          "CNC Aluminum Alloy",
          "Textile & Mesh",
          "Genuine Leather",
        ],
      },
      {
        key: "waterproof",
        label: "Water Resistance",
        placeholder: "e.g. Water-Resistant",
        presets: [
          "100% Waterproof",
          "Water-Resistant",
          "Not Waterproof",
        ],
      },
      {
        key: "country_of_origin",
        label: "Country of Origin",
        placeholder: "e.g. India",
        presets: [
          "India",
          "Italy",
          "Spain",
          "Japan",
          "Vietnam",
        ],
      },
      {
        key: "warranty",
        label: "Warranty Period",
        placeholder: "e.g. 1 Year Manufacturer Warranty",
        presets: [
          "1 Year Manufacturer Warranty",
          "2 Years Manufacturer Warranty",
          "6 Months Warranty",
          "No Warranty",
        ],
      },
    ],
  },
};

export function findCategoryNodeInTree(nodes: any[], catIdOrSlug: string): any {
  if (!catIdOrSlug || !nodes || !nodes.length) return null;
  for (const node of nodes) {
    if (node._id === catIdOrSlug || node.slug === catIdOrSlug) return node;
    if (node.children?.length) {
      const found = findCategoryNodeInTree(node.children, catIdOrSlug);
      if (found) return found;
    }
  }
  return null;
}

const ATTRIBUTE_SET_KEYWORD_TABLE: Array<{ template: string; keywords: string[] }> = [
  {
    template: "Communicator",
    keywords: ["communicator", "intercom", "gadget", "bluetooth", "phone holder", "camera"],
  },
  {
    template: "Helmets",
    keywords: ["helmet", "visor"],
  },
  {
    template: "Jackets",
    keywords: ["jacket", "suit", "pant", "jeans", "armour", "protector", "knee", "racing"],
  },
  {
    template: "Gloves",
    keywords: ["glove"],
  },
  {
    template: "Boots",
    keywords: ["boot", "shoe"],
  },
  {
    template: "Saddle Bag",
    keywords: [
      "bag",
      "luggage",
      "saddle",
      "tank",
      "tail",
      "pannier",
      "hydration",
      "top-box",
      "top box",
      "pod",
    ],
  },
  {
    template: "Chain Lubes / Liquids",
    keywords: ["oil", "lube", "clean", "care", "liquid"],
  },
  {
    template: "Spares, Accessories, Exhausts",
    keywords: [
      "part",
      "spare",
      "exhaust",
      "radiator",
      "guard",
      "light",
      "mount",
      "brake",
      "traction",
      "pad",
      "cover",
      "seat",
      "tag",
    ],
  },
];

/**
 * Normalizes legacy Magento `attribute_set_code` strings and category keyword hints
 * into canonical keys present in `CATEGORY_SPEC_DEFINITIONS`.
 */
export function normalizeAttributeSetCode(rawCode?: string): string {
  const clean = (rawCode || "").trim();
  if (!clean) return "Default";
  if (clean === "Default" || clean === "CategoryCustom") return clean;
  if (CATEGORY_SPEC_DEFINITIONS[clean]) return clean;

  const lower = clean.toLowerCase();
  for (const row of ATTRIBUTE_SET_KEYWORD_TABLE) {
    if (row.keywords.some((kw) => lower.includes(kw))) {
      return row.template;
    }
  }
  return "Default";
}

export function detectAttributeSetFromCategory(catIdOrSlug: string, categories: any[] = []): string {
  if (!catIdOrSlug) return "Default";

  // 1. Explicit admin assignment takes highest priority
  const explicitNode = findCategoryNodeInTree(categories, catIdOrSlug);
  if (explicitNode?.attributeSetCode && explicitNode.attributeSetCode !== "Default") {
    return normalizeAttributeSetCode(explicitNode.attributeSetCode);
  }

  const categoryName = explicitNode?.name || catIdOrSlug;
  return normalizeAttributeSetCode(`${categoryName} ${catIdOrSlug}`);
}

export interface CategoryTemplateCandidate {
  name?: string;
  slug?: string;
  attributeSetCode?: string;
  specDefinitions?: SpecFieldDefinition[];
}

export interface ResolveCategorySpecOptions {
  /** Category chain ordered from most specific (leaf/primary) to broadest (parent/ancestors). */
  categories: Array<CategoryTemplateCandidate | null | undefined>;
  /** Optional product-level attributeSetCode fallback if no category defines one. */
  productAttributeSetCode?: string;
  /** Optional fallback strings (category slug, category name, etc.) for blueprint detection. */
  fallbackHints?: Array<string | undefined | null>;
}

/**
 * Resolves the authoritative Category Specifications & Attributes Template for a category chain.
 * Priority:
 * 1. Explicit `specDefinitions` on the leaf/primary category.
 * 2. Explicit `attributeSetCode` on the leaf/primary category if it differs from parent's code.
 * 3. Explicit `specDefinitions` inherited from parent / matched categories.
 * 4. Blueprint resolved from normalized `attributeSetCode` -> category slug/name -> product `attributeSetCode` -> Default.
 */
export function resolveCategorySpecDefinitions(
  options: ResolveCategorySpecOptions
): SpecFieldDefinition[] {
  const validCategories = (options.categories || []).filter(
    (c): c is CategoryTemplateCandidate => Boolean(c)
  );

  const sanitizeFields = (fields?: SpecFieldDefinition[]): SpecFieldDefinition[] =>
    (fields || [])
      .filter((f) => Boolean(f && f.key?.trim() && f.label?.trim()))
      .map((f) => ({
        key: f.key.trim(),
        label: f.label.trim(),
        ...(f.placeholder ? { placeholder: f.placeholder } : {}),
        ...(Array.isArray(f.presets) && f.presets.length > 0 ? { presets: f.presets } : {}),
      }));

  const primary = validCategories[0];
  if (primary) {
    const primaryFields = sanitizeFields(primary.specDefinitions);
    if (primaryFields.length > 0) {
      return primaryFields;
    }

    const rawPrimaryCode = primary.attributeSetCode?.trim();
    const normalizedPrimary = normalizeAttributeSetCode(rawPrimaryCode);
    const hasDistinctPrimaryBlueprint =
      Boolean(rawPrimaryCode) &&
      normalizedPrimary !== "Default" &&
      normalizedPrimary !== "CategoryCustom" &&
      Boolean(CATEGORY_SPEC_DEFINITIONS[normalizedPrimary]);

    if (hasDistinctPrimaryBlueprint) {
      // Only let a parent's custom specDefinitions override if the parent shares the same blueprint
      const matchingAncestorWithSpecs = validCategories.slice(1).find(
        (cat) =>
          sanitizeFields(cat.specDefinitions).length > 0 &&
          (!cat.attributeSetCode ||
            normalizeAttributeSetCode(cat.attributeSetCode) === normalizedPrimary)
      );
      if (matchingAncestorWithSpecs) {
        return sanitizeFields(matchingAncestorWithSpecs.specDefinitions);
      }
      return sanitizeFields(CATEGORY_SPEC_DEFINITIONS[normalizedPrimary].fields);
    }
  }

  for (const cat of validCategories) {
    const fields = sanitizeFields(cat.specDefinitions);
    if (fields.length > 0) {
      return fields;
    }
  }

  for (const cat of validCategories) {
    const code = normalizeAttributeSetCode(cat.attributeSetCode);
    if (code !== "Default" && code !== "CategoryCustom" && CATEGORY_SPEC_DEFINITIONS[code]) {
      return sanitizeFields(CATEGORY_SPEC_DEFINITIONS[code].fields);
    }
  }

  for (const cat of validCategories) {
    const hint = `${cat.slug || ""} ${cat.name || ""}`.trim();
    if (hint) {
      const detected = detectAttributeSetFromCategory(hint);
      if (detected !== "Default" && CATEGORY_SPEC_DEFINITIONS[detected]) {
        return sanitizeFields(CATEGORY_SPEC_DEFINITIONS[detected].fields);
      }
    }
  }

  for (const rawHint of options.fallbackHints || []) {
    const hint = rawHint?.trim();
    if (hint) {
      const detected = detectAttributeSetFromCategory(hint);
      if (detected !== "Default" && CATEGORY_SPEC_DEFINITIONS[detected]) {
        return sanitizeFields(CATEGORY_SPEC_DEFINITIONS[detected].fields);
      }
    }
  }

  const productCode = normalizeAttributeSetCode(options.productAttributeSetCode);
  if (productCode !== "CategoryCustom" && CATEGORY_SPEC_DEFINITIONS[productCode]) {
    return sanitizeFields(CATEGORY_SPEC_DEFINITIONS[productCode].fields);
  }

  return sanitizeFields(CATEGORY_SPEC_DEFINITIONS.Default.fields);
}

export interface ProductTreeHintInput extends ProductSpecExtractionContext {
  categoryId?: string;
  categorySlugs?: string[];
  categorySlug?: string;
  subCategorySlug?: string;
  category?: string;
  subCategory?: string;
  magentoCategories?: string;
  attributeSetCode?: string;
  attributes?: Record<string, string> | Map<string, string> | null;
  categorySpecTemplate?: SpecFieldDefinition[];
  specifications?: ProductSpecificationItem[];
}

export interface CategoryTreeNodeLike extends CategoryTemplateCandidate {
  _id?: string;
  id?: string;
  children?: CategoryTreeNodeLike[];
  isDeleted?: boolean;
}

/**
 * Walks a nested category tree and returns the matching category chain ordered from
 * most specific (leaf/primary) to parent ancestors for a given product.
 */
export function findProductCategoryChainInTree(
  categoryTree: CategoryTreeNodeLike[] | undefined | null,
  product: ProductTreeHintInput | undefined | null,
  slugAliases: Record<string, string[]> = {}
): CategoryTreeNodeLike[] {
  if (!Array.isArray(categoryTree) || categoryTree.length === 0 || !product) {
    return [];
  }

  const byId = new Map<string, { node: CategoryTreeNodeLike; ancestors: CategoryTreeNodeLike[] }>();
  const bySlug = new Map<string, { node: CategoryTreeNodeLike; ancestors: CategoryTreeNodeLike[] }>();

  const indexTree = (nodes: CategoryTreeNodeLike[], ancestors: CategoryTreeNodeLike[] = []) => {
    for (const node of nodes) {
      if (!node || node.isDeleted) continue;
      const entry = { node, ancestors };
      if (node._id) byId.set(String(node._id), entry);
      if (node.id) byId.set(String(node.id), entry);
      if (node.slug) bySlug.set(String(node.slug).toLowerCase().trim(), entry);
      if (Array.isArray(node.children) && node.children.length > 0) {
        indexTree(node.children, [node, ...ancestors]);
      }
    }
  };
  indexTree(categoryTree);

  const candidates: string[] = [];
  const pushCandidate = (val?: string | null) => {
    const clean = (val || "").trim();
    if (clean && !candidates.includes(clean)) candidates.push(clean);
  };

  const leafSubSlug = product.subCategorySlug
    ? product.subCategorySlug.split("/").filter(Boolean).pop()
    : undefined;

  pushCandidate(product.categoryId);
  pushCandidate(leafSubSlug);
  if (Array.isArray(product.categorySlugs)) {
    for (const s of product.categorySlugs) pushCandidate(s);
  }
  pushCandidate(product.categorySlug);
  if (product.magentoCategories) {
    const rawCats = product.magentoCategories.split(",")[0] || "";
    const parts = rawCats
      .replace(/\\\/|\\\//g, " ")
      .split("/")
      .map((p) =>
        p
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
      )
      .filter((p) => p && !p.includes("root") && !p.includes("default"));
    for (const part of parts.reverse()) pushCandidate(part);
  }

  const lookupEntry = (target: string) => {
    const byExactId = byId.get(target);
    if (byExactId) return byExactId;

    const clean = target.toLowerCase();
    const byExactSlug = bySlug.get(clean);
    if (byExactSlug) return byExactSlug;

    const singular = clean.endsWith("s") ? clean.slice(0, -1) : `${clean}s`;
    const byPlural = bySlug.get(singular);
    if (byPlural) return byPlural;

    const aliases = slugAliases[clean] || [];
    for (const alias of aliases) {
      const hit = bySlug.get(alias.toLowerCase());
      if (hit) return hit;
    }

    for (const [key, list] of Object.entries(slugAliases)) {
      if (list.includes(clean)) {
        const hit = bySlug.get(key.toLowerCase());
        if (hit) return hit;
      }
    }

    return null;
  };

  const matchedEntries: Array<{
    entry: { node: CategoryTreeNodeLike; ancestors: CategoryTreeNodeLike[] };
    isDirectPrimary: boolean;
  }> = [];

  for (const target of candidates) {
    const match = lookupEntry(target);
    if (match) {
      const isDirectPrimary = Boolean(
        (product.categoryId &&
          (String(match.node._id) === product.categoryId ||
            String(match.node.slug || "").toLowerCase() === product.categoryId.toLowerCase())) ||
          (leafSubSlug &&
            String(match.node.slug || "").toLowerCase() === leafSubSlug.toLowerCase())
      );
      matchedEntries.push({ entry: match, isDirectPrimary });
    }
  }

  // Sort deepest/leaf subcategories before top-level parent categories
  matchedEntries.sort((a, b) => {
    if (a.isDirectPrimary !== b.isDirectPrimary) return a.isDirectPrimary ? -1 : 1;
    const depthDiff = b.entry.ancestors.length - a.entry.ancestors.length;
    if (depthDiff !== 0) return depthDiff;
    const aHasCustom = (a.entry.node.specDefinitions?.length || 0) > 0 ? 1 : 0;
    const bHasCustom = (b.entry.node.specDefinitions?.length || 0) > 0 ? 1 : 0;
    return bHasCustom - aHasCustom;
  });

  const result: CategoryTreeNodeLike[] = [];
  const seen = new Set<string>();
  for (const { entry } of matchedEntries) {
    for (const item of [entry.node, ...entry.ancestors]) {
      const key = String(item._id || item.slug || item.name || "");
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
  }

  return result;
}

/**
 * Resolves both `categorySpecTemplate` and `specifications` from a category tree + product object.
 * Used when backend responses don't include pre-resolved template fields (e.g. legacy API / SSR).
 */
export function resolveProductSpecificationsFromTree(
  categoryTree: CategoryTreeNodeLike[] | undefined | null,
  product: ProductTreeHintInput | undefined | null,
  slugAliases: Record<string, string[]> = {}
): {
  categorySpecTemplate: SpecFieldDefinition[];
  specifications: ProductSpecificationItem[];
} {
  if (!product) {
    return { categorySpecTemplate: [], specifications: [] };
  }

  let categorySpecTemplate: SpecFieldDefinition[];
  if (Array.isArray(product.categorySpecTemplate) && product.categorySpecTemplate.length > 0) {
    categorySpecTemplate = product.categorySpecTemplate;
  } else {
    const chain = findProductCategoryChainInTree(categoryTree, product, slugAliases);
    const rawAttrCode =
      product.attributeSetCode ||
      (product.attributes instanceof Map
        ? product.attributes.get("attribute_set_code")
        : (product.attributes as Record<string, string> | undefined)?.attribute_set_code);

    categorySpecTemplate = resolveCategorySpecDefinitions({
      categories: chain,
      productAttributeSetCode: rawAttrCode,
      fallbackHints: [
        product.subCategorySlug,
        product.categorySlug,
        product.categoryId,
        product.subCategory,
        product.category,
      ],
    });
  }

  const baseAttrs: Record<string, string> =
    product.attributes instanceof Map
      ? Object.fromEntries(product.attributes.entries())
      : { ...(product.attributes || {}) };

  if (Array.isArray(product.specifications)) {
    for (const existing of product.specifications) {
      if (existing?.key && existing.value && !baseAttrs[existing.key]) {
        baseAttrs[existing.key] = existing.value;
      }
    }
  }

  const specifications = buildSpecificationsFromTemplate(
    categorySpecTemplate,
    baseAttrs,
    product
  );
  return { categorySpecTemplate, specifications };
}
