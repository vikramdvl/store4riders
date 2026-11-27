import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "stream";

const {
  mockBulkWrite,
  mockProductUpdateOne,
  mockProductFind,
  mockProductFindOne,
  mockBrandFindOneAndUpdate,
  mockCategoryFindOne,
  mockCategoryFindOneAndUpdate,
  mockIndexProduct,
  mockClearProductCaches,
  mockGetS3Stream,
} = vi.hoisted(() => ({
  mockBulkWrite: vi.fn(),
  mockProductUpdateOne: vi.fn(),
  mockProductFind: vi.fn(),
  mockProductFindOne: vi.fn(),
  mockBrandFindOneAndUpdate: vi.fn(),
  mockCategoryFindOne: vi.fn(),
  mockCategoryFindOneAndUpdate: vi.fn(),
  mockIndexProduct: vi.fn(),
  mockClearProductCaches: vi.fn(),
  mockGetS3Stream: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
  Job: vi.fn(),
}));

vi.mock("../../../core/queue/redis-connection", () => ({
  createWorkerRedisConnection: vi.fn(() => ({})),
}));

vi.mock("../../../core/database/connection", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../core/storage/s3", () => ({
  getS3Stream: mockGetS3Stream,
}));

vi.mock("../../../core/search/meilisearch", () => ({
  indexProduct: mockIndexProduct,
}));

vi.mock("../../../core/cache/redis", () => ({
  clearProductCaches: mockClearProductCaches,
}));

vi.mock("../../brand/brand.model", () => ({
  BrandModel: {
    findOneAndUpdate: mockBrandFindOneAndUpdate,
  },
}));

vi.mock("../../category/category.model", () => ({
  CategoryModel: {
    findOne: mockCategoryFindOne,
    findOneAndUpdate: mockCategoryFindOneAndUpdate,
  },
}));

vi.mock("../../product/product.model", () => ({
  ProductModel: {
    find: mockProductFind,
    findOne: mockProductFindOne,
    bulkWrite: mockBulkWrite,
    updateOne: mockProductUpdateOne,
  },
}));

import { processMigrationJob } from "../../../core/queue/migration.worker";

