import { convertToCm, normalizeDimensionUnit } from "./dimension-parser";

/**
 * Shipping Utility Functions
 */

export interface IPackageSpecInputItem {
  sku?: string;
  quantity?: number;
  weight?: number | null;
  weightUnit?: string | null;
  length?: number | null;
  breadth?: number | null;
  height?: number | null;
  dimensionUnit?: string | null;
}

export interface IPackageBoxPreset {
  name: string;
  length: number;
  breadth: number;
  height: number;
}

export interface IEstimatedPackageResult {
  weight: number;
  length: number;
  breadth: number;
  height: number;
  volumetricWeight: number;
  chargeableWeight: number;
  hasProductDimensions: boolean;
  itemsWithDimensionsCount: number;
  totalDistinctItemsCount: number;
  missingWeightSkus: string[];
  missingDimensionSkus: string[];
  matchedPreset: IPackageBoxPreset | null;
}

/**
 * Converts a product weight value and unit into kilograms (kg).
 * Returns null if the input weight is missing or non-positive.
 */
export function convertWeightToKg(weight?: number | null, weightUnit?: string | null): number | null {
  const numeric = Number(weight);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  const unit = String(weightUnit || "kg").trim().toLowerCase();
  if (unit === "g" || unit === "gm" || unit === "gram" || unit === "grams" || unit === "ml" || unit === "milliliter" || unit === "millilitre") {
    return numeric / 1000;
  }
  // 1 Litre is approximated as 1 kg for standard courier manifests
  return numeric;
}

/**
 * Calculates volumetric weight based on standard courier formula (L x B x H / 5000)
 * Dimensions should be in centimeters (cm).
 * Returns weight in kilograms (kg).
 */
export function calculateVolumetricWeight(lengthCm: number, breadthCm: number, heightCm: number): number {
  if (lengthCm <= 0 || breadthCm <= 0 || heightCm <= 0) return 0;
  return (lengthCm * breadthCm * heightCm) / 5000;
}

/**
 * Calculates the chargeable weight.
 * Couriers charge based on the higher of actual weight and volumetric weight.
 */
export function calculateChargeableWeight(actualWeightKg: number, volumetricWeightKg: number): number {
  return Math.max(actualWeightKg, volumetricWeightKg);
}

/**
 * Estimates combined parcel weight and outer box dimensions (L x B x H in cm)
 * for single or multi-product orders, optionally matching against warehouse box presets.
 */
