/**
 * Dynamic Size Sorter Utility for Motorcycle Gear & Apparel.
 * 
 * Supports:
 * - Standard letter/apparel sizes (6XS -> 10XL)
 * - Multi/combo sizes (XS/S, S/M, M/L, L/XL, XL/XXL, etc.)
 * - Youth / Kids sizes (YXS, YS, YM, YL, YXL)
 * - Numeric sizes (Pants waist 28-48, Boots EU 38-48, UK/US 6-13, Helmet cm 53-64cm)
 * - Numeric ranges (53-54 cm, 55-56 cm) & fit modifiers (32S, 32R, 32L)
 * - Universal / Free Size / One Size (placed systematically at the end)
 * - Fallback natural alphanumeric sorting for unclassified items
 */

const STANDARD_ALPHA_SIZES: Record<string, number> = {
  // Extreme smalls
  "6XS": 10,
  "5XS": 20, "XXXXXS": 20,
  "4XS": 30, "XXXXS": 30,
  "3XS": 40, "XXXS": 40,
  "2XS": 50, "XXS": 50,
  "2XS/XS": 55, "XXS/XS": 55, "2XS-XS": 55, "XXS-XS": 55,
  
  // XS
  "XS": 60, "EXTRA SMALL": 60, "X-SMALL": 60, "X SMALL": 60,
  "XS/S": 65, "XS-S": 65, "XS / S": 65,

  // S
  "S": 70, "SMALL": 70, "SM": 70,
  "S/M": 75, "S-M": 75, "S / M": 75,

  // M
  "M": 80, "MED": 80, "MEDIUM": 80, "MD": 80,
  "M/L": 85, "M-L": 85, "M / L": 85,

  // L
  "L": 90, "LARGE": 90, "LRG": 90, "LG": 90,
  "L/XL": 95, "L-XL": 95, "L / XL": 95,

  // XL
  "XL": 100, "X-LARGE": 100, "X LARGE": 100, "EXTRA LARGE": 100, "1XL": 100, "1X": 100,
  "XL/2XL": 105, "XL-2XL": 105, "XL / 2XL": 105,
  "XL/XXL": 105, "XL-XXL": 105, "XL / XXL": 105,

  // 2XL / XXL
  "2XL": 110, "XXL": 110, "2X": 110, "2X-LARGE": 110, "2X LARGE": 110,
  "2XL/3XL": 115, "2XL-3XL": 115, "2XL / 3XL": 115,
  "XXL/XXXL": 115, "XXL-XXXL": 115, "XXL / XXXL": 115,

  // 3XL / XXXL
  "3XL": 120, "XXXL": 120, "3X": 120, "3X-LARGE": 120, "3X LARGE": 120,
  "3XL/4XL": 125, "3XL-4XL": 125, "3XL / 4XL": 125,

  // 4XL / XXXXL
  "4XL": 130, "XXXXL": 130, "4X": 130, "4X-LARGE": 130, "4X LARGE": 130,
  "4XL/5XL": 135, "4XL-5XL": 135, "4XL / 5XL": 135,

  // 5XL / XXXXXL
  "5XL": 140, "XXXXXL": 140, "5X": 140, "5X-LARGE": 140, "5X LARGE": 140,

  // 6XL
  "6XL": 150, "XXXXXXL": 150, "6X": 150, "6X-LARGE": 150, "6X LARGE": 150,

  // 7XL - 10XL
  "7XL": 160, "7X": 160,
  "8XL": 170, "8X": 170,
  "9XL": 180, "9X": 180,
  "10XL": 190, "10X": 190,

  // Youth / Kids
  "YXXS": 32, "KIDS XXS": 32,
  "YXS": 42, "KIDS XS": 42,
  "YS": 52, "KIDS S": 52,
  "YM": 62, "KIDS M": 62,
  "YL": 72, "KIDS L": 72,
  "YXL": 82, "KIDS XL": 82,
};

const UNIVERSAL_SIZE_SET = new Set([
  "FREE SIZE", "FREESIZE", "FREE", "ONE SIZE", "ONESIZE", "OSFA", 
  "ONE SIZE FITS ALL", "UNIVERSAL", "ALL SIZE", "STANDARD"
]);

interface ParsedSize {
  tier: number; // 1: Alpha, 2: Numeric, 3: Universal, 4: Unknown
  primary: number;
  secondary: number;
  raw: string;
}

