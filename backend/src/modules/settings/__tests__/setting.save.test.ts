import { describe, it, expect } from "vitest";
import { SettingValidator } from "../setting.validator";
import { ProductValidator } from "../../product/product.validator";
import { CategoryValidator } from "../../category/category.validator";
import { HomepageValidator } from "../../homepage/homepage.validator";
import { NextRequest } from "next/server";

describe("Admin Save Payload Validations", () => {
  it("tests Product creation with minimal admin form payload", async () => {
    const payload = {
      name: "Test Helmet",
      sku: "TEST-SKU-001",
      basePrice: 5000,
      stockStatus: 1,
      qty: 10,
      status: "published",
      productType: "simple",
      visibility: "Catalog, Search",
      countryOfManufacture: "India",
      weightUnit: "kg",
      description: "<p>Description</p>",
      images: [],
      variants: [],
    };

    const req = new NextRequest("http://localhost:4000/api/v1/products", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const validated = await ProductValidator.validateCreate(req);
    expect(validated.name).toBe("Test Helmet");
  });

  it("tests Product creation with typical full admin form payload", async () => {
    const fullPayload = {
      name: "Axor Apex Helmet",
      sku: "AXOR-APEX-01",
      slug: "axor-apex-helmet",
      brand: "Axor",
      categoryId: "651234567890abcdef123456",
      categorySlugs: ["helmets", "full-face-helmets"],
      productType: "simple",
      status: "published",
      visibility: "Catalog, Search",
      countryOfManufacture: "India",
      weightUnit: "kg",
      basePrice: 4999,
      specialPrice: null,
      specialPriceFromDate: null,
      specialPriceToDate: null,
      mapPrice: null,
      msrpPrice: null,
      stockStatus: 1,
      qty: 15,
      outOfStockQty: null,
      minCartQty: null,
      maxCartQty: null,
      notifyOnStockBelow: null,
      allowBackorders: false,
      images: [
        { id: "img-1", url: "https://d2zuvpvc0pfkya.cloudfront.net/test.webp", altText: "Axor Apex" }
      ],
      variants: [],
      relatedSkus: [],
      upsellSkus: [],
      crosssellSkus: [],
      shortDescription: null,
      description: "Full face helmet with dual visor.",
      sizeChart: null,
      metaTitle: null,
      metaDescription: null,
      metaKeywords: null,
      faqs: [],
      attributes: {
        brand: "Axor",
        country_of_manufacture: "India",
      },
      videoUrl: null,
    };

    const req = new NextRequest("http://localhost:4000/api/v1/products", {
      method: "POST",
      body: JSON.stringify(fullPayload),
    });

    const validated = await ProductValidator.validateCreate(req);
    expect(validated.sku).toBe("AXOR-APEX-01");
  });

  it("tests Settings update with payload from AdminShippingSettings", async () => {
    const shippingPayload = {
      taxRate: 18,
      freeShippingThreshold: 999,
      shippingCost: 49,
      storeOriginAddress: "Warehouse 1",
      storeOriginCity: "Pune",
      storeOriginState: "Maharashtra",
      storeOriginPincode: "411001",
      storeOriginPhone: "9876543210",
      packagePresets: [
        { name: "Small Box", length: 15, breadth: 15, height: 10 }
      ],
    };

    const req = new NextRequest("http://localhost:4000/api/v1/admin/settings", {
      method: "PUT",
      body: JSON.stringify(shippingPayload),
    });

    const validated = await SettingValidator.validateUpdateSettings(req);
    expect(validated.taxRate).toBe(18);
  });
});

describe("Mongoose SettingRepository save test", () => {
  it("tests Mongoose SettingModel update", async () => {
    const { SettingModel } = await import("../setting.model");
    const { SettingRepository } = await import("../setting.repository");

    // Mock getSettings to return a real Mongoose document
    const doc = new SettingModel({
      taxRate: 18,
      freeShippingThreshold: 999,
      shippingCost: 49,
      enabledGateways: ["payu", "cod"],
      codPartialPaymentEnabled: false,
      packagePresets: [
        { name: "Box", length: 10, breadth: 10, height: 10 }
      ],
      footerConfig: {
        column1Title: "COL1",
        column1Links: [],
        column2Title: "COL2",
        column2Links: [],
        column3Title: "COL3",
        column3Links: [],
        column4Title: "COL4",
        column4Links: [],
        bottomLinks: [],
      },
      policyPages: [],
    });

    // Mock save on doc
    doc.save = vi.fn().mockImplementation(async function() {
      const err = this.validateSync();
      if (err) throw err;
      return this;
    });

    vi.spyOn(SettingRepository, "getSettings").mockResolvedValue(doc as any);

    // Call updateSettings
    const result = await SettingRepository.updateSettings({
      taxRate: 12,
      storeOriginAddress: "Test Address",
      enabledGateways: ["payu", "ccavenue", "cod"],
    });

    expect(result.taxRate).toBe(12);
  });
});
