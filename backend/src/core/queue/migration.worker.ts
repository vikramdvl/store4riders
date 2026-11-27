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
import { randomUUID } from "crypto";
import { slugify } from "@store4riders/shared-utils";
import {
  buildDirectVariantUpdateSet,
  buildExistingProductUpdateDoc,
  createCsvImageUrlFormatter,
  getCsvColumnValue,
  mapCsvRowToProductData,
  parseConfigurableVariationsString,
  parseCsvNumber,
} from "../utils/csvMigrationHelper";
import {
  buildSearchSlugs,
  MAGENTO_PATH_TO_NAVBAR_SLUG,
} from "../../modules/product/product.category-constants";

// BullMQ Worker dedicated connection
const connection = createWorkerRedisConnection("migrationWorker");

const getCol = getCsvColumnValue;

/**
 * Checks if visibility indicates child variant (not visible individually)
 */
function isChildVisibility(visibility: string | undefined): boolean {
  if (!visibility) return false;
  const v = visibility.trim().toLowerCase();
  return v === "not visible individually" || v === "1";
}

export async function processMigrationJob(job: Pick<Job, "id" | "data" | "updateProgress">) {
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
  const canonicalConfSkuByLower = new Map<string, string>();
  const canonicalSimpleSkuByLower = new Map<string, string>();
  const categoriesToCreate = new Set<string>();
  const brandsToCreate = new Set<string>();
  const allParsedRows: any[] = [];

  const upsertUniqueCsvRow = (
    targetMap: Map<string, any>,
    lowerLookup: Map<string, string>,
    canonicalSku: string,
    incomingRow: Record<string, any>
  ) => {
    const lowerKey = canonicalSku.toLowerCase();
    const prevKey = lowerLookup.get(lowerKey);
    const prevRow = prevKey ? targetMap.get(prevKey) : undefined;
    if (prevKey && prevKey !== canonicalSku) {
      targetMap.delete(prevKey);
    }
    lowerLookup.set(lowerKey, canonicalSku);

    if (!prevRow) {
      targetMap.set(canonicalSku, incomingRow);
      return;
    }

    const merged = { ...prevRow };
    for (const [col, val] of Object.entries(incomingRow)) {
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        merged[col] = val;
      }
    }
    targetMap.set(canonicalSku, merged);
  };

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
          upsertUniqueCsvRow(configurables, canonicalConfSkuByLower, sku, row);
        } else {
          upsertUniqueCsvRow(simples, canonicalSimpleSkuByLower, sku, row);
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

  const brandSlugToIdMap = new Map<string, string>();
  for (let b of brandsToCreate) {
    if (!b) continue;
    const lower = b.trim().toLowerCase();
    if (BRAND_MAP[lower]) {
      b = BRAND_MAP[lower];
    } else if (INVALID_BRAND_SLUGS.has(lower)) {
      continue;
    }
    const slug = slugify(b);
    const bDoc: any = await BrandModel.findOneAndUpdate(
      { slug },
      { $set: { name: b, slug, isActive: true } },
      { upsert: true, new: true }
    ).lean();
    if (bDoc?._id) {
      brandSlugToIdMap.set(slug, String(bDoc._id));
    }
  }

  const isTestSegment = (val: string) =>
    /^(?:test(?:[\s_-]|$)|root[\s_-]*test)|[\s_-]test(?:[\s_-]|$)/i.test(val.trim());

  for (const catStr of categoriesToCreate) {
    if (!catStr) continue;
    const paths = catStr.split(",");
    for (const singlePath of paths) {
      const parts = singlePath.split("/").map(p => p.trim()).filter(Boolean);
      let parentId: string | null = null;
      let currentSlug = "";
      for (const p of parts) {
        if (p === "Default Category" || p === "Root Catalog") continue;
        if (isTestSegment(p)) break;

        const leafSlug = slugify(p);
        if (!leafSlug || isTestSegment(leafSlug)) break;

        currentSlug = currentSlug ? `${currentSlug}-${leafSlug}` : leafSlug;
        const mappedSegmentSlug = MAGENTO_PATH_TO_NAVBAR_SLUG[p.toLowerCase()];
        const lookupSlugs = Array.from(
          new Set([mappedSegmentSlug, ...buildSearchSlugs(leafSlug), currentSlug].filter(Boolean))
        );

        const existingCat: any = await CategoryModel.findOne({ slug: { $in: lookupSlugs } }).lean();
        if (existingCat && existingCat._id) {
          parentId = existingCat._id.toString();
          currentSlug = existingCat.slug;
          continue;
        }

        const targetSlug = mappedSegmentSlug || leafSlug;
        const cat: any = await CategoryModel.findOneAndUpdate(
          { slug: targetSlug },
          { $setOnInsert: { name: p, slug: targetSlug, parentId: parentId || null } },
          { upsert: true, new: true }
        );
        if (cat && cat._id) {
          parentId = cat._id.toString();
          currentSlug = cat.slug;
        }
      }
    }
  }

  // Pre-Scan: Collect all unique SKUs from CSV (including old_sku & parent_sku) to check DB
  const parentSkusFromChildren = Array.from(simples.values())
    .map((r: any) => getCol(r, ["parent_sku", "parentsku"]))
    .filter(Boolean) as string[];
  const oldSkusFromCsv = Array.from(new Set([
    ...Array.from(configurables.values()),
    ...Array.from(simples.values()),
  ].map((r: any) => getCol(r, ["old_sku", "oldsku"])).filter(Boolean) as string[]));

  const allCsvSkus = Array.from(new Set([
    ...Array.from(configurables.keys()),
    ...Array.from(simples.keys()),
    ...parentSkusFromChildren,
    ...oldSkusFromCsv,
  ]));

  logger.info(`Job ${job.id}: Checking MongoDB for ${allCsvSkus.length} unique SKUs...`);

  // 1. Existing root products in MongoDB (exact B-tree $in first, case-insensitive fallback for unmatched SKUs)
  const existingRoots = await ProductModel.find({ sku: { $in: allCsvSkus } })
    .select("sku name basePrice specialPrice images variants status qty stockStatus description categoryId brand slug attributes")
    .lean()
    .exec();
  const rootSkuMap = new Map(existingRoots.map((p: any) => [p.sku, p]));
  const rootSkuLowerMap = new Map(existingRoots.map((p: any) => [String(p.sku).toLowerCase(), p]));

  const unmatchedRootSkus = allCsvSkus.filter((s) => !rootSkuMap.has(s));
  if (unmatchedRootSkus.length > 0 && unmatchedRootSkus.length <= 2000) {
    const ciRegexes = unmatchedRootSkus.map(
      (s) => new RegExp(`^${s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`, "i")
    );
    const ciRoots = await ProductModel.find({ sku: { $in: ciRegexes } })
      .select("sku name basePrice specialPrice images variants status qty stockStatus description categoryId brand slug attributes")
      .lean()
      .exec();
    for (const p of ciRoots as any[]) {
      rootSkuLowerMap.set(String(p.sku).toLowerCase(), p);
    }
  }
  const getExistingRootBySku = (s: string) => rootSkuMap.get(s) || rootSkuLowerMap.get(s.toLowerCase());

  // 2. Existing child variants inside other products in MongoDB
  const ciAllVariantRegexes =
    allCsvSkus.length <= 2000
      ? allCsvSkus.map((s) => new RegExp(`^${s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`, "i"))
      : allCsvSkus;
  const existingVariantParents = await ProductModel.find({ "variants.sku": { $in: ciAllVariantRegexes } })
    .select("sku name basePrice specialPrice variants stockStatus qty allowBackorders")
    .lean()
    .exec();

  const allCsvSkuLowerSet = new Set(allCsvSkus.map((s) => s.toLowerCase()));
  const variantToParentMap = new Map<string, { parentSku: string; parentDoc: any; variantIndex: number; canonicalVariantSku: string }>();
  existingVariantParents.forEach((parentDoc: any) => {
    (parentDoc.variants || []).forEach((v: any, index: number) => {
      if (v?.sku && allCsvSkuLowerSet.has(String(v.sku).toLowerCase())) {
        variantToParentMap.set(String(v.sku).toLowerCase(), {
          parentSku: parentDoc.sku,
          parentDoc,
          variantIndex: index,
          canonicalVariantSku: v.sku,
        });
      }
    });
  });

  logger.info(`Job ${job.id}: Pre-scan result - Found ${rootSkuMap.size} existing root products, ${variantToParentMap.size} existing child variants in DB.`);

  // S3 Image URL Formatter (shared helper)
  const formatImageUrl = createCsvImageUrlFormatter();

  // Case-insensitive lookup map for simples rows
  const simplesLowerMap = new Map<string, any>();
  for (const [sSku, sRow] of simples.entries()) {
    simplesLowerMap.set(sSku.toLowerCase(), sRow);
  }

  // Helper to map a raw CSV row into standardized product attributes and presence metadata
  const mapRowToProduct = (row: any) => {
    const mapped = mapCsvRowToProductData(row, formatImageUrl);
    if (mapped.brand) {
      const normalizedBrand = BRAND_MAP[mapped.brand.trim().toLowerCase()] || mapped.brand;
      const bSlug = slugify(normalizedBrand);
      const bId = brandSlugToIdMap.get(bSlug);
      if (bId) {
        (mapped as any).brandId = bId;
      }
    }
    return mapped;
  };

  // Pass 2: Identify Child SKUs
  const childSkusInCsv = new Set<string>();
  const childSkusLowerInCsv = new Set<string>();
  const addChildSkuFlag = (s: string) => {
    childSkusInCsv.add(s);
    childSkusLowerInCsv.add(s.toLowerCase());
  };

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
    skus.forEach(addChildSkuFlag);
  }

  // B. Also add SKUs with child visibility or parent_sku
  for (const [sku, row] of simples.entries()) {
    const vis = getCol(row, ["visibility"]);
    const parentSku = getCol(row, ["parent_sku", "parentsku"]);
    if (isChildVisibility(vis) || parentSku) {
      addChildSkuFlag(sku);
    }
  }

  // Track parent documents that need variant updates or stock recalculation
  const affectedParentSkus = new Set<string>();
  const errors: any[] = [];
  let updatedVariantsCount = 0;
  let skippedGarbageCount = 0;

  // Process 1: Update Existing Child Variants directly in MongoDB
  for (const [sku, row] of simples.entries()) {
    const oldSkuVal = getCol(row, ["old_sku", "oldsku"]);
    const matchedVariantMeta =
      variantToParentMap.get(sku.toLowerCase()) ||
      (oldSkuVal ? variantToParentMap.get(oldSkuVal.toLowerCase()) : undefined);
    // If this SKU already belongs to a parent in MongoDB
    if (matchedVariantMeta) {
      addChildSkuFlag(sku); // Mark as child so it is NOT created as standalone
      const { parentSku, parentDoc, variantIndex, canonicalVariantSku } = matchedVariantMeta;
      affectedParentSkus.add(parentSku);

      const existingVariant = parentDoc?.variants?.[variantIndex];
      const updateVariantFields = buildDirectVariantUpdateSet(row, formatImageUrl, existingVariant);
      if (oldSkuVal && oldSkuVal.toLowerCase() === canonicalVariantSku.toLowerCase() && sku.toLowerCase() !== oldSkuVal.toLowerCase()) {
        updateVariantFields["variants.$.sku"] = sku;
      }

      if (Object.keys(updateVariantFields).length > 0) {
        try {
          await ProductModel.updateOne(
            { "variants.sku": canonicalVariantSku },
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
      const parentInDb: any = parentSku ? getExistingRootBySku(parentSku) : undefined;
      if (parentSku && parentInDb && !configurables.has(parentSku)) {
        addChildSkuFlag(sku);
        affectedParentSkus.add(parentInDb.sku);

        const childData = mapRowToProduct(row);
        const childPrice = childData.basePrice > 0 ? childData.basePrice : (parentInDb.basePrice || 0);

        try {
          await ProductModel.updateOne(
            { _id: parentInDb._id, "variants.sku": { $ne: sku } },
            {
              $push: {
                variants: {
                  id: randomUUID(),
                  sku: childData.sku,
                  price: childPrice,
                  specialPrice: childData.specialPrice,
                  stock: childData._present.hasQty ? childData.qty : childData.stockStatus,
                  attributes: childData.attributes,
                  imageUrl: childData.images[0]?.url,
                  weight: childData.weight,
                  weightUnit: childData.weightUnit,
                  length: childData.length,
                  breadth: childData.breadth,
                  height: childData.height,
                  dimensionUnit: childData.dimensionUnit,
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

  // Process 2: Map Configurables + their children (from current CSV or inline configurable_variations)
  const finalParentProducts: any[] = [];

  for (const [sku, confRow] of configurables.entries()) {
    const parentProd = mapRowToProduct(confRow);
    const oldSkuForConf = getCol(confRow, ["old_sku", "oldsku"]);
    if (oldSkuForConf) (parentProd as any)._oldSku = oldSkuForConf;
    affectedParentSkus.add(sku);

    const variationsStr = getCol(confRow, ["configurable_variations"]) || "";
    const inlineParsedVariants = parseConfigurableVariationsString(variationsStr, parentProd.basePrice, formatImageUrl);
    const inlineVarBySku = new Map(inlineParsedVariants.map((v) => [String(v.sku).toLowerCase(), v]));

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

    // Find children from simples map (case-insensitive) or fallback to inline configurable_variations entry
    for (const childSku of Array.from(childSkusForThisParent)) {
      const childRow = simples.get(childSku) || simplesLowerMap.get(childSku.toLowerCase());
      if (childRow) {
        const childData = mapRowToProduct(childRow);
        // Fallback: If child price is 0, inherit parent's price
        const childPrice = childData.basePrice > 0 ? childData.basePrice : parentProd.basePrice;

        parentProd.variants.push({
          id: randomUUID(),
          sku: childData.sku,
          price: childPrice,
          specialPrice: childData.specialPrice,
          stock: childData._present.hasQty ? childData.qty : childData.stockStatus,
          attributes: childData.attributes,
          imageUrl: childData.images[0]?.url,
          altText: childData.images[0]?.altText,
          weight: childData.weight,
          weightUnit: childData.weightUnit,
          length: childData.length,
          breadth: childData.breadth,
          height: childData.height,
          dimensionUnit: childData.dimensionUnit,
          status: childData.status === "published" ? "enabled" : "disabled",
          visibility: childData.visibility || "Not Visible Individually",
          images: childData.images || [],
          _present: childData._present,
        });
      } else {
        const inlineVar = inlineVarBySku.get(childSku.toLowerCase());
        if (inlineVar) {
          parentProd.variants.push(inlineVar);
        }
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

    const existingRoot =
      getExistingRootBySku(sku) || (oldSkuForConf ? getExistingRootBySku(oldSkuForConf) : undefined);
    if (!existingRoot) {
      if (!parentProd._present.hasName || parentProd.name.trim() === sku) {
        logger.warn(`Job ${job.id}: Skipping invalid new configurable product with #N/A or blank name (SKU: ${sku})`);
        skippedGarbageCount++;
        errors.push({ sku, reason: "Skipped: Invalid product name (#N/A or blank)" });
        continue;
      }
      if (parentProd.basePrice <= 0) {
        logger.warn(`Job ${job.id}: Skipping invalid new configurable product with zero price (SKU: ${sku})`);
        skippedGarbageCount++;
        errors.push({ sku, reason: "Skipped: Zero price on standalone product" });
        continue;
      }
    }

    finalParentProducts.push(parentProd);
  }

  // Process 3: Map Remaining Independent Simple Products
  for (const [sku, simpRow] of simples.entries()) {
    // If it's a child SKU (in CSV or in DB), DO NOT create standalone product!
    if (childSkusLowerInCsv.has(sku.toLowerCase()) || variantToParentMap.has(sku.toLowerCase())) {
      continue;
    }

    const rawName = getCol(simpRow, ["name"]);
    const rawPrice = parseCsvNumber(getCol(simpRow, ["price", "base_price", "basePrice"])) ?? 0;
    const oldSkuVal = getCol(simpRow, ["old_sku", "oldsku"]);
    const existingRoot =
      getExistingRootBySku(sku) || (oldSkuVal ? getExistingRootBySku(oldSkuVal) : undefined);

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

    const mappedSimple = mapRowToProduct(simpRow);
    if (oldSkuVal) (mappedSimple as any)._oldSku = oldSkuVal;
    finalParentProducts.push(mappedSimple);
  }

  logger.info(`Job ${job.id}: Mapped ${finalParentProducts.length} root products to upsert, ${updatedVariantsCount} variants directly updated, ${skippedGarbageCount} garbage rows safely rejected.`);

  // Pass 3: MongoDB BulkWrite with Safe Patching & Creation Safeguards
  const BATCH_SIZE = 500;
  let batchCount = 0;
  let createdProductsCount = 0;
  let updatedProductsCount = 0;
  let failCount = 0;

  for (let i = 0; i < finalParentProducts.length; i += BATCH_SIZE) {
    const batch = finalParentProducts.slice(i, i + BATCH_SIZE);
    const batchSkus = Array.from(new Set(
      batch.flatMap((p) => [p.sku, (p as any)._oldSku].filter(Boolean))
    ));

    const selectFields = "sku images variants status description shortDescription basePrice specialPrice brand brandId categoryId slug attributes weight weightUnit length breadth height dimensionUnit";
    const existingInDb = await ProductModel.find({ sku: { $in: batchSkus } })
      .select(selectFields)
      .lean()
      .exec();
    const existingMap = new Map(existingInDb.map((e: any) => [String(e.sku).toLowerCase(), e]));

    const missingCaseBatchSkus = batchSkus.filter((s) => !existingMap.has(String(s).toLowerCase()));
    if (missingCaseBatchSkus.length > 0) {
      const ciBatchRegexes = missingCaseBatchSkus.map(
        (s) => new RegExp(`^${String(s).replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`, "i")
      );
      const ciExistingInDb = await ProductModel.find({ sku: { $in: ciBatchRegexes } })
        .select(selectFields)
        .lean()
        .exec();
      for (const doc of ciExistingInDb as any[]) {
        existingMap.set(String(doc.sku).toLowerCase(), doc);
      }
    }

    // Pre-check slug uniqueness for brand new products in this batch
    const candidateNewSlugs = batch
      .filter((p) => !existingMap.get(String(p.sku).toLowerCase()) && !((p as any)._oldSku && existingMap.get(String((p as any)._oldSku).toLowerCase())))
      .map((p) => p.slug)
      .filter(Boolean);
    const existingSlugsSet = new Set<string>();
    if (candidateNewSlugs.length > 0) {
      const collidingSlugDocs = await ProductModel.find({ slug: { $in: candidateNewSlugs } })
        .select("slug")
        .lean()
        .exec();
      collidingSlugDocs.forEach((d: any) => {
        if (d?.slug) existingSlugsSet.add(String(d.slug).toLowerCase());
      });
    }

    const ops = batch
      .map(p => {
        const directExisting = existingMap.get(String(p.sku).toLowerCase());
        const oldSkuExisting = !directExisting && (p as any)._oldSku
          ? existingMap.get(String((p as any)._oldSku).toLowerCase())
          : undefined;
        const existing = directExisting || oldSkuExisting;

        if (existing) {
          const updateDoc = buildExistingProductUpdateDoc(p, existing);
          if (oldSkuExisting && !directExisting) {
            updateDoc.sku = p.sku;
          }
          if (p._present.hasBrand && (p as any).brandId) {
            updateDoc.brandId = (p as any).brandId;
          }
          if (Object.keys(updateDoc).length === 0) {
            return null;
          }
          return {
            updateOne: {
              filter: { _id: existing._id },
              update: { $set: updateDoc },
              upsert: false // Existing product: strictly update, never duplicate
            }
          };
        } else {
          // Brand NEW Product Creation: Strip metadata and apply Mongoose schema safeguards
          const { _present, _oldSku, ...newDoc } = p as any;
          newDoc.description = newDoc.description || newDoc.shortDescription || newDoc.name;
          newDoc.countryOfManufacture = newDoc.countryOfManufacture || "India";

          let finalSlug = newDoc.slug || slugify(newDoc.name || newDoc.sku);
          if (existingSlugsSet.has(finalSlug.toLowerCase())) {
            finalSlug = `${finalSlug}-${slugify(newDoc.sku)}`;
          }
          newDoc.slug = finalSlug;
          existingSlugsSet.add(finalSlug.toLowerCase());

          if (!newDoc.images || newDoc.images.length === 0) delete newDoc.images;
          if (!newDoc.variants || newDoc.variants.length === 0) {
            delete newDoc.variants;
          } else {
            newDoc.variants = newDoc.variants.map((v: any) => {
              const { _present: _vp, ...cleanVariant } = v || {};
              if (!cleanVariant.id) cleanVariant.id = randomUUID();
              return cleanVariant;
            });
          }

          return {
            updateOne: {
              filter: { sku: p.sku },
              update: { $set: newDoc },
              upsert: true
            }
          };
        }
      })
      .filter((op): op is NonNullable<typeof op> => op !== null);

    try {
      const result = ops.length > 0
        ? await ProductModel.bulkWrite(ops, { ordered: false })
        : { upsertedCount: 0, modifiedCount: 0, matchedCount: 0 };
      createdProductsCount += result.upsertedCount;
      updatedProductsCount += (result.modifiedCount + Math.max(0, result.matchedCount - result.modifiedCount));
      batchCount++;

      // Sync batch to Meilisearch for new published creations or existing published products updated with catalog/stock/price fields
      try {
        const { indexProduct } = await import("../../core/search/meilisearch");
        const indexableSkus = batch
          .filter((p) => {
            const existing = existingMap.get(String(p.sku).toLowerCase());
            if (!existing) {
              return p.status === "published" && p._present?.hasName && p.basePrice > 0;
            }
            return (
              p._present.hasName ||
              p._present.hasBasePrice ||
              p._present.hasSpecialPrice ||
              p._present.hasQty ||
              p._present.hasStockStatus ||
              p._present.hasStatus ||
              p._present.hasBrand ||
              p._present.hasCategories
            );
          })
          .map((p) => p.sku);

        if (indexableSkus.length > 0) {
          const syncedDocs = await ProductModel.find({ sku: { $in: indexableSkus }, status: "published" })
            .select("name slug sku description categoryId basePrice specialPrice categorySlugs brand status visibility stockStatus qty salesCount createdAt variants tags metaKeywords images attributes")
            .lean()
            .exec();
          if (syncedDocs.length > 0) {
            await Promise.all(
              syncedDocs.map((doc: any) => indexProduct(doc))
            );
          }
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

  const finalSuccessTotal = createdProductsCount + updatedProductsCount + updatedVariantsCount;
  logger.info(
    `[Job ${job.id}] Migration Complete! Total Success: ${finalSuccessTotal} ` +
      `(Created: ${createdProductsCount}, Updated: ${updatedProductsCount}, Variants: ${updatedVariantsCount}), ` +
      `Failed: ${failCount}, Skipped: ${skippedGarbageCount}`
  );

  return {
    success: true,
    successCount: finalSuccessTotal,
    createdProductsCount,
    updatedProductsCount,
    updatedVariantsCount,
    skippedGarbageCount,
    failCount,
    errors
  };
}

export const migrationWorker = new Worker("migrationQueue", processMigrationJob, { connection });

migrationWorker.on("completed", (job: Job) => {
  logger.info(`Migration job ${job.id} has completed successfully!`);
});

migrationWorker.on("failed", (job: Job | undefined, err: Error) => {
  logger.error(`Migration job ${job?.id} failed with reason: ${err.message}`);
});
