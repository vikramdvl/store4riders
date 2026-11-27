import { describe, it, expect, vi, beforeEach } from "vitest";
import { MigrationService } from "../migration.service";
import { ProductRepository } from "../../product/product.repository";

vi.mock("../../product/product.repository", () => ({
  ProductRepository: {
    findMigrationPreviewCandidates: vi.fn(),
  },
}));

describe("MigrationService.previewCsvMigration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("streams BOM CSV buffer, extracts parent/child/rename SKUs, and builds dry-run preview without DB writes", async () => {
    vi.mocked(ProductRepository.findMigrationPreviewCandidates).mockResolvedValue({
      existingRoots: [
        { sku: "OLD-HELMET", name: "Existing Helmet", basePrice: 4500, qty: 4, status: "published" },
      ],
      existingVariantParents: [],
    });

    const csvContent = [
      "\ufeffsku,old_sku,name,product_type,price,qty,weight,configurable_variations",
      'NEW-HELMET,OLD-HELMET,"",simple,,12,1.6,""',
      'CONF-JACKET,,"Alpine Jacket",configurable,0,,"","sku=CONF-BLK-M,color=Black,size=M,price=6999,qty=4"',
    ].join("\n");

    const report = await MigrationService.previewCsvMigration({
      buffer: Buffer.from(csvContent, "utf-8"),
    });

    expect(ProductRepository.findMigrationPreviewCandidates).toHaveBeenCalledTimes(1);
    const queriedSkus = vi.mocked(ProductRepository.findMigrationPreviewCandidates).mock.calls[0][0];
    expect(queriedSkus).toEqual(
      expect.arrayContaining(["NEW-HELMET", "OLD-HELMET", "CONF-JACKET", "CONF-BLK-M"])
    );

    expect(report.summary.updateCount).toBe(1);
    expect(report.summary.createCount).toBe(1);
    expect(report.summary.skipCount).toBe(0);
    expect(report.rows.find((r) => r.sku === "NEW-HELMET")?.changes).toEqual(
      expect.arrayContaining(["sku: OLD-HELMET → NEW-HELMET", "qty: 4 → 12"])
    );
  });

  it("rejects empty buffers and path-traversal S3 keys", async () => {
    await expect(
      MigrationService.previewCsvMigration({ buffer: Buffer.from("", "utf-8") })
    ).rejects.toThrow("empty");

    await expect(
      MigrationService.previewCsvMigration({ s3Key: "migrations/../secrets.csv" })
    ).rejects.toThrow("Invalid migration S3 key");

    await expect(MigrationService.previewCsvMigration({})).rejects.toThrow(
      "Either CSV file or s3Key must be provided"
    );
  });
});
