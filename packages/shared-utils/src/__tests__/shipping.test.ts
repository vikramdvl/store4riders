import { describe, it, expect } from "vitest";
import {
  convertWeightToKg,
  calculateVolumetricWeight,
  calculateChargeableWeight,
  estimateOrderPackageDimensions,
} from "../shipping";

describe("shipping utilities & multi-product package estimation", () => {
  it("converts weight units cleanly to kilograms", () => {
    expect(convertWeightToKg(1.5, "kg")).toBe(1.5);
    expect(convertWeightToKg(500, "g")).toBe(0.5);
    expect(convertWeightToKg(400, "ml")).toBe(0.4);
    expect(convertWeightToKg(2, "L")).toBe(2);
    expect(convertWeightToKg(undefined, "kg")).toBeNull();
    expect(convertWeightToKg(0, "kg")).toBeNull();
  });

  it("calculates volumetric and chargeable weights properly", () => {
    expect(calculateVolumetricWeight(30, 20, 15)).toBe(1.8);
    expect(calculateChargeableWeight(1.2, 1.8)).toBe(1.8);
    expect(calculateChargeableWeight(2.5, 1.8)).toBe(2.5);
  });

  it("preserves exact L x B x H for single-item single-quantity orders", () => {
    const res = estimateOrderPackageDimensions(
      [
        {
          sku: "HLM-01",
          quantity: 1,
          weight: 1.5,
          weightUnit: "kg",
          length: 36,
          breadth: 28,
          height: 28,
          dimensionUnit: "cm",
        },
      ],
      [{ name: "Large Box (Helmets)", length: 40, breadth: 30, height: 30 }]
    );

    expect(res.weight).toBe(1.5);
    expect(res.length).toBe(36);
    expect(res.breadth).toBe(28);
    expect(res.height).toBe(28);
    expect(res.matchedPreset?.name).toBe("Large Box (Helmets)");
    expect(res.hasProductDimensions).toBe(true);
    expect(res.missingDimensionSkus).toEqual([]);
    expect(res.missingWeightSkus).toEqual([]);
  });

  it("estimates realistic box dimensions for 4 mixed products (helmet + jacket + lube + light)", () => {
    const presets = [
      { name: "Small Box", length: 15, breadth: 15, height: 10 },
      { name: "Medium Box", length: 30, breadth: 30, height: 15 },
      { name: "Large Box", length: 40, breadth: 30, height: 30 },
      { name: "Jumbo Master Carton", length: 50, breadth: 40, height: 38 },
    ];

    const res = estimateOrderPackageDimensions(
      [
        { sku: "AXOR-HLM", quantity: 1, weight: 1.5, weightUnit: "kg", length: 35, breadth: 28, height: 28 },
        { sku: "RYNOX-JKT", quantity: 1, weight: 1.8, weightUnit: "kg", length: 40, breadth: 32, height: 12 },
        { sku: "CHAIN-LUBE", quantity: 1, weight: 400, weightUnit: "ml", length: 18, breadth: 7, height: 7 },
        { sku: "FOG-LIGHT", quantity: 1, weight: 600, weightUnit: "g", length: 15, breadth: 12, height: 10 },
      ],
      presets
    );

    expect(res.weight).toBe(4.3);
    // Helper recommends matching preset without auto-overriding product-derived dimensions
    expect(res.matchedPreset?.name).toBe("Jumbo Master Carton");
    expect(res.length).toBe(40);
    expect(res.breadth).toBe(32);
    expect(res.height).toBe(40);
    expect(res.hasProductDimensions).toBe(true);
  });

  it("avoids naive sum(H) inflation when no warehouse preset is provided", () => {
    const res = estimateOrderPackageDimensions([
      { sku: "AXOR-HLM", quantity: 1, weight: 1.5, length: 35, breadth: 28, height: 28 },
      { sku: "RYNOX-JKT", quantity: 1, weight: 1.8, length: 40, breadth: 32, height: 12 },
      { sku: "CHAIN-LUBE", quantity: 1, weight: 0.4, length: 18, breadth: 7, height: 7 },
      { sku: "FOG-LIGHT", quantity: 1, weight: 0.6, length: 15, breadth: 12, height: 10 },
    ]);

    // Naive stacking would produce H = 57 cm; volume-bounded packing computes 40 cm
    expect(res.length).toBe(40);
    expect(res.breadth).toBe(32);
    expect(res.height).toBe(40);
    expect(res.volumetricWeight).toBe(10.24);
    expect(res.chargeableWeight).toBe(10.24);
  });

  it("converts inches and mm dimensions and reports missing SKUs", () => {
    const res = estimateOrderPackageDimensions([
      { sku: "IN-ITEM", quantity: 1, weight: 1.0, length: 10, breadth: 8, height: 4, dimensionUnit: "in" },
      { sku: "MISSING-ITEM", quantity: 2, weight: null, length: null, breadth: null, height: null },
    ]);

    // 1.0 + 2 * 0.5 fallback = 2.0 kg
    expect(res.weight).toBe(2);
    expect(res.missingWeightSkus).toEqual(["MISSING-ITEM"]);
    expect(res.missingDimensionSkus).toEqual(["MISSING-ITEM"]);
    expect(res.itemsWithDimensionsCount).toBe(1);
    expect(res.totalDistinctItemsCount).toBe(2);
  });

  it("handles all-missing catalog specs, micro-weights, multi-qty stacking, and oversized non-matching presets", () => {
    const emptyRes = estimateOrderPackageDimensions([{ sku: "NO-SPECS", quantity: 1 }]);
    expect(emptyRes.weight).toBe(0.5);
    expect(emptyRes.length).toBe(15);
    expect(emptyRes.breadth).toBe(15);
    expect(emptyRes.height).toBe(10);
    expect(emptyRes.hasProductDimensions).toBe(false);
    expect(emptyRes.missingWeightSkus).toEqual(["NO-SPECS"]);
    expect(emptyRes.missingDimensionSkus).toEqual(["NO-SPECS"]);

    // Micro weight (20g) floors at 0.05kg per unit for safe courier manifesting
    const microRes = estimateOrderPackageDimensions([
      { sku: "PINLOCK-PIN", quantity: 2, weight: 20, weightUnit: "g", length: 5, breadth: 5, height: 2 },
    ]);
    expect(microRes.weight).toBe(0.1);

    // Multi-quantity stacking with presets smaller than required outer box -> matchedPreset stays null
    const multiQty = estimateOrderPackageDimensions(
      [{ sku: "HELMET-BOX", quantity: 3, weight: 1.5, length: 36, breadth: 28, height: 28 }],
      [{ name: "Small Pouch", length: 20, breadth: 15, height: 10 }]
    );
    expect(multiQty.weight).toBe(4.5);
    expect(multiQty.length).toBe(36);
    expect(multiQty.breadth).toBe(28);
    expect(multiQty.height).toBe(84);
    expect(multiQty.matchedPreset).toBeNull();
  });
});
