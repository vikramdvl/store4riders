import mongoose from "mongoose";
import { BrandRepository } from "./brand.repository";
import { IBrand } from "@store4riders/shared-types";
import { ConflictError, NotFoundError } from "../../core/errors/AppError";
import { BRANDS_METADATA, BrandMetadataRecord } from "./data/brands-metadata";
import { getCache, setCache, clearBrandCaches } from "../../core/cache/redis";

const BRAND_CACHE_TTL = 3600; // 1 hour

/**
 * Authoritative set of brands and default sections in the storefront navigation megamenu.
 * Only these 31 brands default to showInMenu = true. All other catalog brands default to false.
 */
export const DEFAULT_NAV_BRAND_GROUPS: Record<string, string> = {
  "axor-helmets": "Helmet Brands",
  "smk-helmets": "Helmet Brands",
  "rynox-gear": "Riding Gear",
  "raida-gears": "Riding Gear",
  "furygan": "Riding Gear",
  "biking-brotherhood": "Riding Gear",
  "mototech-gear": "Riding Gear",
  "scala-gears": "Riding Gear",
  "invictus": "Riding Gear",
  "lone-ranger": "Riding Gear",
  "fly-racing": "Riding Gear",
  "forma-boots": "Boots & Protection",
  "falco": "Boots & Protection",
  "safe-tech-protectors": "Boots & Protection",
  "sas-tec": "Boots & Protection",
  "maddog": "Luggage & Accessories",
  "parani": "Luggage & Accessories",
  "moto-fusion": "Luggage & Accessories",
  "motospunk": "Luggage & Accessories",
  "quipco": "Luggage & Accessories",
  "shoerella": "Luggage & Accessories",
  "motul": "Parts & Performance",
  "k-n-bike-air-filter": "Parts & Performance",
  "bmc-air-filter": "Parts & Performance",
  "ngk-spark-plugs": "Parts & Performance",
  "rolon": "Parts & Performance",
  "barrel-exhaust": "Parts & Performance",
  "moto-torque": "Parts & Performance",
  "pro-spec-performance-parts": "Parts & Performance",
  "race-dynamics": "Parts & Performance",
  "carberry": "Parts & Performance",
};

export class BrandService {
  private static findStaticMetadata(slugOrAlias: string): BrandMetadataRecord | undefined {
    const clean = slugOrAlias.toLowerCase().trim();
    return BRANDS_METADATA.find(
      (b) =>
        b.slug.toLowerCase() === clean ||
        b.aliases.some((a) => a.toLowerCase() === clean) ||
        b.name.toLowerCase() === clean
    );
  }

  private static resolveMenuConfig(brand: Partial<IBrand>, meta?: BrandMetadataRecord) {
    const slugClean = (brand.slug || "").toLowerCase().trim();
    const hasExplicitMenuConfig = brand.showInMenu !== undefined && brand.showInMenu !== null;
    const showInMenu = hasExplicitMenuConfig
      ? brand.showInMenu === true || (brand.showInMenu as any) === "true" || (brand.showInMenu as any) === 1
      : DEFAULT_NAV_BRAND_GROUPS[slugClean] !== undefined;

    const explicitGroups = Array.isArray(brand.menuGroups)
      ? brand.menuGroups.filter((g) => typeof g === "string" && g.trim().length > 0)
      : [];
    const defaultGroup = DEFAULT_NAV_BRAND_GROUPS[slugClean] || meta?.menuGroup || "";
    const navGroup = hasExplicitMenuConfig
      ? explicitGroups[0] || brand.menuGroup || ""
      : explicitGroups[0] || brand.menuGroup || defaultGroup;
    const menuGroups = explicitGroups.length > 0 ? explicitGroups : navGroup ? [navGroup] : [];

    return { showInMenu, navGroup, menuGroups };
  }

