import {
  CATEGORY_SPEC_DEFINITIONS,
  findCategoryNodeInTree,
  detectAttributeSetFromCategory,
  normalizeAttributeSetCode,
} from "@store4riders/shared-utils";

export {
  CATEGORY_SPEC_DEFINITIONS,
  findCategoryNodeInTree,
  detectAttributeSetFromCategory,
  normalizeAttributeSetCode,
};

export interface CategoryBlueprint {
  attributeSet: string;
  defaultHsn: string;
  defaultTaxClass: string;
  defaultWeightUnit: "kg" | "g" | "ml" | "L";
  suggestedSizes: string[];
  description: string;
}

export function getCategoryBlueprint(catIdOrSlug: string, categories: any[] = []): CategoryBlueprint {
  const node = findCategoryNodeInTree(categories, catIdOrSlug);
  const normalizedNodeSet = node?.attributeSetCode ? normalizeAttributeSetCode(node.attributeSetCode) : "Default";
  const attrSet =
    normalizedNodeSet !== "Default"
      ? normalizedNodeSet
      : detectAttributeSetFromCategory(catIdOrSlug, categories);
  let blueprint: CategoryBlueprint;

  switch (attrSet) {
    case "Helmets":
      blueprint = {
        attributeSet: "Helmets",
        defaultHsn: "6506",
        defaultTaxClass: "Taxable Goods (GST 18%)",
        defaultWeightUnit: "kg",
        suggestedSizes: ["XS", "S", "M", "L", "XL", "2XL"],
        description: "Helmets & Safety Headgear (18% GST · HSN 6506)",
      };
      break;
    case "Jackets":
      blueprint = {
        attributeSet: "Jackets",
        defaultHsn: "6203",
        defaultTaxClass: "Taxable Goods (GST 18%)",
        defaultWeightUnit: "g",
        suggestedSizes: ["S", "M", "L", "XL", "2XL", "3XL", "4XL"],
        description: "Riding Jackets, Pants & Protective Suits (18% GST · HSN 6203)",
      };
      break;
    case "Gloves":
      blueprint = {
        attributeSet: "Gloves",
        defaultHsn: "6116",
        defaultTaxClass: "Taxable Goods (GST 18%)",
        defaultWeightUnit: "g",
        suggestedSizes: ["S", "M", "L", "XL", "2XL"],
        description: "Motorcycle Riding Gloves (18% GST · HSN 6116)",
      };
      break;
    case "Boots":
      blueprint = {
        attributeSet: "Boots",
        defaultHsn: "6403",
        defaultTaxClass: "Taxable Goods (GST 18%)",
        defaultWeightUnit: "kg",
        suggestedSizes: ["EU 39", "EU 40", "EU 41", "EU 42", "EU 43", "EU 44", "EU 45", "EU 46"],
        description: "Riding Boots & Footwear (18% GST · HSN 6403)",
      };
      break;
    case "Saddle Bag":
      blueprint = {
        attributeSet: "Saddle Bag",
        defaultHsn: "4202",
        defaultTaxClass: "Taxable Goods (GST 18%)",
        defaultWeightUnit: "kg",
        suggestedSizes: ["Standard", "21L", "30L", "40L", "60L"],
        description: "Motorcycle Luggage, Saddle & Tank Bags (18% GST · HSN 4202)",
      };
      break;
    case "Chain Lubes / Liquids":
      blueprint = {
        attributeSet: "Chain Lubes / Liquids",
        defaultHsn: "2710",
        defaultTaxClass: "Taxable Goods (GST 18%)",
        defaultWeightUnit: "ml",
        suggestedSizes: ["100ml", "150ml", "250ml", "400ml", "500ml", "1L"],
        description: "Chain Lubes, Cleaners & Care Liquids (18% GST · HSN 2710)",
      };
      break;
    case "Spares, Accessories, Exhausts":
      blueprint = {
        attributeSet: "Spares, Accessories, Exhausts",
        defaultHsn: "8708",
        defaultTaxClass: "Auto Spares & Parts (GST 28%)",
        defaultWeightUnit: "kg",
        suggestedSizes: ["Standard"],
        description: "Motorcycle Spares, Exhausts & Guards (28% GST · HSN 8708)",
      };
      break;
    case "Communicator":
      blueprint = {
        attributeSet: "Communicator",
        defaultHsn: "8517",
        defaultTaxClass: "Taxable Goods (GST 18%)",
        defaultWeightUnit: "g",
        suggestedSizes: ["Single Pack", "Dual Pack"],
        description: "Bluetooth Communicators & Electronics (18% GST · HSN 8517)",
      };
      break;
    default:
      blueprint = {
        attributeSet: "Default",
        defaultHsn: "6506",
        defaultTaxClass: "Taxable Goods (GST 18%)",
        defaultWeightUnit: "kg",
        suggestedSizes: ["Standard"],
        description: "General Merchandise (18% GST)",
      };
      break;
  }

  // Explicit category overrides defined by client in Admin Categories
  if (node?.hsnCode) blueprint.defaultHsn = node.hsnCode;
  if (node?.taxClassName) blueprint.defaultTaxClass = node.taxClassName;
  if (node?.weightUnit) blueprint.defaultWeightUnit = node.weightUnit;

  return blueprint;
}

