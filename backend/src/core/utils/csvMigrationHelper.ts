import { randomUUID } from "crypto";
import {
  convertToCm,
  extractProductDimensions,
  extractProductWeight,
  parseAttributesString,
  slugify,
} from "@store4riders/shared-utils";
import { resolveCanonicalCategorySlugs } from "../../modules/product/product.category-constants";

export const KNOWN_MIGRATION_FIELDS = new Set([
  "name",
  "description",
  "short_description",
  "url_key",
  "slug",
  "sku",
  "price",
  "special_price",
  "base_price",
  "baseprice",
  "specialprice",
  "weight",
  "weight_unit",
  "weightunit",
  "pkg_weight",
  "pkg_weight_unit",
  "package_weight",
  "packageweight",
  "shipping_weight",
  "shipping_weight_unit",
  "shippingweight",
  "item_weight",
  "itemweight",
  "gross_weight",
  "grossweight",
  "net_weight",
  "netweight",
  "dead_weight",
  "deadweight",
  "length",
  "len",
  "breadth",
  "width",
  "wid",
  "height",
  "dimension_unit",
  "dimensionunit",
  "dim_unit",
  "dimunit",
  "unit_dimension",
  "size_unit",
  "dimensions",
  "dimension",
  "package_length",
  "packagelength",
  "pkg_length",
  "package_width",
  "packagewidth",
  "pkg_width",
  "package_breadth",
  "packagebreadth",
  "pkg_breadth",
  "package_height",
  "packageheight",
  "pkg_height",
  "package_dimensions",
  "packagedimensions",
  "shipping_length",
  "shippinglength",
  "shipping_width",
  "shippingwidth",
  "shipping_breadth",
  "shippingbreadth",
  "shipping_height",
  "shippingheight",
  "shipping_dimensions",
  "shippingdimensions",
  "box_length",
  "boxlength",
  "box_width",
  "boxwidth",
  "box_breadth",
  "box_height",
  "boxheight",
  "dim_l",
  "diml",
  "dimension_l",
  "dim_w",
  "dim_b",
  "dimension_w",
  "dimension_b",
  "dim_h",
  "dimh",
  "dimension_h",
  "item_length",
  "itemlength",
  "item_width",
  "item_breadth",
  "item_height",
  "itemheight",
  "l",
  "w",
  "h",
  "b",
  "lbh",
  "l_b_h",
  "lxbxh",
  "l_w_h",
  "box_dimensions",
  "box_size",
  "boxsize",
  "size_dimensions",
  "sizedimensions",
  "product_dimensions",
  "size_dimension",
  "is_in_stock",
  "stock_status",
  "stockstatus",
  "product_type",
  "categories",
  "base_image",
  "base_image_label",
  "additional_images",
  "additional_image_labels",
  "swatch_image",
  "swatch_image_label",
  "color_swatches",
  "additional_attributes",
  "additionalattributes",
  "configurable_variations",
  "related_skus",
  "upsell_skus",
  "crosssell_skus",
  "qty",
  "stock",
  "quantity",
  "status",
  "product_online",
  "visibility",
  "tax_class_name",
  "hsn_code",
  "hsncode",
  "brand",
  "meta_title",
  "meta_keyword",
  "meta_keywords",
  "meta_description",
  "size_chart",
  "sizechart",
  "gender",
  "gender_1",
  "country_of_manufacture",
  "country_of_origin",
  "attribute_set_code",
  "attribute_set",
  "configurable_variation_labels",
  "backorders",
  "free_shipping",
  "special_from_date",
  "special_to_date",
  "parent_sku",
  "parentsku",
  "old_sku",
  "oldsku",
  "new_sku",
  "newsku",
]);

export const IGNORED_IMPORT_ATTRIBUTE_KEYS = new Set([
  "codazon_custom_tab",
  "product name",
  "additional_attributes",
  "additionalattributes",
  "options_container",
  "has_options",
  "required_options",
  "gift_message_available",
  "url_path",
  "small_image",
  "thumbnail",
  "frameborder",
  "allowfullscreen",
]);

export interface ICsvFieldPresence {
  hasName: boolean;
  hasDescription: boolean;
  hasShortDescription: boolean;
  hasSlug: boolean;
  hasBasePrice: boolean;
  hasSpecialPrice: boolean;
  hasSpecialPriceFromDate: boolean;
  hasSpecialPriceToDate: boolean;
  hasWeight: boolean;
  hasDimensions: boolean;
  hasQty: boolean;
  hasStockStatus: boolean;
  hasStatus: boolean;
  hasFreeShipping: boolean;
  hasAllowBackorders: boolean;
  hasVisibility: boolean;
  hasTaxClassName: boolean;
  hasHsnCode: boolean;
  hasBrand: boolean;
  hasCategories: boolean;
  hasMetaTitle: boolean;
  hasMetaDescription: boolean;
  hasMetaKeywords: boolean;
  hasSizeChart: boolean;
  hasGender: boolean;
  hasCountryOfManufacture: boolean;
  hasAttributeSetCode: boolean;
  hasRelatedSkus: boolean;
  hasUpsellSkus: boolean;
  hasCrosssellSkus: boolean;
  hasImageLabels: boolean;
  hasColorSwatches: boolean;
  hasConfigurableVariations: boolean;
  hasConfigurableVariationLabels: boolean;
}

/**
 * Classifies CSV header names into standard product fields, custom attribute columns, or ignored legacy junk.
 */
export function classifyCsvHeaders(headers: string[]) {
  const standardFields: string[] = [];
  const attributeColumns: string[] = [];
  const ignoredColumns: string[] = [];

  for (const rawH of headers) {
    const clean = String(rawH || "").replace(/^\ufeff/, "").trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (IGNORED_IMPORT_ATTRIBUTE_KEYS.has(lower)) {
      ignoredColumns.push(clean);
    } else if (KNOWN_MIGRATION_FIELDS.has(lower)) {
      standardFields.push(clean);
    } else {
      attributeColumns.push(clean);
    }
  }

  return { standardFields, attributeColumns, ignoredColumns };
}

/**
 * Parses color_swatches pipe string (e.g. "Black=#111111|Black / Red=#111") while sanitizing dots for Mongo keys.
 */