  static async getAllBrands(includeInactive: boolean = false): Promise<IBrand[]> {
    const cacheKey = `brands_all_v5_${Boolean(includeInactive)}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached as IBrand[];

    // 1. Fetch ALL DB brands including deleted tombstones so deleted static/product brands never resurrect
    const allDbRecords = await BrandRepository.findAll(true, true);

    const existingSlugs = new Set<string>();
    const existingNames = new Set<string>();
    const enriched: IBrand[] = [];

    // 2. Normalize and enrich active/inactive DB brands, skipping deleted tombstones from output
    for (const b of allDbRecords) {
      const slugClean = (b.slug || "").toLowerCase().trim();
      const nameClean = (b.name || "").toLowerCase().trim();
      if (slugClean) existingSlugs.add(slugClean);
      if (nameClean) existingNames.add(nameClean);
      if (b.aliases && Array.isArray(b.aliases)) {
        b.aliases.forEach((a) => existingSlugs.add(a.toLowerCase().trim()));
      }

      if (b.isDeleted) {
        continue;
      }

      const meta = this.findStaticMetadata(b.slug) || (b.name ? this.findStaticMetadata(b.name) : undefined);
      const { showInMenu, navGroup, menuGroups } = this.resolveMenuConfig(b, meta);
      const resolvedLogo = b.logo || meta?.logo;

      enriched.push({
        ...b,
        logo: resolvedLogo,
        aliases: Array.from(new Set([...(b.aliases || []), ...(meta?.aliases || [])])),
        description: b.description || meta?.description,
        faqs: (b.faqs && b.faqs.length > 0) ? b.faqs : meta?.faqs,
        showInMenu,
        menuGroup: navGroup,
        menuGroups,
        metaTitle: b.metaTitle || meta?.metaTitle,
        metaDescription: b.metaDescription || meta?.metaDescription,
        metaKeywords: b.metaKeywords || meta?.metaKeywords,
      });
    }

    // 3. Find missing catalog brands from BRANDS_METADATA
    const missingToSeed: Partial<IBrand>[] = [];
    for (const meta of BRANDS_METADATA) {
      const sClean = meta.slug.toLowerCase().trim();
      const nClean = meta.name.toLowerCase().trim();
      const alreadyPresent =
        existingSlugs.has(sClean) ||
        existingNames.has(nClean) ||
        meta.aliases.some((a) => existingSlugs.has(a.toLowerCase().trim()));

      if (!alreadyPresent) {
        const inMenu = DEFAULT_NAV_BRAND_GROUPS[sClean] !== undefined;
        const navGroup = DEFAULT_NAV_BRAND_GROUPS[sClean] || meta.menuGroup || "";
        const item: IBrand = {
          _id: "brand-" + meta.slug,
          name: meta.name,
          slug: meta.slug,
          aliases: meta.aliases,
          logo: meta.logo,
          description: meta.description,
          faqs: meta.faqs,
          isActive: true,
          showInMenu: inMenu,
          menuGroup: navGroup,
          menuGroups: navGroup ? [navGroup] : [],
          metaTitle: meta.metaTitle,
          metaDescription: meta.metaDescription,
          metaKeywords: meta.metaKeywords,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        enriched.push(item);
        existingSlugs.add(sClean);
        existingNames.add(nClean);

        missingToSeed.push({
          name: meta.name,
          slug: meta.slug,
          aliases: meta.aliases,
          logo: meta.logo,
          description: meta.description,
          faqs: meta.faqs,
          isActive: true,
          showInMenu: inMenu,
          menuGroup: navGroup,
          menuGroups: navGroup ? [navGroup] : [],
          metaTitle: meta.metaTitle,
          metaDescription: meta.metaDescription,
          metaKeywords: meta.metaKeywords,
        });
      }
    }

    // 4. Also check for distinct brands in products catalog (skip when DB is disconnected in unit tests)
    try {
      if (mongoose.connection.readyState === 1) {
        const { ProductModel } = await import("../product/product.model");
        const distinctBrands: string[] = await ProductModel.distinct("brand").exec();
        if (Array.isArray(distinctBrands)) {
          for (const brandName of distinctBrands) {
            if (!brandName || typeof brandName !== "string") continue;
            const trimmedName = brandName.trim();
            if (!trimmedName) continue;
            const slugCandidate = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
            if (
              !existingNames.has(trimmedName.toLowerCase()) &&
              !existingSlugs.has(slugCandidate)
            ) {
              const meta = this.findStaticMetadata(slugCandidate) || this.findStaticMetadata(trimmedName);
              const inMenu = DEFAULT_NAV_BRAND_GROUPS[slugCandidate] !== undefined;
              const navGroup = DEFAULT_NAV_BRAND_GROUPS[slugCandidate] || meta?.menuGroup || "";
              const item: IBrand = {
                _id: "brand-" + slugCandidate,
                name: meta?.name || trimmedName,
                slug: meta?.slug || slugCandidate,
                aliases: meta?.aliases || [],
                logo: meta?.logo,
                description: meta?.description,
                faqs: meta?.faqs || [],
                isActive: true,
                showInMenu: inMenu,
                menuGroup: navGroup,
                menuGroups: navGroup ? [navGroup] : [],
                metaTitle: meta?.metaTitle,
                metaDescription: meta?.metaDescription,
                metaKeywords: meta?.metaKeywords,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              enriched.push(item);
              existingNames.add(trimmedName.toLowerCase());
              existingSlugs.add(slugCandidate);

              missingToSeed.push({
                name: item.name,
                slug: item.slug,
                aliases: item.aliases,
                logo: item.logo,
                description: item.description,
                faqs: item.faqs,
                isActive: true,
                showInMenu: inMenu,
                menuGroup: navGroup,
                menuGroups: navGroup ? [navGroup] : [],
                metaTitle: item.metaTitle,
                metaDescription: item.metaDescription,
                metaKeywords: item.metaKeywords,
              });
            }
          }
        }
      }
    } catch {
      // Ignore product model lookup in unit test environments
    }

    // 5. Persist missing brands into MongoDB in background so they get permanent ObjectId
    if (missingToSeed.length > 0) {
      BrandRepository.insertManySafe(missingToSeed).catch(() => {});
    }

    // 6. Sort all brands alphabetically
    enriched.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    const finalBrands = includeInactive
      ? enriched
      : enriched.filter((b) => b.isActive !== false);

    await setCache(cacheKey, finalBrands, BRAND_CACHE_TTL);
    return finalBrands;
  }

  static async getPaginatedBrands(params: {
    page?: number;
    limit?: number;
    includeInactive?: boolean;
    search?: string;
    status?: "all" | "active" | "inactive";
    submenu?: "all" | "in_submenu" | "hidden";
    section?: string;
  }): Promise<{ items: IBrand[]; totalCount: number }> {
    const {
      page = 1,
      limit = 20,
      includeInactive = true,
      search,
      status = "all",
      submenu = "all",
      section = "all",
    } = params;

    const allBrands = await this.getAllBrands(true);

    const q = (search || "").toLowerCase().trim();
    const secLower = (section || "").toLowerCase().trim();

    const filtered = allBrands.filter((brand) => {
      // 1. Search filter
      if (q) {
        const nameMatch = (brand.name || "").toLowerCase().includes(q);
        const slugMatch = (brand.slug || "").toLowerCase().includes(q);
        const aliasMatch = Array.isArray(brand.aliases) && brand.aliases.some((a) => a && a.toLowerCase().includes(q));
        if (!nameMatch && !slugMatch && !aliasMatch) return false;
      }

      // 2. Status filter
      if (status === "active" && brand.isActive === false) return false;
      if (status === "inactive" && brand.isActive !== false) return false;
      if (!includeInactive && brand.isActive === false) return false;

      // 3. Submenu filter
      const inMenu =
        brand.showInMenu === true ||
        (brand.showInMenu as any) === "true" ||
        (brand.showInMenu as any) === 1;
      if (submenu === "in_submenu" && !inMenu) return false;
      if (submenu === "hidden" && inMenu) return false;

      // 4. Section filter
      if (secLower && secLower !== "all") {
        const groups = brand.menuGroups && brand.menuGroups.length > 0
          ? brand.menuGroups
          : brand.menuGroup
          ? [brand.menuGroup]
          : [];
        const matchesSec = groups.some((g) => g && typeof g === "string" && g.toLowerCase() === secLower);
        if (!matchesSec) return false;
      }

      return true;
    });

    const totalCount = filtered.length;
    const startIndex = Math.max(0, (page - 1) * limit);
    const items = filtered.slice(startIndex, startIndex + limit);

    return { items, totalCount };
  }

  static async getBrandById(idOrSlug: string) {
    const cacheKey = `brand_detail_v2_${idOrSlug.toLowerCase().trim()}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    let brand: IBrand | null = null;
    if (mongoose.isValidObjectId(idOrSlug)) {
      brand = await BrandRepository.findById(idOrSlug);
    }
    if (!brand) {
      brand = await BrandRepository.findBySlug(idOrSlug);
    }

    const meta = this.findStaticMetadata(idOrSlug) || (brand ? this.findStaticMetadata(brand.slug) || this.findStaticMetadata(brand.name) : undefined);

    if (brand) {
      if (brand.isDeleted) {
        throw new NotFoundError("Brand not found");
      }

      const { showInMenu: inMenu, navGroup, menuGroups } = this.resolveMenuConfig(brand, meta);

      const resolved = {
        ...brand,
        logo: brand.logo || meta?.logo,
        aliases: Array.from(new Set([...(brand.aliases || []), ...(meta?.aliases || [])])),
        description: brand.description || meta?.description,
        faqs: (brand.faqs && brand.faqs.length > 0) ? brand.faqs : meta?.faqs,
        showInMenu: inMenu,
        menuGroup: navGroup,
        menuGroups,
        metaTitle: brand.metaTitle || meta?.metaTitle,
        metaDescription: brand.metaDescription || meta?.metaDescription,
        metaKeywords: brand.metaKeywords || meta?.metaKeywords,
      };
      await setCache(cacheKey, resolved, BRAND_CACHE_TTL);
      return resolved;
    }

    if (meta) {
      const inMenu = DEFAULT_NAV_BRAND_GROUPS[meta.slug.toLowerCase().trim()] !== undefined;
      const navGroup = DEFAULT_NAV_BRAND_GROUPS[meta.slug.toLowerCase().trim()] || meta.menuGroup || "";
      const synthetic = {
        _id: "brand-" + meta.slug,
        name: meta.name,
        slug: meta.slug,
        aliases: meta.aliases,
        logo: meta.logo,
        description: meta.description,
        faqs: meta.faqs,
        isActive: true,
        showInMenu: inMenu,
        menuGroup: navGroup,
        menuGroups: navGroup ? [navGroup] : [],
        metaTitle: meta.metaTitle,
        metaDescription: meta.metaDescription,
        metaKeywords: meta.metaKeywords,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as IBrand;
      await setCache(cacheKey, synthetic, BRAND_CACHE_TTL);
      return synthetic;
    }

    throw new NotFoundError("Brand not found");
  }

  static async createBrand(data: Partial<IBrand>) {
    if (data.slug) {
      const cleanSlug = data.slug.toLowerCase().trim();
      const existing = await Promise.resolve(BrandRepository.findBySlug(cleanSlug)).catch(() => null);
      if (existing) {
        if (existing.isDeleted) {
          const restored = await BrandRepository.update(existing._id, { ...data, slug: cleanSlug, isDeleted: false });
          await clearBrandCaches();
          return restored;
        }
        throw new ConflictError(`Brand with slug "${cleanSlug}" already exists ("${existing.name}")`);
      }
      data.slug = cleanSlug;
    }
    const created = await BrandRepository.create({ ...data, isDeleted: false });
    await clearBrandCaches();
    return created;
  }

  static async updateBrand(id: string, data: Partial<IBrand>) {
    if (data.slug) {
      const cleanSlug = data.slug.toLowerCase().trim();
      const conflict = await Promise.resolve(BrandRepository.findBySlug(cleanSlug)).catch(() => null);
      if (
        conflict &&
        !conflict.isDeleted &&
        String(conflict._id) !== String(id) &&
        `brand-${conflict.slug}` !== String(id)
      ) {
        throw new ConflictError(`Brand with slug "${cleanSlug}" already exists ("${conflict.name}")`);
      }
      data.slug = cleanSlug;
    }
    const previousBrand = data.slug
      ? await Promise.resolve(BrandRepository.findById(id)).catch(() => null)
      : null;
    const updatePayload = { ...data, isDeleted: false };
    let brand = await BrandRepository.update(id, updatePayload);
    if (!brand) {
      const cleanSlug = id.replace(/^brand-/, "").toLowerCase().trim();
      const meta = this.findStaticMetadata(cleanSlug);
      if (meta) {
        brand = await BrandRepository.create({
          name: meta.name,
          slug: meta.slug,
          aliases: meta.aliases,
          logo: meta.logo,
          description: meta.description,
          faqs: meta.faqs,
          isActive: true,
          showInMenu: DEFAULT_NAV_BRAND_GROUPS[meta.slug] !== undefined,
          menuGroup: DEFAULT_NAV_BRAND_GROUPS[meta.slug] || meta.menuGroup || "",
          menuGroups: DEFAULT_NAV_BRAND_GROUPS[meta.slug] ? [DEFAULT_NAV_BRAND_GROUPS[meta.slug]] : [],
          metaTitle: meta.metaTitle,
          metaDescription: meta.metaDescription,
          metaKeywords: meta.metaKeywords,
          ...updatePayload,
        });
      }
    }
    if (!brand) throw new NotFoundError("Brand not found");
    await clearBrandCaches();
    if (previousBrand?.slug && brand.slug && previousBrand.slug !== brand.slug) {
      const { UrlRedirectService } = await import("../url-redirect/url-redirect.service");
      await UrlRedirectService.recordSlugChange(
        `/brands/${previousBrand.slug}`,
        `/brands/${brand.slug}`,
        "auto_brand",
        `Brand "${brand.name}" slug updated`
      );
    }
    return brand;
  }

  static async deleteBrand(id: string) {
    const cleanSlug = id.replace(/^brand-/, "").toLowerCase().trim();
    const existing =
      (await Promise.resolve(BrandRepository.findById(id)).catch(() => null)) ||
      (cleanSlug ? await Promise.resolve(BrandRepository.findBySlug(cleanSlug)).catch(() => null) : null);

    let brand: IBrand | null = null;

    if (existing) {
      const meta =
        this.findStaticMetadata(existing.slug) ||
        (existing.name ? this.findStaticMetadata(existing.name) : undefined);

      let hasCatalogProducts = false;
      try {
        if (mongoose.connection.readyState === 1 && existing.name) {
          const { ProductModel } = await import("../product/product.model");
          const escapedName = existing.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
          const productExists = await ProductModel.exists({ brand: new RegExp(`^${escapedName}$`, "i") });
          hasCatalogProducts = Boolean(productExists);
        }
      } catch {
        hasCatalogProducts = false;
      }

      if (meta || hasCatalogProducts) {
        // Keep a deleted tombstone in MongoDB so static metadata or product brand strings never resurrect it
        brand = await BrandRepository.update(existing._id, {
          isDeleted: true,
          isActive: false,
          showInMenu: false,
          menuGroup: "",
          menuGroups: [],
        });
      } else {
        brand = await BrandRepository.delete(existing._id);
      }
    } else {
      brand = await BrandRepository.delete(id);
      if (!brand) {
        const meta = this.findStaticMetadata(cleanSlug);
        if (meta) {
          brand = await BrandRepository.create({
            name: meta.name,
            slug: meta.slug,
            isDeleted: true,
            isActive: false,
            showInMenu: false,
            menuGroup: "",
            menuGroups: [],
          });
        }
      }
    }

    if (!brand) throw new NotFoundError("Brand not found");
    await clearBrandCaches();
    return brand;
  }
}
