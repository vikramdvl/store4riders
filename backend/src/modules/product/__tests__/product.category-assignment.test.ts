import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  createMock,
  updateMock,
  findByIdMock,
  findBySlugMock,
  findBySkuMock,
  categoryFindMock,
  categoryFindOneMock,
} = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
  findByIdMock: vi.fn(),
  findBySlugMock: vi.fn(),
  findBySkuMock: vi.fn(),
  categoryFindMock: vi.fn(),
  categoryFindOneMock: vi.fn(),
}));

vi.mock("../product.repository", () => ({
  ProductRepository: {
    create: createMock,
    update: updateMock,
    findById: findByIdMock,
    findBySlug: findBySlugMock,
    findBySku: findBySkuMock,
  },
}));

vi.mock("../../category/category.model", () => ({
  CategoryModel: {
    find: categoryFindMock,
    findOne: categoryFindOneMock,
  },
}));

vi.mock("../../../core/search/meilisearch", () => ({
  indexProduct: vi.fn().mockResolvedValue(undefined),
  removeProductFromIndex: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../core/cache/redis", () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  deleteCache: vi.fn().mockResolvedValue(undefined),
  deleteCacheByPattern: vi.fn().mockResolvedValue(undefined),
  clearProductCaches: vi.fn().mockResolvedValue(undefined),
}));

import { ProductService } from "../product.service";
import { ProductValidator } from "../product.validator";
import { NextRequest } from "next/server";

const SMART_DISPLAY_ID = "6afff12e7b74138444ecf9b5";
const GADGETS_ID = "6af1852d8ce2a255f3ce79f7";

function makeExecChain(result: unknown) {
  return {
    select: () => ({
      lean: () => ({
        exec: vi.fn().mockResolvedValue(result),
      }),
    }),
    lean: () => ({
      exec: vi.fn().mockResolvedValue(result),
    }),
  };
}