export function parseColorSwatchesString(raw: string | undefined): Record<string, string> | undefined {
  if (!raw || !raw.trim()) return undefined;
  const result: Record<string, string> = {};
  for (const part of raw.split("|")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).replace(/\./g, " ").replace(/\s+/g, " ").trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key && val) {
      result[key] = val;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Parses pipe-separated Magento `configurable_variations` strings into structured variant entries
 * with per-field presence metadata so inline partial strings never wipe DB variant fields.
 */
export function parseConfigurableVariationsString(
  variationsStr: string,
  parentBasePrice: number,
  formatImageUrl: (url: string) => string | null
): any[] {
  if (!variationsStr || !variationsStr.trim()) return [];
  const entries: any[] = [];
  const seenSkuIndex = new Map<string, number>();
  const segments = variationsStr.split("|").map((s) => s.trim()).filter(Boolean);

  for (const segment of segments) {
    if (!segment.includes("=")) continue;
    const kvPairs = segment.split(",").map((p) => p.trim()).filter(Boolean);
    let sku = "";
    let price: number | undefined;
    let specialPrice: number | undefined;
    let stock: number | undefined;
    let imageUrl: string | undefined;
    let altText: string | undefined;
    let statusVal: "enabled" | "disabled" | undefined;
    const attrs: Record<string, string> = {};

    for (const pair of kvPairs) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx <= 0) continue;
      const k = pair.slice(0, eqIdx).trim();
      const v = pair.slice(eqIdx + 1).trim();
      const lk = k.toLowerCase();
      if (!v) continue;

      if (lk === "sku") sku = v;
      else if (lk === "price" || lk === "base_price") price = parseCsvNumber(v);
      else if (lk === "special_price") specialPrice = parseCsvNumber(v);
      else if (lk === "qty" || lk === "stock") stock = parseCsvInt(v);
      else if (lk === "image") imageUrl = formatImageUrl(v) || undefined;
      else if (lk === "alttext") altText = v;
      else if (lk === "status") statusVal = v === "0" || v.toLowerCase() === "disabled" ? "disabled" : "enabled";
      else if (lk === "colour") attrs.color = v.replace(/\./g, " ").replace(/\s+/g, " ").trim();
      else attrs[k] = lk === "color" ? v.replace(/\./g, " ").replace(/\s+/g, " ").trim() : v;
    }

    if (!sku) continue;

    const entry: Record<string, any> = {
      id: randomUUID(),
      sku,
      price: price !== undefined && price > 0 ? price : parentBasePrice,
      ...(specialPrice !== undefined && specialPrice > 0 ? { specialPrice } : {}),
      stock: stock !== undefined ? stock : 0,
      attributes: attrs,
      ...(imageUrl ? { imageUrl, images: [{ id: randomUUID(), url: imageUrl, altText: altText || sku }] } : { images: [] }),
      ...(altText ? { altText } : {}),
      status: statusVal || "enabled",
      visibility: "Not Visible Individually",
      _present: {
        hasName: false,
        hasDescription: false,
        hasShortDescription: false,
        hasSlug: false,
        hasBasePrice: price !== undefined && price > 0,
        hasSpecialPrice: specialPrice !== undefined && specialPrice > 0,
        hasSpecialPriceFromDate: false,
        hasSpecialPriceToDate: false,
        hasWeight: false,
        hasDimensions: false,
        hasQty: stock !== undefined,
        hasStockStatus: false,
        hasStatus: statusVal !== undefined,
        hasFreeShipping: false,
        hasAllowBackorders: false,
        hasVisibility: false,
        hasTaxClassName: false,
        hasHsnCode: false,
        hasBrand: false,
        hasCategories: false,
        hasMetaTitle: false,
        hasMetaDescription: false,
        hasMetaKeywords: false,
        hasSizeChart: false,
        hasGender: false,
        hasCountryOfManufacture: false,
        hasAttributeSetCode: false,
        hasRelatedSkus: false,
        hasUpsellSkus: false,
        hasCrosssellSkus: false,
        hasImageLabels: Boolean(altText),
        hasColorSwatches: false,
        hasConfigurableVariations: false,
        hasConfigurableVariationLabels: false,
      } satisfies ICsvFieldPresence,
    };

    const skuLower = sku.toLowerCase();
    const existingIdx = seenSkuIndex.get(skuLower);
    if (existingIdx !== undefined) {
      const prev = entries[existingIdx];
      const mergedPresent = { ...prev._present };
      for (const [k, flag] of Object.entries(entry._present)) {
        if (flag) (mergedPresent as Record<string, boolean>)[k] = true;
      }
      entries[existingIdx] = {
        ...prev,
        ...entry,
        id: prev.id,
        sku: entry.sku || prev.sku,
        price: entry._present.hasBasePrice ? entry.price : prev.price,
        stock: entry._present.hasQty ? entry.stock : prev.stock,
        status: entry._present.hasStatus ? entry.status : prev.status,
        ...(entry._present.hasSpecialPrice
          ? { specialPrice: entry.specialPrice }
          : prev.specialPrice !== undefined
          ? { specialPrice: prev.specialPrice }
          : {}),
        attributes: { ...prev.attributes, ...entry.attributes },
        images: entry.images.length > 0 ? entry.images : prev.images,
        imageUrl: entry.imageUrl || prev.imageUrl,
        altText: entry.altText || prev.altText,
        _present: mergedPresent,
      };
    } else {
      seenSkuIndex.set(skuLower, entries.length);
      entries.push(entry);
    }
  }

  return entries;
}

/**
 * Safely parses a CSV decimal number (handling commas and currency symbols like "₹4,999.00").
 * Returns undefined for blanks, #N/A, or non-numeric strings.
 */
