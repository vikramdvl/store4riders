import { ProductRepository } from "./product.repository";
import { IProduct, ISpecFieldDefinition } from "@store4riders/shared-types";
import { NotFoundError, ConflictError } from "../../core/errors/AppError";
import { indexProduct, removeProductFromIndex } from "../../core/search/meilisearch";
import {
  slugify,
  extractProductDimensions,
  extractProductWeight,
  resolveCategorySpecDefinitions,
  buildSpecificationsFromTemplate,
  sortSizeEntities,
} from "@store4riders/shared-utils";
import { getCache, setCache, deleteCache, clearProductCaches } from "../../core/cache/redis";
import { buildSearchSlugs, resolveCanonicalCategorySlugs } from "./product.category-constants";
import { supportsTransactions } from "../../core/database/transaction";
import {
  getCsvColumnValue,
  parseCsvDate,
  parseCsvInt,
  parseCsvNumber,
  parseCsvStockStatus,
} from "../../core/utils/csvMigrationHelper";
import { logger } from "../../core/utils/logger";

const PRODUCT_LIST_TTL = 300; // 5 minutes (invalidated immediately on admin mutations)
const PRODUCT_DETAIL_TTL = 900; // 15 minutes (invalidated immediately on admin mutations)

/**
 * @class ProductService
 * @description Core business logic for Products with Redis caching.
 * Highlights:
 * - High-speed Redis caching for product listings, slug lookups, and SKU sets (5-15ms vs 250ms+ DB latency).
 * - Auto-generates SEO-friendly slugs on creation/update.
 * - Automatically syncs all DB changes instantly to the Meilisearch index.
 * - Auto-invalidates Redis cache on product creation, updates, and deletions.
 */
