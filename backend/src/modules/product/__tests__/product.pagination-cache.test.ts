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
});
