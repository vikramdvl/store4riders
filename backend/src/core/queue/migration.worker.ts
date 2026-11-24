import { Worker, Job } from "bullmq";
import { ENV } from "../config/env";
import { logger } from "../utils/logger";
import { createWorkerRedisConnection } from "./redis-connection";
import { connectToDatabase } from "../database/connection";
import fs from "fs";
import csv from "csv-parser";
import { ProductModel } from "../../modules/product/product.model";
import mongoose from "mongoose";
import { CategoryModel } from "../../modules/category/category.model";
import { BrandModel } from "../../modules/brand/brand.model";
import { slugify, extractProductDimensions, extractProductWeight, parseAttributesString } from "@store4riders/shared-utils";
import { resolveCanonicalCategorySlugs } from "../../modules/product/product.category-constants";

// BullMQ Worker dedicated connection
const connection = createWorkerRedisConnection("migrationWorker");

const KNOWN_FIELDS = new Set([
  "name", "description", "short_description", "url_key", "slug", "sku", "price", "special_price",
  "base_price", "baseprice", "specialprice",
  "weight", "weight_unit", "length", "breadth", "width", "height", "dimension_unit", "dimensions",
  "package_length", "package_width", "package_breadth", "package_height", "package_dimensions",
  "shipping_length", "shipping_width", "shipping_breadth", "shipping_height",
  "l", "w", "h", "b", "is_in_stock", "stock_status", "product_type", "categories", "base_image", "additional_images",
  "additional_attributes", "additionalattributes",
  "configurable_variations", "related_skus", "upsell_skus", "crosssell_skus", "qty", "stock", "quantity",
  "status", "product_online", "visibility", "tax_class_name", "brand",
  "meta_title", "meta_keyword", "meta_keywords", "meta_description", "size_chart", "sizechart", "gender",
  "gender_1", "country_of_manufacture", "country_of_origin", "attribute_set_code", 
  "attribute_set", "configurable_variation_labels", "backorders", "free_shipping",
  "special_from_date", "special_to_date", "parent_sku", "parentsku", "old_sku", "oldsku"
]);

/**
 * Case-insensitive column value extractor across different CSV dialects
 */
function getCol(row: any, aliases: string[]): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== "") {
      return String(row[alias]).trim();
    }
    const lower = alias.toLowerCase();
    const foundKey = Object.keys(row).find((k) => k.trim().toLowerCase() === lower);
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== "") {
      return String(row[foundKey]).trim();
    }
  }
  return undefined;
}

/**
 * Checks if visibility indicates child variant (not visible individually)
 */
function isChildVisibility(visibility: string | undefined): boolean {
  if (!visibility) return false;
  const v = visibility.trim().toLowerCase();
  return v === "not visible individually" || v === "1";
}