function makeQueryMock(result: any) {
  const q: any = {
    select: vi.fn(() => q),
    lean: vi.fn(() => q),
    exec: vi.fn().mockResolvedValue(result),
    then: (resolve: (val: any) => any, reject?: (err: any) => any) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

describe("processMigrationJob - Full End-to-End CSV Worker Regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIndexProduct.mockResolvedValue(undefined);
    mockClearProductCaches.mockResolvedValue(undefined);
    mockProductUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockCategoryFindOne.mockImplementation(() => makeQueryMock(null));
    mockCategoryFindOneAndUpdate.mockImplementation(({ $setOnInsert }: any) =>
      makeQueryMock({ _id: `cat_${$setOnInsert.slug}`, slug: $setOnInsert.slug })
    );
    mockBrandFindOneAndUpdate.mockImplementation(({ slug }: any, { $set }: any) =>
      makeQueryMock({ _id: `brand_${slug}`, slug, name: $set.name })
    );
  });

  it("handles duplicate CSV rows, DB partial patches, old_sku renames, slug collisions, variants, and Pass 4 parent sync safely", async () => {
    const csvContent = [
      "\ufeffsku,old_sku,name,product_type,price,qty,weight,length,breadth,height,brand,status,parent_sku,configurable_variations",
      // 1. Existing product matched case-insensitively with partial qty only (status column blank)
      "exist-db,,   ,simple,,9,,,,,,,,",
      // 2. Rename old SKU -> new SKU
      "SKU-RENAME-NEW,SKU-RENAME-OLD,,simple,2999,5,1.2,30,20,10,,1,,",
      // 3. Same-CSV duplicate SKU in different casing (merges weight/qty from row 2 without wiping name/price from row 1)
      'dup-1,,"Steel Riding Guard",simple,1800,,,,,,,1,,',
      "DUP-1,,,, ,12,500g,32,22,12,Honda,1,,",
      // 4. Slug collisions: NEW-AXOR collides with existing DB slug; GLOVE-1 & GLOVE-2 share name
      'NEW-AXOR,,"Axor Apex",simple,4999,4,,,,,,"1",,',
      'GLOVE-1,,"Same Riding Glove",simple,2499,6,,,,,,"1",,',
      'GLOVE-2,,"Same Riding Glove",simple,2499,7,,,,,,"1",,',
      // 5. New configurable parent with basePrice 0 + inline configurable_variations
      'CONF-NEW,,"Touring Boot",configurable,0,,,,,,,,,"sku=CONF-NEW-42,color=Black,size=42,price=8500,qty=3|sku=CONF-NEW-43,color=Black,size=43,price=8900,qty=2"',
      // 6. Child-only direct variant update (in -> cm conversion on existing DB variant)
      "VAR-CHILD-BLK-M,,,,,,1600g,36,,,,,",
      // 7. Brand new child variant attached via parent_sku under existing DB parent
      "NEW-CHILD-RED-L,,,,6200,8,1.5,40,30,14,,,PAR-JACKET,",
      // 8. Garbage rows rejected safely
      "BAD-ZERO,,Broken Free Product,simple,0,5,,,,,,1,,",
      "BAD-NA,,#N/A,simple,999,5,,,,,,1,,",
    ].join("\n");

    mockGetS3Stream.mockResolvedValue(Readable.from(Buffer.from(csvContent, "utf-8")));

    const dbProductsBySku: Record<string, any> = {
      "EXIST-DB": {
        _id: "db_exist_1",
        sku: "EXIST-DB",
        name: "Protected Helmet Name",
        slug: "protected-helmet-name",
        basePrice: 5000,
        qty: 2,
        status: "published",
        images: [{ id: "img1", url: "https://cdn.example.com/exist.webp", altText: "Exist" }],
        attributes: { shell: "Polycarbonate" },
      },
      "SKU-RENAME-OLD": {
        _id: "db_old_1",
        sku: "SKU-RENAME-OLD",
        name: "Renamed Product",
        slug: "renamed-product",
        basePrice: 2500,
        status: "published",
      },
      "PAR-JACKET": {
        _id: "db_par_jkt",
        sku: "PAR-JACKET",
        name: "Touring Jacket",
        slug: "touring-jacket",
        basePrice: 0,
        status: "published",
        variants: [
          {
            id: "v_blk_m",
            sku: "VAR-CHILD-BLK-M",
            price: 6000,
            stock: 4,
            length: 14,
            breadth: 10,
            height: 6,
            dimensionUnit: "in",
            attributes: { color: "Black", size: "M" },
          },
        ],
      },
    };

    mockProductFind.mockImplementation((query: any) => {
      if (query?.sku?.$in) {
        const list = query.sku.$in as any[];
        const matched = Object.values(dbProductsBySku).filter((doc) =>
          list.some((item) =>
            item instanceof RegExp ? item.test(doc.sku) : String(item).toLowerCase() === doc.sku.toLowerCase()
          )
        );
        return makeQueryMock(matched);
      }
      if (query?.["variants.sku"]?.$in) {
        return makeQueryMock([dbProductsBySku["PAR-JACKET"]]);
      }
      if (query?.slug?.$in) {
        return makeQueryMock([{ slug: "axor-apex" }]);
      }
      return makeQueryMock([]);
    });

    mockProductFindOne.mockImplementation(({ sku }: any) => {
      if (sku === "PAR-JACKET") {
        return makeQueryMock({
          ...dbProductsBySku["PAR-JACKET"],
          variants: [
            { ...dbProductsBySku["PAR-JACKET"].variants[0], stock: 4, price: 6000, status: "enabled" },
            { id: "v_new", sku: "NEW-CHILD-RED-L", stock: 8, price: 6200, status: "enabled" },
          ],
        });
      }
      return makeQueryMock(null);
    });

    mockBulkWrite.mockImplementation(async (ops: any[]) => ({
      upsertedCount: ops.filter((o) => o.updateOne.upsert === true).length,
      modifiedCount: ops.filter((o) => o.updateOne.upsert === false).length,
      matchedCount: ops.filter((o) => o.updateOne.upsert === false).length,
    }));

    const result = await processMigrationJob({
      id: "job-reg-1",
      data: { s3Key: "migrations/test.csv", adminId: "admin_1" },
      updateProgress: vi.fn().mockResolvedValue(undefined),
    } as any);

    // Inspect counts accurately
    expect(result.success).toBe(true);
    expect(result.createdProductsCount).toBe(5); // DUP-1, NEW-AXOR, GLOVE-1, GLOVE-2, CONF-NEW
    expect(result.updatedProductsCount).toBe(2); // EXIST-DB, SKU-RENAME-OLD
    expect(result.updatedVariantsCount).toBe(2); // VAR-CHILD-BLK-M update + NEW-CHILD-RED-L push
    expect(result.skippedGarbageCount).toBe(2); // BAD-ZERO, BAD-NA
    expect(result.failCount).toBe(0);

    // Verify bulkWrite operations
    expect(mockBulkWrite).toHaveBeenCalledTimes(1);
    const ops = mockBulkWrite.mock.calls[0][0] as any[];

    // 1. EXIST-DB partial update never wipes name/slug/images/attributes and sets upsert: false
    const existOp = ops.find((o) => o.updateOne.filter._id === "db_exist_1");
    expect(existOp.updateOne.upsert).toBe(false);
    expect(existOp.updateOne.update.$set).toEqual({ qty: 9, stockStatus: 1 });

    // 2. old_sku rename updates canonical SKU safely with upsert: false
    const renameOp = ops.find((o) => o.updateOne.filter._id === "db_old_1");
    expect(renameOp.updateOne.upsert).toBe(false);
    expect(renameOp.updateOne.update.$set.sku).toBe("SKU-RENAME-NEW");

    // 3. Within-CSV duplicate DUP-1 merged into single insertOne/upsert:true without duplicating
    const dupOps = ops.filter((o) => String(o.updateOne.filter.sku || "").toLowerCase() === "dup-1");
    expect(dupOps).toHaveLength(1);
    expect(dupOps[0].updateOne.update.$set).toMatchObject({
      sku: "DUP-1",
      name: "Steel Riding Guard",
      basePrice: 1800,
      qty: 12,
      weight: 0.5,
      weightUnit: "kg",
      length: 32,
      breadth: 22,
      height: 12,
      brand: "Honda",
      brandId: "brand_moto-fusion",
    });

    // 4. Slug collisions resolved deterministically
    const newAxorOp = ops.find((o) => o.updateOne.filter.sku === "NEW-AXOR");
    expect(newAxorOp.updateOne.update.$set.slug).toBe("axor-apex-new-axor");
    const glove1Op = ops.find((o) => o.updateOne.filter.sku === "GLOVE-1");
    const glove2Op = ops.find((o) => o.updateOne.filter.sku === "GLOVE-2");
    expect(glove1Op.updateOne.update.$set.slug).toBe("same-riding-glove");
    expect(glove2Op.updateOne.update.$set.slug).toBe("same-riding-glove-glove-2");

    // 5. Configurable inherits min variant price (8500) + generates variant UUIDs
    const confOp = ops.find((o) => o.updateOne.filter.sku === "CONF-NEW");
    expect(confOp.updateOne.update.$set.basePrice).toBe(8500);
    expect(confOp.updateOne.update.$set.variants).toHaveLength(2);
    expect(confOp.updateOne.update.$set.countryOfManufacture).toBe("India");

    // 6. Child-only direct variant update converted inches -> cm for omitted axes
    const directVarCall = mockProductUpdateOne.mock.calls.find(
      ([filter]) => filter["variants.sku"] === "VAR-CHILD-BLK-M"
    );
    expect(directVarCall).toBeDefined();
    expect(directVarCall![1].$set).toMatchObject({
      "variants.$.weight": 1.6,
      "variants.$.weightUnit": "kg",
      "variants.$.length": 36,
      "variants.$.breadth": 25.4,
      "variants.$.height": 15.2,
      "variants.$.dimensionUnit": "cm",
    });

    // 7. Brand-new child pushed safely with $ne duplicate guard
    const pushChildCall = mockProductUpdateOne.mock.calls.find(
      ([filter]) => filter._id === "db_par_jkt" && filter["variants.sku"]?.$ne === "NEW-CHILD-RED-L"
    );
    expect(pushChildCall).toBeDefined();
    expect(pushChildCall![1].$push.variants).toMatchObject({
      sku: "NEW-CHILD-RED-L",
      price: 6200,
      stock: 8,
      weight: 1.5,
      length: 40,
      breadth: 30,
      height: 14,
      dimensionUnit: "cm",
    });

    // 8. Pass 4 recalculated parent qty (4 + 8 = 12) & min basePrice (6000)
    const pass4Call = mockProductUpdateOne.mock.calls.find(
      ([filter, update]) => filter._id === "db_par_jkt" && update?.$set?.qty === 12
    );
    expect(pass4Call).toBeDefined();
    expect(pass4Call![1].$set).toEqual({
      qty: 12,
      stockStatus: 1,
      basePrice: 6000,
    });

    expect(mockClearProductCaches).toHaveBeenCalledTimes(1);
    // Verify Meilisearch indexing receives full doc (including status) for published items
    expect(mockIndexProduct).toHaveBeenCalled();
    expect(mockIndexProduct.mock.calls[0][0]).toHaveProperty("status", "published");
    expect(mockIndexProduct.mock.calls[0][0]).toHaveProperty("sku");
  });

  it("handles mixed-unit combined lbh, additional_attributes child updates, and isolates batch failures gracefully", async () => {
    const csvContent = [
      "sku,lbh,weight,status,additional_attributes",
      'CONF-CH-L,12x8x4in,500g,0,"color=Stealth.Grey,size=XL"',
      "SIMPLE-1,300x200x100mm,1.8kg,0,",
    ].join("\n");

    mockGetS3Stream.mockResolvedValue(Readable.from(Buffer.from(csvContent, "utf-8")));

    const simpleExisting = {
      _id: "db_simple_1",
      sku: "SIMPLE-1",
      name: "Published Gear Bag",
      slug: "published-gear-bag",
      status: "published",
    };

    const parentExisting = {
      _id: "db_par_2",
      sku: "PAR-HELMET",
      name: "Helmet",
      variants: [
        { id: "v_ch", sku: "CONF-CH-L", price: 5000, stock: 5, attributes: { color: "Black", size: "L" } },
      ],
    };

    mockProductFind.mockImplementation((query: any) => {
      if (query?.sku?.$in) return makeQueryMock([simpleExisting]);
      if (query?.["variants.sku"]?.$in) return makeQueryMock([parentExisting]);
      return makeQueryMock([]);
    });

    mockProductFindOne.mockImplementation(() => makeQueryMock(parentExisting));

    // Simulate Mongo batch write failure to confirm clean error collection without worker crash
    mockBulkWrite.mockRejectedValueOnce(new Error("Simulated Mongo transient write timeout"));

    const result = await processMigrationJob({
      id: "job-reg-2",
      data: { s3Key: "migrations/edge.csv", adminId: "admin_1" },
      updateProgress: vi.fn().mockResolvedValue(undefined),
    } as any);

    expect(result.success).toBe(true);
    expect(result.updatedVariantsCount).toBe(1);
    expect(result.failCount).toBe(1);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ batch: 0, error: "Simulated Mongo transient write timeout" }),
      ])
    );

    const directVarCall = mockProductUpdateOne.mock.calls.find(
      ([filter]) => filter["variants.sku"] === "CONF-CH-L"
    );
    expect(directVarCall).toBeDefined();
    expect(directVarCall![1].$set).toMatchObject({
      "variants.$.weight": 0.5,
      "variants.$.weightUnit": "kg",
      "variants.$.length": 30.5,
      "variants.$.breadth": 20.3,
      "variants.$.height": 10.2,
      "variants.$.dimensionUnit": "cm",
      "variants.$.attributes.color": "Stealth Grey",
      "variants.$.attributes.size": "XL",
    });
  });
});
