/**
 * Universal Product & Shipping Dimension Parser
 * 
 * Supports extracting length, breadth (width), height, and unit from:
 * 1. Dedicated CSV columns with various aliases (length, breadth, width, l, w, h, b, package_length, etc.)
 * 2. Combined dimension strings (e.g., "20x15x10", "20 x 15 x 10 cm", "12 x 8 x 4 in", "L:20, W:15, H:10")
 * 3. Attributes / additional_attributes strings (e.g. Magento 'length="20",width="15",height="10"' or JSON/KV)
 */

export interface IParsedDimensions {
  length?: number;
  breadth?: number;
  height?: number;
  dimensionUnit: "cm" | "in" | "mm";
}

// Aliases for each dimension
const LENGTH_ALIASES = [
  "length",
  "len",
  "l",
  "package_length",
  "packagelength",
  "pkg_length",
  "shipping_length",
  "shippinglength",
  "box_length",
  "boxlength",
  "dim_l",
  "diml",
  "dimension_l",
  "item_length",
  "itemlength",
];

const BREADTH_ALIASES = [
  "breadth",
  "width",
  "w",
  "b",
  "wid",
  "package_width",
  "packagewidth",
  "package_breadth",
  "packagebreadth",
  "pkg_width",
  "pkg_breadth",
  "shipping_width",
  "shippingwidth",
  "shipping_breadth",
  "shippingbreadth",
  "box_width",
  "boxwidth",
  "box_breadth",
  "dim_w",
  "dim_b",
  "dimension_w",
  "dimension_b",
  "item_width",
  "item_breadth",
];

const HEIGHT_ALIASES = [
  "height",
  "h",
  "package_height",
  "packageheight",
  "pkg_height",
  "shipping_height",
  "shippingheight",
  "box_height",
  "boxheight",
  "dim_h",
  "dimh",
  "dimension_h",
  "item_height",
  "itemheight",
];

const COMBINED_DIMENSION_ALIASES = [
  "dimensions",
  "dimension",
  "package_dimensions",
  "packagedimensions",
  "shipping_dimensions",
  "shippingdimensions",
  "box_size",
  "boxsize",
  "box_dimensions",
  "l_w_h",
  "lxbxh",
  "size_dimensions",
  "sizedimensions",
  "product_dimensions",
  "size_dimension",
];

const UNIT_ALIASES = [
  "dimension_unit",
  "dimensionunit",
  "dim_unit",
  "dimunit",
  "unit_dimension",
  "size_unit",
];

/**
 * Normalizes dimension units to standard 'cm' (or 'in', 'mm').
 */
export function normalizeDimensionUnit(unitStr?: string): "cm" | "in" | "mm" {
  if (!unitStr) return "cm";
  const clean = unitStr.trim().toLowerCase();
  if (clean === "in" || clean === "inch" || clean === "inches" || clean === '"') return "in";
  if (clean === "mm" || clean === "millimeter" || clean === "millimeters") return "mm";
  return "cm";
}

/**
 * Converts a dimension value to centimeters (cm).
 */
export function convertToCm(val: number, unit: "cm" | "in" | "mm"): number {
  if (!val || isNaN(val) || val <= 0) return 0;
  if (unit === "in") {
    // 1 inch = 2.54 cm
    return Math.round(val * 2.54 * 10) / 10;
  }
  if (unit === "mm") {
    // 10 mm = 1 cm
    return Math.round((val / 10) * 10) / 10;
  }
  return Math.round(val * 10) / 10;
}

/**
 * Parses combined dimension string such as:
 * - "20x15x10"
 * - "20 x 15 x 10"
 * - "20*15*10"
 * - "20 x 15 x 10 cm"
 * - "12 x 8 x 4 in" / "12 x 8 x 4 inches"
 * - "L:20, W:15, H:10" / "L: 20cm, B: 15cm, H: 10cm"
 * - "Length: 20, Width: 15, Height: 10"
 */
