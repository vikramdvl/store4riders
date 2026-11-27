import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  findBySlugMock,
  findByIdMock,
  categoryFindMock,
  categoryFindOneMock,
  catRepoFindByIdMock,
  catRepoFindBySlugMock,
} = vi.hoisted(() => ({
  findBySlugMock: vi.fn(),
  findByIdMock: vi.fn(),
  categoryFindMock: vi.fn(),
  categoryFindOneMock: vi.fn(),
  catRepoFindByIdMock: vi.fn(),
  catRepoFindBySlugMock: vi.fn(),
}));

vi.mock("../product.repository", () => ({
  ProductRepository: {
    findBySlug: findBySlugMock,
    findById: findByIdMock,
  },
}));

vi.mock("../../category/category.model", () => ({
  CategoryModel: {
    find: categoryFindMock,
    findOne: categoryFindOneMock,
  },
}));

vi.mock("../../category/category.repository", () => ({
  CategoryRepository: {
    findById: catRepoFindByIdMock,
    findBySlug: catRepoFindBySlugMock,
  },
}));

vi.mock("../../brand/brand.service", () => ({
  BrandService: {
    getAllBrands: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../brand/brand.model", () => ({
  BrandModel: {
    findById: vi.fn().mockReturnValue({ lean: () => ({ exec: vi.fn().mockResolvedValue(null) }) }),
    findOne: vi.fn().mockReturnValue({ lean: () => ({ exec: vi.fn().mockResolvedValue(null) }) }),
  },
}));

vi.mock("../../../core/cache/redis", () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  deleteCache: vi.fn().mockResolvedValue(undefined),
  clearProductCaches: vi.fn().mockResolvedValue(undefined),
}));

import { ProductService } from "../product.service";

function makeExecChain(result: unknown) {
  return {
    lean: () => ({
      exec: vi.fn().mockResolvedValue(result),
    }),
  };
}

describe("ProductService.getProductBySlug — Category Specifications & Attributes Template", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    categoryFindOneMock.mockReturnValue(makeExecChain(null));
    catRepoFindByIdMock.mockResolvedValue(null);
    catRepoFindBySlugMock.mockResolvedValue(null);
  });

  it("resolves PDP specifications strictly from the category's specDefinitions template", async () => {
    findBySlugMock.mockResolvedValue({
      _id: "prod_dry_bag",
      name: "Rynox Expedition Dry Bag 2 - Stormproof - 15 ltr",
      slug: "rynox-expedition-dry-bag-2",
      sku: "RYN-DRY-BAG-2",
      categoryId: "motorcycle-bags-bike-luggage",
      categorySlugs: ["motorcycle-bags-bike-luggage"],
      basePrice: 1450,
      description: "<p>Dry bag description</p><ul><li>Compatibility: Universal</li></ul>",
      attributes: {
        suitable_for_tank: "No",
        convertible_in_backpack: "No",
        magnetic_non_magnetic: "Non Magnetic",
      },
      images: [],
      variants: [],
    });

    categoryFindMock.mockReturnValue(
      makeExecChain([
        {
          _id: "cat_luggage",
          name: "Motorcycle Bags / Bike Luggage",
          slug: "motorcycle-bags-bike-luggage",
          attributeSetCode: "Saddle Bag",
          specDefinitions: [
            { key: "capacity", label: "Luggage Volume / Capacity" },
            { key: "magnetic_non_magnetic", label: "Mounting System" },
            { key: "convertible_in_backpack", label: "Backpack / Shoulder Conversion" },
          ],
        },
      ])
    );

    const product = await ProductService.getProductBySlug("rynox-expedition-dry-bag-2");

    expect(product.categorySpecTemplate).toHaveLength(3);
    expect(product.specifications).toEqual([
      {
        key: "capacity",
        label: "Luggage Volume / Capacity",
        value: "15 Litres",
        isHighlight: false,
      },
      {
        key: "magnetic_non_magnetic",
        label: "Mounting System",
        value: "Non Magnetic",
        isHighlight: false,
      },
      {
        key: "convertible_in_backpack",
        label: "Backpack / Shoulder Conversion",
        value: "No",
        isHighlight: false,
      },
    ]);
    // Unconfigured attribute must NOT be auto-generated
    expect(product.specifications?.find((s) => s.key === "suitable_for_tank")).toBeUndefined();
  });

  it("extracts missing template specifications from product description & origin instead of showing only Country of Origin", async () => {
    findBySlugMock.mockResolvedValue({
      _id: "prod_dry_bag_minimal_attrs",
      name: "Rynox Expedition Dry Bag 2 - Stormproof - 15 ltr",
      slug: "rynox-expedition-dry-bag-2-minimal",
      sku: "RYN-DRY-BAG-MIN",
      categoryId: "other-luggage",
      categorySlugs: ["other-luggage"],
      basePrice: 1450,
      countryOfManufacture: "India",
      shortDescription: "<p>100% waterproof 15 ltr. capacity dry bag.</p>",
      description: "<p>Constructed from vinyl coated waterproof fabric with heat welded seams and roll-top closure.</p>",
      attributes: {
        condition: "New",
        country_of_origin: "India",
      },
      images: [],
      variants: [],
    });

    categoryFindMock.mockReturnValue(
      makeExecChain([
        {
          _id: "cat_other_luggage",
          name: "Other Luggage",
          slug: "other-luggage",
          attributeSetCode: "Default",
          specDefinitions: [
            { key: "material", label: "Material / Construction" },
            { key: "waterproof", label: "Water Resistance" },
            { key: "country_of_origin", label: "Country of Origin" },
            { key: "warranty", label: "Warranty Period" },
          ],
        },
      ])
    );

    const product = await ProductService.getProductBySlug("rynox-expedition-dry-bag-2-minimal");

    expect(product.specifications?.map((s) => ({ label: s.label, value: s.value }))).toEqual([
      { label: "Material / Construction", value: "Vinyl-Coated Waterproof Fabric" },
      { label: "Water Resistance", value: "100% Waterproof (Heat-Welded Seams)" },
      { label: "Country of Origin", value: "India" },
    ]);
  });

  it("inherits parent category specDefinitions when child category template is empty", async () => {
    findBySlugMock.mockResolvedValue({
      _id: "prod_dry_bag_child",
      name: "Dry Bag Child",
      slug: "dry-bag-child",
      sku: "DRY-CHILD",
      categoryId: "dry-bags",
      categorySlugs: ["dry-bags"],
      basePrice: 1500,
      description: "<p>Description</p>",
      attributes: {
        waterproof_rating: "IPX6 Seam Welded",
        suitable_for_tank: "No",
      },
      images: [],
      variants: [],
    });

    categoryFindMock.mockReturnValue(
      makeExecChain([
        {
          _id: "cat_dry_bags",
          name: "Dry Bags",
          slug: "dry-bags",
          parentId: "cat_luggage_parent",
          specDefinitions: [],
        },
      ])
    );

    categoryFindOneMock.mockReturnValue(
      makeExecChain({
        _id: "cat_luggage_parent",
        name: "Motorcycle Bags / Bike Luggage",
        slug: "motorcycle-bags-bike-luggage",
        specDefinitions: [
          { key: "waterproof_rating", label: "Waterproof Rating" },
        ],
      })
    );

    const product = await ProductService.getProductBySlug("dry-bag-child");

    expect(product.specifications).toEqual([
      {
        key: "waterproof_rating",
        label: "Waterproof Rating",
        value: "IPX6 Seam Welded",
        isHighlight: false,
      },
    ]);
  });
});