function parseSize(raw: string): ParsedSize {
  if (!raw || typeof raw !== "string") {
    return { tier: 4, primary: 0, secondary: 0, raw: "" };
  }
  const str = raw.trim();
  const upper = str.toUpperCase();

  // 1. Universal / Free Size
  if (UNIVERSAL_SIZE_SET.has(upper)) {
    return { tier: 3, primary: 0, secondary: 0, raw: str };
  }

  // 2. Direct Alpha match
  if (STANDARD_ALPHA_SIZES[upper] !== undefined) {
    return { tier: 1, primary: STANDARD_ALPHA_SIZES[upper], secondary: 0, raw: str };
  }

  // Strip prefix like "SIZE: ", "SIZE "
  const withoutSizePrefix = upper.replace(/^SIZE[:\s\-]+/, "").trim();
  if (STANDARD_ALPHA_SIZES[withoutSizePrefix] !== undefined) {
    return { tier: 1, primary: STANDARD_ALPHA_SIZES[withoutSizePrefix], secondary: 0, raw: str };
  }

  // Check for parenthesis alpha match, e.g. "M (38-40)" or "38 (M)" or "42 (L)"
  const parenMatch = upper.match(/\(([A-Z0-9\-\/]+)\)/);
  if (parenMatch && STANDARD_ALPHA_SIZES[parenMatch[1]] !== undefined) {
    return { tier: 1, primary: STANDARD_ALPHA_SIZES[parenMatch[1]], secondary: 0, raw: str };
  }

  // 3. Numeric sizes (e.g. 42, EU 42, 54 cm, 53-54 cm, 32S, 32 Regular)
  let numClean = upper
    .replace(/^(EU|US|UK|EURO|EUR|EUROPE)[\s\-_]*/i, "")
    .replace(/[\s\-_]*(EU|US|UK|EURO|EUR|EUROPE)$/i, "")
    .replace(/[\s\-_]*(CM|MM|IN|INCH|INCHES|['"])$/i, "")
    .trim();

  // Check for numeric range, e.g. "53-54", "53 - 54", "53/54"
  const rangeMatch = numClean.match(/^(\d+(?:\.\d+)?)\s*[\-–\/]\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return { tier: 2, primary: min, secondary: max, raw: str };
  }

  // Check for fit modifier suffix like "32S", "32R", "32L", "32 SHORT", "32 REG", "32 LONG"
  const fitMatch = numClean.match(/^(\d+(?:\.\d+)?)\s*(SHORT|REGULAR|REG|LONG|[SRL])$/);
  if (fitMatch) {
    const val = parseFloat(fitMatch[1]);
    let mod = 2; // default Regular
    const f = fitMatch[2];
    if (f === "S" || f === "SHORT") mod = 1;
    else if (f === "L" || f === "LONG") mod = 3;
    return { tier: 2, primary: val, secondary: mod, raw: str };
  }

  // Simple number e.g. "42", "42.5", "28"
  const singleNumMatch = numClean.match(/^(\d+(?:\.\d+)?)$/);
  if (singleNumMatch) {
    return { tier: 2, primary: parseFloat(singleNumMatch[1]), secondary: 0, raw: str };
  }

  // Starts with number (e.g. "32W x 30L" or "32x30")
  const startNumMatch = numClean.match(/^(\d+(?:\.\d+)?)/);
  if (startNumMatch) {
    const val = parseFloat(startNumMatch[1]);
    const remaining = numClean.slice(startNumMatch[0].length);
    const secondNum = remaining.match(/(\d+(?:\.\d+)?)/);
    return { tier: 2, primary: val, secondary: secondNum ? parseFloat(secondNum[1]) : 0, raw: str };
  }

  // 4. Unknown string
  return { tier: 4, primary: 0, secondary: 0, raw: str };
}

/**
 * Comparator for two size strings.
 * Sorts systematically:
 * 1. Standard Alpha sizes (XXS, XS, S, M, L, XL, XXL, 3XL...)
 * 2. Numeric sizes in ascending numerical order (28, 30, 32... 39, 40, 41...)
 * 3. Universal / Free Size
 * 4. Other unknown size descriptions
 */
export function compareSizes(a: string, b: string): number {
  const pA = parseSize(a);
  const pB = parseSize(b);

  if (pA.tier !== pB.tier) {
    return pA.tier - pB.tier;
  }

  if (pA.tier === 1) { // Alpha
    if (pA.primary !== pB.primary) return pA.primary - pB.primary;
    return pA.raw.localeCompare(pB.raw);
  }

  if (pA.tier === 2) { // Numeric
    if (pA.primary !== pB.primary) return pA.primary - pB.primary;
    if (pA.secondary !== pB.secondary) return pA.secondary - pB.secondary;
    return pA.raw.localeCompare(pB.raw);
  }

  if (pA.tier === 3) { // Universal
    return pA.raw.localeCompare(pB.raw);
  }

  return pA.raw.localeCompare(pB.raw, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Sorts an array of size strings systematically.
 */
export function sortSizes(sizesList: string[]): string[] {
  if (!Array.isArray(sizesList)) return [];
  return [...sizesList].sort(compareSizes);
}

/**
 * Sorts an array of objects by their size property systematically.
 * Useful for aggregation facets `{ name: string, count: number }`.
 */
export function sortSizeEntities<T>(items: T[], getSize: (item: T) => string): T[] {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => compareSizes(getSize(a), getSize(b)));
}