export function estimateOrderPackageDimensions(
  items: IPackageSpecInputItem[],
  packagePresets?: IPackageBoxPreset[]
): IEstimatedPackageResult {
  const safeItems = Array.isArray(items) ? items : [];
  let totalWeight = 0;
  let totalUnits = 0;
  let itemsWithDimensionsCount = 0;
  const missingWeightSkus: string[] = [];
  const missingDimensionSkus: string[] = [];

  let singleItemExactDims: { length: number; breadth: number; height: number } | null = null;

  let maxLongest = 0;
  let maxMiddle = 0;
  let maxSmallest = 0;
  let naiveStackedH = 0;
  let totalItemVolumeCm3 = 0;

  let rawMaxL = 0;
  let rawMaxB = 0;
  let rawSumH = 0;

  for (const item of safeItems) {
    const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
    totalUnits += qty;
    const skuLabel = item.sku ? String(item.sku) : "Unknown SKU";

    const convertedKg = convertWeightToKg(item.weight, item.weightUnit);
    if (convertedKg === null) {
      missingWeightSkus.push(skuLabel);
      totalWeight += 0.5 * qty;
    } else {
      totalWeight += Math.max(0.05, convertedKg) * qty;
    }

    const dimUnit = normalizeDimensionUnit(item.dimensionUnit || undefined);
    const rawL = Number(item.length);
    const rawB = Number(item.breadth);
    const rawH = Number(item.height);

    const l = Number.isFinite(rawL) && rawL > 0 ? convertToCm(rawL, dimUnit) : 0;
    const b = Number.isFinite(rawB) && rawB > 0 ? convertToCm(rawB, dimUnit) : 0;
    const h = Number.isFinite(rawH) && rawH > 0 ? convertToCm(rawH, dimUnit) : 0;

    if (l > 0) rawMaxL = Math.max(rawMaxL, l);
    if (b > 0) rawMaxB = Math.max(rawMaxB, b);
    if (h > 0) rawSumH += h * qty;

    if (l > 0 && b > 0 && h > 0) {
      itemsWithDimensionsCount++;
      singleItemExactDims = { length: l, breadth: b, height: h };

      const [d1, d2, d3] = [l, b, h].sort((x, y) => y - x);
      maxLongest = Math.max(maxLongest, d1);
      maxMiddle = Math.max(maxMiddle, d2);
      maxSmallest = Math.max(maxSmallest, d3);
      naiveStackedH += d3 * qty;
      totalItemVolumeCm3 += l * b * h * qty;
    } else {
      missingDimensionSkus.push(skuLabel);
      if (h > 0) {
        naiveStackedH += h * qty;
      }
    }
  }

  const finalWeight = totalWeight > 0 ? Number(totalWeight.toFixed(2)) : 0.5;
  const hasProductDimensions = itemsWithDimensionsCount > 0 || rawMaxL > 0 || rawMaxB > 0 || rawSumH > 0;

  let finalLength = 15;
  let finalBreadth = 15;
  let finalHeight = 10;
  let matchedPreset: IPackageBoxPreset | null = null;

  if (safeItems.length === 1 && totalUnits === 1 && singleItemExactDims) {
    // Preserve exact dimensions for single-unit single-item dispatches
    finalLength = Math.max(1, Math.round(singleItemExactDims.length));
    finalBreadth = Math.max(1, Math.round(singleItemExactDims.breadth));
    finalHeight = Math.max(1, Math.round(singleItemExactDims.height));
  } else if (totalItemVolumeCm3 > 0 && maxLongest > 0 && maxMiddle > 0) {
    // Multi-item / multi-qty carton estimation with 10% packing void allowance
    const neededVolumeCm3 = totalItemVolumeCm3 * 1.1;
    const volumeDrivenHeight = Math.ceil(neededVolumeCm3 / (maxLongest * maxMiddle));
    const boundedHeight = Math.min(
      Math.max(1, Math.ceil(naiveStackedH)),
      Math.max(Math.ceil(maxSmallest), volumeDrivenHeight)
    );

    finalLength = Math.max(1, Math.round(maxLongest));
    finalBreadth = Math.max(1, Math.round(maxMiddle));
    finalHeight = Math.max(1, Math.round(boundedHeight));

    if (Array.isArray(packagePresets) && packagePresets.length > 0) {
      const validPresets = packagePresets
        .filter((p) => p && Number(p.length) > 0 && Number(p.breadth) > 0 && Number(p.height) > 0)
        .sort((a, b) => a.length * a.breadth * a.height - b.length * b.breadth * b.height);

      for (const preset of validPresets) {
        const [p1, p2, p3] = [Number(preset.length), Number(preset.breadth), Number(preset.height)].sort((x, y) => y - x);
        const presetVol = p1 * p2 * p3;
        if (p1 >= maxLongest && p2 >= maxMiddle && p3 >= maxSmallest && presetVol >= neededVolumeCm3) {
          matchedPreset = preset;
          break;
        }
      }
    }
  } else if (hasProductDimensions) {
    finalLength = rawMaxL > 0 ? Math.max(1, Math.round(rawMaxL)) : 15;
    finalBreadth = rawMaxB > 0 ? Math.max(1, Math.round(rawMaxB)) : 15;
    finalHeight = rawSumH > 0 ? Math.max(1, Math.round(rawSumH)) : 10;
  }

  // Also resolve a matching preset for single-item orders as a UI hint without overriding single-item dimensions
  if (!matchedPreset && safeItems.length === 1 && totalUnits === 1 && singleItemExactDims && Array.isArray(packagePresets) && packagePresets.length > 0) {
    const [d1, d2, d3] = [singleItemExactDims.length, singleItemExactDims.breadth, singleItemExactDims.height].sort((x, y) => y - x);
    const validPresets = packagePresets
      .filter((p) => p && Number(p.length) > 0 && Number(p.breadth) > 0 && Number(p.height) > 0)
      .sort((a, b) => a.length * a.breadth * a.height - b.length * b.breadth * b.height);

    for (const preset of validPresets) {
      const [p1, p2, p3] = [Number(preset.length), Number(preset.breadth), Number(preset.height)].sort((x, y) => y - x);
      if (p1 >= d1 && p2 >= d2 && p3 >= d3) {
        matchedPreset = preset;
        break;
      }
    }
  }

  const volumetricWeight = Number(calculateVolumetricWeight(finalLength, finalBreadth, finalHeight).toFixed(2));
  const chargeableWeight = Number(calculateChargeableWeight(finalWeight, volumetricWeight).toFixed(2));

  return {
    weight: finalWeight,
    length: finalLength,
    breadth: finalBreadth,
    height: finalHeight,
    volumetricWeight,
    chargeableWeight,
    hasProductDimensions,
    itemsWithDimensionsCount,
    totalDistinctItemsCount: safeItems.length,
    missingWeightSkus: Array.from(new Set(missingWeightSkus)),
    missingDimensionSkus: Array.from(new Set(missingDimensionSkus)),
    matchedPreset,
  };
}
