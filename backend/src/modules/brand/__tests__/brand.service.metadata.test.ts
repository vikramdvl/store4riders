import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrandService } from "../brand.service";
import { BrandRepository } from "../brand.repository";
import { clearBrandCaches } from "../../../core/cache/redis";

describe("BrandService - Metadata and URL Resolution", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearBrandCaches();
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

  it("should return all catalog brands in getAllBrands even if DB has only a subset", async () => {
    vi.spyOn(BrandRepository, "findAll").mockResolvedValue([
      {
        _id: "db-1",
        name: "Custom Shop Brand",
        slug: "custom-shop-brand",
        isActive: true,
        showInMenu: "false" as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ]);

    const all = await BrandService.getAllBrands(true);
    expect(all.length).toBeGreaterThanOrEqual(60);

    // Custom shop brand normalized
    const custom = all.find((b) => b.slug === "custom-shop-brand");
    expect(custom).toBeDefined();
    expect(custom?.showInMenu).toBe(false);

    // Navbar brand default showInMenu true
    const axor = all.find((b) => b.slug === "axor-helmets");
    expect(axor).toBeDefined();
    expect(axor?.showInMenu).toBe(true);
    expect(axor?.menuGroup).toBe("Helmet Brands");

    // Non-navbar brand default showInMenu false
    const agv = all.find((b) => b.slug === "agv");
    expect(agv).toBeDefined();
    expect(agv?.showInMenu).toBe(false);

    const alpinestars = all.find((b) => b.slug === "alpinestars");
    expect(alpinestars).toBeDefined();
    expect(alpinestars?.showInMenu).toBe(false);
  });

  it("should filter out inactive brands when includeInactive is false", async () => {
    vi.spyOn(BrandRepository, "findAll").mockResolvedValue([
      {
        _id: "db-active",
        name: "Active Helmet Brand",
        slug: "active-helmet-brand",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
      {
        _id: "db-inactive",
        name: "Old Discontinued Brand",
        slug: "old-discontinued-brand",
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ]);

    const activeOnly = await BrandService.getAllBrands(false);
    expect(activeOnly.some((b) => b.slug === "old-discontinued-brand")).toBe(false);

    const allWithInactive = await BrandService.getAllBrands(true);
    expect(allWithInactive.some((b) => b.slug === "old-discontinued-brand")).toBe(true);
  });

  it("should create brand successfully via createBrand", async () => {
    const mockCreated = {
      _id: "new-brand-id",
      name: "Shark Helmets",
      slug: "shark-helmets",
      isActive: true,
      showInMenu: false,
    } as any;
    vi.spyOn(BrandRepository, "create").mockResolvedValue(mockCreated);

    const res = await BrandService.createBrand({
      name: "Shark Helmets",
      slug: "shark-helmets",
    });
    expect(res).toBeDefined();
    expect(res.name).toBe("Shark Helmets");
    expect(res.slug).toBe("shark-helmets");
  });

  it("should update brand and showInMenu status via updateBrand", async () => {
    const mockUpdated = {
      _id: "brand-123",
      name: "Axor Helmets",
      slug: "axor-helmets",
      showInMenu: false,
      isActive: true,
    } as any;
    vi.spyOn(BrandRepository, "findById").mockResolvedValue({
      _id: "brand-123",
      name: "Axor Helmets",
      slug: "axor-helmets",
    } as any);
    vi.spyOn(BrandRepository, "update").mockResolvedValue(mockUpdated);

    const res = await BrandService.updateBrand("brand-123", { showInMenu: false });
    expect(res).toBeDefined();
    expect(res.showInMenu).toBe(false);
  });

  it("should delete brand successfully via deleteBrand", async () => {
    const mockDeleted = {
      _id: "brand-del",
      name: "Delete Me",
      slug: "delete-me",
    } as any;
    vi.spyOn(BrandRepository, "findById").mockResolvedValue(null);
    vi.spyOn(BrandRepository, "findBySlug").mockResolvedValue(null);
    vi.spyOn(BrandRepository, "delete").mockResolvedValue(mockDeleted);

    const res = await BrandService.deleteBrand("brand-del");
    expect(res).toBeDefined();
    expect(res.slug).toBe("delete-me");
  });

  it("should tombstone deleted static/catalog brands (e.g. parani) so getAllBrands does not resurrect them and getBrandById throws NotFoundError", async () => {
    const tombstone = {
      _id: "db-parani",
      name: "Parani",
      slug: "parani",
      isDeleted: true,
      isActive: false,
      showInMenu: false,
      menuGroup: "",
      menuGroups: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    vi.spyOn(BrandRepository, "findById").mockResolvedValue({
      _id: "db-parani",
      name: "Parani",
      slug: "parani",
      isActive: true,
      showInMenu: true,
    } as any);
    vi.spyOn(BrandRepository, "update").mockResolvedValue(tombstone);

    const deleted = await BrandService.deleteBrand("db-parani");
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.isActive).toBe(false);
    expect(deleted.showInMenu).toBe(false);

    vi.spyOn(BrandRepository, "findAll").mockResolvedValue([tombstone]);
    const all = await BrandService.getAllBrands(true);
    expect(all.some((b) => b.slug === "parani")).toBe(false);

    vi.spyOn(BrandRepository, "findBySlug").mockResolvedValue(tombstone);
    await expect(BrandService.getBrandById("parani")).rejects.toThrow("Brand not found");
  });

  it("should preserve admin menu edits (hide from submenu or reassigned menuGroups) for default navbar brands", async () => {
    vi.spyOn(BrandRepository, "findAll").mockResolvedValue([
      {
        _id: "db-axor",
        name: "Axor Helmets",
        slug: "axor-helmets",
        isActive: true,
        showInMenu: false,
        menuGroup: "",
        menuGroups: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
      {
        _id: "db-smk",
        name: "SMK Helmets",
        slug: "smk-helmets",
        isActive: true,
        showInMenu: true,
        menuGroup: "Riding Gear",
        menuGroups: ["Riding Gear"],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ]);

    const all = await BrandService.getAllBrands(true);
    const axor = all.find((b) => b.slug === "axor-helmets");
    expect(axor?.showInMenu).toBe(false);
    expect(axor?.menuGroups).toEqual([]);
    expect(axor?.menuGroup).toBe("");

    const smk = all.find((b) => b.slug === "smk-helmets");
    expect(smk?.showInMenu).toBe(true);
    expect(smk?.menuGroups).toEqual(["Riding Gear"]);
    expect(smk?.menuGroup).toBe("Riding Gear");
  });

  it("should restore a previously deleted brand tombstone when re-created via createBrand", async () => {
    vi.spyOn(BrandRepository, "findBySlug").mockResolvedValue({
      _id: "db-parani",
      name: "Parani",
      slug: "parani",
      isDeleted: true,
      isActive: false,
      showInMenu: false,
    } as any);
    const updateSpy = vi.spyOn(BrandRepository, "update").mockResolvedValue({
      _id: "db-parani",
      name: "Parani",
      slug: "parani",
      isDeleted: false,
      isActive: true,
      showInMenu: true,
    } as any);

    const restored = await BrandService.createBrand({
      name: "Parani",
      slug: "parani",
      isActive: true,
      showInMenu: true,
    });
    expect(updateSpy).toHaveBeenCalledWith(
      "db-parani",
      expect.objectContaining({ slug: "parani", isDeleted: false })
    );
    expect(restored?.isDeleted).toBe(false);
  });

  it("should paginate brands correctly via getPaginatedBrands", async () => {
    vi.spyOn(BrandRepository, "findAll").mockResolvedValue([]);

    const page1 = await BrandService.getPaginatedBrands({ page: 1, limit: 10 });
    expect(page1.items.length).toBe(10);
    expect(page1.totalCount).toBeGreaterThanOrEqual(60);

    const page2 = await BrandService.getPaginatedBrands({ page: 2, limit: 10 });
    expect(page2.items.length).toBe(10);
    // Page 2 items should be different from Page 1
    expect(page1.items[0].slug).not.toBe(page2.items[0].slug);

    // Search filter
    const searchRes = await BrandService.getPaginatedBrands({ search: "Axor" });
    expect(searchRes.items.length).toBeGreaterThanOrEqual(1);
    expect(searchRes.items.some(b => b.name.includes("Axor"))).toBe(true);
  });
});