export function parseCombinedDimensionsString(rawStr: string): IParsedDimensions | null {
  if (!rawStr || typeof rawStr !== "string") return null;
  const str = rawStr.trim();
  if (!str) return null;

  // Detect unit in string if present
  let unit: "cm" | "in" | "mm" = "cm";
  if (/(\binch|\binches|\bin\b|")/i.test(str)) {
    unit = "in";
  } else if (/(\bmm\b|\bmillimeter)/i.test(str)) {
    unit = "mm";
  } else if (/(\bcm\b|\bcentimeter)/i.test(str)) {
    unit = "cm";
  }

  // Pattern 1: L: 20, W: 15, H: 10 or Length: 20, Width: 15, Height: 10
  const labeledRegex = /(?:l(?:ength)?[:=]?\s*(\d+(?:\.\d+)?))\D+(?:(?:w(?:idth)?|b(?:readth)?)[:=]?\s*(\d+(?:\.\d+)?))\D+(?:h(?:eight)?[:=]?\s*(\d+(?:\.\d+)?))/i;
  const labeledMatch = str.match(labeledRegex);
  if (labeledMatch) {
    const l = parseFloat(labeledMatch[1]);
    const b = parseFloat(labeledMatch[2]);
    const h = parseFloat(labeledMatch[3]);
    if (!isNaN(l) && !isNaN(b) && !isNaN(h)) {
      return {
        length: convertToCm(l, unit),
        breadth: convertToCm(b, unit),
        height: convertToCm(h, unit),
        dimensionUnit: "cm",
      };
    }
  }

  // Pattern 2: 20x15x10 or 20*15*10 or 20 X 15 X 10 (with optional units after numbers)
  const xPattern = /^(\d+(?:\.\d+)?)\s*(?:cm|in|mm|inch|inches|")?\s*[*xX×]\s*(\d+(?:\.\d+)?)\s*(?:cm|in|mm|inch|inches|")?\s*[*xX×]\s*(\d+(?:\.\d+)?)/i;
  const xMatch = str.match(xPattern);
  if (xMatch) {
    const l = parseFloat(xMatch[1]);
    const b = parseFloat(xMatch[2]);
    const h = parseFloat(xMatch[3]);
    if (!isNaN(l) && !isNaN(b) && !isNaN(h)) {
      return {
        length: convertToCm(l, unit),
        breadth: convertToCm(b, unit),
        height: convertToCm(h, unit),
        dimensionUnit: "cm",
      };
    }
  }

  return null;
}

/**
 * Searches an object (row or attributes) case-insensitively for a value matching any of the given aliases.
 */
function findValueByAliases(obj: Record<string, any>, aliases: string[]): any {
  if (!obj || typeof obj !== "object") return undefined;

  // Direct check first
  for (const alias of aliases) {
    if (obj[alias] !== undefined && obj[alias] !== null && String(obj[alias]).trim() !== "") {
      return obj[alias];
    }
  }

  // Case-insensitive & normalized check
  const aliasSet = new Set(aliases.map((a) => a.toLowerCase().replace(/[^a-z0-9]/g, "")));
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || val === null || String(val).trim() === "") continue;
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (aliasSet.has(cleanKey)) {
      return val;
    }
  }

  return undefined;
}

/**
 * Parses Magento-style additional_attributes string, e.g.:
 * 'condition="New",length="20",breadth="15",height="10"' or 'dimensions="20x15x10"'
 */
function parseMagentoAdditionalAttributes(attrStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!attrStr || typeof attrStr !== "string") return result;

  // Split on commas not inside quotes or standard comma-separated key=value pairs
  const pairs = attrStr.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx > 0) {
      const k = pair.substring(0, eqIdx).trim().replace(/^["']|["']$/g, "");
      const v = pair.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (k && v) {
        result[k] = v;
      }
    }
  }
  return result;
}

