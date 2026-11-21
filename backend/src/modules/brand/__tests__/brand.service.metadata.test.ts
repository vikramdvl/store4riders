import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrandService } from "../brand.service";
import { BrandRepository } from "../brand.repository";

describe("BrandService - Metadata and URL Resolution", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should resolve Axor Helmets metadata and return enriched data", async () => {
    vi.spyOn(BrandRepository, "findBySlug").mockResolvedValue(null);

    const brand = await BrandService.getBrandById("axor-helmets");
    expect(brand).toBeDefined();
    expect(brand.name).toBe("Axor Helmets");
    expect(brand.slug).toBe("axor-helmets");
    expect(brand.faqs?.length).toBe(8);
    expect(brand.metaTitle).toContain("Axor Helmets");
  });

  it("should resolve brand via aliases (e.g. rynox-gears -> rynox-gear)", async () => {
    vi.spyOn(BrandRepository, "findBySlug").mockResolvedValue(null);

    const brand = await BrandService.getBrandById("rynox-gears");
    expect(brand).toBeDefined();
    expect(brand.name).toBe("Rynox Gear");
    expect(brand.slug).toBe("rynox-gear");
    expect(brand.aliases).toContain("rynox-gears");
    expect(brand.faqs?.length).toBe(5);
  });

  it("should resolve brand via live URL slug (e.g. rolon-chain-sprocket-kits -> rolon)", async () => {
    vi.spyOn(BrandRepository, "findBySlug").mockResolvedValue(null);

    const brand = await BrandService.getBrandById("rolon-chain-sprocket-kits");
    expect(brand).toBeDefined();
    expect(brand.name).toBe("Rolon");
    expect(brand.slug).toBe("rolon");
    expect(brand.aliases).toContain("rolon-chain-sprocket-kits");
    expect(brand.faqs?.length).toBe(10);
  });

  it("should enrich existing database brand with missing description or faqs", async () => {
    vi.spyOn(BrandRepository, "findBySlug").mockResolvedValue({
      _id: "db-id-123",
      name: "SMK Helmets",
      slug: "smk-helmets",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const brand = await BrandService.getBrandById("smk-helmets");
    expect(brand).toBeDefined();
    expect(brand._id).toBe("db-id-123");
    expect(brand.description).toContain("European styling meets world-class manufacturing");
    expect(brand.faqs?.length).toBe(7);
  });

  it("should correctly handle missing brands stubs (e.g. sas-tec, shoerella)", async () => {
    vi.spyOn(BrandRepository, "findBySlug").mockResolvedValue(null);

    const sasTec = await BrandService.getBrandById("sas-tec");
    expect(sasTec).toBeDefined();
    expect(sasTec.name).toBe("SAS-TEC");
    expect(sasTec.faqs?.length).toBeGreaterThanOrEqual(1);

    const shoerella = await BrandService.getBrandById("shoerella");
    expect(shoerella).toBeDefined();
    expect(shoerella.name).toBe("Shoerella");
  });

  it("should resolve Parani (Engineered by Sena) and aliases like parani-m10", async () => {
    vi.spyOn(BrandRepository, "findBySlug").mockResolvedValue(null);

    const parani = await BrandService.getBrandById("parani");
    expect(parani).toBeDefined();
    expect(parani.name).toBe("Parani");
    expect(parani.slug).toBe("parani");
    expect(parani.faqs?.length).toBe(5);
    expect(parani.metaTitle).toContain("Parani");

    const paraniByAlias = await BrandService.getBrandById("parani-m10");
    expect(paraniByAlias).toBeDefined();
    expect(paraniByAlias.slug).toBe("parani");
  });
});
