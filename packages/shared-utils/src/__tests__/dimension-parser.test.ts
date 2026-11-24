import { describe, it, expect } from "vitest";
import {
  extractProductDimensions,
  parseCombinedDimensionsString,
  convertToCm,
  normalizeDimensionUnit,
  extractProductWeight,
  parseAttributesString,
} from "../dimension-parser";

describe("dimension-parser", () => {
  it("normalizes units properly", () => {
    expect(normalizeDimensionUnit("inch")).toBe("in");
    expect(normalizeDimensionUnit("inches")).toBe("in");
    expect(normalizeDimensionUnit("cm")).toBe("cm");
    expect(normalizeDimensionUnit("mm")).toBe("mm");
    expect(normalizeDimensionUnit(undefined)).toBe("cm");
  });

  it("converts units to cm accurately", () => {
    expect(convertToCm(10, "cm")).toBe(10);
    expect(convertToCm(10, "in")).toBe(25.4);
    expect(convertToCm(100, "mm")).toBe(10);
  });

  it("parses combined string like 20x15x10", () => {
    const res = parseCombinedDimensionsString("20x15x10");
    expect(res).toEqual({
      length: 20,
      breadth: 15,
      height: 10,
      dimensionUnit: "cm",
    });
  });

  it("parses combined string with spaces and cm unit", () => {
    const res = parseCombinedDimensionsString(" 30 x 20 x 15 cm ");
    expect(res).toEqual({
      length: 30,
      breadth: 20,
      height: 15,
      dimensionUnit: "cm",
    });
  });

  it("parses combined string in inches and converts to cm", () => {
    const res = parseCombinedDimensionsString("10 x 5 x 2 inches");
    expect(res).toEqual({
      length: 25.4,
      breadth: 12.7,
      height: 5.1,
      dimensionUnit: "cm",
    });
  });

  it("parses labeled format: L: 25, W: 15, H: 10", () => {
    const res = parseCombinedDimensionsString("L: 25, W: 15, H: 10");
    expect(res).toEqual({
      length: 25,
      breadth: 15,
      height: 10,
      dimensionUnit: "cm",
    });
  });

  it("extracts dimensions from separate columns (length, breadth, height)", () => {
    const row = {
      length: "25",
      breadth: "15",
      height: "10",
    };
    const res = extractProductDimensions(row);
    expect(res).toEqual({
      length: 25,
      breadth: 15,
      height: 10,
      dimensionUnit: "cm",
    });
  });

  it("extracts dimensions from shorthand aliases (l, w, h)", () => {
    const row = {
      l: "30",
      w: "20",
      h: "15",
    };
    const res = extractProductDimensions(row);
    expect(res).toEqual({
      length: 30,
      breadth: 20,
      height: 15,
      dimensionUnit: "cm",
    });
  });

  it("extracts dimensions from package_* aliases", () => {
    const row = {
      package_length: "40",
      package_width: "30",
      package_height: "20",
      dimension_unit: "cm",
    };
    const res = extractProductDimensions(row);
    expect(res).toEqual({
      length: 40,
      breadth: 30,
      height: 20,
      dimensionUnit: "cm",
    });
  });

  it("extracts dimensions from Magento additional_attributes string", () => {
    const row = {
      additional_attributes: 'condition="New",length="35",breadth="25",height="15"',
    };
    const res = extractProductDimensions(row);
    expect(res).toEqual({
      length: 35,
      breadth: 25,
      height: 15,
      dimensionUnit: "cm",
    });
  });

  it("extracts dimensions when in additional_attributes as dimensions='30x20x10'", () => {
    const row = {
      additional_attributes: 'condition="New",dimensions="30x20x10"',
    };
    const res = extractProductDimensions(row);
    expect(res).toEqual({
      length: 30,
      breadth: 20,
      height: 10,
      dimensionUnit: "cm",
    });
  });

  it("parses additional attributes into clean key-value dictionary", () => {
    const raw = 'size="XL",color="Matte Black",capacity="30L",material="Cordura 600D"';
    const parsed = parseAttributesString(raw);
    expect(parsed).toEqual({
      size: "XL",
      color: "Matte Black",
      capacity: "30L",
      material: "Cordura 600D",
    });
  });

  it("extracts and normalizes product weights properly", () => {
    // 1. Direct kg float
    expect(extractProductWeight({ weight: "1.5" })).toEqual({
      weight: 1.5,
      weightUnit: "kg",
    });

    // 2. String with kg
    expect(extractProductWeight({ package_weight: "2.5 kg" })).toEqual({
      weight: 2.5,
      weightUnit: "kg",
    });

    // 3. String with grams (auto-converts to kg for Shiprocket)
    expect(extractProductWeight({ weight: "500g" })).toEqual({
      weight: 0.5,
      weightUnit: "kg",
    });

    expect(extractProductWeight({ shipping_weight: "750 gm" })).toEqual({
      weight: 0.75,
      weightUnit: "kg",
    });

    // 4. Large number without unit (assumed grams e.g. 800)
    expect(extractProductWeight({ weight: "800" })).toEqual({
      weight: 0.8,
      weightUnit: "kg",
    });

    // 5. Volume in Litres
    expect(extractProductWeight({ weight: "1.5L" })).toEqual({
      weight: 1.5,
      weightUnit: "kg",
    });

    // 6. Weight from additional_attributes string
    const rowWithAttrs = {
      additional_attributes: 'condition="New",weight="1.2kg",size="L"',
    };
    expect(extractProductWeight(rowWithAttrs)).toEqual({
      weight: 1.2,
      weightUnit: "kg",
    });
  });
});
