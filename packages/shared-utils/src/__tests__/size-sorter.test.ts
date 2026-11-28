import { describe, it, expect } from "vitest";
import { compareSizes, sortSizes, sortSizeEntities } from "../size-sorter";

describe("Dynamic Size Sorter (shared-utils)", () => {
  it("sorts standard clothing sizes from smallest to largest", () => {
    const sizes = ["L", "XL", "M", "XXL", "S", "XS"];
    const sorted = sortSizes(sizes);
    expect(sorted).toEqual(["XS", "S", "M", "L", "XL", "XXL"]);
  });

  it("handles extreme sizes and variants like 2XL, 3XL, 4XL, XXS", () => {
    const sizes = ["4XL", "M", "3XL", "2XL", "XXS", "S", "XL", "L", "XS"];
    const sorted = sortSizes(sizes);
    expect(sorted).toEqual(["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"]);
  });

  it("handles combo/dual sizes properly (S/M, L/XL)", () => {
    const sizes = ["L/XL", "S", "S/M", "M", "M/L", "L", "XL"];
    const sorted = sortSizes(sizes);
    expect(sorted).toEqual(["S", "S/M", "M", "M/L", "L", "L/XL", "XL"]);
  });

  it("sorts numeric sizes numerically (e.g. boot / pant sizes)", () => {
    const bootSizes = ["44", "41", "43", "40", "42", "45"];
    expect(sortSizes(bootSizes)).toEqual(["40", "41", "42", "43", "44", "45"]);

    const pantSizes = ["34", "30", "38", "32", "36", "28"];
    expect(sortSizes(pantSizes)).toEqual(["28", "30", "32", "34", "36", "38"]);
  });

  it("handles EU / US / UK prefixes and units", () => {
    const sizes = ["EU 44", "EU 40", "EU 42", "EU 41"];
    expect(sortSizes(sizes)).toEqual(["EU 40", "EU 41", "EU 42", "EU 44"]);

    const cmSizes = ["61-62 cm", "53-54 cm", "57-58 cm", "55-56 cm", "59-60 cm"];
    expect(sortSizes(cmSizes)).toEqual(["53-54 cm", "55-56 cm", "57-58 cm", "59-60 cm", "61-62 cm"]);
  });

  it("places Universal / Free Size after standard apparel sizes", () => {
    const sizes = ["Free Size", "XL", "One Size", "S", "M", "L"];
    expect(sortSizes(sizes)).toEqual(["S", "M", "L", "XL", "Free Size", "One Size"]);
  });

  it("sorts size entities preserving their counts", () => {
    const items = [
      { name: "L", count: 88 },
      { name: "XL", count: 85 },
      { name: "M", count: 77 },
      { name: "XXL", count: 39 },
      { name: "S", count: 38 },
      { name: "XS", count: 1 },
    ];

    const sorted = sortSizeEntities(items, (i) => i.name);
    expect(sorted.map((i) => i.name)).toEqual(["XS", "S", "M", "L", "XL", "XXL"]);
  });
});
