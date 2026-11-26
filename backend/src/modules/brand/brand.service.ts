import mongoose from "mongoose";
import { BrandRepository } from "./brand.repository";
import { IBrand } from "@store4riders/shared-types";
import { NotFoundError } from "../../core/errors/AppError";
import { BRANDS_METADATA, BrandMetadataRecord } from "./data/brands-metadata";
import { getCache, setCache, clearBrandCaches } from "../../core/cache/redis";

const BRAND_CACHE_TTL = 3600; // 1 hour

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

  static async getAllBrands(includeInactive: boolean = false) {
    const cacheKey = `brands_all_v1_${Boolean(includeInactive)}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const dbBrands = await BrandRepository.findAll(includeInactive);
    // Enrich DB brands with metadata if description or faqs is missing
    const enriched = dbBrands.map((b) => {
      const meta = this.findStaticMetadata(b.slug) || (b.name ? this.findStaticMetadata(b.name) : undefined);
      if (!meta) return b;
      return {
        ...b,
        aliases: Array.from(new Set([...(b.aliases || []), ...meta.aliases])),
        description: b.description || meta.description,
        faqs: (b.faqs && b.faqs.length > 0) ? b.faqs : meta.faqs,
        metaTitle: b.metaTitle || meta.metaTitle,
        metaDescription: b.metaDescription || meta.metaDescription,
        metaKeywords: b.metaKeywords || meta.metaKeywords,
      };
    });

    await setCache(cacheKey, enriched, BRAND_CACHE_TTL);
    return enriched;
  }

  static async getBrandById(idOrSlug: string) {
    const cacheKey = `brand_detail_v1_${idOrSlug.toLowerCase().trim()}`;
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
      const resolved = meta
        ? {
            ...brand,
            aliases: Array.from(new Set([...(brand.aliases || []), ...meta.aliases])),
            description: brand.description || meta.description,
            faqs: (brand.faqs && brand.faqs.length > 0) ? brand.faqs : meta.faqs,
            metaTitle: brand.metaTitle || meta.metaTitle,
            metaDescription: brand.metaDescription || meta.metaDescription,
            metaKeywords: brand.metaKeywords || meta.metaKeywords,
          }
        : brand;
      await setCache(cacheKey, resolved, BRAND_CACHE_TTL);
      return resolved;
    }

    if (meta) {
      // Fallback synthetic IBrand if DB doesn't have it yet
      const synthetic = {
        _id: "brand-" + meta.slug,
        name: meta.name,
        slug: meta.slug,
        aliases: meta.aliases,
        description: meta.description,
        faqs: meta.faqs,
        isActive: true,
        showInMenu: true,
        menuGroup: "Popular Brands",
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
    const created = await BrandRepository.create(data);
    await clearBrandCaches();
    return created;
  }

  static async updateBrand(id: string, data: Partial<IBrand>) {
    const previousBrand = data.slug
      ? await Promise.resolve(BrandRepository.findById(id)).catch(() => null)
      : null;
    const brand = await BrandRepository.update(id, data);
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
    const brand = await BrandRepository.delete(id);
    if (!brand) throw new NotFoundError("Brand not found");
    await clearBrandCaches();
    return brand;
  }
}