export const migrationWorker = new Worker("migrationQueue", async (job: Job) => {
  const { filePath, s3Key, adminId } = job.data;
  logger.info(`Processing migration job ${job.id}. S3 Key: ${s3Key || "none"}, Local Path: ${filePath || "none"}`);

  if (mongoose.connection.readyState === 0) {
    await connectToDatabase();
  }

  // 1. Get stream from S3 or local filesystem
  let stream: NodeJS.ReadableStream;
  if (s3Key) {
    const { getS3Stream } = await import("../storage/s3");
    stream = await getS3Stream(s3Key);
    logger.info(`Job ${job.id}: Streaming CSV directly from AWS S3 (key: ${s3Key})`);
  } else if (filePath && fs.existsSync(filePath)) {
    stream = fs.createReadStream(filePath);
    logger.info(`Job ${job.id}: Streaming CSV from local file system (${filePath})`);
  } else {
    throw new Error(`CSV file source missing or not found on server (s3Key: ${s3Key || "none"}, filePath: ${filePath || "none"})`);
  }

  const configurables = new Map<string, any>();
  const simples = new Map<string, any>();
  const categoriesToCreate = new Set<string>();
  const brandsToCreate = new Set<string>();
  const allParsedRows: any[] = [];

  // Pass 1: Stream and Parse the CSV
  await new Promise((resolve, reject) => {
    stream
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim().replace(/^\ufeff/, ""),
      }))
      .on("data", (row) => {
        const sku = (getCol(row, ["sku", "\ufeffsku", "ï»¿sku"]))?.trim();
        if (!sku || sku.toLowerCase() === "sku") return; // Skip empty rows or duplicate headers

        const brand = getCol(row, ["brand"]);
        if (brand) brandsToCreate.add(brand);

        const cats = getCol(row, ["categories"]);
        if (cats) categoriesToCreate.add(cats);

        const productType = getCol(row, ["product_type"])?.toLowerCase();
        if (productType === "configurable") {
          configurables.set(sku, row);
        } else {
          simples.set(sku, row);
        }
        allParsedRows.push(row);
      })
      .on("end", () => {
        logger.info(`CSV parsing complete for job ${job.id}. Found ${configurables.size} configurables and ${simples.size} simples.`);
        resolve(true);
      })
      .on("error", (err) => {
        logger.error(`Error parsing CSV in job ${job.id}:`, err);
        reject(err);
      });
  });

  // AUTO-GENERATE CATEGORIES AND BRANDS (Preserving existing logic)
  logger.info(`Extracting Brands & Categories... Found ${brandsToCreate.size} raw brands and ${categoriesToCreate.size} raw category strings.`);
  
  const INVALID_BRAND_SLUGS = new Set(["honda", "dominar", "radiator", "yamaha", "suzuki", "ktm", "bajaj"]);
  const BRAND_MAP: Record<string, string> = {
    honda: "Moto Fusion",
    dominar: "Motospunk",
    radiator: "Moto Fusion",
  };

  for (let b of brandsToCreate) {
    if (!b) continue;
    const lower = b.trim().toLowerCase();
    if (BRAND_MAP[lower]) {
      b = BRAND_MAP[lower];
    } else if (INVALID_BRAND_SLUGS.has(lower)) {
      continue;
    }
    const slug = slugify(b);
    await BrandModel.updateOne({ slug }, { $set: { name: b, slug, isActive: true } }, { upsert: true });
  }

  for (const catStr of categoriesToCreate) {
    if (!catStr) continue;
    const paths = catStr.split(",");
    for (const singlePath of paths) {
      const parts = singlePath.split("/").map(p => p.trim()).filter(Boolean);
      let parentId: string | null = null;
      let currentSlug = "";
      for (const p of parts) {
        if (p === "Default Category" || p === "Root Catalog") continue;
        currentSlug = currentSlug ? `${currentSlug}-${slugify(p)}` : slugify(p);
        const cat: any = await CategoryModel.findOneAndUpdate(
          { slug: currentSlug },
          { $set: { name: p, slug: currentSlug, parentId: parentId || null } },
          { upsert: true, new: true }
        );
        if (cat && cat._id) {
          parentId = cat._id.toString();
        }
      }
    }
  }

  // Pre-Scan: Collect all unique SKUs from the CSV and parent_skus to check DB
  const parentSkusFromChildren = Array.from(simples.values())
    .map((r: any) => getCol(r, ["parent_sku", "parentsku"]))
    .filter(Boolean) as string[];

  const allCsvSkus = Array.from(new Set([
    ...Array.from(configurables.keys()),
    ...Array.from(simples.keys()),
    ...parentSkusFromChildren
  ]));

  logger.info(`Job ${job.id}: Checking MongoDB for ${allCsvSkus.length} unique SKUs...`);

  // 1. Existing root products in MongoDB
  const existingRoots = await ProductModel.find({ sku: { $in: allCsvSkus } })
    .select("sku name basePrice specialPrice images variants status qty stockStatus description categoryId brand slug attributes")
    .lean()
    .exec();
  const rootSkuMap = new Map(existingRoots.map((p: any) => [p.sku, p]));

  // 2. Existing child variants inside other products in MongoDB
  const existingVariantParents = await ProductModel.find({ "variants.sku": { $in: allCsvSkus } })
    .select("sku name basePrice specialPrice variants stockStatus qty allowBackorders")
    .lean()
    .exec();

  const variantToParentMap = new Map<string, { parentSku: string; parentDoc: any; variantIndex: number }>();
  existingVariantParents.forEach((parentDoc: any) => {
    (parentDoc.variants || []).forEach((v: any, index: number) => {
      if (allCsvSkus.includes(v.sku)) {
        variantToParentMap.set(v.sku, {
          parentSku: parentDoc.sku,
          parentDoc,
          variantIndex: index
        });
      }
    });
  });

  logger.info(`Job ${job.id}: Pre-scan result - Found ${rootSkuMap.size} existing root products, ${variantToParentMap.size} existing child variants in DB.`);

  // S3 Image URL Formatter
  const s3BaseUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/catalog/product`;
  const formatImageUrl = (url: string) => {
    url = url.trim();
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return url.startsWith("/") ? `${s3BaseUrl}${url}` : `${s3BaseUrl}/${url}`;
  };

  // Helper to map a raw CSV row into standardized product attributes
  const mapRowToProduct = (row: any) => {
    const attributes: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      if (!KNOWN_FIELDS.has(key) && value && String(value).trim() !== "") {
        attributes[key] = String(value).trim();
      }
    }

    // Unfold Magento additional_attributes (or JSON attributes) into distinct attributes
    const rawAdditional = getCol(row, ["additional_attributes", "additionalattributes"]);
    if (rawAdditional) {
      const parsedAdd = parseAttributesString(rawAdditional);
      for (const [k, v] of Object.entries(parsedAdd)) {
        if (!attributes[k] && v) {
          attributes[k] = String(v).trim();
        }
      }
    }
    delete attributes["additional_attributes"];
    delete attributes["additionalattributes"];

    const images: any[] = [];
    const baseImage = getCol(row, ["base_image"]);
    if (baseImage) {
      const formatted = formatImageUrl(baseImage);
      if (formatted) images.push({ url: formatted, altText: getCol(row, ["base_image_label"]) || getCol(row, ["name"]) || "" });
    }
    const addImages = getCol(row, ["additional_images"]);
    if (addImages) {
      const extraUrls = addImages.split(",").map(i => formatImageUrl(i)).filter(Boolean);
      extraUrls.forEach(url => images.push({ url, altText: getCol(row, ["name"]) || "" }));
    }

    const rawPrice = parseFloat(getCol(row, ["price", "base_price", "basePrice"]) || "0");
    const basePrice = !isNaN(rawPrice) && rawPrice > 0 ? rawPrice : 0;

    const rawSpecial = parseFloat(getCol(row, ["special_price", "specialPrice"]) || "");
    const specialPrice = !isNaN(rawSpecial) && rawSpecial > 0 ? rawSpecial : undefined;

    const parsedWeight = extractProductWeight(row, attributes);
    const weight = parsedWeight.weight;
    const weightUnit = parsedWeight.weightUnit || "kg";

    const rawQty = parseInt(getCol(row, ["qty", "stock", "quantity"]) || "0");
    const qty = !isNaN(rawQty) ? rawQty : 0;

    const rawStockStatus = getCol(row, ["is_in_stock", "stock_status", "stockStatus"]);
    const stockStatus = rawStockStatus !== undefined ? (parseInt(rawStockStatus) === 0 ? 0 : 1) : (qty > 0 ? 1 : 0);

    const sizeChart = getCol(row, ["size_chart", "sizechart"]) || "";
    const gender = getCol(row, ["gender", "gender_1"]) || "";
    const countryOfManufacture = getCol(row, ["country_of_manufacture", "country_of_origin"]) || "";
    const attributeSetCode = getCol(row, ["attribute_set_code", "attribute_set"]) || "";
    const configurableVariationLabels = getCol(row, ["configurable_variation_labels"]) || "";
    const configurableVariations = getCol(row, ["configurable_variations"]) || "";
    const allowBackorders = getCol(row, ["backorders"]) === "1" || getCol(row, ["backorders"])?.toLowerCase() === "true";
    const isFreeShipping = getCol(row, ["free_shipping"]) === "1";
    const parsedDims = extractProductDimensions(row, attributes);

    const relatedSkus = (getCol(row, ["related_skus"]) || "").split(",").map(s => s.trim()).filter(Boolean);
    const upsellSkus = (getCol(row, ["upsell_skus"]) || "").split(",").map(s => s.trim()).filter(Boolean);
    const crosssellSkus = (getCol(row, ["crosssell_skus"]) || "").split(",").map(s => s.trim()).filter(Boolean);

    const sku = getCol(row, ["sku"])!;
    const name = getCol(row, ["name"]) || sku;
    const slug = getCol(row, ["url_key", "slug"]) || sku.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const rawStatus = getCol(row, ["status", "product_online"]);
    const status = (rawStatus === "1" || rawStatus?.toLowerCase() === "enabled" || rawStatus?.toLowerCase() === "published") ? "published" : "draft";

    const visibility = getCol(row, ["visibility"]) || "";

    const categories = getCol(row, ["categories"]) || "";
    const rawSlugs = (() => {
      if (!categories) return [];
      const parts = categories.split(/[/,]/);
      const mapped = new Set<string>();
      parts.forEach((p: string) => {
        let s = p.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        if (!s || s.includes("root-test") || s.includes("default-category") || s.includes("price") || s.includes("under-")) return;
        mapped.add(s);
        if (s.endsWith("s") && !s.endsWith("ss")) {
          mapped.add(s.slice(0, -1));
        } else {
          mapped.add(s + "s");
        }
      });
      return Array.from(mapped);
    })();

    const canonicalSlugs = resolveCanonicalCategorySlugs({
      name,
      magentoCategories: categories,
      categorySlugs: rawSlugs,
    });

    const categorySlugs = Array.from(new Set([...rawSlugs, ...canonicalSlugs]));

    return {
      name,
      description: getCol(row, ["description"]) || "",
      shortDescription: getCol(row, ["short_description"]) || "",
      slug,
      sku,
      basePrice,
      specialPrice,
      specialPriceFromDate: getCol(row, ["special_from_date"]) ? new Date(getCol(row, ["special_from_date"])!) : undefined,
      specialPriceToDate: getCol(row, ["special_to_date"]) ? new Date(getCol(row, ["special_to_date"])!) : undefined,
      weight,
      weightUnit,
      length: parsedDims.length,
      breadth: parsedDims.breadth,
      height: parsedDims.height,
      dimensionUnit: parsedDims.dimensionUnit || "cm",
      stockStatus,
      qty,
      allowBackorders,
      isFreeShipping,
      productType: getCol(row, ["product_type"]) || "simple",
      brand: getCol(row, ["brand"]) || attributes["brand"] || undefined,
      taxClassName: getCol(row, ["tax_class_name"]),
      status,
      visibility,
      magentoCategories: categories,
      metaTitle: getCol(row, ["meta_title"]) || "",
      metaKeywords: getCol(row, ["meta_keywords", "meta_keyword"]) || "",
      metaDescription: getCol(row, ["meta_description"]) || "",
      sizeChart,
      size_chart: sizeChart,
      gender,
      countryOfManufacture,
      attributeSetCode,
      configurableVariationLabels,
      configurableVariations,
      categoryId: categorySlugs[0] || undefined,
      categorySlugs,
      relatedSkus,
      upsellSkus,
      crosssellSkus,
      images,
      attributes,
      variants: [] as any[]
    };
  };

  // Pass 2: Identify Child SKUs
  const childSkusInCsv = new Set<string>();

  // A. Extract child SKUs from configurable rows
  for (const conf of configurables.values()) {
    const variationsStr = getCol(conf, ["configurable_variations"]) || "";
    let skus: string[] = [];
    if (variationsStr.includes("sku=")) {
      const matches = variationsStr.match(/sku=([^,|]+)/g);
      if (matches) {
        skus = matches.map((s: string) => s.split("=")[1].trim());
      }
    } else if (variationsStr) {
      skus = variationsStr.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
    skus.forEach((s) => childSkusInCsv.add(s));
  }

  // B. Also add SKUs with child visibility or parent_sku
  for (const [sku, row] of simples.entries()) {
    const vis = getCol(row, ["visibility"]);
    const parentSku = getCol(row, ["parent_sku", "parentsku"]);
    if (isChildVisibility(vis) || parentSku) {
      childSkusInCsv.add(sku);
    }
  }

  // Track parent documents that need variant updates or stock recalculation
  const affectedParentSkus = new Set<string>();
  const errors: any[] = [];
  let updatedVariantsCount = 0;
  let skippedGarbageCount = 0;

  // Process 1: Update Existing Child Variants directly in MongoDB
  for (const [sku, row] of simples.entries()) {
    // If this SKU already belongs to a parent in MongoDB
    if (variantToParentMap.has(sku)) {
      childSkusInCsv.add(sku); // Mark as child so it is NOT created as standalone
      const { parentSku } = variantToParentMap.get(sku)!;
      affectedParentSkus.add(parentSku);

      const updateVariantFields: Record<string, any> = {};

      const rawPrice = getCol(row, ["price", "base_price", "basePrice"]);
      if (rawPrice !== undefined) {
        const p = parseFloat(rawPrice);
        if (!isNaN(p) && p > 0) updateVariantFields["variants.$.price"] = p;
      }

      const rawSpecial = getCol(row, ["special_price", "specialPrice"]);
      if (rawSpecial !== undefined) {
        const sp = parseFloat(rawSpecial);
        if (!isNaN(sp) && sp > 0) updateVariantFields["variants.$.specialPrice"] = sp;
      }

      const rawQty = getCol(row, ["qty", "stock", "quantity"]);
      if (rawQty !== undefined) {
        const q = parseInt(rawQty);
        if (!isNaN(q)) updateVariantFields["variants.$.stock"] = q;
      }

      const rawStatus = getCol(row, ["status", "is_in_stock"]);
      if (rawStatus !== undefined) {
        updateVariantFields["variants.$.status"] = (rawStatus === "1" || rawStatus.toLowerCase() === "enabled") ? "enabled" : "disabled";
      }

      // Extract child variant dimensions and weight (supporting separate columns or additional_attributes)
      const childAttributes: Record<string, string> = {};
      const rawChildAdditional = getCol(row, ["additional_attributes", "additionalattributes"]);
      if (rawChildAdditional) {
        Object.assign(childAttributes, parseAttributesString(rawChildAdditional));
      }

      const childDims = extractProductDimensions(row, childAttributes);
      if (childDims.length !== undefined && childDims.length > 0) updateVariantFields["variants.$.length"] = childDims.length;
      if (childDims.breadth !== undefined && childDims.breadth > 0) updateVariantFields["variants.$.breadth"] = childDims.breadth;
      if (childDims.height !== undefined && childDims.height > 0) updateVariantFields["variants.$.height"] = childDims.height;

      const childWeightData = extractProductWeight(row, childAttributes);
      if (childWeightData.weight !== undefined && childWeightData.weight > 0) {
        updateVariantFields["variants.$.weight"] = childWeightData.weight;
      }

      const baseImg = getCol(row, ["base_image"]);
      if (baseImg) {
        const fUrl = formatImageUrl(baseImg);
        if (fUrl) updateVariantFields["variants.$.imageUrl"] = fUrl;
      }

      // Old SKU rename support
      const oldSku = getCol(row, ["old_sku", "oldsku"]);
      const newSku = getCol(row, ["new_sku", "sku"]);
      if (oldSku && newSku && oldSku !== newSku) {
        updateVariantFields["variants.$.sku"] = newSku;
      }

      if (Object.keys(updateVariantFields).length > 0) {
        try {
          await ProductModel.updateOne(
            { "variants.sku": sku },
            { $set: updateVariantFields }
          );
          updatedVariantsCount++;
        } catch (err: any) {
          errors.push({ sku, error: `Failed to update variant: ${err.message}` });
        }
      }
    } else {
      // Case B: Brand new child variant specifying parent_sku of an existing MongoDB parent
      const parentSku = getCol(row, ["parent_sku", "parentsku"]);
      if (parentSku && rootSkuMap.has(parentSku) && !configurables.has(parentSku)) {
        childSkusInCsv.add(sku);
        affectedParentSkus.add(parentSku);

        const childData = mapRowToProduct(row);
        const parentInDb: any = rootSkuMap.get(parentSku);
        const childPrice = childData.basePrice > 0 ? childData.basePrice : (parentInDb.basePrice || 0);

        try {
          await ProductModel.updateOne(
            { sku: parentSku, "variants.sku": { $ne: sku } },
            {
              $push: {
                variants: {
                  sku: childData.sku,
                  price: childPrice,
                  specialPrice: childData.specialPrice,
                  stock: childData.qty || childData.stockStatus,
                  attributes: childData.attributes,
                  imageUrl: childData.images[0]?.url,
                  weight: childData.weight,
                  length: childData.length,
                  breadth: childData.breadth,
                  height: childData.height,
                  status: childData.status === "published" ? "enabled" : "disabled",
                  visibility: childData.visibility || "Not Visible Individually",
                  images: childData.images || []
                }
              }
            }
          );
          updatedVariantsCount++;
        } catch (err: any) {
          errors.push({ sku, error: `Failed to add new variant to parent ${parentSku}: ${err.message}` });
        }
      }
    }
  }

  // Process 2: Map Configurables + their children (from current CSV)
  const finalParentProducts: any[] = [];

  for (const [sku, confRow] of configurables.entries()) {
    const parentProd = mapRowToProduct(confRow);
    affectedParentSkus.add(sku);

    const variationsStr = getCol(confRow, ["configurable_variations"]) || "";
    let skus: string[] = [];
    if (variationsStr.includes("sku=")) {
      const matches = variationsStr.match(/sku=([^,|]+)/g);
      if (matches) {
        skus = matches.map((s: string) => s.split("=")[1].trim());
      }
    } else if (variationsStr) {
      skus = variationsStr.split(",").map((s: string) => s.trim()).filter(Boolean);
    }

    // Also collect child rows that specify parent_sku matching this configurable!
    const childSkusForThisParent = new Set<string>(skus);
    for (const [sSku, sRow] of simples.entries()) {
      const pSku = getCol(sRow, ["parent_sku", "parentsku"]);
      if (pSku && pSku.toLowerCase() === sku.toLowerCase()) {
        childSkusForThisParent.add(sSku);
      }
    }

    // Find children from simples map
    for (const childSku of Array.from(childSkusForThisParent)) {
      const childRow = simples.get(childSku);
      if (childRow) {
        const childData = mapRowToProduct(childRow);
        // Fallback: If child price is 0, inherit parent's price
        const childPrice = childData.basePrice > 0 ? childData.basePrice : parentProd.basePrice;

        parentProd.variants.push({
          sku: childData.sku,
          price: childPrice,
          specialPrice: childData.specialPrice,
          stock: childData.qty || childData.stockStatus,
          attributes: childData.attributes,
          imageUrl: childData.images[0]?.url,
          weight: childData.weight,
          length: childData.length,
          breadth: childData.breadth,
          height: childData.height,
          status: childData.status === "published" ? "enabled" : "disabled",
          visibility: childData.visibility || "Not Visible Individually",
          images: childData.images || []
        });
      }
    }

    // Inherit price from lowest variant if parent basePrice is 0
    if (parentProd.basePrice === 0 && parentProd.variants.length > 0) {
      const validPrices = parentProd.variants.map((v: any) => v.price).filter((p: number) => p > 0);
      if (validPrices.length > 0) {
        parentProd.basePrice = Math.min(...validPrices);
      }
      if (!parentProd.specialPrice) {
        const validSpecials = parentProd.variants.map((v: any) => v.specialPrice).filter((p: any) => p && p > 0);
        if (validSpecials.length > 0) {
          parentProd.specialPrice = Math.min(...validSpecials);
        }
      }
    }

    finalParentProducts.push(parentProd);
  }

  // Process 3: Map Remaining Independent Simple Products
  for (const [sku, simpRow] of simples.entries()) {
    // If it's a child SKU (in CSV or in DB), DO NOT create standalone product!
    if (childSkusInCsv.has(sku) || variantToParentMap.has(sku)) {
      continue;
    }

    const rawName = getCol(simpRow, ["name"]);
    const rawPrice = parseFloat(getCol(simpRow, ["price", "base_price", "basePrice"]) || "0");
    const existingRoot = rootSkuMap.get(sku);

    // Garbage row rejection for new creations
    if (!existingRoot) {
      if (!rawName || rawName === "#N/A" || rawName.toLowerCase() === "#n/a" || rawName.trim() === sku) {
        logger.warn(`Job ${job.id}: Skipping invalid new product with #N/A or blank name (SKU: ${sku})`);
        skippedGarbageCount++;
        errors.push({ sku, reason: "Skipped: Invalid product name (#N/A or blank)" });
        continue;
      }
      if (isNaN(rawPrice) || rawPrice <= 0) {
        logger.warn(`Job ${job.id}: Skipping invalid new standalone product with zero price (SKU: ${sku})`);
        skippedGarbageCount++;
        errors.push({ sku, reason: "Skipped: Zero price on standalone product" });
        continue;
      }
    }

    finalParentProducts.push(mapRowToProduct(simpRow));
  }

  logger.info(`Job ${job.id}: Mapped ${finalParentProducts.length} root products to upsert, ${updatedVariantsCount} variants directly updated, ${skippedGarbageCount} garbage rows safely rejected.`);

  // Pass 3: MongoDB BulkWrite with Safe Patching
  const BATCH_SIZE = 500;
  let batchCount = 0;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < finalParentProducts.length; i += BATCH_SIZE) {
    const batch = finalParentProducts.slice(i, i + BATCH_SIZE);
    const batchSkus = batch.map(p => p.sku);

    const existingInDb = await ProductModel.find({ sku: { $in: batchSkus } })
      .select("sku images variants status description shortDescription basePrice specialPrice brand categoryId slug")
      .lean()
      .exec();
    const existingMap = new Map(existingInDb.map((e: any) => [e.sku, e]));

    const ops = batch.map(p => {
      const existing = existingMap.get(p.sku);

      if (existing) {
        // SAFE PATCHING: Only update fields that are explicitly valid in the CSV row
        const updateDoc: Record<string, any> = {};

        if (p.name && p.name !== "#N/A" && p.name.toLowerCase() !== "#n/a") updateDoc.name = p.name;
        if (p.description && p.description.trim() !== "") updateDoc.description = p.description;
        if (p.shortDescription && p.shortDescription.trim() !== "") updateDoc.shortDescription = p.shortDescription;
        if (p.slug && p.slug.trim() !== "") updateDoc.slug = p.slug;
        if (p.basePrice && p.basePrice > 0) updateDoc.basePrice = p.basePrice;
        if (p.specialPrice !== undefined) updateDoc.specialPrice = p.specialPrice;
        if (p.specialPriceFromDate) updateDoc.specialPriceFromDate = p.specialPriceFromDate;
        if (p.specialPriceToDate) updateDoc.specialPriceToDate = p.specialPriceToDate;
        if (p.weight !== undefined) updateDoc.weight = p.weight;
        if (p.weightUnit) updateDoc.weightUnit = p.weightUnit;
        if (p.length !== undefined) updateDoc.length = p.length;
        if (p.breadth !== undefined) updateDoc.breadth = p.breadth;
        if (p.height !== undefined) updateDoc.height = p.height;
        if (p.dimensionUnit) updateDoc.dimensionUnit = p.dimensionUnit;
        if (p.attributes && Object.keys(p.attributes).length > 0) updateDoc.attributes = p.attributes;
        if (p.qty !== undefined) updateDoc.qty = p.qty;
        if (p.stockStatus !== undefined) updateDoc.stockStatus = p.stockStatus;
        if (p.brand) updateDoc.brand = p.brand;
        if (p.magentoCategories) updateDoc.magentoCategories = p.magentoCategories;
        if (p.categorySlugs && p.categorySlugs.length > 0) {
          updateDoc.categorySlugs = p.categorySlugs;
          updateDoc.categoryId = p.categoryId || p.categorySlugs[0];
        }
        if (p.metaTitle) updateDoc.metaTitle = p.metaTitle;
        if (p.metaDescription) updateDoc.metaDescription = p.metaDescription;
        if (p.metaKeywords) updateDoc.metaKeywords = p.metaKeywords;
        if (p.sizeChart) updateDoc.sizeChart = p.sizeChart;
        if (p.gender) updateDoc.gender = p.gender;

        // 1. Photos Protection: Never overwrite with empty images if DB already has photos
        if (p.images && p.images.length > 0) {
          updateDoc.images = p.images;
        }

        // 2. Variants Merge Protection: Merge existing variants with updated variants
        // Never wipe existing variants if CSV only has a subset of variants!
        if (p.variants && p.variants.length > 0) {
          if (existing.variants && existing.variants.length > 0) {
            const newVarMap = new Map<string, any>(p.variants.map((v: any) => [v.sku, v]));
            const mergedVariants: any[] = [];

            // Update existing variants while preserving unmentioned ones
            for (const oldVar of (existing.variants as any[])) {
              if (newVarMap.has(oldVar.sku)) {
                const updatedVar: any = newVarMap.get(oldVar.sku);
                mergedVariants.push({
                  ...(oldVar as object),
                  ...(updatedVar as object),
                  images: (updatedVar.images && updatedVar.images.length > 0) ? updatedVar.images : oldVar.images,
                  imageUrl: updatedVar.imageUrl || oldVar.imageUrl,
                });
                newVarMap.delete(oldVar.sku);
              } else {
                // Keep existing variant untouched!
                mergedVariants.push(oldVar);
              }
            }

            // Append any newly added variants
            for (const brandNewVar of Array.from(newVarMap.values())) {
              mergedVariants.push(brandNewVar);
            }

            updateDoc.variants = mergedVariants;
          } else {
            updateDoc.variants = p.variants;
          }
        }

        // 3. Status Protection: Never downgrade published product to draft
        if (existing.status === "published" && p.status === "draft") {
          updateDoc.status = "published";
        } else if (p.status) {
          updateDoc.status = p.status;
        }

        return {
          updateOne: {
            filter: { sku: p.sku },
            update: { $set: updateDoc },
            upsert: false // Existing product: strictly update, never duplicate
          }
        };
      } else {
        // Brand NEW Product Creation: Full document with default safeguards
        const newDoc: any = { ...p };
        if (!newDoc.images || newDoc.images.length === 0) delete newDoc.images;
        if (!newDoc.variants || newDoc.variants.length === 0) delete newDoc.variants;

        return {
          updateOne: {
            filter: { sku: p.sku },
            update: { $set: newDoc },
            upsert: true
          }
        };
      }
    });

    try {
      const result = await ProductModel.bulkWrite(ops, { ordered: false });
      successCount += (result.upsertedCount + result.modifiedCount + (result.matchedCount - result.modifiedCount));
      batchCount++;

      // Sync batch to Meilisearch
      try {
        const { indexProduct } = await import("../../core/search/meilisearch");
        const productsToIndex = batch.filter(p => p.status === "published");
        if (productsToIndex.length > 0) {
          await Promise.all(productsToIndex.map(p => indexProduct({
            _id: p.sku,
            id: p.sku,
            name: p.name,
            slug: p.slug,
            sku: p.sku,
            basePrice: p.basePrice,
            specialPrice: p.specialPrice,
            categorySlugs: p.categorySlugs,
            brand: p.brand,
            stockStatus: p.stockStatus,
            imageUrl: p.images?.[0]?.url || "",
          } as any)));
        }
      } catch (searchError: any) {
        logger.error(`[Job ${job.id}] Failed to sync batch ${batchCount} to Meilisearch: ${searchError.message}`);
      }

      // Report progress to BullMQ
      const progress = Math.round(((i + batch.length) / finalParentProducts.length) * 100);
      await job.updateProgress(progress);
      logger.info(`[Job ${job.id}] Processed batch ${batchCount} (${i + batch.length}/${finalParentProducts.length})`);
    } catch (error: any) {
      logger.error(`[Job ${job.id}] Batch ${batchCount} encountered errors: ${error.message}`);
      failCount += batch.length;
      errors.push({ batch: batchCount, error: error.message });
    }
  }

  // Pass 4: Recalculate Parent Stock Status & Base Price for Affected Parents
  if (affectedParentSkus.size > 0) {
    logger.info(`Job ${job.id}: Recalculating stock status and base price for ${affectedParentSkus.size} parent products...`);
    for (const parentSku of affectedParentSkus) {
      try {
        const parentDoc: any = await ProductModel.findOne({ sku: parentSku });
        if (parentDoc && parentDoc.variants && parentDoc.variants.length > 0) {
          const totalStock = parentDoc.variants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
          const hasInStockVariant = parentDoc.variants.some((v: any) => (v.stock || 0) > 0 && v.status !== "disabled");
          const newStockStatus = hasInStockVariant || parentDoc.allowBackorders ? 1 : 0;

          const validVariantPrices = parentDoc.variants.map((v: any) => v.price).filter((p: number) => p && p > 0);
          const newBasePrice = (parentDoc.basePrice <= 0 && validVariantPrices.length > 0)
            ? Math.min(...validVariantPrices)
            : parentDoc.basePrice;

          await ProductModel.updateOne(
            { _id: parentDoc._id },
            {
              $set: {
                qty: totalStock,
                stockStatus: newStockStatus,
                basePrice: newBasePrice
              }
            }
          );
        }
      } catch (parentSyncErr: any) {
        logger.warn(`Job ${job.id}: Failed to sync parent aggregate stock for SKU ${parentSku}: ${parentSyncErr.message}`);
      }
    }
  }

  // Final Cache Invalidation
  try {
    const { clearProductCaches } = await import("../../core/cache/redis");
    await clearProductCaches();
    logger.info(`[Job ${job.id}] Nuked all product caches after bulk upload.`);
  } catch (err: any) {
    logger.warn(`[Job ${job.id}] Failed to clear cache: ${err.message}`);
  }

  const finalSuccessTotal = successCount + updatedVariantsCount;
  logger.info(`[Job ${job.id}] Migration Complete! Total Success: ${finalSuccessTotal} (Products: ${successCount}, Variants: ${updatedVariantsCount}), Failed: ${failCount}, Skipped: ${skippedGarbageCount}`);

  return {
    success: true,
    successCount: finalSuccessTotal,
    updatedProductsCount: successCount,
    updatedVariantsCount,
    skippedGarbageCount,
    failCount,
    errors
  };
}, { connection });

migrationWorker.on("completed", (job: Job) => {
  logger.info(`Migration job ${job.id} has completed successfully!`);
});

migrationWorker.on("failed", (job: Job | undefined, err: Error) => {
  logger.error(`Migration job ${job?.id} failed with reason: ${err.message}`);
});