describe("ProductService Strict Admin Category Assignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findBySkuMock.mockResolvedValue(null);
    findBySlugMock.mockResolvedValue(null);
    vi.spyOn(ProductService, "checkSkuAvailability").mockResolvedValue({ available: true });
    vi.spyOn(ProductService, "checkSlugAvailability").mockResolvedValue({ available: true });
    createMock.mockImplementation(async (payload) => ({
      _id: "6b1111111111111111111111",
      ...payload,
    }));
    updateMock.mockImplementation(async (_id, payload) => ({
      _id,
      ...payload,
    }));
  });

  it("preserves exact admin category without guessing extra categories from product name or adding parent categories", async () => {
    categoryFindMock.mockReturnValue(
      makeExecChain([
        {
          _id: SMART_DISPLAY_ID,
          slug: "motorcycle-smart-display",
          parentId: GADGETS_ID,
        },
      ])
    );

    await ProductService.createProduct({
      name: "Chigee Handlebar Mount Kit Bluetooth Smart Display",
      sku: "CHIGEE-MOUNT-01",
      basePrice: 39999,
      categoryId: "motorcycle-smart-display",
      categorySlugs: ["motorcycle-smart-display"],
      description: "Motorcycle smart display",
      qty: 5,
      stockStatus: 1,
    });

    const savedPayload = createMock.mock.calls[0][0];
    expect(savedPayload.categorySlugs).toEqual(["motorcycle-smart-display"]);
    expect(savedPayload.categorySlugs).not.toContain("gadgets");
    expect(savedPayload.categorySlugs).not.toContain("bike-phone-holders");
    expect(savedPayload.categorySlugs).not.toContain("communicators");
    expect(savedPayload.categorySlugs).not.toContain("motorcycle-accessories-online");
  });

  it("resolves a raw category ObjectId to its own slug without adding parent categories", async () => {
    categoryFindMock.mockReturnValue(
      makeExecChain([
        {
          _id: SMART_DISPLAY_ID,
          slug: "motorcycle-smart-display",
          parentId: GADGETS_ID,
        },
      ])
    );

    const created = await ProductService.createProduct({
      name: "Carpuride W603B",
      sku: "CARP-W603B",
      basePrice: 29999,
      categoryId: SMART_DISPLAY_ID,
      categorySlugs: [SMART_DISPLAY_ID],
      description: "Motorcycle smart display",
      qty: 5,
      stockStatus: 1,
    });

    const savedPayload = createMock.mock.calls[0][0];
    expect(savedPayload.categorySlugs).toEqual(["motorcycle-smart-display"]);
    expect(savedPayload.categorySlugs).not.toContain("gadgets");
    expect(savedPayload.categorySlugs).not.toContain(SMART_DISPLAY_ID);
    expect(created.categoryId).toBe(SMART_DISPLAY_ID);
  });

  it("updates to exact admin-selected category without preserving stale old categories or re-adding magento tags", async () => {
    findByIdMock.mockResolvedValue({
      _id: "6b2222222222222222222222",
      name: "Beast T-Shirt",
      slug: "beast-t-shirt",
      sku: "AS-T-BEAS",
      magentoCategories: "Root Test 01/Gadgets/Action Cameras/Camera Accessories",
      categoryId: "old-cat",
      categorySlugs: ["action-cameras", "merchandise"],
    });
    categoryFindMock.mockReturnValue(
      makeExecChain([
        {
          _id: "6b3333333333333333333333",
          slug: "merchandise",
        },
      ])
    );

    await ProductService.updateProduct("6b2222222222222222222222", {
      categorySlugs: ["merchandise"],
    });

    const updatedPayload = updateMock.mock.calls[0][1];
    expect(updatedPayload.categorySlugs).toEqual(["merchandise"]);
    expect(updatedPayload.categorySlugs).not.toContain("action-cameras");
    expect(updatedPayload.categorySlugs).not.toContain("old-cat");
  });

  it("does not overwrite existing categories when updating only product name", async () => {
    findByIdMock.mockResolvedValue({
      _id: "6b2222222222222222222222",
      name: "Carpuride W603B",
      slug: "carpuride-w603b",
      sku: "CARP-W603B",
      categoryId: "motorcycle-smart-display",
      categorySlugs: ["motorcycle-smart-display"],
    });

    await ProductService.updateProduct("6b2222222222222222222222", {
      name: "Carpuride W603B Handlebar Mount Edition",
    });

    const updatedPayload = updateMock.mock.calls[0][1];
    expect(updatedPayload.categorySlugs).toBeUndefined();
  });

  it("keeps all 2-3 admin-selected categories intact on create and update", async () => {
    categoryFindMock.mockReturnValue(
      makeExecChain([
        { _id: SMART_DISPLAY_ID, slug: "motorcycle-smart-display" },
        { _id: GADGETS_ID, slug: "gadgets" },
      ])
    );

    const selected = ["motorcycle-smart-display", "gadgets", "touring-gear"];
    await ProductService.createProduct({
      name: "Multi-Category Smart Display",
      sku: "MULTI-CAT-01",
      basePrice: 15000,
      categoryId: "motorcycle-smart-display",
      categorySlugs: selected,
      description: "Multi category item",
      qty: 10,
      stockStatus: 1,
    });

    const savedPayload = createMock.mock.calls[0][0];
    expect(savedPayload.categorySlugs).toEqual(selected);
  });

  it("preserves legacy magentoCategories mapping when no explicit admin category is provided", async () => {
    categoryFindMock.mockReturnValue(
      makeExecChain([{ _id: "6af1852c8ce2a255f3ce79f3", slug: "rally-tower-navigation-tower" }])
    );

    await ProductService.createProduct({
      name: "K3G Adventure Tower",
      sku: "K3G-LEGACY-01",
      basePrice: 14999,
      magentoCategories: "Root Test 01/Motorcycle Accessories | Bike Accessories/Rally Tower \\/ Navigation Tower",
      description: "Legacy import item",
      qty: 5,
      stockStatus: 1,
    });

    const savedPayload = createMock.mock.calls[0][0];
    expect(savedPayload.categorySlugs).toContain("rally-tower");
    expect(savedPayload.categorySlugs).toContain("motorcycle-accessories-online");
  });
});