export const COLOR_OPTIONS = [
  // Solid & Classic Finishes
  { label: "Matte Black", value: "Matte Black" },
  { label: "Gloss Black", value: "Gloss Black" },
  { label: "Black", value: "Black" },
  { label: "White", value: "White" },
  { label: "Pearl White", value: "Pearl White" },
  { label: "Grey", value: "Grey" },
  { label: "Nardo Grey", value: "Nardo Grey" },
  { label: "Titanium", value: "Titanium" },
  { label: "Silver", value: "Silver" },
  { label: "Golden", value: "Golden" },

  // Fluorescent & Hi-Vis Safety Colors
  { label: "Fluo Green", value: "Fluo Green" },
  { label: "Fluo Yellow", value: "Fluo Yellow" },
  { label: "Fluo Orange", value: "Fluo Orange" },
  { label: "Hi-Vis Neon", value: "Hi-Vis Neon" },

  // Dual-Tone & Racing Graphics Combos
  { label: "Black/Red", value: "Black/Red" },
  { label: "Black/Orange", value: "Black/Orange" },
  { label: "Black/Fluo Yellow", value: "Black/Fluo Yellow" },
  { label: "Black/Fluo Green", value: "Black/Fluo Green" },
  { label: "Black/Grey", value: "Black/Grey" },
  { label: "Black/White", value: "Black/White" },
  { label: "Red/Black", value: "Red/Black" },
  { label: "Fluo Yellow/Red", value: "Fluo Yellow/Red" },
  { label: "White/Red/Blue", value: "White/Red/Blue" },
  { label: "Blue/White", value: "Blue/White" },
  { label: "Red/White", value: "Red/White" },
  { label: "Red", value: "Red" },
  { label: "Blue", value: "Blue" },

  // Touring, Heritage & Leather
  { label: "Vintage Brown", value: "Vintage Brown" },
  { label: "Tobacco Brown", value: "Tobacco Brown" },
  { label: "Tan", value: "Tan" },
  { label: "Olive Green", value: "Olive Green" },
  { label: "Military Camo", value: "Military Camo" },
  { label: "Desert Khaki", value: "Desert Khaki" },
  { label: "Navy Blue", value: "Navy Blue" },

  // Visors & Accessories
  { label: "Clear", value: "Clear" },
  { label: "Smoke", value: "Smoke" },
  { label: "Dark Smoke", value: "Dark Smoke" },
  { label: "Iridium Silver", value: "Iridium Silver" },
  { label: "Iridium Blue", value: "Iridium Blue" },
  { label: "Iridium Gold", value: "Iridium Gold" },
  { label: "Rainbow Aurora", value: "Rainbow Aurora" },
];

export const SIZE_OPTIONS = [
  { label: "Apparel: XS", value: "XS" },
  { label: "Apparel: S", value: "S" },
  { label: "Apparel: M", value: "M" },
  { label: "Apparel: L", value: "L" },
  { label: "Apparel: XL", value: "XL" },
  { label: "Apparel: 2XL", value: "2XL" },
  { label: "Apparel: 3XL", value: "3XL" },
  { label: "Shoes: UK 6 / EU 40", value: "40" },
  { label: "Shoes: UK 7 / EU 41", value: "41" },
  { label: "Shoes: UK 8 / EU 42", value: "42" },
  { label: "Shoes: UK 9 / EU 43", value: "43" },
  { label: "Shoes: UK 10 / EU 44", value: "44" },
  { label: "Shoes: UK 11 / EU 45", value: "45" },
  { label: "Volume: 50ml", value: "50ml" },
  { label: "Volume: 150ml", value: "150ml" },
  { label: "Volume: 250ml", value: "250ml" },
  { label: "Volume: 400ml", value: "400ml" },
  { label: "Volume: 500ml", value: "500ml" },
  { label: "Volume: 1L", value: "1L" },
  { label: "Volume: 2L", value: "2L" }
];