export function parseCsvNumber(val: unknown): number | undefined {
  if (val === undefined || val === null) return undefined;
  const cleaned = String(val).replace(/[₹$,\s]/g, "").trim();
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return undefined;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

/**
 * Safely parses a CSV integer (handling thousand separators like "1,200" and explicit "0").
 * Returns undefined for blanks, #N/A, or non-integer strings.
 */
export function parseCsvInt(val: unknown): number | undefined {
  if (val === undefined || val === null) return undefined;
  const cleaned = String(val).replace(/[,\s]/g, "").trim();
  if (!cleaned || !/^-?\d+$/.test(cleaned)) return undefined;
  const num = parseInt(cleaned, 10);
  return Number.isFinite(num) ? num : undefined;
}

/**
 * Safely parses ISO or DD-MM-YYYY / DD/MM/YYYY date strings from spreadsheets.
 * Returns undefined instead of Invalid Date for unparseable inputs.
 */
export function parseCsvDate(val: unknown): Date | undefined {
  if (val === undefined || val === null) return undefined;
  if (val instanceof Date) return !isNaN(val.getTime()) ? val : undefined;
  const trimmed = String(val).trim();
  if (!trimmed || trimmed.toLowerCase() === "#n/a") return undefined;

  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    const d = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00.000Z`);
    if (!isNaN(d.getTime())) return d;
  }

  const parsed = new Date(trimmed);
  return !isNaN(parsed.getTime()) ? parsed : undefined;
}

/**
 * Parses CSV stock status strings ("1", "0", "true", "false", "in stock", "out of stock").
 * Returns undefined when ambiguous so stock is never accidentally corrupted.
 */
export function parseCsvStockStatus(val: unknown): 0 | 1 | undefined {
  if (val === undefined || val === null) return undefined;
  const trimmed = String(val).trim().toLowerCase();
  if (!trimmed) return undefined;
  if (trimmed === "0" || trimmed === "false" || trimmed === "no" || trimmed === "out of stock" || trimmed === "out_of_stock") {
    return 0;
  }
  if (trimmed === "1" || trimmed === "true" || trimmed === "yes" || trimmed === "in stock" || trimmed === "in_stock") {
    return 1;
  }
  const num = parseCsvInt(trimmed);
  if (num === 0) return 0;
  if (num !== undefined && num > 0) return 1;
  return undefined;
}

/**
 * Case-insensitive, BOM-safe column value extractor across different CSV header dialects.
 */
export function getCsvColumnValue(row: Record<string, any>, aliases: string[]): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== "") {
      return String(row[alias]).trim();
    }
    const lower = alias.replace(/^\ufeff/, "").trim().toLowerCase();
    const foundKey = Object.keys(row).find(
      (k) => k.replace(/^\ufeff/, "").trim().toLowerCase() === lower
    );
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== "") {
      return String(row[foundKey]).trim();
    }
  }
  return undefined;
}

/**
 * Checks whether a column header exists on the CSV row (even if its cell value is empty).
 */
export function hasCsvColumnHeader(row: Record<string, any>, aliases: string[]): boolean {
  if (!row || typeof row !== "object") return false;
  const normalizedKeys = new Set(
    Object.keys(row).map((k) => k.replace(/^\ufeff/, "").trim().toLowerCase())
  );
  return aliases.some((alias) => normalizedKeys.has(alias.replace(/^\ufeff/, "").trim().toLowerCase()));
}

/**
 * Maps a raw CSV row into normalized product fields plus explicit field-presence metadata
 * so partial CSV uploads never overwrite omitted database fields.
 */
export function mapCsvRowToProductData(
  row: Record<string, any>,
  formatImageUrl: (url: string) => string | null
) {
  const attributes: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(row)) {
    const cleanKey = rawKey.replace(/^\ufeff/, "").trim();
    const lowerKey = cleanKey.toLowerCase();
    if (
      cleanKey &&
      !KNOWN_MIGRATION_FIELDS.has(lowerKey) &&
      !IGNORED_IMPORT_ATTRIBUTE_KEYS.has(lowerKey) &&
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      attributes[cleanKey] = String(value).trim();
    }
  }

  // Unfold Magento additional_attributes (or JSON attributes) into distinct attributes
  const rawAdditional = getCsvColumnValue(row, ["additional_attributes", "additionalattributes"]);
  if (rawAdditional) {
    const parsedAdd = parseAttributesString(rawAdditional);
    for (const [k, v] of Object.entries(parsedAdd)) {
      const lowerK = k.trim().toLowerCase();
      if (!attributes[k] && v && !IGNORED_IMPORT_ATTRIBUTE_KEYS.has(lowerK)) {
        attributes[k] = String(v).trim();
      }
    }
  }

  const rawName = getCsvColumnValue(row, ["name"]);
  const hasValidName = Boolean(rawName && rawName !== "#N/A" && rawName.toLowerCase() !== "#n/a");
  const baseImageLabel = getCsvColumnValue(row, ["base_image_label"]);
  const rawAdditionalLabels = getCsvColumnValue(row, ["additional_image_labels"]);
  const additionalLabels = rawAdditionalLabels
    ? rawAdditionalLabels.split(",").map((l) => l.trim())
    : [];

  const images: any[] = [];
  const baseImage = getCsvColumnValue(row, ["base_image"]);
  if (baseImage) {
    const formatted = formatImageUrl(baseImage);
    if (formatted) {
      images.push({
        url: formatted,
        altText: baseImageLabel || (hasValidName ? rawName! : ""),
      });
    }
  }
  const addImages = getCsvColumnValue(row, ["additional_images"]);
  if (addImages) {
    const extraUrls = addImages.split(",").map((i) => formatImageUrl(i)).filter(Boolean);
    extraUrls.forEach((url, idx) =>
      images.push({
        url,
        altText: additionalLabels[idx] || (hasValidName ? rawName! : ""),
      })
    );
  }

  const rawPriceCol = getCsvColumnValue(row, ["price", "base_price", "basePrice"]);
  const parsedBasePrice = parseCsvNumber(rawPriceCol);
  const basePrice = parsedBasePrice !== undefined && parsedBasePrice > 0 ? parsedBasePrice : 0;

  const rawSpecialCol = getCsvColumnValue(row, ["special_price", "specialPrice"]);
  const parsedSpecial = parseCsvNumber(rawSpecialCol);
  const specialPrice = parsedSpecial !== undefined && parsedSpecial > 0 ? parsedSpecial : undefined;

  const parsedWeight = extractProductWeight(row, attributes);
  const weight = parsedWeight.weight;
  const weightUnit = parsedWeight.weightUnit || "kg";

  const rawQtyCol = getCsvColumnValue(row, ["qty", "stock", "quantity"]);
  const parsedQty = parseCsvInt(rawQtyCol);
  const qty = parsedQty !== undefined ? parsedQty : 0;

  const rawStockStatusCol = getCsvColumnValue(row, ["is_in_stock", "stock_status", "stockStatus"]);
  const parsedStockStatus = parseCsvStockStatus(rawStockStatusCol);
  const stockStatus =
    parsedStockStatus !== undefined
      ? parsedStockStatus
      : qty > 0
      ? 1
      : 0;

  const sizeChart = getCsvColumnValue(row, ["size_chart", "sizechart"]) || "";
  const gender = getCsvColumnValue(row, ["gender", "gender_1"]) || "";
  const countryOfManufacture = getCsvColumnValue(row, ["country_of_manufacture", "country_of_origin"]) || "";
  const attributeSetCode = getCsvColumnValue(row, ["attribute_set_code", "attribute_set"]) || "";
  const configurableVariationLabels = getCsvColumnValue(row, ["configurable_variation_labels"]) || "";
  const configurableVariations = getCsvColumnValue(row, ["configurable_variations"]) || "";
  const rawBackorders = getCsvColumnValue(row, ["backorders"]);
  const allowBackorders = rawBackorders === "1" || rawBackorders?.toLowerCase() === "true";
  const rawFreeShipping = getCsvColumnValue(row, ["free_shipping"]);
  const isFreeShipping = rawFreeShipping === "1" || rawFreeShipping?.toLowerCase() === "true";
  const parsedDims = extractProductDimensions(row, attributes);

  const rawRelated = getCsvColumnValue(row, ["related_skus"]);
  const rawUpsell = getCsvColumnValue(row, ["upsell_skus"]);
  const rawCrosssell = getCsvColumnValue(row, ["crosssell_skus"]);
  const relatedSkus = (rawRelated || "").split(",").map((s) => s.trim()).filter(Boolean);
  const upsellSkus = (rawUpsell || "").split(",").map((s) => s.trim()).filter(Boolean);
  const crosssellSkus = (rawCrosssell || "").split(",").map((s) => s.trim()).filter(Boolean);

  const sku = getCsvColumnValue(row, ["sku"]) || "";
  const name = rawName || sku;

  const rawSlug = getCsvColumnValue(row, ["url_key", "slug"]);
  const slug = rawSlug || (hasValidName ? slugify(rawName!) : "") || sku.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const colorSwatches = parseColorSwatchesString(getCsvColumnValue(row, ["color_swatches", "colorSwatches"]));

  const rawStatus = getCsvColumnValue(row, ["status", "product_online"]);
  const status =
    rawStatus === "1" || rawStatus?.toLowerCase() === "enabled" || rawStatus?.toLowerCase() === "published"
      ? "published"
      : "draft";

  const visibility = getCsvColumnValue(row, ["visibility"]) || "";
  const categories = getCsvColumnValue(row, ["categories"]) || "";
  const rawSlugs = (() => {
    if (!categories) return [];
    const parts = categories.split(/[/,]/);
    const mapped = new Set<string>();
    parts.forEach((p: string) => {
      const s = p.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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
  // Prefer sanitized canonical slugs over raw CSV splits so cross-category safeguards cannot be undone
  const categorySlugs = canonicalSlugs.length > 0 ? canonicalSlugs : rawSlugs;

  const description = getCsvColumnValue(row, ["description"]) || "";
  const shortDescription = getCsvColumnValue(row, ["short_description"]) || "";
  const brand = getCsvColumnValue(row, ["brand"]) || attributes["brand"] || undefined;
  const taxClassName = getCsvColumnValue(row, ["tax_class_name"]);
  const hsnCode = getCsvColumnValue(row, ["hsn_code", "hsncode"]);
  const metaTitle = getCsvColumnValue(row, ["meta_title"]) || "";
  const metaKeywords = getCsvColumnValue(row, ["meta_keywords", "meta_keyword"]) || "";
  const metaDescription = getCsvColumnValue(row, ["meta_description"]) || "";
  const specialPriceFromDate = parseCsvDate(getCsvColumnValue(row, ["special_from_date"]));
  const specialPriceToDate = parseCsvDate(getCsvColumnValue(row, ["special_to_date"]));

  const _present: ICsvFieldPresence = {
    hasName: hasValidName,
    hasDescription: description.trim() !== "",
    hasShortDescription: shortDescription.trim() !== "",
    hasSlug: Boolean(rawSlug && rawSlug.trim() !== ""),
    hasBasePrice: basePrice > 0,
    hasSpecialPrice: specialPrice !== undefined,
    hasSpecialPriceFromDate: Boolean(specialPriceFromDate),
    hasSpecialPriceToDate: Boolean(specialPriceToDate),
    hasWeight: weight !== undefined && weight > 0,
    hasDimensions: Boolean(
      (parsedDims.length !== undefined && parsedDims.length > 0) ||
      (parsedDims.breadth !== undefined && parsedDims.breadth > 0) ||
      (parsedDims.height !== undefined && parsedDims.height > 0)
    ),
    hasQty: parsedQty !== undefined,
    hasStockStatus: parsedStockStatus !== undefined,
    hasStatus: rawStatus !== undefined,
    hasFreeShipping: rawFreeShipping !== undefined,
    hasAllowBackorders: rawBackorders !== undefined,
    hasVisibility: visibility !== "",
    hasTaxClassName: taxClassName !== undefined,
    hasHsnCode: hsnCode !== undefined,
    hasBrand: Boolean(brand),
    hasCategories: categories !== "",
    hasMetaTitle: metaTitle !== "",
    hasMetaDescription: metaDescription !== "",
    hasMetaKeywords: metaKeywords !== "",
    hasSizeChart: sizeChart !== "",
    hasGender: gender !== "",
    hasCountryOfManufacture: countryOfManufacture !== "",
    hasAttributeSetCode: attributeSetCode !== "",
    hasRelatedSkus: rawRelated !== undefined && hasCsvColumnHeader(row, ["related_skus"]),
    hasUpsellSkus: rawUpsell !== undefined && hasCsvColumnHeader(row, ["upsell_skus"]),
    hasCrosssellSkus: rawCrosssell !== undefined && hasCsvColumnHeader(row, ["crosssell_skus"]),
    hasImageLabels: Boolean(baseImageLabel || rawAdditionalLabels),
    hasColorSwatches: Boolean(colorSwatches && Object.keys(colorSwatches).length > 0),
    hasConfigurableVariations: configurableVariations !== "",
    hasConfigurableVariationLabels: configurableVariationLabels !== "",
  };

  return {
    name,
    description,
    shortDescription,
    slug,
    sku,
    basePrice,
    specialPrice,
    specialPriceFromDate,
    specialPriceToDate,
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
    productType: getCsvColumnValue(row, ["product_type"]) || "simple",
    brand,
    taxClassName,
    hsnCode,
    status,
    visibility,
    magentoCategories: categories,
    metaTitle,
    metaKeywords,
    metaDescription,
    sizeChart,
    size_chart: sizeChart,
    gender,
    countryOfManufacture,
    attributeSetCode,
    configurableVariationLabels,
    configurableVariations,
    colorSwatches,
    categoryId: categorySlugs[0] || undefined,
    categorySlugs,
    relatedSkus,
    upsellSkus,
    crosssellSkus,
    images,
    attributes,
    variants: [] as any[],
    _present,
  };
}

/**
 * Checks whether incoming image URLs match the existing image list so re-uploads preserve IDs and altText.
 */
function hasUnchangedImageUrls(existingImages: any[] | undefined, incomingImages: any[]): boolean {
  if (!Array.isArray(existingImages) || existingImages.length !== incomingImages.length) {
    return false;
  }
  const normalizeUrl = (u?: string) => (u ? u.split("?")[0].replace("http://", "https://").trim().toLowerCase() : "");
  return incomingImages.every((img, idx) => normalizeUrl(img?.url) === normalizeUrl(existingImages[idx]?.url));
}

/**
 * Builds a safe $set update payload for an existing product from a CSV row,
 * preserving omitted fields, merging attributes, and protecting published status/images/variants.
 */
export function buildExistingProductUpdateDoc(
  p: ReturnType<typeof mapCsvRowToProductData>,
  existing: Record<string, any>
): Record<string, any> {
  const updateDoc: Record<string, any> = {};
  const present = p._present;

  if (present.hasName) updateDoc.name = p.name;
  if (present.hasDescription) updateDoc.description = p.description;
  if (present.hasShortDescription) updateDoc.shortDescription = p.shortDescription;
  if (present.hasSlug) updateDoc.slug = p.slug;
  if (present.hasBasePrice && p.basePrice > 0) updateDoc.basePrice = p.basePrice;
  if (present.hasSpecialPrice && p.specialPrice !== undefined) updateDoc.specialPrice = p.specialPrice;
  if (present.hasSpecialPriceFromDate && p.specialPriceFromDate) updateDoc.specialPriceFromDate = p.specialPriceFromDate;
  if (present.hasSpecialPriceToDate && p.specialPriceToDate) updateDoc.specialPriceToDate = p.specialPriceToDate;

  if (present.hasWeight && p.weight !== undefined) {
    updateDoc.weight = p.weight;
    updateDoc.weightUnit = p.weightUnit || "kg";
  }

  if (present.hasDimensions) {
    const existingDimUnit = existing.dimensionUnit === "in" || existing.dimensionUnit === "mm" ? existing.dimensionUnit : "cm";
    if (p.length !== undefined && p.length > 0) {
      updateDoc.length = p.length;
    } else if (existingDimUnit !== "cm" && Number(existing.length) > 0) {
      updateDoc.length = convertToCm(Number(existing.length), existingDimUnit);
    }

    if (p.breadth !== undefined && p.breadth > 0) {
      updateDoc.breadth = p.breadth;
    } else if (existingDimUnit !== "cm" && Number(existing.breadth) > 0) {
      updateDoc.breadth = convertToCm(Number(existing.breadth), existingDimUnit);
    }

    if (p.height !== undefined && p.height > 0) {
      updateDoc.height = p.height;
    } else if (existingDimUnit !== "cm" && Number(existing.height) > 0) {
      updateDoc.height = convertToCm(Number(existing.height), existingDimUnit);
    }

    updateDoc.dimensionUnit = p.dimensionUnit || "cm";
  }

  if (p.attributes && Object.keys(p.attributes).length > 0) {
    const existingAttrs =
      existing.attributes instanceof Map
        ? Object.fromEntries(existing.attributes)
        : existing.attributes && typeof existing.attributes === "object"
        ? { ...existing.attributes }
        : {};
    updateDoc.attributes = { ...existingAttrs, ...p.attributes };
  }

  if (present.hasQty) updateDoc.qty = p.qty;
  if (present.hasStockStatus || present.hasQty) updateDoc.stockStatus = p.stockStatus;
  if (present.hasFreeShipping) updateDoc.isFreeShipping = p.isFreeShipping;
  if (present.hasAllowBackorders) updateDoc.allowBackorders = p.allowBackorders;
  if (present.hasVisibility) updateDoc.visibility = p.visibility;
  if (present.hasTaxClassName && p.taxClassName) updateDoc.taxClassName = p.taxClassName;
  if (present.hasHsnCode && p.hsnCode) updateDoc.hsnCode = p.hsnCode;
  if (present.hasBrand && p.brand) updateDoc.brand = p.brand;
  if (present.hasCategories && p.magentoCategories) updateDoc.magentoCategories = p.magentoCategories;
  if (present.hasCategories) {
    const resolvedForExisting =
      !present.hasName && existing.name && p.magentoCategories
        ? resolveCanonicalCategorySlugs({
            name: existing.name,
            magentoCategories: p.magentoCategories,
            categorySlugs: p.categorySlugs,
          })
        : p.categorySlugs;
    if (resolvedForExisting && resolvedForExisting.length > 0) {
      updateDoc.categorySlugs = resolvedForExisting;
      updateDoc.categoryId = resolvedForExisting[0] || p.categoryId;
    }
  }
  if (present.hasMetaTitle) updateDoc.metaTitle = p.metaTitle;
  if (present.hasMetaDescription) updateDoc.metaDescription = p.metaDescription;
  if (present.hasMetaKeywords) updateDoc.metaKeywords = p.metaKeywords;
  if (present.hasSizeChart) updateDoc.sizeChart = p.sizeChart;
  if (present.hasGender) updateDoc.gender = p.gender;
  if (present.hasCountryOfManufacture) updateDoc.countryOfManufacture = p.countryOfManufacture;
  if (present.hasAttributeSetCode) updateDoc.attributeSetCode = p.attributeSetCode;
  if (present.hasRelatedSkus) updateDoc.relatedSkus = p.relatedSkus;
  if (present.hasUpsellSkus) updateDoc.upsellSkus = p.upsellSkus;
  if (present.hasCrosssellSkus) updateDoc.crosssellSkus = p.crosssellSkus;
  if (present.hasColorSwatches && p.colorSwatches) updateDoc.colorSwatches = p.colorSwatches;
  if (present.hasConfigurableVariations) updateDoc.configurableVariations = p.configurableVariations;
  if (present.hasConfigurableVariationLabels) updateDoc.configurableVariationLabels = p.configurableVariationLabels;

  // Photos protection: never overwrite existing photos with empty list, and preserve existing IDs/altText if URLs match
  if (
    p.images &&
    p.images.length > 0 &&
    (present.hasImageLabels || !hasUnchangedImageUrls(existing.images, p.images))
  ) {
    updateDoc.images = p.images;
  }

  // Variants merge protection: update matching variants while preserving unmentioned fields and variants
  if (p.variants && p.variants.length > 0) {
    const stripVariantMeta = (v: any) => {
      const { _present, ...cleanVar } = v || {};
      return cleanVar;
    };

    if (existing.variants && existing.variants.length > 0) {
      const newVarMap = new Map<string, any>(
        p.variants.map((v: any) => [String(v.sku || "").toLowerCase(), v])
      );
      const mergedVariants: any[] = [];

      for (const oldVar of existing.variants as any[]) {
        const oldVarSkuKey = String(oldVar.sku || "").toLowerCase();
        if (newVarMap.has(oldVarSkuKey)) {
          const rawUpdatedVar: any = newVarMap.get(oldVarSkuKey);
          const vPresent: ICsvFieldPresence | undefined = rawUpdatedVar._present;
          const updatedVar = stripVariantMeta(rawUpdatedVar);

          if (vPresent) {
            const oldAttrs =
              oldVar.attributes instanceof Map
                ? Object.fromEntries(oldVar.attributes)
                : oldVar.attributes && typeof oldVar.attributes === "object"
                ? { ...oldVar.attributes }
                : {};
            const newAttrs =
              updatedVar.attributes && typeof updatedVar.attributes === "object" ? updatedVar.attributes : {};

            const oldVarDimUnit = oldVar.dimensionUnit === "in" || oldVar.dimensionUnit === "mm" ? oldVar.dimensionUnit : "cm";
            const dimensionUpdates: Record<string, any> = vPresent.hasDimensions
              ? {
                  ...(updatedVar.length !== undefined && updatedVar.length > 0
                    ? { length: updatedVar.length }
                    : oldVarDimUnit !== "cm" && Number(oldVar.length) > 0
                    ? { length: convertToCm(Number(oldVar.length), oldVarDimUnit) }
                    : {}),
                  ...(updatedVar.breadth !== undefined && updatedVar.breadth > 0
                    ? { breadth: updatedVar.breadth }
                    : oldVarDimUnit !== "cm" && Number(oldVar.breadth) > 0
                    ? { breadth: convertToCm(Number(oldVar.breadth), oldVarDimUnit) }
                    : {}),
                  ...(updatedVar.height !== undefined && updatedVar.height > 0
                    ? { height: updatedVar.height }
                    : oldVarDimUnit !== "cm" && Number(oldVar.height) > 0
                    ? { height: convertToCm(Number(oldVar.height), oldVarDimUnit) }
                    : {}),
                  dimensionUnit: updatedVar.dimensionUnit || oldVar.dimensionUnit || "cm",
                }
              : {};

            const mergedVar: Record<string, any> = {
              ...(oldVar as object),
              ...(vPresent.hasBasePrice && updatedVar.price > 0 ? { price: updatedVar.price } : {}),
              ...(vPresent.hasSpecialPrice ? { specialPrice: updatedVar.specialPrice } : {}),
              ...(vPresent.hasQty ? { stock: updatedVar.stock } : {}),
              ...(vPresent.hasStatus ? { status: updatedVar.status } : {}),
              ...(vPresent.hasVisibility ? { visibility: updatedVar.visibility } : {}),
              ...(vPresent.hasHsnCode && updatedVar.hsnCode ? { hsnCode: updatedVar.hsnCode } : {}),
              ...(vPresent.hasWeight && updatedVar.weight !== undefined
                ? { weight: updatedVar.weight, weightUnit: updatedVar.weightUnit || oldVar.weightUnit || "kg" }
                : {}),
              ...dimensionUpdates,
              ...(Object.keys(newAttrs).length > 0 ? { attributes: { ...oldAttrs, ...newAttrs } } : {}),
              images: updatedVar.images && updatedVar.images.length > 0 ? updatedVar.images : oldVar.images,
              imageUrl: updatedVar.imageUrl || oldVar.imageUrl,
              altText: updatedVar.altText || oldVar.altText,
            };
            mergedVariants.push(mergedVar);
          } else {
            mergedVariants.push({
              ...(oldVar as object),
              ...(updatedVar as object),
              images: updatedVar.images && updatedVar.images.length > 0 ? updatedVar.images : oldVar.images,
              imageUrl: updatedVar.imageUrl || oldVar.imageUrl,
              altText: updatedVar.altText || oldVar.altText,
            });
          }
          newVarMap.delete(oldVarSkuKey);
        } else {
          mergedVariants.push(oldVar);
        }
      }

      for (const brandNewVar of Array.from(newVarMap.values())) {
        mergedVariants.push(stripVariantMeta(brandNewVar));
      }

      updateDoc.variants = mergedVariants;
    } else {
      updateDoc.variants = p.variants.map(stripVariantMeta);
    }
  }

  // Status protection: only update when explicitly provided, and never downgrade published to draft
  if (present.hasStatus) {
    if (existing.status === "published" && p.status === "draft") {
      updateDoc.status = "published";
    } else {
      updateDoc.status = p.status;
    }
  }

  return updateDoc;
}

/**
 * Builds a sparse `$set` update object (`variants.$.<field>`) for an existing child variant SKU,
 * guaranteeing omitted CSV columns or blank cells never touch unrelated variant fields.
 */
export function buildDirectVariantUpdateSet(
  row: Record<string, any>,
  formatImageUrl: (url: string) => string | null,
  existingVariant?: Record<string, any>
): Record<string, any> {
  const updateVariantFields: Record<string, any> = {};

  const parsedPrice = parseCsvNumber(getCsvColumnValue(row, ["price", "base_price", "basePrice"]));
  if (parsedPrice !== undefined && parsedPrice > 0) {
    updateVariantFields["variants.$.price"] = parsedPrice;
  }

  const parsedSpecial = parseCsvNumber(getCsvColumnValue(row, ["special_price", "specialPrice"]));
  if (parsedSpecial !== undefined && parsedSpecial > 0) {
    updateVariantFields["variants.$.specialPrice"] = parsedSpecial;
  }

  const parsedQty = parseCsvInt(getCsvColumnValue(row, ["qty", "stock", "quantity"]));
  if (parsedQty !== undefined) {
    updateVariantFields["variants.$.stock"] = parsedQty;
  }

  const rawStatus = getCsvColumnValue(row, ["status", "product_online"]);
  if (rawStatus !== undefined) {
    updateVariantFields["variants.$.status"] =
      rawStatus === "1" || rawStatus.toLowerCase() === "enabled" || rawStatus.toLowerCase() === "published"
        ? "enabled"
        : "disabled";
  }

  const childAttributes: Record<string, string> = {};
  const rawChildAdditional = getCsvColumnValue(row, ["additional_attributes", "additionalattributes"]);
  if (rawChildAdditional) {
    Object.assign(childAttributes, parseAttributesString(rawChildAdditional));
  }

  const childDims = extractProductDimensions(row, childAttributes);
  const hasAnyUpdatedDimAxis =
    (childDims.length !== undefined && childDims.length > 0) ||
    (childDims.breadth !== undefined && childDims.breadth > 0) ||
    (childDims.height !== undefined && childDims.height > 0);

  if (hasAnyUpdatedDimAxis) {
    const oldVarDimUnit =
      existingVariant?.dimensionUnit === "in" || existingVariant?.dimensionUnit === "mm"
        ? existingVariant.dimensionUnit
        : "cm";

    if (childDims.length !== undefined && childDims.length > 0) {
      updateVariantFields["variants.$.length"] = childDims.length;
    } else if (oldVarDimUnit !== "cm" && Number(existingVariant?.length) > 0) {
      updateVariantFields["variants.$.length"] = convertToCm(Number(existingVariant?.length), oldVarDimUnit);
    }

    if (childDims.breadth !== undefined && childDims.breadth > 0) {
      updateVariantFields["variants.$.breadth"] = childDims.breadth;
    } else if (oldVarDimUnit !== "cm" && Number(existingVariant?.breadth) > 0) {
      updateVariantFields["variants.$.breadth"] = convertToCm(Number(existingVariant?.breadth), oldVarDimUnit);
    }

    if (childDims.height !== undefined && childDims.height > 0) {
      updateVariantFields["variants.$.height"] = childDims.height;
    } else if (oldVarDimUnit !== "cm" && Number(existingVariant?.height) > 0) {
      updateVariantFields["variants.$.height"] = convertToCm(Number(existingVariant?.height), oldVarDimUnit);
    }

    updateVariantFields["variants.$.dimensionUnit"] = childDims.dimensionUnit || "cm";
  }

  const childWeightData = extractProductWeight(row, childAttributes);
  if (childWeightData.weight !== undefined && childWeightData.weight > 0) {
    updateVariantFields["variants.$.weight"] = childWeightData.weight;
    updateVariantFields["variants.$.weightUnit"] = childWeightData.weightUnit || "kg";
  }

  const hsnCode = getCsvColumnValue(row, ["hsn_code", "hsncode"]);
  if (hsnCode) {
    updateVariantFields["variants.$.hsnCode"] = hsnCode;
  }

  const baseImg = getCsvColumnValue(row, ["base_image"]);
  if (baseImg) {
    const fUrl = formatImageUrl(baseImg);
    if (fUrl) updateVariantFields["variants.$.imageUrl"] = fUrl;
  }

  const rawColorAttr =
    getCsvColumnValue(row, ["color", "colour"]) ||
    childAttributes.color ||
    childAttributes.colour;
  if (rawColorAttr) {
    updateVariantFields["variants.$.attributes.color"] = rawColorAttr.replace(/\./g, " ").replace(/\s+/g, " ").trim();
  }
  const rawSizeAttr =
    getCsvColumnValue(row, ["size", "eu_size", "eu_size_for_boots"]) ||
    childAttributes.size ||
    childAttributes.eu_size ||
    childAttributes.eu_size_for_boots;
  if (rawSizeAttr) {
    updateVariantFields["variants.$.attributes.size"] = rawSizeAttr;
  }

  const oldSku = getCsvColumnValue(row, ["old_sku", "oldsku"]);
  const newSku = getCsvColumnValue(row, ["new_sku", "sku"]);
  if (oldSku && newSku && oldSku !== newSku) {
    updateVariantFields["variants.$.sku"] = newSku;
  }

  return updateVariantFields;
}

/**
 * Produces human-readable "field: old -> new" summaries for the Pre-Upload Validator Preview popup.
 */
export function formatCsvUpdateDiffs(
  existing: Record<string, any>,
  updateDoc: Record<string, any>
): string[] {
  const diffs: string[] = [];
  const fmt = (val: any) => (val === undefined || val === null || val === "" ? "—" : String(val));

  if (updateDoc.sku !== undefined && updateDoc.sku !== existing.sku) {
    diffs.push(`sku: ${fmt(existing.sku)} → ${updateDoc.sku}`);
  }
  if (updateDoc.name !== undefined && updateDoc.name !== existing.name) {
    diffs.push(`name: ${fmt(existing.name)} → ${updateDoc.name}`);
  }
  if (updateDoc.basePrice !== undefined && updateDoc.basePrice !== existing.basePrice) {
    diffs.push(`price: ₹${fmt(existing.basePrice)} → ₹${updateDoc.basePrice}`);
  }
  if (updateDoc.specialPrice !== undefined && updateDoc.specialPrice !== existing.specialPrice) {
    diffs.push(`specialPrice: ₹${fmt(existing.specialPrice)} → ₹${updateDoc.specialPrice}`);
  }
  if (updateDoc.qty !== undefined && updateDoc.qty !== existing.qty) {
    diffs.push(`qty: ${fmt(existing.qty)} → ${updateDoc.qty}`);
  }
  if (updateDoc.stockStatus !== undefined && updateDoc.stockStatus !== existing.stockStatus) {
    diffs.push(`stock: ${existing.stockStatus === 0 ? "OOS" : "In Stock"} → ${updateDoc.stockStatus === 0 ? "OOS" : "In Stock"}`);
  }
  if (updateDoc.weight !== undefined && (updateDoc.weight !== existing.weight || updateDoc.weightUnit !== existing.weightUnit)) {
    diffs.push(`weight: ${fmt(existing.weight)}${existing.weight ? " " + (existing.weightUnit || "kg") : ""} → ${updateDoc.weight} ${updateDoc.weightUnit || "kg"}`);
  }
  if (updateDoc.length !== undefined || updateDoc.breadth !== undefined || updateDoc.height !== undefined) {
    const oldDim =
      existing.length || existing.breadth || existing.height
        ? `${existing.length || "?"}×${existing.breadth || "?"}×${existing.height || "?"} ${existing.dimensionUnit || "cm"}`
        : "—";
    const newL = updateDoc.length ?? existing.length ?? "?";
    const newB = updateDoc.breadth ?? existing.breadth ?? "?";
    const newH = updateDoc.height ?? existing.height ?? "?";
    diffs.push(`L×B×H: ${oldDim} → ${newL}×${newB}×${newH} ${updateDoc.dimensionUnit || "cm"}`);
  }
  if (updateDoc.brand !== undefined && updateDoc.brand !== existing.brand) {
    diffs.push(`brand: ${fmt(existing.brand)} → ${updateDoc.brand}`);
  }
  if (updateDoc.magentoCategories !== undefined) {
    diffs.push(`categories updated`);
  }
  if (updateDoc.images) {
    diffs.push(`images: ${(existing.images || []).length} → ${updateDoc.images.length}`);
  }
  if (updateDoc.variants) {
    diffs.push(`variants: ${(existing.variants || []).length} → ${updateDoc.variants.length} merged`);
  }
  if (updateDoc.attributes) {
    const oldAttrs =
      existing.attributes instanceof Map
        ? Object.fromEntries(existing.attributes)
        : existing.attributes || {};
    const changedKeys = Object.keys(updateDoc.attributes).filter(
      (k) => updateDoc.attributes[k] !== oldAttrs[k]
    );
    if (changedKeys.length > 0) {
      diffs.push(`specs merged: ${changedKeys.slice(0, 4).join(", ")}${changedKeys.length > 4 ? ` (+${changedKeys.length - 4})` : ""}`);
    }
  }
  if (updateDoc.status !== undefined && updateDoc.status !== existing.status) {
    diffs.push(`status: ${fmt(existing.status)} → ${updateDoc.status}`);
  }

  // Catch any remaining scalar updates cleanly
  const covered = new Set([
    "sku", "name", "basePrice", "specialPrice", "qty", "stockStatus", "weight", "weightUnit",
    "length", "breadth", "height", "dimensionUnit", "brand", "brandId", "magentoCategories",
    "categorySlugs", "categoryId", "images", "variants", "attributes", "status",
  ]);
  for (const k of Object.keys(updateDoc)) {
    if (!covered.has(k) && updateDoc[k] !== existing[k]) {
      diffs.push(`${k} updated`);
    }
  }

  return diffs;
}

/**
 * Shared S3/CDN image URL formatter used by both migration worker and dry-run preview.
 */
export function createCsvImageUrlFormatter() {
  const s3BaseUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/catalog/product`;
  return (url: string): string | null => {
    const clean = String(url || "").trim();
    if (!clean) return null;
    if (clean.startsWith("http://") || clean.startsWith("https://")) return clean;
    return clean.startsWith("/") ? `${s3BaseUrl}${clean}` : `${s3BaseUrl}/${clean}`;
  };
}

export interface ICsvPreviewRowResult {
  rowNumber: number;
  sku: string;
  name: string;
  rowType: "simple" | "configurable" | "variant" | "unknown";
  action: "create" | "update" | "variant_update" | "variant_create" | "no_change" | "skip";
  changes: string[];
  reason?: string;
}

export interface ICsvMigrationPreviewReport {
  totalRows: number;
  headerAnalysis: {
    standardFields: string[];
    attributeColumns: string[];
    ignoredColumns: string[];
  };
  summary: {
    createCount: number;
    updateCount: number;
    variantUpdateCount: number;
    variantCreateCount: number;
    noChangeCount: number;
    skipCount: number;
  };
  rows: ICsvPreviewRowResult[];
  truncatedNormalRows: number;
}

const MAX_PREVIEW_NORMAL_ROWS = 150;

/**
 * Pure dry-run analyzer that mirrors migration.worker classification, validation, and safe-patch logic
 * without mutating MongoDB so admins can inspect exact changes before confirming bulk upload.
 */
export function buildCsvMigrationPreview(params: {
  allRows: Record<string, any>[];
  headers: string[];
  existingRoots: any[];
  existingVariantParents: any[];
  formatImageUrl: (url: string) => string | null;
}): ICsvMigrationPreviewReport {
  const { allRows, headers, existingRoots, existingVariantParents, formatImageUrl } = params;
  const headerAnalysis = classifyCsvHeaders(headers);

  const rootLowerMap = new Map<string, any>();
  for (const r of existingRoots) {
    if (r?.sku) rootLowerMap.set(String(r.sku).toLowerCase(), r);
  }

  const variantParentMap = new Map<string, { parentDoc: any; oldVar: any }>();
  for (const parentDoc of existingVariantParents) {
    for (const v of parentDoc?.variants || []) {
      if (v?.sku) {
        variantParentMap.set(String(v.sku).toLowerCase(), { parentDoc, oldVar: v });
      }
    }
  }

  const childSkusLower = new Set<string>();
  const configurablesSet = new Set<string>();

  for (const row of allRows) {
    const sku = getCsvColumnValue(row, ["sku", "\ufeffsku"]);
    if (!sku || sku.toLowerCase() === "sku") continue;
    const productType = getCsvColumnValue(row, ["product_type"])?.toLowerCase();
    if (productType === "configurable") {
      configurablesSet.add(sku.toLowerCase());
      const variationsStr = getCsvColumnValue(row, ["configurable_variations"]) || "";
      if (variationsStr.includes("sku=")) {
        const matches = variationsStr.match(/sku=([^,|]+)/g);
        matches?.forEach((m) => childSkusLower.add(m.split("=")[1].trim().toLowerCase()));
      } else if (variationsStr) {
        variationsStr.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).forEach((s) => childSkusLower.add(s));
      }
    } else {
      const vis = getCsvColumnValue(row, ["visibility"])?.trim().toLowerCase();
      const parentSku = getCsvColumnValue(row, ["parent_sku", "parentsku"]);
      if (vis === "not visible individually" || vis === "1" || parentSku) {
        childSkusLower.add(sku.toLowerCase());
      }
    }
  }

  const summary = {
    createCount: 0,
    updateCount: 0,
    variantUpdateCount: 0,
    variantCreateCount: 0,
    noChangeCount: 0,
    skipCount: 0,
  };

  const normalPreviewRows: ICsvPreviewRowResult[] = [];
  const skipPreviewRows: ICsvPreviewRowResult[] = [];

  allRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const sku = getCsvColumnValue(row, ["sku", "\ufeffsku"]);
    if (!sku) {
      summary.skipCount++;
      skipPreviewRows.push({
        rowNumber,
        sku: "—",
        name: getCsvColumnValue(row, ["name"]) || "Missing SKU",
        rowType: "unknown",
        action: "skip",
        changes: [],
        reason: "SKU missing in row",
      });
      return;
    }
    if (sku.toLowerCase() === "sku") return;

    const skuLower = sku.toLowerCase();
    const oldSku = getCsvColumnValue(row, ["old_sku", "oldsku"]);
    const oldSkuLower = oldSku?.toLowerCase();
    const productType = getCsvColumnValue(row, ["product_type"])?.toLowerCase();
    const p = mapCsvRowToProductData(row, formatImageUrl);

    // 1. Existing child variant inside DB parent
    const matchedVariant = variantParentMap.get(skuLower) || (oldSkuLower ? variantParentMap.get(oldSkuLower) : undefined);
    if (productType !== "configurable" && matchedVariant) {
      const directSet = buildDirectVariantUpdateSet(row, formatImageUrl, matchedVariant.oldVar);
      const changes = Object.entries(directSet).map(([k, v]) => {
        const cleanField = k.replace(/^variants\.\$\./, "");
        return `${cleanField}: ${String(v)}`;
      });

      if (changes.length === 0) {
        summary.noChangeCount++;
        if (normalPreviewRows.length < MAX_PREVIEW_NORMAL_ROWS) {
          normalPreviewRows.push({
            rowNumber,
            sku,
            name: matchedVariant.parentDoc.name || sku,
            rowType: "variant",
            action: "no_change",
            changes: ["No changed variant columns in CSV"],
          });
        }
      } else {
        summary.variantUpdateCount++;
        if (normalPreviewRows.length < MAX_PREVIEW_NORMAL_ROWS) {
          normalPreviewRows.push({
            rowNumber,
            sku,
            name: `${matchedVariant.parentDoc.name || matchedVariant.parentDoc.sku} (${matchedVariant.oldVar.sku})`,
            rowType: "variant",
            action: "variant_update",
            changes,
          });
        }
      }
      return;
    }

    // 2. Child row belonging to configurable/parent CSV or DB parent
    const parentSku = getCsvColumnValue(row, ["parent_sku", "parentsku"]);
    const isChildRow = productType !== "configurable" && (childSkusLower.has(skuLower) || Boolean(parentSku));
    if (isChildRow) {
      const parentInDb = parentSku ? rootLowerMap.get(parentSku.toLowerCase()) : undefined;
      const parentInSameCsv = parentSku ? configurablesSet.has(parentSku.toLowerCase()) : false;
      if (parentInDb || parentInSameCsv || !parentSku) {
        summary.variantCreateCount++;
        const previewChanges: string[] = [];
        if (p._present.hasBasePrice) previewChanges.push(`price: ₹${p.basePrice}`);
        if (p._present.hasQty) previewChanges.push(`stock: ${p.qty}`);
        if (p._present.hasWeight) previewChanges.push(`weight: ${p.weight} ${p.weightUnit}`);
        if (p._present.hasDimensions) {
          previewChanges.push(`L×B×H: ${p.length || "?"}×${p.breadth || "?"}×${p.height || "?"} ${p.dimensionUnit}`);
        }
        if (normalPreviewRows.length < MAX_PREVIEW_NORMAL_ROWS) {
          normalPreviewRows.push({
            rowNumber,
            sku,
            name: parentSku ? `Child of ${parentSku}` : p.name,
            rowType: "variant",
            action: "variant_create",
            changes: previewChanges.length > 0 ? previewChanges : ["Attached under parent configurable"],
          });
        }
        return;
      }
    }

    // 3. Root Product (Configurable or Simple)
    const rowType: "simple" | "configurable" = productType === "configurable" ? "configurable" : "simple";
    const existing = rootLowerMap.get(skuLower) || (oldSkuLower ? rootLowerMap.get(oldSkuLower) : undefined);

    if (existing) {
      const updateDoc = buildExistingProductUpdateDoc(p, existing);
      if (oldSku && existing.sku.toLowerCase() !== skuLower && !rootLowerMap.has(skuLower)) {
        updateDoc.sku = sku;
      }
      const diffs = formatCsvUpdateDiffs(existing, updateDoc);
      if (Object.keys(updateDoc).length === 0 || diffs.length === 0) {
        summary.noChangeCount++;
        if (normalPreviewRows.length < MAX_PREVIEW_NORMAL_ROWS) {
          normalPreviewRows.push({
            rowNumber,
            sku,
            name: existing.name || p.name,
            rowType,
            action: "no_change",
            changes: ["Omitted/blank columns preserved — nothing new to overwrite"],
          });
        }
      } else {
        summary.updateCount++;
        if (normalPreviewRows.length < MAX_PREVIEW_NORMAL_ROWS) {
          normalPreviewRows.push({
            rowNumber,
            sku,
            name: existing.name || p.name,
            rowType,
            action: "update",
            changes: diffs,
          });
        }
      }
    } else {
      // Brand new product creation checks
      if (!p._present.hasName || p.name.trim() === sku) {
        summary.skipCount++;
        skipPreviewRows.push({
          rowNumber,
          sku,
          name: p.name || sku,
          rowType,
          action: "skip",
          changes: [],
          reason: "New SKU missing valid product name (blank or #N/A)",
        });
        return;
      }
      let effectiveBasePrice = p.basePrice;
      let inlineVariantCount = 0;
      if (rowType === "configurable" && p.configurableVariations) {
        const inlineVars = parseConfigurableVariationsString(p.configurableVariations, p.basePrice, formatImageUrl);
        inlineVariantCount = inlineVars.length;
        if (effectiveBasePrice <= 0) {
          const validInlinePrices = inlineVars.map((v) => v.price).filter((pr) => pr > 0);
          if (validInlinePrices.length > 0) {
            effectiveBasePrice = Math.min(...validInlinePrices);
          }
        }
      }
      if (effectiveBasePrice <= 0 && rowType === "simple") {
        summary.skipCount++;
        skipPreviewRows.push({
          rowNumber,
          sku,
          name: p.name,
          rowType,
          action: "skip",
          changes: [],
          reason: "New standalone product has zero/missing price",
        });
        return;
      }

      summary.createCount++;
      const createSummary: string[] = [
        `name: ${p.name}`,
        effectiveBasePrice > 0 ? `price: ₹${effectiveBasePrice}` : "price: from child variants",
      ];
      if (p._present.hasQty) createSummary.push(`qty: ${p.qty}`);
      if (p._present.hasWeight) createSummary.push(`weight: ${p.weight} ${p.weightUnit}`);
      if (p._present.hasDimensions) createSummary.push(`L×B×H: ${p.length || "?"}×${p.breadth || "?"}×${p.height || "?"} ${p.dimensionUnit}`);
      if (inlineVariantCount > 0) createSummary.push(`${inlineVariantCount} variants`);

      if (normalPreviewRows.length < MAX_PREVIEW_NORMAL_ROWS) {
        normalPreviewRows.push({
          rowNumber,
          sku,
          name: p.name,
          rowType,
          action: "create",
          changes: createSummary,
        });
      }
    }
  });

  const combinedRows = [...skipPreviewRows, ...normalPreviewRows];
  const validNonSkipCount =
    summary.createCount +
    summary.updateCount +
    summary.variantUpdateCount +
    summary.variantCreateCount +
    summary.noChangeCount;
  const truncatedNormalRows = Math.max(0, validNonSkipCount - normalPreviewRows.length);

  return {
    totalRows: allRows.length,
    headerAnalysis,
    summary,
    rows: combinedRows,
    truncatedNormalRows,
  };
}