describe("ProductValidator Category Query Isolation & Rally Tower Alias", () => {
  const createMockReq = (url: string) =>
    ({
      nextUrl: new URL(url),
    }) as NextRequest;

  it("matches rally-tower-navigation-tower DB products when querying rally-tower", () => {
    const req = createMockReq("http://localhost/api/products?category=rally-tower");
    const result = ProductValidator.validateListQuery(req);
    const andConditions = (result.filters as any).$and;
    const catCond = andConditions.find(
      (cond: any) =>
        cond.$or &&
        cond.$or.some(
          (sub: any) =>
            sub.categorySlugs?.$in?.includes("rally-tower") &&
            sub.categorySlugs?.$in?.includes("rally-tower-navigation-tower")
        )
    );
    expect(catCond).toBeDefined();
  });

  it("does not cross-include motorcycle-smart-display or action-cameras under gadgets, or camera-accessories under action-cameras", () => {
    const gadgetsReq = createMockReq("http://localhost/api/products?category=gadgets");
    const gadgetsResult = ProductValidator.validateListQuery(gadgetsReq);
    const gadgetsCatCond = (gadgetsResult.filters as any).$and.find(
      (cond: any) => cond.$or && cond.$or.some((sub: any) => sub.categorySlugs?.$in)
    );
    const gadgetsSearchSlugs: string[] = gadgetsCatCond.$or[0].categorySlugs.$in;
    expect(gadgetsSearchSlugs).not.toContain("motorcycle-smart-display");
    expect(gadgetsSearchSlugs).not.toContain("action-cameras");
    expect(gadgetsSearchSlugs).not.toContain("camera-accessories");

    const actionCamReq = createMockReq("http://localhost/api/products?category=action-cameras");
    const actionCamResult = ProductValidator.validateListQuery(actionCamReq);
    const actionCamCatCond = (actionCamResult.filters as any).$and.find(
      (cond: any) => cond.$or && cond.$or.some((sub: any) => sub.categorySlugs?.$in)
    );
    const actionCamSearchSlugs: string[] = actionCamCatCond.$or[0].categorySlugs.$in;
    expect(actionCamSearchSlugs).toContain("action-cameras");
    expect(actionCamSearchSlugs).not.toContain("camera-accessories");
  });

  it("excludes exhausts from performance-parts/spares, intercoms from bike-phone-holders, and T-shirts from action-cameras", () => {
    const perfReq = createMockReq("http://localhost/api/products?category=performance-parts");
    const perfAnd = (ProductValidator.validateListQuery(perfReq).filters as any).$and;
    const perfExcludes = perfAnd.filter((c: any) => c.name?.$not || c.magentoCategories?.$not);
    expect(perfExcludes.length).toBeGreaterThanOrEqual(2);
    expect(perfExcludes.some((c: any) => c.name?.$not?.test("Red Rooster Stellar Exhaust"))).toBe(true);
    expect(perfExcludes.some((c: any) => c.name?.$not?.test("FuelX Pro+"))).toBe(false);

    const holderReq = createMockReq("http://localhost/api/products?category=bike-phone-holders");
    const holderAnd = (ProductValidator.validateListQuery(holderReq).filters as any).$and;
    const holderExcludes = holderAnd.filter((c: any) => c.name?.$not || c.magentoCategories?.$not);
    expect(holderExcludes.some((c: any) => c.name?.$not?.test("BluArmor C50Pro Bluetooth Communicator"))).toBe(true);
    expect(holderExcludes.some((c: any) => c.name?.$not?.test("Beast T-Shirt"))).toBe(true);
    expect(holderExcludes.some((c: any) => c.name?.$not?.test("Bobogear Claw Grip Bike Mobile Holder"))).toBe(false);

    const camReq = createMockReq("http://localhost/api/products?category=action-cameras");
    const camAnd = (ProductValidator.validateListQuery(camReq).filters as any).$and;
    const camExcludes = camAnd.filter((c: any) => c.name?.$not || c.magentoCategories?.$not);
    expect(camExcludes.some((c: any) => c.name?.$not?.test("Beast T-Shirt"))).toBe(true);
    expect(camExcludes.some((c: any) => c.name?.$not?.test("Qubo Bike Cam Pro"))).toBe(false);
  });
});
