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
    vi.spyOn(SettingModel, "findOneAndUpdate").mockReturnValue({
      lean: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          ...doc.toObject(),
          taxRate: 12,
          storeOriginAddress: "Test Address",
          enabledGateways: ["payu", "ccavenue", "cod"],
        }),
      }),
    } as any);

    // Call updateSettings
    const result = await SettingRepository.updateSettings({
      taxRate: 12,
      storeOriginAddress: "Test Address",
      enabledGateways: ["payu", "ccavenue", "cod"],
    });

    expect(result.taxRate).toBe(12);
  });

  it("preserves colorSwatches on ProductValidator.validateCreate", async () => {
    const req = new NextRequest("http://localhost:4000/api/v1/products", {
      method: "POST",
      body: JSON.stringify({
        name: "Color Swatch Helmet",
        sku: "SWATCH-SKU-01",
        basePrice: 5499,
        stockStatus: 1,
        productType: "configurable",
        colorSwatches: {
          Red: "https://d2zuvpvc0pfkya.cloudfront.net/red.webp",
          Black: "https://d2zuvpvc0pfkya.cloudfront.net/black.webp",
        },
      }),
    });

    const validated = await ProductValidator.validateCreate(req);
    expect(validated.colorSwatches).toEqual({
      Red: "https://d2zuvpvc0pfkya.cloudfront.net/red.webp",
      Black: "https://d2zuvpvc0pfkya.cloudfront.net/black.webp",
    });
  });

  it("preserves touringGear.items on HomepageValidator.validateUpdateSections", async () => {
    const req = new NextRequest("http://localhost:4000/api/v1/homepage/sections", {
      method: "PUT",
      body: JSON.stringify({
        sections: {
          topBanner: { message: "Free shipping above 999", highlightText: "FREE", isEnabled: true, linkUrl: "/products" },
          featuredCategories: {
            sectionTitle: "Featured",
            helmets: { title: "Helmets", imageUrl: "https://example.com/h.webp", linkUrl: "/helmets" },
            gloves: { title: "Gloves", imageUrl: "https://example.com/g.webp", linkUrl: "/gloves" },
            jackets: { title: "Jackets", imageUrl: "https://example.com/j.webp", linkUrl: "/jackets" },
          },
          browseCategories: { sectionTitle: "Browse", items: [] },
          touringGear: {
            sectionTitle: "Touring Gear",
            seeMoreText: "View All",
            seeMoreLink: "/touring-gear",
            items: [
              {
                id: "item-1",
                name: "Saddlebags",
                priceFormatted: "₹4,999",
                imageUrl: "https://d2zuvpvc0pfkya.cloudfront.net/bags.webp",
                productUrl: "/luggage/saddlebags",
              },
            ],
          },
          socialMedia: { sectionTitle: "Instagram", reelImages: [] },
          testimonials: { sectionTitle: "Testimonials" },
        },
      }),
    });

    const validated = await HomepageValidator.validateUpdateSections(req);
    expect(validated.sections.touringGear?.items).toHaveLength(1);
    expect(validated.sections.touringGear?.items?.[0]?.name).toBe("Saddlebags");
  });

  it("unsets null optional fields in CouponRepository.update instead of setting null", async () => {
    const { CouponModel } = await import("../../coupon/coupon.model");
    const { CouponRepository } = await import("../../coupon/coupon.repository");

    const spy = vi.spyOn(CouponModel, "findByIdAndUpdate").mockReturnValue({
      lean: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: "coup_1", code: "SAVE10" }),
      }),
    } as any);

    await CouponRepository.update("coup_1", {
      description: "",
      maxDiscountCap: null as any,
      totalUsageLimit: null as any,
      startDate: null as any,
    });

    expect(spy).toHaveBeenCalledWith(
      "coup_1",
      {
        $set: { description: "" },
        $unset: { maxDiscountCap: 1, totalUsageLimit: 1, startDate: 1 },
      },
      { new: true }
    );
    spy.mockRestore();
  });

  it("unsets parentId in CategoryRepository.update when cleared back to root level", async () => {
    const { CategoryModel } = await import("../../category/category.model");
    const { CategoryRepository } = await import("../../category/category.repository");

    const findSpy = vi.spyOn(CategoryRepository, "findById").mockResolvedValue({
      _id: "cat_1",
      slug: "luggage",
      name: "Luggage",
      parentId: "cat_parent",
    } as any);
    const updateSpy = vi.spyOn(CategoryModel, "findByIdAndUpdate").mockReturnValue({
      lean: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: "cat_1", slug: "luggage", name: "Luggage" }),
      }),
    } as any);

    await CategoryRepository.update("cat_1", { name: "Luggage", parentId: "" });

    expect(updateSpy).toHaveBeenCalledWith(
      "cat_1",
      {
        $set: { name: "Luggage" },
        $unset: { parentId: 1 },
      },
      { new: true }
    );
    findSpy.mockRestore();
    updateSpy.mockRestore();
  });
});