function parseDateOrNull(val: any): Date | null | undefined {
  if (val === null) return null;
  if (val === undefined || val === "") return undefined;
  if (val instanceof Date) return isNaN(val.getTime()) ? undefined : val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      const d = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00.000Z`);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  return undefined;
}

export class ProductService {
  
  static async getProducts(
    filters: Record<string, unknown>, 
    page: number, 
    limit: number,
    sort: Record<string, 1 | -1> = { createdAt: -1, _id: -1 },
    options: { bypassCache?: boolean } = {}
  ) {
    const bypassCache = Boolean(options?.bypassCache);
    if (bypassCache) {
      const skip = (page - 1) * limit;
      const [items, totalCount] = await Promise.all([
        ProductRepository.findAll(filters, skip, limit, sort),
        ProductRepository.count(filters),
      ]);
      return { items, totalCount };
    }

    // Deterministic serialization helper for cache key that preserves RegExp and nested objects
    const serializeFilter = (obj: any): string => {
      if (!obj || typeof obj !== "object") return String(obj);
      if (obj instanceof RegExp) return obj.toString();
      if (Array.isArray(obj)) return `[${obj.map(serializeFilter).join(",")}]`;
      return Object.entries(obj)
        .map(([k, v]) => `${k}:${serializeFilter(v)}`)
        .sort()
        .join(";");
    };

    const filterKey = serializeFilter(filters);
    const cacheKey = `products_v17_${page}_${limit}_${filterKey}_${serializeFilter(sort)}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const skip = (page - 1) * limit;
    const countCacheKey = `products_count_v1_${filterKey}`;
    const cachedCount = await getCache(countCacheKey);

    let items: IProduct[];
    let totalCount: number;

    if (typeof cachedCount === "number") {
      totalCount = cachedCount;
      items =
        totalCount === 0 || skip >= totalCount
          ? []
          : await ProductRepository.findAll(filters, skip, limit, sort);
    } else {
      [items, totalCount] = await Promise.all([
        ProductRepository.findAll(filters, skip, limit, sort),
        ProductRepository.count(filters),
      ]);
      await setCache(countCacheKey, totalCount, PRODUCT_LIST_TTL);
    }

    const result = { items, totalCount };

    await setCache(cacheKey, result, PRODUCT_LIST_TTL);
    return result;
  }

  static async getProductBySlug(slug: string): Promise<IProduct> {
    const cacheKey = `product_slug_v6_${slug}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    let product = await ProductRepository.findBySlug(slug);
    if (!product) {
      product = await ProductRepository.findById(slug);
    }
    if (!product) throw new NotFoundError("Product");

    // DYNAMIC ORPHAN VARIANT RECOVERY:
    // If no variants are attached, we search the database for child variants 
    // using the explicit SKUs from configurableVariations (accurate mapping) 
    // or fallback to SKU prefix matching.
    if (!product.variants || product.variants.length === 0) {
      const { ProductModel } = await import("./product.model");
      let childSkus: string[] = [];
      const skuToAttributes: Record<string, any> = {};

      if (product.configurableVariations) {
        const variants = product.configurableVariations.split("|");
        for (const variant of variants) {
          const attrs = variant.split(",");
          let sku = "";
          const attributes: Record<string, string> = {};
          for (const attr of attrs) {
            const [key, value] = attr.split("=");
            if (!key || !value) continue;
            const k = key.trim().toLowerCase();
            const v = value.trim();
            if (k === "sku") {
              sku = v;
            } else if (k.includes("color") || k.includes("colour")) {
              attributes["color"] = v;
            } else {
              attributes[k] = v;
            }
          }
          if (sku) {
            childSkus.push(sku);
            skuToAttributes[sku] = attributes;
          }
        }
      }

      let children: any[] = [];
      if (childSkus.length > 0) {
        // Fast direct indexed B-Tree match first (<1ms)
        children = await ProductModel.find({ sku: { $in: childSkus } }).lean().exec();
        if (!children || children.length === 0) {
          const skuRegexes = childSkus.map(s => new RegExp(`^${s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, "i"));
          children = await ProductModel.find({ sku: { $in: skuRegexes } }).lean().exec();
        }
      } else if (product.productType === 'configurable' && product.sku) {
        children = await ProductModel.find({ sku: { $regex: new RegExp(`^${product.sku}[-_]`, "i") } }).lean().exec();
        children.forEach(c => {
          if (!skuToAttributes[c.sku]) {
            const parts = c.sku.replace(new RegExp(`^${product.sku}[-_]`, "i"), "").split(/[-_]/).filter(Boolean);
            const attrs: Record<string, string> = {};
            if (parts[0]) attrs.color = parts[0];
            if (parts[1]) attrs.size = parts[1];
            skuToAttributes[c.sku] = attrs;
          }
        });
      }

      if (children && children.length > 0) {
        product.variants = children.map(c => ({
          id: c._id ? c._id.toString() : c.sku,
          sku: c.sku,
          price: c.basePrice || c.specialPrice || 0,
          specialPrice: c.specialPrice,
          stock: c.stockStatus === 0 ? 0 : (typeof c.qty === 'number' ? c.qty : 10),
          attributes: skuToAttributes[c.sku] || {},
          imageUrl: c.images?.[0]?.url
        }));

        if (!product.basePrice || product.basePrice === 0) {
          const validPrices = children.map(c => c.basePrice || c.specialPrice).filter(p => p && p > 0);
          if (validPrices.length > 0) {
            product.basePrice = Math.min(...validPrices);
          }
        }
      }
    }

    // SKU COLOR CODE → IMAGE URL LINKER
    // Problem: Some variants have imageUrl missing because the import script only
    // linked images for child product rows that existed separately in the CSV.
    // Variants parsed from the parent's configurableVariations string got no imageUrl.
    //
    // Fix: Extract the manufacturer color code from the variant SKU (e.g. "GL186" from
    // "GL186-XS-Green"), then find the matching image in product.images whose URL
    // contains that code (e.g. "_gl186_" in the filename). Works for ALL brands.
    if (product.variants && product.variants.length > 0 && product.images && product.images.length > 0) {
      const KNOWN_SIZES = new Set(['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', 'xxxxl', '2xl', '3xl', '4xl']);

      // Cache per color code so all sizes of the same color share the same imageUrl
      const colorCodeToImageUrl = new Map<string, string>();

      (product as any).variants.forEach((variant: any) => {
        if (variant.imageUrl || !variant.sku) return; // Already has image, skip

        const skuParts = variant.sku.split(/[-_]/);

        for (const part of skuParts) {
          const partLower = part.toLowerCase();

          if (KNOWN_SIZES.has(partLower)) continue;  // Skip known sizes (XS, S, M, L...)
          if (part.length < 3) continue;              // Skip very short tokens
          if (/^[a-z]+$/i.test(part)) continue;       // Skip pure color words like "Green", "Orange"

          // This looks like a manufacturer color code (letters + digits, e.g. GL186, MA216)
          if (colorCodeToImageUrl.has(partLower)) {
            variant.imageUrl = colorCodeToImageUrl.get(partLower);
            break;
          }

          const matchedImage = (product.images as any[]).find((img: any) =>
            img.url && img.url.toLowerCase().includes(partLower)
          );

          if (matchedImage) {
            variant.imageUrl = matchedImage.url;
            colorCodeToImageUrl.set(partLower, matchedImage.url);
            break;
          }
        }
      });
    }

    // LINK VARIANT IMAGES FROM colorImages & SYNC COLOR IMAGES TO PRODUCT GALLERY
    if (product.colorImages) {
      const cMap: Record<string, string> = product.colorImages instanceof Map
        ? Object.fromEntries(product.colorImages)
        : (product.colorImages as Record<string, string>);
      (product as any).colorImages = cMap;

      // 1. Assign imageUrl to variants lacking one if their color matches colorImages
      if (product.variants && product.variants.length > 0) {
        (product as any).variants.forEach((variant: any) => {
          if (variant.imageUrl) return;
          const vColor = variant.attributes instanceof Map
            ? (variant.attributes.get('color') || variant.attributes.get('colour'))
            : (variant.attributes?.color || variant.attributes?.colour);
          if (vColor) {
            const vColorStr = String(vColor).trim().toLowerCase();
            const matchedKey = Object.keys(cMap).find(k => k.trim().toLowerCase() === vColorStr);
            if (matchedKey && cMap[matchedKey]) {
              variant.imageUrl = cMap[matchedKey];
            }
          }
        });
      }

      // 2. Ensure each colorImage exists in product.images with descriptive altText
      if (product.images && Array.isArray(product.images)) {
        const existingUrls = new Set(
          (product.images as any[])
            .map((img: any) => (img.url ? img.url.split('?')[0].replace('http://', 'https://').trim().toLowerCase() : ''))
        );

        // Normalize color matching to avoid adding duplicates if an image for that color already exists in product.images
        const existingColors = new Set(
          (product.images as any[])
            .map((img: any) => {
              const alt = (img.altText || '').toLowerCase();
              const match = alt.match(/-(?:\s*)(.+)$/);
              return match ? match[1].trim().toLowerCase() : '';
            })
            .filter(Boolean)
        );

        Object.entries(cMap).forEach(([colorName, colorUrl]) => {
          if (typeof colorUrl === 'string' && colorUrl) {
            const cleanUrl = colorUrl.split('?')[0].replace('http://', 'https://').trim().toLowerCase();
            const colorLower = colorName.trim().toLowerCase();
            if (!existingUrls.has(cleanUrl) && !existingColors.has(colorLower)) {
              (product.images as any[]).push({
                id: `color-${colorName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                url: colorUrl,
                altText: `${product.name} - ${colorName}`,
              });
              existingUrls.add(cleanUrl);
              existingColors.add(colorLower);
            }
          }
        });
      }
    }

    // DYNAMIC BRAND + CATEGORY RESOLUTION IN PARALLEL (Eliminates sequential DB waterfalls)
    let brandName = product.brand || (product.attributes && ((product.attributes as any).brand || (product.attributes as any).Brand)) || "";
    let brandSlug = product.brandSlug;
    let brandLogo = product.brandLogo;

    const resolveBrandTask = async () => {
      if (!brandSlug && (product.brandId || brandName)) {
        try {
          const { BrandService } = await import("../brand/brand.service");
          const allBrands = (await BrandService.getAllBrands(true)) as any[];
          let brandDoc: any = null;

          if (product.brandId && allBrands.length > 0) {
            brandDoc = allBrands.find((b) => String(b._id) === String(product.brandId));
          }
          if (!brandDoc && brandName && allBrands.length > 0) {
            const cleanBrand = String(brandName).trim();
            const cleanBrandLower = cleanBrand.toLowerCase();
            const slugCandidate = slugify(cleanBrand);
            brandDoc = allBrands.find(
              (b) =>
                (b.slug && b.slug.toLowerCase() === slugCandidate) ||
                (b.name && b.name.toLowerCase() === cleanBrandLower)
            );
          }

          if (!brandDoc) {
            const { BrandModel } = await import("../brand/brand.model");
            const mongoose = await import("mongoose");
            if (product.brandId && mongoose.default.isValidObjectId(product.brandId)) {
              brandDoc = await BrandModel.findById(product.brandId).lean().exec();
            }
            if (!brandDoc && brandName) {
              const cleanBrand = String(brandName).trim();
              const escapeRegex = (s: string) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
              const slugCandidate = slugify(cleanBrand);
              brandDoc = await BrandModel.findOne({
                $or: [
                  { slug: slugCandidate },
                  { name: new RegExp(`^${escapeRegex(cleanBrand)}$`, "i") },
                  { slug: new RegExp(`^${escapeRegex(slugCandidate)}$`, "i") },
                ],
              }).lean().exec();
            }
          }

          if (brandDoc) {
            brandName = brandDoc.name || brandName;
            brandSlug = brandDoc.slug;
            brandLogo = brandDoc.logo;
          } else if (brandName) {
            brandSlug = slugify(String(brandName).trim());
          }
        } catch {
          if (brandName && !brandSlug) {
            brandSlug = slugify(String(brandName).trim());
          }
        }
      }
    };

    // DYNAMIC CATEGORY & SUBCATEGORY RESOLUTION
    let categoryName = (product as any).category || "";
    let categorySlug = (product as any).categorySlug || "";
    let subCategoryName = (product as any).subCategory || "";
    let subCategorySlug = (product as any).subCategorySlug || "";
    const categoryHierarchy: Array<{ name: string; slug: string }> = [];
    let resolvedSpecTemplate: ISpecFieldDefinition[] = [];

    const resolveCategoryTask = async () => {
      try {
        const { CategoryModel } = await import("../category/category.model");
        const { CategoryRepository } = await import("../category/category.repository");
        const { LEAF_TO_PARENT_MAP } = await import("./product.category-constants");
        const mongoose = await import("mongoose");
        const candidateSlugs = [
          product.categoryId,
          ...(Array.isArray(product.categorySlugs) ? product.categorySlugs : []),
        ].filter((s): s is string => typeof s === "string" && s.trim().length > 0);

    // Split on non-escaped slashes only so Magento escaped slashes like "Bags \/ Luggage" stay whole
    const resolvedCategoryParts = (rawCats: string): string[] =>
      rawCats
        .replace(/\\\/|\\\//g, " ")
        .split("/")
        .map((p: string) => slugify(p.trim()))
        .filter((p: string) => p && !p.includes("root") && !p.includes("default"));

    if (product.magentoCategories) {
      const parts = product.magentoCategories.split(",").flatMap(resolvedCategoryParts);
      for (const p of parts) {
        if (!candidateSlugs.includes(p)) candidateSlugs.push(p);
      }
    }

        const orConditions: any[] = [];
        if (candidateSlugs.length > 0) {
          orConditions.push({ slug: { $in: candidateSlugs } });
        }
        if (product.categoryId && mongoose.default.isValidObjectId(product.categoryId)) {
          orConditions.push({ _id: product.categoryId });
        }

        let matchedCats: any[] = [];
        let primaryCat: any = null;
        let subCat: any = null;
        let parentCat: any = null;
        let directCat: any = null;
        if (orConditions.length > 0) {
          matchedCats = await CategoryModel.find({ $or: orConditions }).lean().exec();
        }

        if (product.categoryId) {
          const catIdStr = String(product.categoryId).trim().toLowerCase();
          primaryCat = matchedCats.find(
            (c) =>
              String(c._id) === String(product.categoryId) ||
              (c.slug && String(c.slug).toLowerCase() === catIdStr)
          );
          if (!primaryCat) {
            primaryCat = await CategoryRepository.findById(String(product.categoryId)).catch(() => null);
          }
        }

        if (matchedCats.length > 0) {
          // Find if any matched category has a parentId (meaning it's a subcategory)
          subCat = matchedCats.find((c) => c.parentId && String(c.parentId).trim() !== "");
          if (subCat) {
            subCategoryName = subCat.name;
            subCategorySlug = subCat.slug;

            // Find its parent category (either already in matchedCats or by parentId / slug)
            parentCat = matchedCats.find(
              (c) =>
                c._id?.toString() === subCat.parentId ||
                c.slug === subCat.parentId ||
                (LEAF_TO_PARENT_MAP[subCat.slug] && c.slug === LEAF_TO_PARENT_MAP[subCat.slug])
            );

            if (!parentCat && subCat.parentId) {
              parentCat = await CategoryModel.findOne({
                $or: [
                  ...(mongoose.default.isValidObjectId(subCat.parentId) ? [{ _id: subCat.parentId }] : []),
                  { slug: subCat.parentId }
                ]
              }).lean().exec();
            }
            if (!parentCat && LEAF_TO_PARENT_MAP[subCat.slug]) {
              parentCat = await CategoryModel.findOne({ slug: LEAF_TO_PARENT_MAP[subCat.slug] }).lean().exec();
            }

            if (parentCat) {
              if (LEAF_TO_PARENT_MAP[parentCat.slug]) {
                const topSlug = LEAF_TO_PARENT_MAP[parentCat.slug];
                const topCat: any = await CategoryModel.findOne({ slug: topSlug }).lean().exec();
                categoryName = topCat ? topCat.name : topSlug.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
                categorySlug = topSlug;
                subCategoryName = parentCat.name;
                subCategorySlug = `${topSlug}/${parentCat.slug}`;
              } else {
                categoryName = parentCat.name;
                categorySlug = parentCat.slug;
                subCategorySlug = `${parentCat.slug}/${subCat.slug}`;
              }
            } else if (LEAF_TO_PARENT_MAP[subCat.slug]) {
              const pSlug = LEAF_TO_PARENT_MAP[subCat.slug];
              categorySlug = pSlug;
              categoryName = pSlug.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
              subCategorySlug = `${pSlug}/${subCat.slug}`;
            }
          } else {
            // All matched are top-level or primary
            const fallbackPrimary = primaryCat || matchedCats[0];
            categoryName = fallbackPrimary.name;
            categorySlug = fallbackPrimary.slug;
          }
        }

        // If not resolved from DB categories, check LEAF_TO_PARENT_MAP
        if (!categoryName && product.categoryId && LEAF_TO_PARENT_MAP[product.categoryId]) {
          const parentSlugCandidate = LEAF_TO_PARENT_MAP[product.categoryId];
          categorySlug = parentSlugCandidate;
          categoryName = parentSlugCandidate.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
          subCategorySlug = `${parentSlugCandidate}/${product.categoryId}`;
          subCategoryName = product.categoryId.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
        }

        // If still not resolved, check legacy magentoCategories
        if (!categoryName && product.magentoCategories) {
          const firstCat = product.magentoCategories.split(",")[0];
          const token = "__ESC_SLASH__";
          const parts = firstCat
            .replace(/\\\/|\\\//g, token)
            .split("/")
            .map((p) => p.replace(new RegExp(token, "g"), "/").trim())
            .filter((p) => p && !p.toLowerCase().includes("root") && !p.toLowerCase().includes("default"));

          if (parts.length >= 2) {
            const firstSlug = slugify(parts[0]);
            const lastSlug = slugify(parts[parts.length - 1]);
            if (LEAF_TO_PARENT_MAP[firstSlug]) {
              const topSlug = LEAF_TO_PARENT_MAP[firstSlug];
              categorySlug = topSlug;
              categoryName = topSlug.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
              subCategoryName = parts[0];
              subCategorySlug = `${topSlug}/${firstSlug}`;
            } else {
              categoryName = parts[0];
              categorySlug = firstSlug;
              subCategoryName = parts[parts.length - 1];
              subCategorySlug = `${categorySlug}/${lastSlug}`;
            }
          } else if (parts.length === 1) {
            const s = slugify(parts[0]);
            if (LEAF_TO_PARENT_MAP[s]) {
              const topSlug = LEAF_TO_PARENT_MAP[s];
              categorySlug = topSlug;
              categoryName = topSlug.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
              subCategoryName = parts[0];
              subCategorySlug = `${topSlug}/${s}`;
            } else {
              categoryName = parts[0];
              categorySlug = s;
            }
          }
        }

        if (categoryName) {
          categoryHierarchy.push({ name: categoryName, slug: categorySlug });
        }
        if (subCategoryName) {
          categoryHierarchy.push({ name: subCategoryName, slug: subCategorySlug });
        }

        // Ensure direct/parent category record is resolved when alias slugs or parentId differ from matchedCats
        if (!parentCat && primaryCat?.parentId) {
          parentCat = await CategoryRepository.findById(String(primaryCat.parentId)).catch(() => null);
        }
        if (categorySlug && (!primaryCat || primaryCat.slug !== categorySlug)) {
          directCat = await CategoryRepository.findBySlug(categorySlug).catch(() => null);
        }
        if (!directCat && subCategorySlug) {
          const leafSubSlug = subCategorySlug.split("/").filter(Boolean).pop();
          if (leafSubSlug) {
            directCat = await CategoryRepository.findBySlug(leafSubSlug).catch(() => null);
          }
        }

        // DYNAMIC SIZE CHART RESOLUTION:
        // 1. If product has no explicit sizeChart, check legacy Magento attributes (e.g. size_chart_01, sizechart)
        if (!product.sizeChart && !product.size_chart) {
          if (product.attributes && typeof product.attributes === "object") {
            for (const [k, v] of Object.entries(product.attributes)) {
              const lowerK = k.toLowerCase();
              if (lowerK.startsWith("size_chart") || lowerK.startsWith("sizechart")) {
                if (v && typeof v === "string" && v.trim()) {
                  product.sizeChart = v.trim();
                  break;
                }
              }
            }
          }
        }

        // 2. If still empty, automatically inherit from its subcategory or parent category.
        if (!product.sizeChart && !product.size_chart) {
          const getCatChart = (c: any) => (c ? (c.sizeChart || c.size_chart) : undefined);
          const inheritedChart =
            getCatChart(primaryCat) ||
            getCatChart(subCat) ||
            getCatChart(parentCat) ||
            (matchedCats.find((c) => getCatChart(c)) ? getCatChart(matchedCats.find((c) => getCatChart(c))) : undefined) ||
            getCatChart(directCat);

          if (inheritedChart) {
            product.sizeChart = inheritedChart;
          }
        }

        // CATEGORY SPECIFICATIONS & ATTRIBUTES TEMPLATE RESOLUTION:
        // Resolve strictly from the product's category template (specDefinitions / blueprint),
        // ordered from most specific (subcategory / primary) to parent category.
        const isPrimaryTopLevelWhileSubExists = Boolean(
          subCat && primaryCat && !primaryCat.parentId && String(subCat._id) !== String(primaryCat._id)
        );
        const rawChain = isPrimaryTopLevelWhileSubExists
          ? [subCat, primaryCat, parentCat, ...matchedCats, directCat]
          : [primaryCat, subCat, parentCat, ...matchedCats, directCat];
        const categoryChain: any[] = [];
        const seenCatKeys = new Set<string>();
        for (const cat of rawChain) {
          if (!cat) continue;
          const key = String(cat._id || cat.slug || cat.name || "");
          if (key && !seenCatKeys.has(key)) {
            seenCatKeys.add(key);
            categoryChain.push(cat);
          }
        }

        resolvedSpecTemplate = resolveCategorySpecDefinitions({
          categories: categoryChain,
          productAttributeSetCode: product.attributeSetCode || (product.attributes as any)?.attribute_set_code,
          fallbackHints: [
            subCategorySlug,
            categorySlug,
            product.categoryId,
            subCategoryName,
            categoryName,
          ],
        });
      } catch {
        // Non-blocking fallback to blueprint detection from product hints
        resolvedSpecTemplate = resolveCategorySpecDefinitions({
          categories: [],
          productAttributeSetCode: product.attributeSetCode || (product.attributes as any)?.attribute_set_code,
          fallbackHints: [
            subCategorySlug,
            categorySlug,
            product.categoryId,
            subCategoryName,
            categoryName,
          ],
        });
      }
    };

    await Promise.all([resolveBrandTask(), resolveCategoryTask()]);

    if (brandName) product.brand = String(brandName).trim();
    if (brandSlug) product.brandSlug = brandSlug;
    if (brandLogo) product.brandLogo = brandLogo;

    if (categoryName) (product as any).category = categoryName;
    if (categorySlug) (product as any).categorySlug = categorySlug;
    if (subCategoryName) (product as any).subCategory = subCategoryName;
    if (subCategorySlug) (product as any).subCategorySlug = subCategorySlug;
    if (categoryHierarchy.length > 0) (product as any).categoryHierarchy = categoryHierarchy;
    product.categorySpecTemplate = resolvedSpecTemplate;
    product.specifications = buildSpecificationsFromTemplate(resolvedSpecTemplate, product.attributes, {
      name: product.name,
      shortDescription: product.shortDescription || (product as any).short_description,
      description: product.description,
      brand: brandName || product.brand,
      gender: product.gender,
      countryOfManufacture: product.countryOfManufacture,
      weight: product.weight,
      weightUnit: (product as any).weightUnit,
      length: (product as any).length,
      breadth: (product as any).breadth,
      height: (product as any).height,
      dimensionUnit: (product as any).dimensionUnit,
      variants: product.variants as any[],
    });

    await setCache(cacheKey, product, PRODUCT_DETAIL_TTL);
    return product;
  }

  static async getProductsBySkus(skus: string[], inStockOnly = true): Promise<IProduct[]> {
    if (!skus || skus.length === 0) return [];
    const cacheKey = `products_skus_v5_${inStockOnly ? "in_" : ""}${skus.slice().sort().join("_")}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const cleanSkus = skus
      .join(",")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const items = await ProductRepository.findBySkus(cleanSkus, inStockOnly);
    await setCache(cacheKey, items, PRODUCT_DETAIL_TTL);
    return items;
  }

  /**
   * Kit Recommendation Engine — accuracy first, no fallback.
   * Only returns relatedSkus products if they exist in DB.
   * If relatedSkus not configured or not found in DB → returns empty array.
   * No smart matching, no upsellSkus fallback.
   */
  static async getKitRecommendations(slugOrId: string): Promise<IProduct[]> {
    const cacheKey = `product_kit_v5_${slugOrId}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    let product: IProduct | null = (await getCache(`product_slug_v6_${slugOrId}`)) as IProduct | null;
    if (!product && slugOrId.match(/^[0-9a-fA-F]{24}$/)) {
      product = await ProductRepository.findById(slugOrId);
    }
    if (!product) {
      product = await ProductRepository.findBySlug(slugOrId);
    }
    if (!product) return [];

    let kitProducts: IProduct[] = [];

    // Strictly Admin DB Truth: Only return in-stock products explicitly configured in relatedSkus
    if (product.relatedSkus && product.relatedSkus.length > 0) {
      const cleanSkus = product.relatedSkus
        .join(",")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
      if (cleanSkus.length > 0) {
        kitProducts = await ProductRepository.findBySkus(cleanSkus, true);
      }
    }

    await setCache(cacheKey, kitProducts, PRODUCT_DETAIL_TTL);
    return kitProducts;
  }

  /**
   * Upsell Recommendation Engine — "You May Also Like".
   * 1. Returns upsellSkus products if configured.
   * 2. If fewer than 6 items, recommends alternative products from the same category or brand.
   */
  static async getUpsellRecommendations(slugOrId: string): Promise<IProduct[]> {
    const cacheKey = `product_upsell_v5_${slugOrId}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    let product: IProduct | null = (await getCache(`product_slug_v6_${slugOrId}`)) as IProduct | null;
    if (!product && slugOrId.match(/^[0-9a-fA-F]{24}$/)) {
      product = await ProductRepository.findById(slugOrId);
    }
    if (!product) {
      product = await ProductRepository.findBySlug(slugOrId);
    }
    if (!product) return [];

    let upsellProducts: IProduct[] = [];

    // Strictly Admin DB Truth: Only return in-stock products explicitly configured in upsellSkus
    if (product.upsellSkus && product.upsellSkus.length > 0) {
      const cleanSkus = product.upsellSkus
        .join(",")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
      if (cleanSkus.length > 0) {
        upsellProducts = await ProductRepository.findBySkus(cleanSkus, true);
      }
    }

    await setCache(cacheKey, upsellProducts, PRODUCT_DETAIL_TTL);
    return upsellProducts;
  }

  /**
   * Cross-Sell Recommendation Engine — "Frequently Bought Together".
   * 1. Returns crosssellSkus products if configured.
   * 2. If fewer than 6 items, recommends essential rider accessories & maintenance care products.
   */
  static async getCrossSellRecommendations(slugOrId: string): Promise<IProduct[]> {
    const cacheKey = `product_crosssell_v4_${slugOrId}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    let product: IProduct | null = (await getCache(`product_slug_v6_${slugOrId}`)) as IProduct | null;
    if (!product && slugOrId.match(/^[0-9a-fA-F]{24}$/)) {
      product = await ProductRepository.findById(slugOrId);
    }
    if (!product) {
      product = await ProductRepository.findBySlug(slugOrId);
    }
    if (!product) return [];

    let crossSellProducts: IProduct[] = [];

    // Strictly Admin DB Truth: Only return in-stock products explicitly configured in crosssellSkus
    if (product.crosssellSkus && product.crosssellSkus.length > 0) {
      const cleanSkus = product.crosssellSkus
        .join(",")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
      if (cleanSkus.length > 0) {
        crossSellProducts = await ProductRepository.findBySkus(cleanSkus, true);
      }
    }

    await setCache(cacheKey, crossSellProducts, PRODUCT_DETAIL_TTL);
    return crossSellProducts;
  }

  static async getAggregations(filters: Record<string, unknown> = {}, categorySlug?: string, rawActiveFilters?: any): Promise<any> {
    const serializeFilter = (obj: any): string => {
      if (!obj || typeof obj !== "object") return String(obj);
      if (obj instanceof RegExp) return obj.toString();
      if (Array.isArray(obj)) return `[${obj.map(serializeFilter).join(",")}]`;
      return Object.entries(obj).map(([k, v]) => `${k}:${serializeFilter(v)}`).sort().join(";");
    };

    const cacheKey = `aggs_v30_${categorySlug || 'all'}_${serializeFilter(rawActiveFilters || {})}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const { ProductModel } = await import("./product.model");
    
    const baseFilters: any = {
      $or: [
        { status: "published" },
        { status: { $exists: false } }
      ],
      visibility: { $ne: "Not Visible Individually" },
      // Hide out-of-stock products unless they allow backorders or have variant stock
      $and: [
        {
          $or: [
            { allowBackorders: true },
            { "variants.stock": { $gt: 0 } },
            {
              $and: [
                { "variants.0": { $exists: false } },
                { stockStatus: { $ne: 0 } },
                { qty: { $gt: 0 } }
              ]
            }
          ]
        }
      ]
    };
    
    if (rawActiveFilters?.category) {
      let cleanSlug = rawActiveFilters.category.toLowerCase().trim();
      if (cleanSlug.includes('/')) {
        cleanSlug = cleanSlug.split('/').pop() || cleanSlug;
      }
      
      const searchSlugs = buildSearchSlugs(cleanSlug);

      const categoryMatchCondition = { categorySlugs: { $in: searchSlugs } };

      const excludeConditions: any[] = [];
      if ((cleanSlug.includes("boot") || cleanSlug.includes("shoe")) && !cleanSlug.includes("sock") && !cleanSlug.includes("lace") && !cleanSlug.includes("insole") && !cleanSlug.includes("cover") && !cleanSlug.includes("slider")) {
        excludeConditions.push({ name: { $not: /\b(socks?|laces?|insole|covers?|toe\s*slider)\b/i } });
      } else if (cleanSlug.includes("helmet") && !cleanSlug.includes("bag") && !cleanSlug.includes("visor") && !cleanSlug.includes("cleaner") && !cleanSlug.includes("balaclava") && !cleanSlug.includes("intercom") && !cleanSlug.includes("communicator") && !cleanSlug.includes("spoiler") && !cleanSlug.includes("pinlock") && !cleanSlug.includes("lens") && !cleanSlug.includes("shield") && !cleanSlug.includes("accessories")) {
        excludeConditions.push({ name: { $not: /\b(communicator|communicators|intercom|intercoms|bluetooth|headset|camera|action\s*cam|pinlock|spoiler|deflector|pad|pads|screw|lock|chin\s*curtain|ratchet|pivot|vent|vents|replacement|cleaner|spray|mask|balaclava|lens|shield|glove|gloves|jacket|jackets|boots?|shoes?|pants?|backpacks?|bags?|luggage|hydration|tail\s*bag|tank\s*bag|saddle\s*bag|panniers?|goggle|goggles)\b/i } });
        // Strictly exclude standalone replacement visors, but preserve genuine Dual Visor / Double Visor helmets
        excludeConditions.push({
          $or: [
            { name: /\b(dual|double)\s+visor/i },
            { name: { $not: /\bvisors?\b/i } }
          ]
        });
      } else if ((cleanSlug.includes("jacket") || cleanSlug.includes("suit") || cleanSlug.includes("pant") || cleanSlug.includes("jeans")) && !cleanSlug.includes("armor") && !cleanSlug.includes("armour") && !cleanSlug.includes("protector") && !cleanSlug.includes("guard") && !cleanSlug.includes("pad") && !cleanSlug.includes("insert") && !cleanSlug.includes("layer") && !cleanSlug.includes("liner")) {
        excludeConditions.push({ name: { $not: /\b((hip|knee|elbow|back|shoulder|chest)\s*(protector|armor|armour|insert|pad|pads)|armour\s*insert|armor\s*insert|base\s*layer|liner)\b/i } });
      } else if ((cleanSlug.includes("communicator") || cleanSlug.includes("intercom")) && !cleanSlug.includes("mount") && !cleanSlug.includes("cable") && !cleanSlug.includes("wire") && !cleanSlug.includes("battery") && !cleanSlug.includes("clamp") && !cleanSlug.includes("pad")) {
        excludeConditions.push({ name: { $not: /\b(cable|wire|battery|clamp|mount|pad)\b/i } });
      } else if (cleanSlug.includes("knee-guard") || cleanSlug.includes("knee-guards")) {
        excludeConditions.push({ name: { $not: /\b(hip|elbow|shoulder|back|chest|tailbone)\b/i } });
      }

      baseFilters.$and = baseFilters.$and || [];
      baseFilters.$and.push(categoryMatchCondition);
      
      if (excludeConditions.length > 0) {
        baseFilters.$and.push(...excludeConditions);
      }

      /*
      --- LEGACY REGEX GUESSING CODE (COMMENTED OUT AFTER MIGRATION) ---
      const slugMap: Record<string, string> = {
        "full-face-helmets": "full-face",
        "modular-helmets": "modular-flip-up",
        "half-face-helmets": "open-face",
        "off-road-motocross": "off-road-motocross-gear",
        "off-road-riding-boots": "off-road-riding-boots",
        "riding-jacket": "riding-jackets",
        "riding-jean": "riding-jeans",
        "touring-pant": "touring-pants",
        "knee-guard": "knee-guards",
        "saddle-bags": "saddle-bags-bikes",
        "tail-bags": "motorcycle-tail-bags",
        "women-riding-gear": "riding-gear-for-women"
      };

      if (slugMap[cleanSlug]) {
        cleanSlug = slugMap[cleanSlug];
      }

      if (cleanSlug.includes("off-road-boot") || cleanSlug.includes("off-road-riding-boot")) {
        ... (100+ lines of legacy code)
      */
    }
    
    if (rawActiveFilters?.search && typeof rawActiveFilters.search === "string") {
      const sanitized = rawActiveFilters.search.replace(/[\0\$\{\}\[\]\<\>\\]/g, "").trim().slice(0, 100);
      if (sanitized) {
        const tokens = sanitized.split(/\s+/).filter(Boolean);
        baseFilters.$and = baseFilters.$and || [];
        for (const token of tokens) {
          const escaped = token.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
          const tokenRegex = new RegExp(escaped, "i");
          baseFilters.$and.push({
            $or: [
              { name: { $regex: tokenRegex } },
              { brand: { $regex: tokenRegex } },
              { sku: { $regex: tokenRegex } },
              { magentoCategories: { $regex: tokenRegex } },
            ],
          });
        }
      }
    }

    baseFilters.$and = baseFilters.$and || [];
    baseFilters.$and.push({
      $or: [
        { allowBackorders: true },
        { "variants.stock": { $gt: 0 } },
        {
          $and: [
            { "variants.0": { $exists: false } },
            { stockStatus: { $ne: 0 } },
            { qty: { $gt: 0 } }
          ]
        }
      ]
    });

    const products = await ProductModel.find(baseFilters)
      .select("name brand gender magentoCategories variants.attributes variants.stock configurableVariations colorImages stockStatus attributes basePrice specialPrice")
      .lean()
      .exec();

    const brandsMap = new Map<string, number>();
    const categoriesMap = new Map<string, number>();
    const colorsMap = new Map<string, Set<string>>();
    const sizesMap = new Map<string, Set<string>>();
    
    const dynamicAttrsMap = new Map<string, Map<string, Set<string>>>();
    const TRACKED_ATTRS = ['material', 'riding_style', 'gender', 'motorcycle_model'];

    const activeBrands = rawActiveFilters?.brand?.map((b: string) => b.toLowerCase()) || [];
    const activeColors = rawActiveFilters?.colour?.map((c: string) => c.toLowerCase()) || [];
    const activeSizes = rawActiveFilters?.size?.map((s: string) => s.toLowerCase()) || [];
    const activeModels = rawActiveFilters?.motorcycle_model?.map((m: string) => m.toLowerCase()) || [];

    let overallMinPrice = Infinity;
    let overallMaxPrice = 0;

    products.forEach((p: any) => {
      const pName = (p.name || "").toLowerCase();
      const pBrand = (p.brand || (p.attributes && (p.attributes.brand || p.attributes.Brand)) || "").toLowerCase();
      let matchesBrand = true;
      if (activeBrands.length > 0) {
        matchesBrand = activeBrands.some((b: string) => {
          if (!b) return false;
          const flexibleB = b.replace(/-/g, '[\\s\\-]');
          const regex = new RegExp(flexibleB, 'i');
          if (pBrand && regex.test(pBrand)) return true;
          const wordRegex = new RegExp(`\\b${flexibleB}\\b`, "i");
          return wordRegex.test(pName);
        });
      }

      let matchesColor = true;
      let matchesSize = true;
      let matchesModel = true;
      
      const availableColors = new Set<string>();
      const availableSizes = new Set<string>();
      const availableModels = new Set<string>();
      
      const getDynamicAttrLocal = (obj: any, keywords: string[]) => {
        if (!obj || typeof obj !== 'object') return undefined;
        const key = Object.keys(obj).find(k => {
          const lowerK = k.toLowerCase().replace(/[\s\-_]/g, '');
          if (lowerK.includes('sizechart') || lowerK.includes('size_chart')) return false;
          return keywords.some(kw => lowerK.includes(kw.replace(/[\s\-_]/g, '')));
        });
        return key ? obj[key] : undefined;
      };

      const MODEL_KEYWORDS = ['motorcycle_model', 'bike_compatibility', 'compatible_models', 'bike_model'];

      if (p.variants && p.variants.length > 0) {
        p.variants.forEach((v: any) => {
          if (v.stock > 0 || p.allowBackorders) {
            const vCol = getDynamicAttrLocal(v.attributes, ['color', 'colour']);
            if (vCol) availableColors.add(vCol.toLowerCase());
            const vSiz = getDynamicAttrLocal(v.attributes, ['size', 'eu_size', 'eu_size_for_boots']);
            if (vSiz) availableSizes.add(vSiz.toLowerCase());
            const vMod = getDynamicAttrLocal(v.attributes, MODEL_KEYWORDS);
            if (vMod) {
              vMod.split(',').forEach((s: string) => availableModels.add(s.trim().toLowerCase()));
            }
          }
        });
      } else if (p.configurableVariations) {
        const vars = p.configurableVariations.split("|");
        for (const variant of vars) {
          const attrs = variant.split(",");
          for (const attr of attrs) {
            const [k, v] = attr.split("=");
            if (k && v) {
              const kl = k.trim().toLowerCase();
              if (kl === 'color' || kl === 'colour') availableColors.add(v.trim().toLowerCase());
              if (kl === 'size' || kl === 'eu_size' || kl === 'eu_size_for_boots' || (kl.includes('size') && !kl.includes('chart'))) {
                availableSizes.add(v.trim().toLowerCase());
              }
              if (kl === 'motorcycle_model' || kl === 'bike_compatibility' || kl === 'compatible_models' || kl === 'bike_model') {
                v.trim().split(',').forEach((s: string) => availableModels.add(s.trim().toLowerCase()));
              }
            }
          }
        }
      }
      
      if (p.colorImages && typeof p.colorImages === 'object') {
        Object.keys(p.colorImages).forEach(c => availableColors.add(c.trim().toLowerCase()));
      }

      if (p.attributes && typeof p.attributes === 'object') {
        const topMod = getDynamicAttrLocal(p.attributes, MODEL_KEYWORDS);
        if (topMod) {
          topMod.split(',').forEach((s: string) => availableModels.add(s.trim().toLowerCase()));
        }
      }

      if (activeColors.length > 0) {
        matchesColor = activeColors.some((c: string) => availableColors.has(c));
      }
      if (activeSizes.length > 0) {
        matchesSize = activeSizes.some((s: string) => availableSizes.has(s));
      }
      if (activeModels.length > 0) {
        matchesModel = activeModels.some((m: string) => availableModels.has(m));
      }

      if (pBrand && matchesColor && matchesSize && matchesModel) {
        brandsMap.set(pBrand, (brandsMap.get(pBrand) || 0) + 1);
      }

      if (p.magentoCategories && matchesBrand && matchesColor && matchesSize && matchesModel) {
        const paths = p.magentoCategories.split(",");
        for (const path of paths) {
          const pathLower = path.toLowerCase();
          if (pathLower.includes("between") || pathLower.includes("under ") || pathLower.includes("price") || pathLower.includes("rs.") || pathLower.includes("₹")) continue;
          
          const parts = path.split("/").map((part: string) => part.trim()).filter((part: string) => part && !part.toLowerCase().includes("root"));
          if (parts.length > 0) {
            const cleanPath = parts.join(" > ");
            categoriesMap.set(cleanPath, (categoriesMap.get(cleanPath) || 0) + 1);
          }
        }
      }

      const extractedVariants: any[] = [];
      
      const getDynamicAttr = (obj: any, keywords: string[]) => {
        if (!obj || typeof obj !== 'object') return undefined;
        const key = Object.keys(obj).find(k => {
          const lowerK = k.toLowerCase();
          if (lowerK.includes('size_chart') || lowerK.includes('sizechart')) return false;
          return keywords.some(kw => lowerK.includes(kw));
        });
        return key ? obj[key] : undefined;
      };

      if (p.variants && p.variants.length > 0) {
        const topDefaultColor = getDynamicAttr(p.attributes, ['color', 'colour']);
        p.variants.forEach((v: any) => {
          if (v.stock > 0 || p.allowBackorders) {
            extractedVariants.push({ 
              color: getDynamicAttr(v.attributes, ['color', 'colour']) || topDefaultColor, 
              size: getDynamicAttr(v.attributes, ['size', 'eu_size', 'eu_size_for_boots']) 
            });
          }
        });
      } else if (p.configurableVariations) {
        const topDefaultColor = getDynamicAttr(p.attributes, ['color', 'colour']);
        const vars = p.configurableVariations.split("|");
        for (const variant of vars) {
          const vObj: any = {};
          variant.split(",").forEach((attr: string) => {
            const [k, v] = attr.split("=");
            if (k && v) vObj[k.trim().toLowerCase()] = v.trim();
          });
          extractedVariants.push({ 
            color: getDynamicAttr(vObj, ['color', 'colour']) || topDefaultColor, 
            size: getDynamicAttr(vObj, ['size', 'eu_size', 'eu_size_for_boots']) 
          });
        }
      }
      
      if (p.colorImages && typeof p.colorImages === 'object') {
        Object.keys(p.colorImages).forEach(c => {
          extractedVariants.push({ color: c, size: undefined });
        });
      }

      if (p.attributes && typeof p.attributes === 'object') {
        const topColor = getDynamicAttr(p.attributes, ['color', 'colour']);
        const topSize = getDynamicAttr(p.attributes, ['size', 'eu_size', 'eu_size_for_boots']);
        if (topColor || topSize) {
          extractedVariants.push({ color: topColor, size: topSize });
        }
      }

      extractedVariants.forEach((v: any) => {
        const vColor = v.color;
        const vSize = v.size;
        
        let vMatchesSize = true;
        if (activeSizes.length > 0) {
          if (vSize) vMatchesSize = activeSizes.includes(vSize.toLowerCase());
          else vMatchesSize = matchesSize;
        }
        
        if (matchesBrand && vMatchesSize && matchesModel && vColor) {
          if (!colorsMap.has(vColor)) colorsMap.set(vColor, new Set());
          colorsMap.get(vColor)!.add(p._id.toString());
        }

        let vMatchesColor = true;
        if (activeColors.length > 0) {
          if (vColor) vMatchesColor = activeColors.includes(vColor.toLowerCase());
          else vMatchesColor = matchesColor;
        }
        
        if (matchesBrand && vMatchesColor && matchesModel && vSize) {
          if (!sizesMap.has(vSize)) sizesMap.set(vSize, new Set());
          sizesMap.get(vSize)!.add(p._id.toString());
        }
      });

      TRACKED_ATTRS.forEach(attrName => {
        let isEligible = false;
        if (attrName === 'motorcycle_model') {
          isEligible = matchesBrand && matchesColor && matchesSize;
        } else {
          isEligible = matchesBrand && matchesColor && matchesSize && matchesModel;
        }

        if (isEligible) {
          const cleanVals: string[] = [];

          if (attrName === 'motorcycle_model') {
            if (p.attributes && typeof p.attributes === 'object') {
              const topMod = getDynamicAttrLocal(p.attributes, MODEL_KEYWORDS);
              if (topMod) {
                topMod.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((s: string) => cleanVals.push(s));
              }
            }
            if (p.variants && p.variants.length > 0) {
              p.variants.forEach((v: any) => {
                if (v.stock > 0 || p.allowBackorders) {
                  const vMod = getDynamicAttrLocal(v.attributes, MODEL_KEYWORDS);
                  if (vMod) {
                    vMod.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((s: string) => cleanVals.push(s));
                  }
                }
              });
            } else if (p.configurableVariations) {
              const vars = p.configurableVariations.split("|");
              for (const variant of vars) {
                const attrs = variant.split(",");
                for (const attr of attrs) {
                  const [k, v] = attr.split("=");
                  if (k && v) {
                    const kl = k.trim().toLowerCase();
                    if (kl === 'motorcycle_model' || kl === 'bike_compatibility' || kl === 'compatible_models' || kl === 'bike_model') {
                      v.trim().split(',').map((s: string) => s.trim()).filter(Boolean).forEach((s: string) => cleanVals.push(s));
                    }
                  }
                }
              }
            }
          } else {
            let attrValue = '';
            if (attrName === 'gender' && p.gender) {
              attrValue = p.gender;
            } else if (p.attributes && typeof p.attributes === 'object') {
              const capName = attrName.charAt(0).toUpperCase() + attrName.slice(1);
              const upperName = attrName.toUpperCase();
              attrValue = p.attributes[attrName] || p.attributes[capName] || p.attributes[upperName];
            }

            if (attrValue) {
              attrValue.split(',').map(v => v.trim()).filter(Boolean).forEach(v => cleanVals.push(v));
            }
          }

          if (cleanVals.length > 0) {
            if (!dynamicAttrsMap.has(attrName)) dynamicAttrsMap.set(attrName, new Map());
            const valMap = dynamicAttrsMap.get(attrName)!;
            const uniqueVals = Array.from(new Set(cleanVals));
            uniqueVals.forEach(cleanVal => {
              if (!valMap.has(cleanVal)) valMap.set(cleanVal, new Set());
              valMap.get(cleanVal)!.add(p._id.toString());
            });
          }
        }
      });

      if (matchesBrand && matchesColor && matchesSize && matchesModel) {
        let pBase = p.basePrice || 0;
        let pSpecial = p.specialPrice;

        if (!pBase && p.variants && p.variants.length > 0) {
          const vPrices = p.variants.map((v: any) => v.price).filter((pr: number) => pr > 0);
          if (vPrices.length > 0) pBase = Math.min(...vPrices);
          if (!pSpecial) {
            const vSpecials = p.variants.map((v: any) => v.specialPrice).filter((pr: number) => pr > 0);
            if (vSpecials.length > 0) pSpecial = Math.min(...vSpecials);
          }
        }
        
        if (!pBase && pSpecial && pSpecial > 0) {
          pBase = pSpecial;
          pSpecial = undefined;
        }

        const finalPrice = (pSpecial && pSpecial > 0 && pBase > 0 && pSpecial < pBase) ? pSpecial : pBase;
        if (finalPrice > 0) {
          if (finalPrice < overallMinPrice) overallMinPrice = finalPrice;
          if (finalPrice > overallMaxPrice) overallMaxPrice = finalPrice;
        }
      }
    });

    const dynamicAttributesResponse: Record<string, any[]> = {};

    // ───────────────────────────────────────────────────────────────────
    // CATEGORY FAMILY FILTER SYSTEM
    // Determines which filters (size, color, dynamic attrs) are valid
    // for the current category. Products outside wearable/apparel
    // categories should NEVER show clothing Size, Gender, etc.
    // ───────────────────────────────────────────────────────────────────
    const cat = (rawActiveFilters?.category || '').toLowerCase();

    // Category Family Detection
    const isProtection = ['protector', 'armour', 'armor', 'guard', 'knee'].some(kw => cat.includes(kw));
    const isWomenOnly = ['women', 'lady', 'ladies'].some(kw => cat.includes(kw));
    const isApparel = !isProtection && ['jacket', 'pant', 'jean', 'suit', 'riding-gear', 'innerwear', 'base-layer', 'riding-shirt'].some(kw => cat.includes(kw));
    const isFootwear = ['boot', 'shoe', 'sneaker'].some(kw => cat.includes(kw));
    const isGlove = cat.includes('glove');
    const isHelmet = ['helmet', 'full-face', 'modular', 'half-face', 'open-face', 'off-road-motocross'].some(kw => cat.includes(kw));
    const isHelmetAccessory = ['visor', 'pinlock', 'spoiler', 'balaclava', 'communicator', 'intercom', 'helmet-cleaner', 'helmet-accessor'].some(kw => cat.includes(kw));
    const isLuggage = ['luggage', 'bag', 'tank-bag', 'saddle-bag', 'tail-bag', 'top-box', 'hydration', 'backpack', 'pannier'].some(kw => cat.includes(kw));
    const isConsumable = ['chain-care', 'chain-lube', 'oils-lube', 'motorcycle-care', 'cleaner', 'spray', 'polish'].some(kw => cat.includes(kw));
    const isExhaust = cat.includes('exhaust');
    const isSpare = !isExhaust && ['spare', 'sprocket', 'radiator', 'brake', 'performance-part', 'air-filter', 'spark-plug', 'chain-sprocket'].some(kw => cat.includes(kw));
    const isElectronics = ['gadget', 'phone-holder', 'mobile-holder', 'camera', 'gopro', 'usb', 'charger'].some(kw => cat.includes(kw));
    const isLightAccessory = ['auxiliary', 'light', 'filter', 'clamp', 'mount', 'harness', 'switch', 'flasher'].some(kw => cat.includes(kw));
    const isBikeCover = cat.includes('cover');
    const isOffBeat = cat.includes('off-beat');

    // Accessories & Spares detection (including all subcategories)
    const isAccessory = ['accessor', 'auxiliary', 'light', 'filter', 'clamp', 'mount', 'harness', 'switch', 'flasher', 'cover', 'off-beat', 'rally-tower', 'performance-part', 'chain-care'].some(kw => cat.includes(kw));
    const isSpareCategory = ['spare', 'sprocket', 'radiator', 'brake', 'air-filter', 'spark-plug', 'chain-sprocket'].some(kw => cat.includes(kw));
    const isBikeModelEligible = isExhaust || isAccessory || isSpareCategory || isSpare || isLightAccessory || isBikeCover || isOffBeat;

    // Wearable items: Size is valid for clothing, footwear, gloves (NEVER protection/guards)
    const isClothingWearable = (isApparel || isFootwear || isGlove) && !isProtection;
    // Helmet: Size + Color valid, but NOT Gender
    const isHeadgear = isHelmet && !isHelmetAccessory;
    // Items where ONLY Price + Brand are valid (no size, no color, no gender)
    const isPriceAndBrandOnly = isConsumable || isSpare || isElectronics || isLightAccessory || isBikeCover || isOffBeat;

    // Determine allowed filter facets for this category
    const allowSize = (isClothingWearable || isHeadgear) && !isProtection;
    const allowColor = (isClothingWearable || isHeadgear || isLuggage || isHelmetAccessory || isProtection || isExhaust) && !isPriceAndBrandOnly;
    // Gender is strictly ONLY allowed for clothing/apparel, footwear, and gloves, and NEVER for protection/guards, headgear, luggage, spares, or women-only category
    const allowGender = isClothingWearable && !isWomenOnly && !isProtection;
    const allowMaterial = (isApparel || isGlove) && !isProtection;
    const allowRidingStyle = (isApparel || isHeadgear) && !isProtection;
    const allowHelmetType = isHeadgear;

    // If no specific category detected (e.g. search results, /products, brand pages), allow everything
    const hasCategoryContext = cat.length > 0;

    for (const [attrName, valMap] of dynamicAttrsMap.entries()) {
      // Allow motorcycle_model for exhausts, motorcycle accessories & spares categories and their subcategories
      if (attrName === 'motorcycle_model') {
        if (hasCategoryContext && !isBikeModelEligible) continue;
        dynamicAttributesResponse[attrName] = Array.from(valMap.entries())
          .map(([name, set]) => ({ name, count: set.size }))
          .sort((a, b) => b.count - a.count);
        continue;
      }

      // Skip all other dynamic attributes for categories that are price and brand only (except exhausts)
      if (hasCategoryContext && isPriceAndBrandOnly && !isExhaust) {
        continue;
      }

      // Skip helmet_type for non-helmet categories
      if (attrName === 'helmet_type') {
        if (hasCategoryContext && !allowHelmetType) continue;
      }

      // Skip gender for non-wearable categories
      if (attrName === 'gender') {
        if (hasCategoryContext && !allowGender) continue;
      }

      // Skip material for non-apparel categories
      if (attrName === 'material') {
        if (hasCategoryContext && !allowMaterial) continue;
      }

      // Skip riding_style for non-gear categories
      if (attrName === 'riding_style') {
        if (hasCategoryContext && !allowRidingStyle) continue;
      }
      
      dynamicAttributesResponse[attrName] = Array.from(valMap.entries())
        .map(([name, set]) => ({ name, count: set.size }))
        .sort((a, b) => b.count - a.count);
    }

    const result: any = {
      brands: Array.from(brandsMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      categories: Array.from(categoriesMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      colors: Array.from(colorsMap.entries()).map(([name, set]) => ({ name, count: set.size })).sort((a, b) => b.count - a.count),
      sizes: sortSizeEntities(
        Array.from(sizesMap.entries()).map(([name, set]) => ({ name, count: set.size })),
        (s) => s.name
      ),
      dynamicAttributes: dynamicAttributesResponse,
      priceStats: { 
        min: overallMinPrice === Infinity ? 0 : overallMinPrice, 
        max: overallMaxPrice 
      },
      filterConfig: undefined,
    };

    // Suppress sizes if this category family doesn't use them
    if (hasCategoryContext && (!allowSize || isPriceAndBrandOnly)) {
      result.sizes = [];
    }

    // Suppress colors if this category family doesn't use them
    if (hasCategoryContext && (!allowColor || (isPriceAndBrandOnly && !isExhaust))) {
      result.colors = [];
    }

    if (categorySlug) {
      const { CategoryModel } = await import("../category/category.model");
      const categoryDoc = await CategoryModel.findOne({ slug: categorySlug }).lean().exec() as any;
      if (categoryDoc && Array.isArray(categoryDoc.filterConfig) && categoryDoc.filterConfig.length > 0) {
        result.filterConfig = [...categoryDoc.filterConfig];
        if (isBikeModelEligible && !result.filterConfig.some((c: any) => c.code === 'motorcycle_model')) {
          const priceIdx = result.filterConfig.findIndex((c: any) => c.code === 'price');
          const insertIdx = priceIdx >= 0 ? priceIdx + 1 : 0;
          result.filterConfig.splice(insertIdx, 0, { code: 'motorcycle_model', label: 'Motorcycle Model' });
        }
      }
    }

    await setCache(cacheKey, result, 3600);
    return result;
  }

  static async checkSkuAvailability(
    sku: string,
    excludeId?: string
  ): Promise<{ available: boolean; existingProduct?: { name: string; sku: string } }> {
    const cleanSku = sku.trim();
    if (!cleanSku) return { available: true };

    const escaped = cleanSku.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const query: any = {
      $or: [
        { sku: new RegExp(`^${escaped}$`, "i") },
        { "variants.sku": new RegExp(`^${escaped}$`, "i") },
      ],
    };

    if (excludeId) {
      const mongoose = await import("mongoose");
      if (mongoose.default.Types.ObjectId.isValid(excludeId)) {
        query._id = { $ne: excludeId };
      } else {
        query.slug = { $ne: excludeId };
      }
    }

    const { ProductModel } = await import("./product.model");
    const existing = await ProductModel.findOne(query).select("name sku").lean().exec();

    if (existing) {
      return {
        available: false,
        existingProduct: {
          name: (existing as any).name,
          sku: (existing as any).sku,
        },
      };
    }

    return { available: true };
  }

  static async checkSlugAvailability(
    slug: string,
    excludeId?: string
  ): Promise<{ available: boolean; existingProduct?: { name: string; slug: string } }> {
    const cleanSlug = slug.toLowerCase().trim();
    if (!cleanSlug) return { available: true };

    const escaped = cleanSlug.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const query: any = {
      slug: new RegExp(`^${escaped}$`, "i"),
    };

    if (excludeId) {
      const mongoose = await import("mongoose");
      if (mongoose.default.Types.ObjectId.isValid(excludeId)) {
        query._id = { $ne: excludeId };
      } else {
        query.slug = { $ne: excludeId };
      }
    }

    const { ProductModel } = await import("./product.model");
    const existing = await ProductModel.findOne(query).select("name slug").lean().exec();

    if (existing) {
      return {
        available: false,
        existingProduct: {
          name: (existing as any).name,
          slug: (existing as any).slug,
        },
      };
    }

    return { available: true };
  }

  static async createProduct(data: Partial<IProduct>): Promise<IProduct> {
    if (data.specialPriceFromDate !== undefined) {
      data.specialPriceFromDate = parseDateOrNull(data.specialPriceFromDate) as any;
    }
    if (data.specialPriceToDate !== undefined) {
      data.specialPriceToDate = parseDateOrNull(data.specialPriceToDate) as any;
    }
    if (!data.countryOfManufacture) {
      data.countryOfManufacture = "India";
    }
    if (!data.weightUnit) {
      data.weightUnit = "kg";
    }
    if (data.sku) {
      const check = await this.checkSkuAvailability(data.sku);
      if (!check.available && check.existingProduct) {
        throw new ConflictError(
          `A product with SKU "${data.sku}" already exists ("${check.existingProduct.name}"). SKU must be unique across the catalog.`
        );
      }
    }
    const slug = data.slug ? slugify(data.slug) : slugify(data.name || "");
    if (slug) {
      const slugCheck = await this.checkSlugAvailability(slug);
      if (!slugCheck.available && slugCheck.existingProduct) {
        throw new ConflictError(
          `A product with URL Slug "${slug}" already exists ("${slugCheck.existingProduct.name}"). URL slug must be unique.`
        );
      }
    }
    const { categoryId, categorySlugs } = await this.resolveAndEnrichCategoryAssignment(data);

    // Sanitize colorImages keys: MongoDB BSON keys cannot contain dots (.)
    if (data.colorImages && typeof data.colorImages === "object") {
      const sanitizedColorImages: Record<string, string> = {};
      const entries = data.colorImages instanceof Map
        ? Array.from(data.colorImages.entries())
        : Object.entries(data.colorImages);
      for (const [key, val] of entries) {
        if (typeof val === "string") {
          const safeKey = key.replace(/\./g, " ").replace(/\s+/g, " ").trim();
          sanitizedColorImages[safeKey] = val;
        }
      }
      data.colorImages = sanitizedColorImages;
    }
    // Sanitize colorSwatches keys: MongoDB BSON keys cannot contain dots (.)
    if (data.colorSwatches && typeof data.colorSwatches === "object") {
      const sanitizedColorSwatches: Record<string, string> = {};
      const entries = data.colorSwatches instanceof Map
        ? Array.from(data.colorSwatches.entries())
        : Object.entries(data.colorSwatches);
      for (const [key, val] of entries) {
        if (typeof val === "string") {
          const safeKey = key.replace(/\./g, " ").replace(/\s+/g, " ").trim();
          sanitizedColorSwatches[safeKey] = val;
        }
      }
      data.colorSwatches = sanitizedColorSwatches;
    }

    if (Array.isArray(data.variants)) {
      data.variants.forEach((v: any) => {
        if (v.color && typeof v.color === "string" && v.color.includes(".")) {
          v.color = v.color.replace(/\./g, " ").replace(/\s+/g, " ").trim();
        }
        if (v.attributes && typeof v.attributes === "object") {
          const col = v.attributes.color || v.attributes.colour;
          if (typeof col === "string" && col.includes(".")) {
            const cleanCol = col.replace(/\./g, " ").replace(/\s+/g, " ").trim();
            if (v.attributes.color) v.attributes.color = cleanCol;
            if (v.attributes.colour) v.attributes.colour = cleanCol;
          }
        }
      });
    }

    const productData = { ...data, slug, categorySlugs, ...(categoryId ? { categoryId } : {}) };
    let product;
    try {
      product = await ProductRepository.create(productData);
    } catch (err: any) {
      if (err.code === 11000) {
        if (err.keyPattern?.sku) {
          throw new ConflictError(`A product with SKU "${data.sku}" already exists. SKU must be unique.`);
        }
        if (err.keyPattern?.slug) {
          throw new ConflictError(`Slug "${slug}" already exists. Please choose a unique URL slug.`);
        }
      }
      throw err;
    }
    
    // Sync to search index & invalidate cache
    await indexProduct(product);
    await this.invalidateProductCache(slug);
    
    return product;
  }

  /**
   * Preserves exact admin-assigned categories without auto-mapping into parent or
   * name-guessed categories. Resolves a category ObjectId to its own slug so storefront
   * slug queries still work if an ID was submitted, and retains legacy Magento CSV
   * canonical resolution only when raw magentoCategories are provided without explicit slugs.
   */
  private static async resolveAndEnrichCategoryAssignment(data: {
    name?: string;
    magentoCategories?: string;
    categoryId?: string;
    categorySlugs?: string[];
  }): Promise<{ categoryId?: string; categorySlugs: string[] }> {
    const isHexId = (val: string) => /^[0-9a-fA-F]{24}$/.test(val);
    const seedSlugs = new Set<string>(
      Array.isArray(data.categorySlugs)
        ? data.categorySlugs
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
            .map((s) => s.trim())
        : []
    );

    const rawCategoryId = typeof data.categoryId === "string" ? data.categoryId.trim() : "";
    if (rawCategoryId && !isHexId(rawCategoryId)) {
      seedSlugs.add(rawCategoryId);
    }

    // Legacy Magento CSV imports pass magentoCategories without admin-chosen categorySlugs/categoryId.
    const hasExplicitAdminSelection = seedSlugs.size > 0 || Boolean(rawCategoryId);
    if (!hasExplicitAdminSelection && data.magentoCategories) {
      const canonicalSlugs = resolveCanonicalCategorySlugs({
        name: data.name,
        magentoCategories: data.magentoCategories,
        categorySlugs: [],
      });
      for (const slug of canonicalSlugs) {
        if (slug) seedSlugs.add(slug);
      }
    }

    let resolvedCategoryId = data.categoryId;

    const hexIds = new Set<string>();
    if (rawCategoryId && isHexId(rawCategoryId)) {
      hexIds.add(rawCategoryId);
    }
    const slugCandidates = new Set<string>();
    for (const entry of seedSlugs) {
      if (isHexId(entry)) {
        hexIds.add(entry);
      } else {
        slugCandidates.add(entry);
      }
    }

    if (hexIds.size > 0 || slugCandidates.size > 0) {
      try {
        const { CategoryModel } = await import("../category/category.model");
        const orClauses: Record<string, unknown>[] = [];
        if (hexIds.size > 0) {
          orClauses.push({ _id: { $in: Array.from(hexIds) } });
        }
        if (slugCandidates.size > 0) {
          orClauses.push({ slug: { $in: Array.from(slugCandidates) } });
        }

        const matchedCats = await CategoryModel.find({ $or: orClauses })
          .select("_id slug")
          .lean()
          .exec();

        if (!resolvedCategoryId && matchedCats.length > 0) {
          resolvedCategoryId = String((matchedCats[0] as any)._id);
        }

        for (const catDoc of matchedCats as Array<{ _id?: unknown; slug?: string }>) {
          const curId = catDoc._id ? String(catDoc._id) : "";
          const catSlug = typeof catDoc.slug === "string" ? catDoc.slug.trim() : "";
          if (!catSlug) continue;

          // Replace raw ObjectIds with that exact category's own slug (without adding parents).
          if (curId && seedSlugs.has(curId)) {
            seedSlugs.delete(curId);
            seedSlugs.add(catSlug);
          } else if (curId && rawCategoryId === curId && seedSlugs.size === 0) {
            seedSlugs.add(catSlug);
          }
        }
      } catch {
        // Non-blocking fallback when Category lookup is unavailable (e.g. disconnected unit tests)
      }
    }

    return {
      categoryId: resolvedCategoryId,
      categorySlugs: Array.from(seedSlugs),
    };
  }

  static async updateProduct(id: string, data: Partial<IProduct>): Promise<IProduct> {
    if (data.specialPriceFromDate !== undefined) {
      data.specialPriceFromDate = parseDateOrNull(data.specialPriceFromDate) as any;
    }
    if (data.specialPriceToDate !== undefined) {
      data.specialPriceToDate = parseDateOrNull(data.specialPriceToDate) as any;
    }
    // Resolve real document if id is slug, SKU, or ObjectId
    let existingDoc = await ProductRepository.findById(id);
    if (!existingDoc) {
      existingDoc = await ProductRepository.findBySlug(id);
    }
    if (!existingDoc) {
      throw new NotFoundError("Product");
    }
    const realId = String((existingDoc as any)._id);

    if (data.sku) {
      const check = await this.checkSkuAvailability(data.sku, realId);
      if (!check.available && check.existingProduct) {
        throw new ConflictError(
          `A product with SKU "${data.sku}" already exists ("${check.existingProduct.name}"). SKU must be unique across the catalog.`
        );
      }
    }
    if (data.slug) {
      data.slug = slugify(data.slug);
      const slugCheck = await this.checkSlugAvailability(data.slug, realId);
      if (!slugCheck.available && slugCheck.existingProduct) {
        throw new ConflictError(
          `A product with URL Slug "${data.slug}" already exists ("${slugCheck.existingProduct.name}"). URL slug must be unique.`
        );
      }
    }
    if (!data.slug && data.name) {
      data.slug = slugify(data.name);
    }

    const hasExistingSlugs = Array.isArray(existingDoc.categorySlugs) && existingDoc.categorySlugs.length > 0;
    if (
      data.categorySlugs !== undefined ||
      data.categoryId !== undefined ||
      (data.magentoCategories && !hasExistingSlugs)
    ) {
      const enriched = await this.resolveAndEnrichCategoryAssignment({
        name: data.name ?? existingDoc.name,
        magentoCategories: data.magentoCategories,
        categoryId: data.categoryId,
        categorySlugs: data.categorySlugs,
      });
      if (
        data.categorySlugs !== undefined ||
        data.categoryId !== undefined ||
        enriched.categorySlugs.length > 0
      ) {
        data.categorySlugs = enriched.categorySlugs;
      }
      if (!data.categoryId && enriched.categoryId && (data.categorySlugs !== undefined || !existingDoc.categoryId)) {
        data.categoryId = enriched.categoryId;
      }
    }

    let product;
    try {
    // Sanitize colorImages keys: MongoDB BSON keys cannot contain dots (.)
    if (data.colorImages && typeof data.colorImages === "object") {
      const sanitizedColorImages: Record<string, string> = {};
      const entries = data.colorImages instanceof Map
        ? Array.from(data.colorImages.entries())
        : Object.entries(data.colorImages);
      for (const [key, val] of entries) {
        if (typeof val === "string") {
          const safeKey = key.replace(/\./g, " ").replace(/\s+/g, " ").trim();
          sanitizedColorImages[safeKey] = val;
        }
      }
      data.colorImages = sanitizedColorImages;
    }
    // Sanitize colorSwatches keys: MongoDB BSON keys cannot contain dots (.)
    if (data.colorSwatches && typeof data.colorSwatches === "object") {
      const sanitizedColorSwatches: Record<string, string> = {};
      const entries = data.colorSwatches instanceof Map
        ? Array.from(data.colorSwatches.entries())
        : Object.entries(data.colorSwatches);
      for (const [key, val] of entries) {
        if (typeof val === "string") {
          const safeKey = key.replace(/\./g, " ").replace(/\s+/g, " ").trim();
          sanitizedColorSwatches[safeKey] = val;
        }
      }
      data.colorSwatches = sanitizedColorSwatches;
    }

    if (Array.isArray(data.variants)) {
      data.variants.forEach((v: any) => {
        if (v.color && typeof v.color === "string" && v.color.includes(".")) {
          v.color = v.color.replace(/\./g, " ").replace(/\s+/g, " ").trim();
        }
        if (v.attributes && typeof v.attributes === "object") {
          const col = v.attributes.color || v.attributes.colour;
          if (typeof col === "string" && col.includes(".")) {
            const cleanCol = col.replace(/\./g, " ").replace(/\s+/g, " ").trim();
            if (v.attributes.color) v.attributes.color = cleanCol;
            if (v.attributes.colour) v.attributes.colour = cleanCol;
          }
        }
      });
    }

    product = await ProductRepository.update(realId, data);
    } catch (err: any) {
      if (err.code === 11000) {
        if (err.keyPattern?.sku) {
          throw new ConflictError(`A product with SKU "${data.sku}" already exists. SKU must be unique.`);
        }
        if (err.keyPattern?.slug) {
          throw new ConflictError(`Slug "${data.slug}" already exists. Please choose a unique URL slug.`);
        }
      }
      throw err;
    }
    if (!product) throw new NotFoundError("Product");
    
    // Sync to search index & invalidate cache for old slug and new slug
    await indexProduct(product);
    await this.invalidateProductCache(existingDoc.slug);
    if (product.slug && product.slug !== existingDoc.slug) {
      await this.invalidateProductCache(product.slug);
      if (existingDoc.slug) {
        const { UrlRedirectService } = await import("../url-redirect/url-redirect.service");
        await UrlRedirectService.recordSlugChange(
          `/${existingDoc.slug}`,
          `/${product.slug}`,
          "auto_product",
          `Product "${product.name}" slug updated`
        );
      }
    }
    
    return product;
  }

  static async deleteProduct(id: string): Promise<void> {
    const product = await ProductRepository.findById(id);
    if (!product) throw new NotFoundError("Product");
    await ProductRepository.delete(id);
    await removeProductFromIndex(id);
    await this.invalidateProductCache(product.slug);
  }

  private static async invalidateProductCache(slug?: string) {
    if (slug) {
      await deleteCache(`product_slug_${slug}`);
      await deleteCache(`product_slug_v2_${slug}`);
      await deleteCache(`product_slug_v4_${slug}`);
      await deleteCache(`product_slug_v5_${slug}`);
      await deleteCache(`product_slug_v6_${slug}`);
      await deleteCache(`product_kit_v4_${slug}`);
      await deleteCache(`product_kit_v5_${slug}`);
      await deleteCache(`product_upsell_v4_${slug}`);
      await deleteCache(`product_upsell_v5_${slug}`);
      await deleteCache(`product_crosssell_v3_${slug}`);
      await deleteCache(`product_crosssell_v4_${slug}`);
    }
    await clearProductCaches(Boolean(slug));
  }

  static async bulkUpdateFromCsv(csvContent: string): Promise<{ successCount: number; errorRows: any[] }> {
    const Papa = (await import("papaparse")).default;
    const mongoose = (await import("mongoose")).default;

    return new Promise((resolve, reject) => {
      Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        complete: async (results: any) => {
          const rows = results.data as any[];
          let successCount = 0;
          const errorRows: any[] = [];

          let session: any = null;
          const canUseTx = await supportsTransactions();
          if (canUseTx) {
            try {
              session = await mongoose.startSession();
              session.startTransaction();
            } catch {
              session = null; // graceful fallback for standalone MongoDB instances
            }
          }

          try {
            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              if (!row || typeof row !== "object") continue;

              // Helper for case-insensitive, BOM-safe column extraction (returns undefined for blanks/whitespace)
              const getCol = (aliases: string[]) => getCsvColumnValue(row, aliases);

              const rawOldSku = getCol(["old_sku", "oldSku", "original_sku", "previous_sku", "rename_from"]);
              const rawSku = getCol(["sku", "SKU", "Sku", "variant_sku", "variantSku", "new_sku", "newSku"]);

              const lookupSku = (rawOldSku || rawSku)?.trim();
              if (!lookupSku) {
                errorRows.push({ row: i + 2, reason: "SKU is missing in CSV row" });
                continue;
              }

              const updateData: any = {};

              // SKU Renaming: if old_sku was specified and differs from new sku
              if (rawOldSku && rawSku && rawOldSku.trim().toLowerCase() !== rawSku.trim().toLowerCase()) {
                updateData.sku = rawSku.trim();
                updateData.newSku = rawSku.trim();
              }

              // 1. Basic Information & Content
              const rawName = getCol(["name", "Name", "title", "Title", "product_name"]);
              if (rawName && rawName.toLowerCase() !== "#n/a") {
                updateData.name = rawName;
              }

              const rawDesc = getCol(["description", "Description"]);
              if (rawDesc) {
                updateData.description = rawDesc;
              }

              const rawShortDesc = getCol(["short_description", "shortDescription", "ShortDescription"]);
              if (rawShortDesc) {
                updateData.shortDescription = rawShortDesc;
              }

              const rawSlug = getCol(["url_key", "slug", "urlKey", "UrlKey"]);
              if (rawSlug) {
                updateData.slug = slugify(rawSlug);
              }

              // 2. Pricing & Dates (strict numeric/date validation so garbage values never write NaN or Invalid Date)
              const parsedPrice = parseCsvNumber(getCol(["price", "basePrice", "base_price", "Price"]));
              if (parsedPrice !== undefined && parsedPrice > 0) {
                updateData.basePrice = parsedPrice;
              }

              const parsedSpecialPrice = parseCsvNumber(getCol(["special_price", "specialPrice", "SpecialPrice", "specialprice"]));
              if (parsedSpecialPrice !== undefined && parsedSpecialPrice > 0) {
                updateData.specialPrice = parsedSpecialPrice;
              }

              const parsedSpecialFrom = parseCsvDate(getCol(["special_from_date", "specialPriceFromDate", "special_from"]));
              if (parsedSpecialFrom) {
                updateData.specialPriceFromDate = parsedSpecialFrom;
              }

              const parsedSpecialTo = parseCsvDate(getCol(["special_to_date", "specialPriceToDate", "special_to"]));
              if (parsedSpecialTo) {
                updateData.specialPriceToDate = parsedSpecialTo;
              }

              // 3. Inventory, Stock & Shipping
              const parsedQty = parseCsvInt(getCol(["qty", "stock", "quantity", "Qty", "Stock"]));
              if (parsedQty !== undefined) {
                updateData.qty = parsedQty;
              }

              const parsedStockStatus = parseCsvStockStatus(getCol(["is_in_stock", "stockStatus", "stock_status", "isInStock"]));
              if (parsedStockStatus !== undefined) {
                updateData.stockStatus = parsedStockStatus;
              } else if (parsedQty !== undefined) {
                updateData.stockStatus = parsedQty > 0 ? 1 : 0;
              }

              const rawBackorders = getCol(["backorders", "allowBackorders", "allow_backorders"]);
              if (rawBackorders !== undefined) {
                updateData.allowBackorders = rawBackorders === "1" || rawBackorders.toLowerCase() === "true";
              }

              const rawFreeShipping = getCol(["free_shipping", "isFreeShipping", "is_free_shipping"]);
              if (rawFreeShipping !== undefined) {
                updateData.isFreeShipping = rawFreeShipping === "1" || rawFreeShipping.toLowerCase() === "true";
              }

              // 4. Physical Specs & Logistics (Weight, Dimensions — only write when present)
              const parsedWeight = extractProductWeight(row);
              if (parsedWeight.weight !== undefined && parsedWeight.weight > 0) {
                updateData.weight = parsedWeight.weight;
                updateData.weightUnit = parsedWeight.weightUnit || "kg";
              }

              // Auto-catch dimensions from separate columns (length/breadth/height, l/w/h, etc.), combined string (30x20x10), or attributes
              const parsedDims = extractProductDimensions(row);
              const hasParsedDimensions =
                (parsedDims.length !== undefined && parsedDims.length > 0) ||
                (parsedDims.breadth !== undefined && parsedDims.breadth > 0) ||
                (parsedDims.height !== undefined && parsedDims.height > 0);
              if (hasParsedDimensions) {
                if (parsedDims.length !== undefined && parsedDims.length > 0) updateData.length = parsedDims.length;
                if (parsedDims.breadth !== undefined && parsedDims.breadth > 0) updateData.breadth = parsedDims.breadth;
                if (parsedDims.height !== undefined && parsedDims.height > 0) updateData.height = parsedDims.height;
                updateData.dimensionUnit = parsedDims.dimensionUnit || "cm";
              }

              const rawGender = getCol(["gender", "Gender"]);
              if (rawGender) {
                updateData.gender = rawGender;
              }

              const rawCountry = getCol(["country_of_manufacture", "countryOfManufacture", "country"]);
              if (rawCountry) {
                updateData.countryOfManufacture = rawCountry;
              }

              const rawHsn = getCol(["hsn_code", "hsnCode", "hsncode", "tax_class_name", "taxClassName"]);
              if (rawHsn) {
                updateData.hsnCode = rawHsn;
              }

              // 5. SEO & Meta Tags
              const rawMetaTitle = getCol(["meta_title", "metaTitle", "MetaTitle"]);
              if (rawMetaTitle) {
                updateData.metaTitle = rawMetaTitle;
              }

              const rawMetaDesc = getCol(["meta_description", "metaDescription", "MetaDescription"]);
              if (rawMetaDesc) {
                updateData.metaDescription = rawMetaDesc;
              }

              const rawMetaKeywords = getCol(["meta_keyword", "meta_keywords", "metaKeywords", "MetaKeywords"]);
              if (rawMetaKeywords) {
                updateData.metaKeywords = rawMetaKeywords;
              }

              // 6. Cross-sells, Upsells & Related SKUs
              const parseSkuList = (val: string): string[] =>
                val.split(/[,|]/).map((s) => s.trim()).filter(Boolean);

              const rawRelated = getCol(["related_skus", "relatedSkus", "RelatedSkus"]);
              if (rawRelated) {
                updateData.relatedSkus = parseSkuList(rawRelated);
              }

              const rawUpsell = getCol(["upsell_skus", "upsellSkus", "UpsellSkus"]);
              if (rawUpsell) {
                updateData.upsellSkus = parseSkuList(rawUpsell);
              }

              const rawCrosssell = getCol(["crosssell_skus", "crosssellSkus", "CrosssellSkus"]);
              if (rawCrosssell) {
                updateData.crosssellSkus = parseSkuList(rawCrosssell);
              }

              // 7. Swatches & Size Chart
              const rawSizeChart = getCol([
                "size_chart",
                "sizeChart",
                "SizeChart",
                "sizechart",
                "size_chart_01",
                "size_guide",
                "sizeGuide",
                "SizeGuide",
                "Size Chart",
                "Size chart",
              ]);
              if (rawSizeChart) {
                updateData.sizeChart = rawSizeChart;
                updateData.size_chart = rawSizeChart;
              }

              const rawColorSwatches = getCol(["color_swatches", "colorSwatches", "ColorSwatches"]);
              if (rawColorSwatches) {
                const parsedSwatches: Record<string, string> = {};
                rawColorSwatches.split("|").forEach((item: string) => {
                  const eqIdx = item.indexOf("=");
                  if (eqIdx !== -1) {
                    const col = item.slice(0, eqIdx);
                    const hex = item.slice(eqIdx + 1);
                    if (col && hex) {
                      const cleanKey = col.replace(/\./g, " ").replace(/\s+/g, " ").trim();
                      parsedSwatches[cleanKey] = hex.trim();
                    }
                  }
                });
                if (Object.keys(parsedSwatches).length > 0) {
                  updateData.colorSwatches = parsedSwatches;
                }
              }

              // 8. Status & Visibility
              const rawStatus = getCol(["status", "product_online"]);
              if (rawStatus !== undefined) {
                updateData.status = (rawStatus === "1" || rawStatus.toLowerCase() === "published" || rawStatus.toLowerCase() === "enabled") ? "published" : "draft";
              }

              // 9. Brand (auto-link brandId and brandSlug if matched)
              const rawBrand = getCol(["brand", "Brand"]);
              if (rawBrand) {
                const cleanBrand = rawBrand;
                updateData.brand = cleanBrand;
                try {
                  const { BrandModel } = await import("../brand/brand.model");
                  const brandDoc: any = await BrandModel.findOne({
                    $or: [
                      { name: new RegExp(`^${cleanBrand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
                      { slug: cleanBrand.toLowerCase() }
                    ]
                  }).lean().exec();
                  if (brandDoc && brandDoc._id) {
                    updateData.brandId = brandDoc._id.toString();
                    updateData.brandSlug = brandDoc.slug;
                  }
                } catch {
                  // Continue if BrandModel lookup fails
                }
              }

              // 10. Categories & Canonical resolution
              const rawCats = getCol(["categories", "magentoCategories", "category"]);
              if (rawCats) {
                updateData.magentoCategories = rawCats;
                const canonicalSlugs = resolveCanonicalCategorySlugs({
                  name: updateData.name || "",
                  magentoCategories: rawCats,
                });
                if (canonicalSlugs && canonicalSlugs.length > 0) {
                  updateData.categoryId = canonicalSlugs[0];
                  updateData.categorySlugs = canonicalSlugs;
                }
              }

              try {
                let product = await ProductRepository.updateBySku(lookupSku, updateData, session);

                // Fallback: if old_sku column contained a historical reference while current sku exists in DB
                if (!product && rawOldSku && rawSku && rawOldSku.trim().toLowerCase() !== rawSku.trim().toLowerCase()) {
                  const { sku: _dropSku, newSku: _dropNewSku, ...updateWithoutRename } = updateData;
                  product = await ProductRepository.updateBySku(rawSku.trim(), updateWithoutRename, session);
                }

                if (!product) {
                  errorRows.push({ row: i + 2, reason: `Product or Variant with SKU "${lookupSku}" not found` });
                } else {
                  successCount++;
                  indexProduct(product).catch((err) =>
                    logger.error(`[BulkCsvUpdate] Meilisearch sync failed for SKU ${lookupSku}:`, err)
                  );
                  await this.invalidateProductCache(product.slug);
                }
              } catch (rowErr: any) {
                errorRows.push({ row: i + 2, reason: rowErr.message || `Failed to update SKU "${lookupSku}"` });
              }
            }

            if (session) {
              await session.commitTransaction();
              session.endSession();
            }
            resolve({ successCount, errorRows });
          } catch (error: any) {
            if (session) {
              await session.abortTransaction();
              session.endSession();
            }
            reject(error);
          }
        },
        error: (error: any) => {
          reject(error);
        },
      });
    });
  }

  static async exportCsv(brand?: string): Promise<string> {
    const { ProductModel } = await import("./product.model");
    
    const filter: any = {};
    if (brand && brand.trim() && brand !== "all") {
      const cleanBrand = brand.trim();
      let brandDoc: any = null;
      try {
        const { BrandModel } = await import("../brand/brand.model");
        brandDoc = await BrandModel.findOne({
          $or: [
            { slug: cleanBrand.toLowerCase() },
            { name: new RegExp(`^${cleanBrand.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`, "i") },
          ],
        }).lean().exec();
      } catch (err) {
        // Continue with name match
      }

      const matchingNames = new Set<string>([cleanBrand]);
      if (brandDoc) {
        if (brandDoc.name) matchingNames.add(brandDoc.name);
        if (brandDoc.slug) matchingNames.add(brandDoc.slug);
      }

      const regexPattern = Array.from(matchingNames)
        .map((n) => n.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"))
        .join("|");

      filter.$or = [
        { brand: { $regex: new RegExp(regexPattern, "i") } },
        ...(brandDoc?._id ? [{ brandId: brandDoc._id.toString() }] : []),
      ];
    }

    // Fetch products
    const products = await ProductModel.find(filter).lean().exec();

    // Map to Magento CSV Headers with image labels and swatches
    const baseHeaders = [
      "sku", "name", "description", "short_description", "url_key", "price", "special_price",
      "special_from_date", "special_to_date", "weight", "weight_unit", "length", "breadth", "height", "dimension_unit", "is_in_stock", "qty", "product_type",
      "categories", "brand", "tax_class_name", "status", "visibility",
      "base_image", "base_image_label",
      "additional_images", "additional_image_labels",
      "swatch_image", "swatch_image_label",
      "color_swatches",
      "configurable_variations", "related_skus", "upsell_skus", "crosssell_skus", "size_chart", "gender",
      "country_of_manufacture", "attribute_set_code", "configurable_variation_labels", "free_shipping", "ship_cost",
      "backorders", "meta_title", "meta_keyword", "meta_description"
    ];

    const ignoredExportAttrKeys = new Set([
      "codazon_custom_tab",
      "product name",
      "options_container",
      "has_options",
      "required_options",
      "gift_message_available",
      "additional_attributes",
      "url_path",
      "small_image",
      "thumbnail",
      "frameborder",
      "allowfullscreen",
      "size_chart_01",
      "size_chart_02",
      "size_chart_03",
    ]);

    const isCleanExportAttrKey = (key: string): boolean => {
      const k = key.trim().toLowerCase();
      if (!k || k.length > 35) return false;
      if (/["'|,<>{}()[\]]/.test(k)) return false;
      if (ignoredExportAttrKeys.has(k) || k.startsWith("size_chart") || k.startsWith("sizechart")) return false;
      return true;
    };

    // Collect all unique clean dynamic attribute keys across all products
    const dynamicAttrKeys = new Set<string>();
    products.forEach((p: any) => {
      if (p.attributes && typeof p.attributes === "object") {
        const attrsObj = p.attributes instanceof Map ? Object.fromEntries(p.attributes) : p.attributes;
        Object.keys(attrsObj).forEach((k) => {
          if (!baseHeaders.includes(k) && k !== "size_chart" && isCleanExportAttrKey(k)) {
            dynamicAttrKeys.add(k);
          }
        });
      }
    });

    const dynamicHeaders = Array.from(dynamicAttrKeys);
    const allHeaders = [...baseHeaders, ...dynamicHeaders];

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return "";
      const s = String(str);
      if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows: string[] = [];

    products.forEach((p: any) => {
      const baseImg = p.images?.[0]?.url || "";
      const baseImgAlt = p.images?.[0]?.altText || p.name || "";
      const additionalImgs = p.images?.slice(1).map((i: any) => i.url).join(",") || "";
      const additionalImgAlts = p.images?.slice(1).map((i: any) => i.altText || p.name || "").join(",") || "";

      // Extract swatch image from colorImages or first variant
      let swatchImg = "";
      let swatchAlt = "";
      if (p.colorImages) {
        const cMap = p.colorImages instanceof Map ? Object.fromEntries(p.colorImages) : p.colorImages;
        const firstVal = Object.values(cMap)[0];
        if (typeof firstVal === "string") swatchImg = firstVal;
      }
      if (!swatchImg && p.variants?.[0]?.imageUrl) {
        swatchImg = p.variants[0].imageUrl;
        swatchAlt = p.variants[0].altText || p.variants[0].images?.[0]?.altText || "";
      }

      // Extract colorSwatches formatted string
      let colorSwatchesStr = "";
      if (p.colorSwatches && typeof p.colorSwatches === "object") {
        const sMap = p.colorSwatches instanceof Map ? Object.fromEntries(p.colorSwatches) : p.colorSwatches;
        colorSwatchesStr = Object.entries(sMap).map(([col, hex]) => `${col}=${hex}`).join("|");
      }

      const configurableVars = p.variants?.map((v: any) => {
        const attrs = Object.entries(v.attributes || {}).map(([k, val]) => `${k}=${val}`).join(",");
        const imgPart = v.imageUrl ? `,image=${v.imageUrl}` : "";
        const altPart = (v.altText || v.images?.[0]?.altText) ? `,altText=${v.altText || v.images?.[0]?.altText}` : "";
        return `sku=${v.sku},price=${v.price},qty=${v.stock}${attrs ? ',' + attrs : ''}${imgPart}${altPart}`;
      }).join("|") || p.configurableVariations || "";

      // 1. Parent product row
      const parentBaseRow = [
        p.sku,
        p.name,
        p.description,
        p.shortDescription,
        p.slug,
        p.basePrice,
        p.specialPrice || "",
        p.specialPriceFromDate ? new Date(p.specialPriceFromDate).toISOString().split("T")[0] : "",
        p.specialPriceToDate ? new Date(p.specialPriceToDate).toISOString().split("T")[0] : "",
        p.weight || "",
        (p as any).weightUnit || "kg",
        (p as any).length || "",
        (p as any).breadth || "",
        (p as any).height || "",
        (p as any).dimensionUnit || "cm",
        p.stockStatus,
        p.qty,
        p.productType,
        p.magentoCategories || p.categorySlugs?.join(","),
        p.brand || "",
        p.taxClassName || "",
        p.status === "published" ? "1" : "0",
        p.visibility || "",
        baseImg,
        baseImgAlt,
        additionalImgs,
        additionalImgAlts,
        swatchImg,
        swatchAlt,
        colorSwatchesStr,
        configurableVars,
        p.relatedSkus?.join(",") || "",
        p.upsellSkus?.join(",") || "",
        p.crosssellSkus?.join(",") || "",
        p.sizeChart || (p.attributes && p.attributes.size_chart) || "",
        p.gender || "",
        p.countryOfManufacture || "",
        p.attributeSetCode || "",
        p.configurableVariationLabels || "",
        p.isFreeShipping ? "1" : "0",
        (p.attributes instanceof Map ? p.attributes.get("ship_cost") : p.attributes?.ship_cost) || "",
        p.allowBackorders ? "1" : "0",
        p.metaTitle || "",
        p.metaKeywords || "",
        p.metaDescription || "",
      ];

      const parentAttrsObj = p.attributes instanceof Map ? Object.fromEntries(p.attributes) : (p.attributes || {});
      const parentDynamicRow = dynamicHeaders.map((k) => parentAttrsObj[k] || "");
      rows.push([...parentBaseRow, ...parentDynamicRow].map(escapeCsv).join(","));

      // 2. Export individual child variant rows for complete visibility & bulk editing
      if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
        p.variants.forEach((v: any) => {
          const vColor = v.attributes instanceof Map
            ? (v.attributes.get("color") || v.attributes.get("colour") || "")
            : (v.attributes?.color || v.attributes?.colour || v.color || "");
          const vSize = v.attributes instanceof Map
            ? (v.attributes.get("size") || v.attributes.get("eu_size") || "")
            : (v.attributes?.size || v.attributes?.eu_size || v.size || "");
          const vName = `${p.name} - ${[vColor, vSize].filter(Boolean).join(" ")}`.trim();
          const vImg = v.imageUrl || v.images?.[0]?.url || "";
          const vAlt = v.altText || v.images?.[0]?.altText || vName;

          const childBaseRow = [
            v.sku,
            vName,
            p.description,
            p.shortDescription,
            `${p.slug}-${slugify(v.sku)}`,
            v.price ?? p.basePrice,
            v.specialPrice || "",
            "", // special_from_date
            "", // special_to_date
            v.weight || p.weight || "",
            (v as any).weightUnit || (p as any).weightUnit || "kg",
            (v as any).length || (p as any).length || "",
            (v as any).breadth || (p as any).breadth || "",
            (v as any).height || (p as any).height || "",
            (v as any).dimensionUnit || (p as any).dimensionUnit || "cm",
            (v.stock > 0 || p.allowBackorders) ? "1" : "0",
            v.stock ?? 0,
            "simple", // child product type
            p.magentoCategories || p.categorySlugs?.join(","),
            p.brand || "",
            p.taxClassName || "",
            v.status === "disabled" ? "0" : "1",
            "Not Visible Individually", // standard Magento child visibility
            vImg,
            vAlt,
            "", // additional_images
            "", // additional_image_labels
            vImg,
            vAlt,
            "", // color_swatches
            "", // configurable_variations
            "", // related_skus
            "", // upsell_skus
            "", // crosssell_skus
            p.sizeChart || "",
            p.gender || "",
            p.countryOfManufacture || "",
            p.attributeSetCode || "",
            "", // configurable_variation_labels
            p.isFreeShipping ? "1" : "0",
            "", // ship_cost (inherited from parent)
            p.allowBackorders ? "1" : "0",
            vName,
            p.metaKeywords || "",
            p.metaDescription || "",
          ];

          const childDynamicRow = dynamicHeaders.map((k) => {
            if (k === "color") return vColor;
            if (k === "size") return vSize;
            return parentAttrsObj[k] || "";
          });

          rows.push([...childBaseRow, ...childDynamicRow].map(escapeCsv).join(","));
        });
      }
    });

    return [allHeaders.join(","), ...rows].join("\n");
  }
}
