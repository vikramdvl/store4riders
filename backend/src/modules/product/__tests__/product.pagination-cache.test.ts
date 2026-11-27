import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductService } from "../product.service";
import { ProductRepository } from "../product.repository";
import { clearProductCaches } from "../../../core/cache/redis";

describe("ProductService.getProducts pagination caching", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearProductCaches();
  });

  it("reuses cached totalCount across page changes for identical filters", async () => {
    const findAllSpy = vi
      .spyOn(ProductRepository, "findAll")
      .mockResolvedValue([{ _id: "prod-1", name: "Helmet" }] as any);
    const countSpy = vi.spyOn(ProductRepository, "count").mockResolvedValue(25);

    const filters = { status: { $nin: ["draft", "archived"] }, categorySlugs: { $in: ["helmets"] } };
    const sort = { isFeatured: -1 as const, createdAt: -1 as const, _id: -1 as const };

    const page1 = await ProductService.getProducts(filters, 1, 12, sort);
    expect(page1.totalCount).toBe(25);
    expect(countSpy).toHaveBeenCalledTimes(1);
    expect(findAllSpy).toHaveBeenCalledTimes(1);

    const page2 = await ProductService.getProducts(filters, 2, 12, sort);
    expect(page2.totalCount).toBe(25);
    expect(findAllSpy).toHaveBeenCalledTimes(2);
    expect(countSpy).toHaveBeenCalledTimes(1);
  });

  it("bypasses server cache cleanly for live admin searches after CSV imports or mutations", async () => {
    const findAllSpy = vi
      .spyOn(ProductRepository, "findAll")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ _id: "prod-new", sku: "S4R-NEW-1", name: "New CSV Helmet" }] as any);
    const countSpy = vi
      .spyOn(ProductRepository, "count")
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    const adminFilter = { sku: /S4R-NEW-1/i };
    const sort = { isFeatured: -1 as const, createdAt: -1 as const, _id: -1 as const };

    const firstLookup = await ProductService.getProducts(adminFilter, 1, 20, sort, { bypassCache: true });
    expect(firstLookup.totalCount).toBe(0);

    const secondLookup = await ProductService.getProducts(adminFilter, 1, 20, sort, { bypassCache: true });
    expect(secondLookup.totalCount).toBe(1);
    expect(secondLookup.items[0].sku).toBe("S4R-NEW-1");
    expect(findAllSpy).toHaveBeenCalledTimes(2);
    expect(countSpy).toHaveBeenCalledTimes(2);
  });
});
