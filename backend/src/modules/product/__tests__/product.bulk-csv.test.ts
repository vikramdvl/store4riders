import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductService } from "../product.service";
import { ProductRepository } from "../product.repository";

const mockUpdateBySku = vi.fn();

vi.mock("../../../core/database/transaction", () => ({
  supportsTransactions: vi.fn().mockResolvedValue(false),
}));

vi.mock("../../../core/search/meilisearch", () => ({
  indexProduct: vi.fn().mockResolvedValue(undefined),
  removeProductFromIndex: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../core/cache/redis", () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  deleteCache: vi.fn().mockResolvedValue(undefined),
  clearProductCaches: vi.fn().mockResolvedValue(undefined),
}));

describe("ProductService.bulkUpdateFromCsv - Partial CSV Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(ProductRepository, "updateBySku").mockImplementation(mockUpdateBySku);
    mockUpdateBySku.mockResolvedValue({
      _id: "prod_1",
      sku: "AXOR-APEX-M",
      slug: "axor-apex-m",
      name: "Axor Apex M",
    });
  });

  it("updates ONLY qty and stockStatus when CSV contains sku + qty (no unwanted dimensionUnit or blank fields)", async () => {
    const csv = "sku,qty\nAXOR-APEX-M,18";

    const report = await ProductService.bulkUpdateFromCsv(csv);

    expect(report.successCount).toBe(1);
    expect(report.errorRows).toEqual([]);
    expect(mockUpdateBySku).toHaveBeenCalledTimes(1);

    const [calledSku, updatePayload] = mockUpdateBySku.mock.calls[0];
    expect(calledSku).toBe("AXOR-APEX-M");
    expect(updatePayload).toEqual({
      qty: 18,
      stockStatus: 1,
    });
    expect(updatePayload).not.toHaveProperty("dimensionUnit");
    expect(updatePayload).not.toHaveProperty("weightUnit");
    expect(updatePayload).not.toHaveProperty("name");
    expect(updatePayload).not.toHaveProperty("basePrice");
  });

  it("handles blank/whitespace cells and unit-suffixed weights ('500g') without wiping relatedSkus or setting NaN", async () => {
    const csv = [
      "sku,name,price,special_price,weight,related_skus,status,length,breadth,height",
      "AXOR-APEX-M,   ,,   ,500g,   ,,, , ",
    ].join("\n");

    const report = await ProductService.bulkUpdateFromCsv(csv);

    expect(report.successCount).toBe(1);
    expect(mockUpdateBySku).toHaveBeenCalledTimes(1);

    const [, updatePayload] = mockUpdateBySku.mock.calls[0];
    expect(updatePayload).toEqual({
      weight: 0.5,
      weightUnit: "kg",
    });
    expect(updatePayload).not.toHaveProperty("relatedSkus");
    expect(updatePayload).not.toHaveProperty("status");
    expect(updatePayload).not.toHaveProperty("dimensionUnit");
  });

  it("parses formatted prices, thousand-separated qty, and lbh combined column accurately", async () => {
    const csv = 'sku,price,qty,lbh,is_in_stock\nAXOR-APEX-M,"₹4,999","1,200",36x28x28,1';

    const report = await ProductService.bulkUpdateFromCsv(csv);

    expect(report.successCount).toBe(1);
    const [, updatePayload] = mockUpdateBySku.mock.calls[0];
    expect(updatePayload).toEqual({
      basePrice: 4999,
      qty: 1200,
      stockStatus: 1,
      length: 36,
      breadth: 28,
      height: 28,
      dimensionUnit: "cm",
    });
  });

  it("ignores garbage values (#N/A, non-numeric weights/prices, invalid dates) instead of corrupting MongoDB", async () => {
    const csv = [
      "sku,price,special_price,weight,qty,special_from_date",
      "AXOR-APEX-M,#N/A,TBD,invalid,not-a-num,bad-date",
    ].join("\n");

    const report = await ProductService.bulkUpdateFromCsv(csv);

    expect(report.successCount).toBe(1);
    const [, updatePayload] = mockUpdateBySku.mock.calls[0];
    expect(updatePayload).toEqual({});
  });

  it("falls back to current sku when legacy old_sku metadata column contains a non-matching historical SKU", async () => {
    mockUpdateBySku
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: "prod_1",
        sku: "AXOR-APEX-M",
        slug: "axor-apex-m",
        name: "Axor Apex M",
      });

    const csv = "sku,old_sku,qty\nAXOR-APEX-M,LEGACY-2018-SKU,14";
    const report = await ProductService.bulkUpdateFromCsv(csv);

    expect(report.successCount).toBe(1);
    expect(report.errorRows).toEqual([]);
    expect(mockUpdateBySku).toHaveBeenCalledTimes(2);
    expect(mockUpdateBySku.mock.calls[0][0]).toBe("LEGACY-2018-SKU");
    expect(mockUpdateBySku.mock.calls[1]).toEqual([
      "AXOR-APEX-M",
      { qty: 14, stockStatus: 1 },
      null,
    ]);
  });
});