/**
 * Comprehensive Product Dimension Extractor
 * 
 * Works with CSV rows, plain objects, or nested attributes.
 * Looks across separate columns, combined strings, and attributes.
 * Auto-converts any inches or mm to standard centimeters (cm).
 */
export function extractProductDimensions(
  row: Record<string, any>,
  attributes?: Record<string, any>
): IParsedDimensions {
  const mergedAttrs: Record<string, any> = { ...(attributes || {}) };

  // If row has additional_attributes string (Magento CSV), parse into mergedAttrs
  if (row.additional_attributes && typeof row.additional_attributes === "string") {
    const magentoMap = parseMagentoAdditionalAttributes(row.additional_attributes);
    Object.assign(mergedAttrs, magentoMap);
  }

  // If row.attributes is a string or object
  if (row.attributes) {
    if (typeof row.attributes === "string") {
      try {
        const json = JSON.parse(row.attributes);
        Object.assign(mergedAttrs, json);
      } catch {
        Object.assign(mergedAttrs, parseMagentoAdditionalAttributes(row.attributes));
      }
    } else if (typeof row.attributes === "object") {
      Object.assign(mergedAttrs, row.attributes);
    }
  }

  // 1. Check unit
  const rawUnit =
    findValueByAliases(row, UNIT_ALIASES) ||
    findValueByAliases(mergedAttrs, UNIT_ALIASES);
  const detectedUnit = normalizeDimensionUnit(rawUnit);

  // 2. Check dedicated separate columns in row, then in mergedAttrs
  const rawL = findValueByAliases(row, LENGTH_ALIASES) ?? findValueByAliases(mergedAttrs, LENGTH_ALIASES);
  const rawB = findValueByAliases(row, BREADTH_ALIASES) ?? findValueByAliases(mergedAttrs, BREADTH_ALIASES);
  const rawH = findValueByAliases(row, HEIGHT_ALIASES) ?? findValueByAliases(mergedAttrs, HEIGHT_ALIASES);

  const numL = rawL !== undefined ? parseFloat(String(rawL).replace(/[^0-9.]/g, "")) : undefined;
  const numB = rawB !== undefined ? parseFloat(String(rawB).replace(/[^0-9.]/g, "")) : undefined;
  const numH = rawH !== undefined ? parseFloat(String(rawH).replace(/[^0-9.]/g, "")) : undefined;

  if (
    numL !== undefined && !isNaN(numL) && numL > 0 &&
    numB !== undefined && !isNaN(numB) && numB > 0 &&
    numH !== undefined && !isNaN(numH) && numH > 0
  ) {
    return {
      length: convertToCm(numL, detectedUnit),
      breadth: convertToCm(numB, detectedUnit),
      height: convertToCm(numH, detectedUnit),
      dimensionUnit: "cm",
    };
  }

  // If only some separate columns are present
  if (
    (numL !== undefined && !isNaN(numL) && numL > 0) ||
    (numB !== undefined && !isNaN(numB) && numB > 0) ||
    (numH !== undefined && !isNaN(numH) && numH > 0)
  ) {
    return {
      length: numL !== undefined && !isNaN(numL) ? convertToCm(numL, detectedUnit) : undefined,
      breadth: numB !== undefined && !isNaN(numB) ? convertToCm(numB, detectedUnit) : undefined,
      height: numH !== undefined && !isNaN(numH) ? convertToCm(numH, detectedUnit) : undefined,
      dimensionUnit: "cm",
    };
  }

  // 3. Check combined dimension string in row or mergedAttrs
  const rawCombined =
    findValueByAliases(row, COMBINED_DIMENSION_ALIASES) ??
    findValueByAliases(mergedAttrs, COMBINED_DIMENSION_ALIASES);

  if (rawCombined && typeof rawCombined === "string") {
    const parsed = parseCombinedDimensionsString(rawCombined);
    if (parsed) return parsed;
  }

  // Default empty result
  return {
    dimensionUnit: "cm",
  };
}
