/**
 * @fileoverview Smart Category Specifications & Attributes Template value resolver.
 *
 * Strictly bound by the Category Specifications & Attributes Template fields:
 * NEVER outputs unconfigured keys and NEVER hallucinates values not present in the product.
 *
 * Resolution Priority per Template Field:
 * 1. Explicit `product.attributes` (exact key -> attribute synonyms -> concept alias match)
 * 2. Explicit structured Product document fields (`countryOfManufacture`, `brand`, `gender`, `weight`, `dimensions`, `variants`)
 * 3. Conservative, negation-aware factual extraction from `name`, `shortDescription`, and clean `description`
 */

import type { ProductSpecificationItem, SpecFieldDefinition } from "./spec-templates";

export type SpecConcept =
  | "capacity"
  | "weight_in_ml"
  | "material"
  | "certification"
  | "waterproof"
  | "pinlock_ready"
  | "sun_visor"
  | "bluetooth_ready"
  | "closure_type"
  | "rain_cover"
  | "convertible_in_backpack"
  | "magnetic_non_magnetic"
  | "luggage_suitable_for_upswept_e"
  | "glove_type"
  | "knuckle_protection"
  | "touchscreen_friendly"
  | "boot_type"
  | "ankle_protection"
  | "thermal_liner"
  | "ventilation"
  | "formulation"
  | "application_type"
  | "intercom_range"
  | "battery_runtime"
  | "motorcycle_model"
  | "bike_compatibility"
  | "placement"
  | "warranty"
  | "country_of_origin"
  | "gender"
  | "brand"
  | "weight"
  | "dimensions"
  | "color"
  | "size";

export interface ProductSpecExtractionContext {
  name?: string;
  shortDescription?: string;
  description?: string;
  brand?: string;
  gender?: string;
  countryOfManufacture?: string;
  weight?: number;
  weightUnit?: string;
  length?: number;
  breadth?: number;
  height?: number;
  dimensionUnit?: string;
  variants?: Array<{
    attributes?: Record<string, string> | Map<string, string>;
  }>;
}

const JUNK_SPEC_VALUES = new Set([
  "new",
  "used",
  "refurbished",
  "none",
  "null",
  "undefined",
  "n/a",
  "na",
  "default",
  "standard",
  "-",
  "--",
  "0",
  "0.000000",
]);

function isHtmlLikeString(str: string): boolean {
  return (
    /<[a-z\d]+(?:\s+[^>]*>|>)/i.test(str) ||
    str.includes("</") ||
    str.includes("/>") ||
    str.includes("<table") ||
    str.includes("<div")
  );
}

export function isJunkSpecValue(val: string): boolean {
  const v = val.trim().toLowerCase();
  if (!v || v.length > 220) return true;
  if (isHtmlLikeString(val)) return true;
  return JUNK_SPEC_VALUES.has(v);
}

export function isHighlightSpec(key: string, value: string): boolean {
  const k = key.toLowerCase();
  const v = value.toLowerCase();
  if (
    k.includes("cert") ||
    k.includes("safety") ||
    k.includes("armour") ||
    k.includes("armor") ||
    k.includes("homolog")
  ) {
    return true;
  }
  return (
    v.includes("ece 22.06") ||
    v.includes("ece 22.05") ||
    v.includes("ce level 2") ||
    v.includes("carbon fiber") ||
    v.includes("snell") ||
    v.includes("double d") ||
    v.includes("100% waterproof")
  );
}

export function normalizeLookupKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const ATTRIBUTES_BY_CONCEPT: Record<SpecConcept, string[]> = {
  capacity: ["capacity", "volume", "luggage_volume", "luggage_capacity", "storage_capacity", "bag_capacity"],
  weight_in_ml: ["weight_in_ml", "net_volume", "net_quantity", "fluid_volume"],
  material: ["material", "shell_material", "outer_shell", "outer_material", "construction_material", "outer_fabric", "fabric", "upper_material"],
  certification: ["certification", "safety_certification", "homologation", "safety_standard", "armor_protection", "armour_level", "ce_rating", "protection_level"],
  waterproof: ["waterproof", "waterproofing", "water_resistance", "water_resistant", "weather_resistance", "rain_protection", "ip_rating"],
  pinlock_ready: ["pinlock_ready", "pinlock", "anti_fog", "antifog"],
  sun_visor: ["sun_visor", "internal_visor", "dual_visor", "internal_sun_visor"],
  bluetooth_ready: ["bluetooth_ready", "intercom_ready", "bluetooth", "bluetooth_spec", "speaker_pockets"],
  closure_type: ["closure_type", "closure", "fastening", "fastening_system", "fastener", "retention_system", "chin_strap"],
  rain_cover: ["rain_cover", "raincover", "rain_liner"],
  convertible_in_backpack: ["convertible_in_backpack", "backpack_conversion", "shoulder_conversion"],
  magnetic_non_magnetic: ["magnetic_non_magnetic", "mounting_system", "mount_type", "attachment_system", "tank_mount"],
  luggage_suitable_for_upswept_e: ["luggage_suitable_for_upswept_e", "upswept_exhaust", "exhaust_clearance"],
  glove_type: ["glove_type", "glove_style", "cuff_type"],
  knuckle_protection: ["knuckle_protection", "knuckle_protector", "knuckle_armor", "knuckle_guard"],
  touchscreen_friendly: ["touchscreen_friendly", "touchscreen", "touch_screen"],
  boot_type: ["boot_type", "boot_classification", "boot_style"],
  ankle_protection: ["ankle_protection", "shin_protection", "ankle_armor", "ankle_guard"],
  thermal_liner: ["thermal_liner", "warm_liner", "winter_liner", "thermal"],
  ventilation: ["ventilation", "airflow", "air_flow", "vents", "breathability"],
  formulation: ["formulation", "chemical_formulation", "lubricant_type"],
  application_type: ["application_type", "application_method", "dispenser"],
  intercom_range: ["intercom_range", "mesh_range", "bluetooth_range", "range"],
  battery_runtime: ["battery_runtime", "battery_life", "talk_time", "battery"],
  motorcycle_model: ["motorcycle_model", "compatible_motorcycle_models", "compatible_bikes", "compatible_models", "bike_model"],
  bike_compatibility: ["bike_compatibility", "fitment_type", "fitment", "compatibility"],
  placement: ["placement", "mounting_location", "mounting_position", "position"],
  warranty: ["warranty", "warranty_period", "manufacturer_warranty"],
  country_of_origin: ["country_of_origin", "country_of_manufacture", "made_in", "origin"],
  gender: ["gender", "rider_fit", "fit", "target_gender"],
  brand: ["brand", "manufacturer", "make"],
  weight: ["weight", "product_weight", "net_weight", "gross_weight", "shipping_weight"],
  dimensions: ["dimensions", "dimension", "size_dimensions"],
  color: ["color", "colour", "colors", "colours"],
  size: ["size", "sizes", "available_sizes"],
};

const EXACT_CONCEPT_LOOKUP: Map<string, SpecConcept> = (() => {
  const map = new Map<string, SpecConcept>();
  for (const [concept, aliases] of Object.entries(ATTRIBUTES_BY_CONCEPT) as Array<[SpecConcept, string[]]>) {
    for (const alias of aliases) {
      map.set(alias, concept);
    }
  }
  return map;
})();

/**
 * Maps a Category Template field `key` and `label` to its canonical specification concept.
 * Supports arbitrary admin-defined labels/slugs like "Water Resistance" -> "waterproof".
 */
export function inferSpecConcept(key: string, label?: string): SpecConcept | null {
  const normKey = normalizeLookupKey(key || "");
  if (EXACT_CONCEPT_LOOKUP.has(normKey)) {
    return EXACT_CONCEPT_LOOKUP.get(normKey)!;
  }

  const normLabel = normalizeLookupKey(label || "");
  if (normLabel && EXACT_CONCEPT_LOOKUP.has(normLabel)) {
    return EXACT_CONCEPT_LOOKUP.get(normLabel)!;
  }

  const combined = ` ${normKey} ${normLabel} `.replace(/_/g, " ");

  if (combined.includes("weight in ml") || combined.includes("net volume") || combined.includes("net quantity") || combined.includes("fluid")) {
    return "weight_in_ml";
  }
  if (combined.includes("capacity") || combined.includes("luggage volume") || combined.includes("storage volume")) {
    return "capacity";
  }
  if (combined.includes("country") || combined.includes("origin") || combined.includes("manufacture") || combined.includes("made in")) {
    return "country_of_origin";
  }
  if (combined.includes("warranty")) return "warranty";
  if (combined.includes("waterproof") || combined.includes("water resist") || combined.includes("weather resist") || combined.includes("rain protection")) {
    return "waterproof";
  }
  if (combined.includes("rain cover") || combined.includes("raincover")) return "rain_cover";
  if (combined.includes("backpack") || combined.includes("shoulder conversion")) return "convertible_in_backpack";
  if (combined.includes("magnetic") || combined.includes("mounting system")) return "magnetic_non_magnetic";
  if (combined.includes("upswept")) return "luggage_suitable_for_upswept_e";
  if (combined.includes("pinlock") || combined.includes("anti fog")) return "pinlock_ready";
  if (combined.includes("sun visor") || combined.includes("dual visor")) return "sun_visor";
  if (combined.includes("bluetooth") || combined.includes("intercom ready") || combined.includes("speaker pocket")) return "bluetooth_ready";
  if (combined.includes("intercom range") || combined.includes("mesh range")) return "intercom_range";
  if (combined.includes("battery") || combined.includes("talk time")) return "battery_runtime";
  if (combined.includes("certif") || combined.includes("homolog") || combined.includes("safety standard") || combined.includes("armor protection") || combined.includes("armour")) {
    return "certification";
  }
  if (combined.includes("knuckle")) return "knuckle_protection";
  if (combined.includes("ankle") || combined.includes("shin")) return "ankle_protection";
  if (combined.includes("touchscreen") || combined.includes("touch screen")) return "touchscreen_friendly";
  if (combined.includes("glove style") || combined.includes("glove type") || combined.includes("cuff")) return "glove_type";
  if (combined.includes("boot class") || combined.includes("boot type") || combined.includes("boot style")) return "boot_type";
  if (combined.includes("thermal") || combined.includes("warm liner") || combined.includes("winter liner")) return "thermal_liner";
  if (combined.includes("ventilation") || combined.includes("airflow") || combined.includes("air flow")) return "ventilation";
  if (combined.includes("closure") || combined.includes("fasten") || combined.includes("chin strap") || combined.includes("retention")) {
    return "closure_type";
  }
  if (combined.includes("material") || combined.includes("shell") || combined.includes("fabric") || combined.includes("construction")) {
    return "material";
  }
  if (combined.includes("motorcycle") || combined.includes("compatible bike")) return "motorcycle_model";
  if (combined.includes("fitment") || combined.includes("compatibility")) return "bike_compatibility";
  if (combined.includes("placement") || combined.includes("mounting location") || combined.includes("mounting position")) {
    return "placement";
  }
  if (combined.includes("formulation") || combined.includes("chemical")) return "formulation";
  if (combined.includes("application") || combined.includes("dispenser")) return "application_type";
  if (combined.includes("gender") || combined.includes("rider fit")) return "gender";
  if (combined.includes("brand") || combined.includes("manufacturer")) return "brand";
  if (combined.includes("weight") && !combined.includes("lightweight")) return "weight";
  if (combined.includes("dimension")) return "dimensions";

  return null;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&times;/gi, "×")
    .replace(/&ndash;|&mdash;/gi, "-");
}

function stripNoiseToPlainText(raw?: string): string {
  if (!raw || typeof raw !== "string") return "";

  let cleaned = raw
    .replace(/\{\{media\b[^}]{0,500}\}\}/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<table[\s\S]*?<\/table>/gi, " ");

  // Remove injected wash-care boilerplate blocks so care notes do not pollute gear armor/detergent specs
  const washIdx = cleaned.search(/step\s*1\s*[-–:]?\s*prep/i);
  if (washIdx !== -1 && /detergent/i.test(cleaned.slice(washIdx))) {
    cleaned = cleaned.slice(0, washIdx);
  }

  cleaned = cleaned
    .replace(/<\/(?:p|div|li|tr|h[1-6]|section|article|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]{0,1000}>/g, " ");

  cleaned = decodeHtmlEntities(cleaned)
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[ \t\r]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

  return cleaned;
}

function hasNegationNear(text: string, matchIdx: number, matchLen = 0): boolean {
  const beforeSlice = text.slice(Math.max(0, matchIdx - 42), matchIdx);
  const clauseSepIdx = Math.max(
    beforeSlice.lastIndexOf("."),
    beforeSlice.lastIndexOf("\n"),
    beforeSlice.lastIndexOf(";"),
    beforeSlice.lastIndexOf(":"),
    beforeSlice.lastIndexOf("!")
  );
  const clauseBefore = (clauseSepIdx >= 0 ? beforeSlice.slice(clauseSepIdx + 1) : beforeSlice).toLowerCase();

  if (/\b(?:no|not|without|non|never|avoid|lacks?|free from|doesn't|does not|won't|will not)\b/.test(clauseBefore)) {
    return true;
  }

  if (matchLen > 0) {
    const afterSlice = text.slice(matchIdx + matchLen, matchIdx + matchLen + 26).toLowerCase();
    const afterBoundary = afterSlice.search(/[.\n;!]/);
    const clauseAfter = afterBoundary >= 0 ? afterSlice.slice(0, afterBoundary) : afterSlice;
    if (/^\s*(?:will not|won't|does not|doesn't|not\s+(?:included|available|compatible|supported|work))/.test(clauseAfter)) {
      return true;
    }
  }

  return false;
}

function formatWeightCleanly(weight: number, unit?: string): string {
  const cleanNum = Number.isInteger(weight) ? String(weight) : String(Number(weight.toFixed(2)));
  return `${cleanNum} ${unit || "kg"}`.trim();
}

function formatGenderValue(raw: string): string {
  const parts = raw
    .replace(/"\|"/g, "|")
    .replace(/"/g, "")
    .split(/[|,]/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return "";
  const normalized = parts.map((p) => {
    const low = p.toLowerCase();
    if (low === "male") return "Men";
    if (low === "female") return "Women";
    if (low === "unisex") return "Unisex";
    return p;
  });
  return Array.from(new Set(normalized)).join(", ");
}

function cleanMagentoAttributeString(val: string): string {
  if (!val.includes("|")) return val.trim();
  const parts = val
    .replace(/"\|"/g, "|")
    .replace(/"/g, "")
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  return Array.from(new Set(parts)).join(", ");
}

function resolveStructuredField(concept: SpecConcept, ctx?: ProductSpecExtractionContext | null): string {
  if (!ctx) return "";

  switch (concept) {
    case "country_of_origin": {
      const country = (ctx.countryOfManufacture || "").trim();
      return country && !isJunkSpecValue(country) ? country : "";
    }
    case "brand": {
      const brand = (ctx.brand || "").trim();
      return brand && !isJunkSpecValue(brand) ? brand : "";
    }
    case "gender": {
      return ctx.gender ? formatGenderValue(ctx.gender) : "";
    }
    case "weight": {
      if (typeof ctx.weight === "number" && Number.isFinite(ctx.weight) && ctx.weight > 0) {
        return formatWeightCleanly(ctx.weight, ctx.weightUnit);
      }
      return "";
    }
    case "dimensions": {
      if (
        typeof ctx.length === "number" &&
        ctx.length > 0 &&
        typeof ctx.breadth === "number" &&
        ctx.breadth > 0 &&
        typeof ctx.height === "number" &&
        ctx.height > 0
      ) {
        return `${ctx.length} × ${ctx.breadth} × ${ctx.height} ${ctx.dimensionUnit || "cm"}`;
      }
      return "";
    }
    case "color":
    case "size": {
      if (!Array.isArray(ctx.variants) || ctx.variants.length === 0) return "";
      const collected = new Set<string>();
      for (const v of ctx.variants) {
        if (!v?.attributes) continue;
        const attrs = v.attributes instanceof Map ? Object.fromEntries(v.attributes) : v.attributes;
        for (const [k, rawV] of Object.entries(attrs)) {
          const lk = k.toLowerCase();
          const val = String(rawV || "").trim();
          if (!val || isJunkSpecValue(val)) continue;
          if (concept === "color" && (lk === "color" || lk === "colour")) collected.add(val);
          if (concept === "size" && lk.includes("size")) collected.add(val);
        }
      }
      return collected.size > 0 ? Array.from(collected).slice(0, 12).join(", ") : "";
    }
    default:
      return "";
  }
}

interface PreparedTexts {
  primaryText: string;
  bodyText: string;
  allText: string;
}

function prepareTexts(ctx?: ProductSpecExtractionContext | null): PreparedTexts {
  const name = stripNoiseToPlainText(ctx?.name);
  const shortDesc = stripNoiseToPlainText(ctx?.shortDescription);
  const desc = stripNoiseToPlainText(ctx?.description);
  const primaryText = [name, shortDesc].filter(Boolean).join("\n");
  const allText = [primaryText, desc].filter(Boolean).join("\n");
  return { primaryText, bodyText: desc, allText };
}

function extractCapacityFromTexts(texts: PreparedTexts): string {
  const searchOrder = [texts.primaryText, texts.bodyText].filter(Boolean);
  for (const chunk of searchOrder) {
    const rangeMatch = chunk.match(
      /\b(\d+(?:\.\d+)?)\s*(?:l|ltrs?\.?|litres?|liters?)?\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*(?:l|ltrs?\.?|litres?|liters?)\b/i
    );
    if (rangeMatch) {
      return `${rangeMatch[1]} - ${rangeMatch[2]} Litres`;
    }

    // Check explicit litres words or capital "L" adjacent to luggage terms
    const re = /\b(\d+(?:\.\d+)?)\s*(?:(ltrs?\.?|litres?|liters?)|L(?=\s*(?:\b|capacity|bag|pack|volume|expandable|dry|tail|saddle|tank|$)))/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk)) !== null) {
      const after = chunk.slice(m.index + m[0].length, m.index + m[0].length + 28).toLowerCase();
      if (/^\s*(?:water\s+bottle|bottle|flask)/.test(after)) continue;
      // Avoid accidental uppercase/lowercase match on unitless "1 L" inside apparel sizing unless unit word matched
      if (!m[2]) {
        const before = chunk.slice(Math.max(0, m.index - 20), m.index).toLowerCase();
        if (/(?:size|chest|waist)\s*$/.test(before)) continue;
      }
      const num = parseFloat(m[1]);
      if (!Number.isFinite(num) || num <= 0 || num > 250) continue;
      return num === 1 ? "1 Litre" : `${m[1]} Litres`;
    }
  }
  return "";
}

function extractVolumeInMlFromTexts(texts: PreparedTexts): string {
  for (const chunk of [texts.primaryText, texts.bodyText].filter(Boolean)) {
    const mlMatch = chunk.match(/\b(\d+(?:\.\d+)?)\s*(ml|millilitres?|milliliters?)\b/i);
    if (mlMatch) return `${mlMatch[1]} ml`;
    const ltrMatch = chunk.match(/\b(\d+(?:\.\d+)?)\s*(ltrs?\.?|litres?|liters?)\b/i);
    if (ltrMatch) {
      const after = chunk.slice((ltrMatch.index || 0) + ltrMatch[0].length, (ltrMatch.index || 0) + ltrMatch[0].length + 24).toLowerCase();
      if (!/^\s*water\s+bottle/.test(after)) {
        return parseFloat(ltrMatch[1]) === 1 ? "1 Litre" : `${ltrMatch[1]} Litres`;
      }
    }
  }
  return "";
}

function extractCertificationFromTexts(allText: string): string {
  const helmetCerts: string[] = [];
  if (/\bece\s*22\.?06\b/i.test(allText)) helmetCerts.push("ECE 22.06");
  else if (/\bece\s*22\.?05(?:\s*\(p\/j\))?/i.test(allText)) {
    helmetCerts.push(/\bece\s*22\.?05\s*\(p\/j\)/i.test(allText) ? "ECE 22.05 (P/J)" : "ECE 22.05");
  } else if (/\bece\s*r\s*22\b/i.test(allText)) {
    helmetCerts.push("ECE R22");
  }

  if (/\bDOT\b/.test(allText) || /\bdot\s*(?:certified|approved|fmvss)\b/i.test(allText)) {
    helmetCerts.push("DOT");
  }
  if (/\bISI\b/.test(allText) || /\b(?:is\s*4151|isi\s*(?:certified|approved))\b/i.test(allText)) {
    helmetCerts.push("ISI");
  }
  const snellMatch = allText.match(/\bSNELL(?:\s*M\d{4})?\b/i);
  if (snellMatch) helmetCerts.push(snellMatch[0].toUpperCase());
  if (/\bFIM\b(?=\s*(?:homologat|certifi|approv|spec|racing))/i.test(allText)) {
    helmetCerts.push("FIM");
  }
  if (helmetCerts.length > 0) {
    return Array.from(new Set(helmetCerts)).join(" & ");
  }

  const armorCerts: string[] = [];
  if (/\bce\s*(?:approved\s*|certified\s*)?level\s*[-]?\s*2\b|\blevel\s*[-]?\s*2\s*(?:ce\s*)?(?:armor|armour|protector)/i.test(allText)) {
    armorCerts.push("CE Level 2");
  } else if (/\bce\s*(?:approved\s*|certified\s*)?level\s*[-]?\s*1\b|\blevel\s*[-]?\s*1\s*(?:ce\s*)?(?:armor|armour|protector)/i.test(allText)) {
    armorCerts.push("CE Level 1");
  } else if (/\bce\s+(?:approved|certified)\b/i.test(allText)) {
    armorCerts.push("CE Certified");
  }

  if (/\bsas[- ]?tec\b/i.test(allText)) armorCerts.push("SAS-TEC");
  if (/\bknox\s*micro[- ]?lock\b/i.test(allText)) armorCerts.push("Knox Micro-Lock");
  else if (/\bknox\s*sps\b/i.test(allText)) armorCerts.push("Knox SPS");
  else if (/\bknox\b/i.test(allText)) armorCerts.push("Knox Armor");
  if (/\bd3o\b/i.test(allText)) armorCerts.push("D3O");

  return Array.from(new Set(armorCerts)).join(" • ");
}

function extractWaterproofFromTexts(allText: string): string {
  const ipMatch = allText.match(/\b(ip(?:x|[0-6])[5-8])\b/i);
  if (ipMatch) {
    return `${ipMatch[1].toUpperCase()} Waterproof`;
  }

  if (/\bReissa\b/i.test(allText)) return "100% Waterproof (Reissa Membrane)";
  if (/\bGore[- ]?Tex\b/i.test(allText)) return "100% Waterproof (Gore-Tex Membrane)";
  if (/\bDryTek\b/i.test(allText)) return "100% Waterproof (DryTek Membrane)";
  if (/\bHumax\b/i.test(allText)) return "100% Waterproof (Humax Membrane)";
  if (/\bHipora\b/i.test(allText)) return "100% Waterproof (Hipora Membrane)";
  if (/\bDrystar\b/i.test(allText)) return "100% Waterproof (Drystar Membrane)";

  if (/\b100%\s*water\s*proof\b/i.test(allText)) {
    if (/heat[- ]?welded/i.test(allText)) return "100% Waterproof (Heat-Welded Seams)";
    if (/seam[- ]?sealed/i.test(allText)) return "100% Waterproof (Seam-Sealed)";
    return "100% Waterproof";
  }

  const rainLinerMatch = allText.match(/\b(?:external\s+|detachable\s+|standalone\s+)?(?:waterproof\s+)?rain\s*liner\b/i);
  if (rainLinerMatch && !hasNegationNear(allText, rainLinerMatch.index || 0, rainLinerMatch[0].length)) {
    return "Rain Liner Included";
  }

  const nonWpMatch = allText.match(/\bnon[- ]?waterproof\b/i);
  if (nonWpMatch) return "Non-Waterproof";

  const wpRe = /\bwater\s*proof\b/gi;
  let wm: RegExpExecArray | null;
  while ((wm = wpRe.exec(allText)) !== null) {
    if (!hasNegationNear(allText, wm.index, wm[0].length)) {
      if (/heat[- ]?welded/i.test(allText)) return "100% Waterproof (Heat-Welded Seams)";
      if (/seam[- ]?sealed/i.test(allText)) return "100% Waterproof (Seam-Sealed)";
      return "Waterproof";
    }
    return "Not Waterproof";
  }

  const wrMatch = allText.match(/\bwater[- ]?(?:resistant|repellent)\b/i);
  if (wrMatch && !hasNegationNear(allText, wrMatch.index || 0, wrMatch[0].length)) {
    return "Water-Resistant";
  }

  return "";
}

function extractMaterialFromTexts(allText: string): string {
  const candidates: Array<{ pattern: RegExp; label: string; group?: string }> = [
    // Composites / Helmets
    { pattern: /\b(?:100%\s*)?carbon\s*fib(?:er|re)\b/i, label: "Carbon Fiber", group: "carbon" },
    { pattern: /\btri[- ]?composite(?:\s*fiber\s*glass|\s*fibreglass|\s*fiberglass)?\b/i, label: "Tri-Composite Fiberglass", group: "fiberglass" },
    { pattern: /\bkevlar\b/i, label: "Kevlar Composite" },
    { pattern: /\bfib(?:er|re)\s*glass\b|\bfiberglass\b/i, label: "Fiberglass Composite", group: "fiberglass" },
    { pattern: /\blexan\b(?:\s*polycarbonate)?/i, label: "Lexan Polycarbonate", group: "poly" },
    { pattern: /\bhirp\b/i, label: "HIRP Polycarbonate", group: "poly" },
    { pattern: /\bpolycarbonate\b/i, label: "Polycarbonate", group: "poly" },
    { pattern: /\beirt\b|\bthermoplastic\b/i, label: "High-Impact Thermoplastic" },
    { pattern: /\bhigh[- ]?impact\s*abs\b|\babs\s+shell\b|\babs\b/i, label: "High-Impact ABS" },
    // Technical Fabrics / Luggage
    { pattern: /\b1680d\s*(?:ballistic\s*)?nylon\b/i, label: "1680D Ballistic Nylon", group: "1680d" },
    { pattern: /\b1680d\s*fabric\b/i, label: "1680D Heavy-Duty Fabric", group: "1680d" },
    { pattern: /\bballistic\s*nylon\b/i, label: "Ballistic Nylon", group: "1680d" },
    { pattern: /\b1000d\s*cordura\b/i, label: "1000D Cordura", group: "cordura" },
    { pattern: /\b600d\s*cordura\b/i, label: "600D Cordura", group: "cordura" },
    { pattern: /\b500d\s*cordura\b/i, label: "500D Cordura", group: "cordura" },
    { pattern: /\bcordura\b/i, label: "Cordura Textile", group: "cordura" },
    { pattern: /\b600d\s*polyester\b/i, label: "600D Polyester", group: "polyester" },
    { pattern: /\b500d\s*(?:high[- ]?tenacity\s*)?nylon\b/i, label: "500D Nylon", group: "nylon" },
    { pattern: /\bvinyl[- ]?coated(?:\s+waterproof)?\s+fabric\b/i, label: "Vinyl-Coated Waterproof Fabric", group: "vinyl" },
    { pattern: /\bpvc\s*tarpaulin\b/i, label: "PVC Tarpaulin", group: "tarpaulin" },
    { pattern: /\btarpaulin\b/i, label: "Tarpaulin", group: "tarpaulin" },
    { pattern: /\bripstop(?:\s+nylon)?\b/i, label: "Ripstop Nylon" },
    { pattern: /\bsuperfabric\b/i, label: "SuperFabric" },
    { pattern: /\b3d\s*air\s*mesh\b/i, label: "3D Air Mesh", group: "mesh" },
    { pattern: /\bnylon\s*mesh\b/i, label: "Nylon Mesh", group: "mesh" },
    { pattern: /\bperforated\s*mesh\b|\bair\s*mesh\b/i, label: "Breathable Air Mesh", group: "mesh" },
    { pattern: /\bclarino\b/i, label: "Clarino Microfiber", group: "microfiber" },
    { pattern: /\bmicrofiber\b|\bmicrofibre\b/i, label: "Microfiber", group: "microfiber" },
    // Leathers
    { pattern: /\bkangaroo\s*leather\b/i, label: "Kangaroo Leather", group: "leather" },
    { pattern: /\bgoatskin(?:\s*leather)?\b/i, label: "Goatskin Leather", group: "leather" },
    { pattern: /\bfull[- ]?grain\s*(?:cowhide\s*)?leather\b/i, label: "Full-Grain Leather", group: "leather" },
    { pattern: /\bperforated\s*leather\b/i, label: "Perforated Leather", group: "leather" },
    { pattern: /\bcowhide\s*leather\b/i, label: "Cowhide Leather", group: "leather" },
    { pattern: /\bsuede\s*leather\b/i, label: "Suede Leather", group: "leather" },
    // Hardware / Metals
    { pattern: /\bt304\s*stainless\s*steel\b/i, label: "T304 Stainless Steel", group: "steel" },
    { pattern: /\bstainless\s*steel\b/i, label: "Stainless Steel", group: "steel" },
    { pattern: /\b6061[- ]?t6(?:\s*billet)?\s*alumin(?:um|ium)\b/i, label: "6061-T6 Billet Aluminum", group: "alu" },
    { pattern: /\bcnc(?:\s*machined)?\s*alumin(?:um|ium)\b/i, label: "CNC Machined Aluminum", group: "alu" },
    { pattern: /\balumin(?:um|ium)\s*alloy\b|\balumin(?:um|ium)\b/i, label: "Aluminum Alloy", group: "alu" },
    { pattern: /\bpowder[- ]?coated(?:\s*mild)?\s*steel\b|\bmild\s*steel\b/i, label: "Powder-Coated Steel", group: "steel" },
  ];

  const found: string[] = [];
  const usedGroups = new Set<string>();

  for (const item of candidates) {
    const match = allText.match(item.pattern);
    if (!match) continue;
    if (hasNegationNear(allText, match.index || 0, match[0].length)) continue;
    if (item.group && usedGroups.has(item.group)) continue;
    if (item.group) usedGroups.add(item.group);
    found.push(item.label);
    if (found.length >= 2) break;
  }

  return found.join(" / ");
}

function extractClosureFromTexts(allText: string): string {
  if (/\bdouble\s*d[- ]?ring\b/i.test(allText)) return "Double D-Ring";
  if (/\bmicrometric\b/i.test(allText)) return "Micrometric Quick-Release Buckle";
  if (/\bboa\b(?=\s*(?:dial|lacing|fit|closure|system))/i.test(allText)) return "BOA Quick Dial System";
  if (/\bratchet\s*buckle/i.test(allText)) return "Micro-Metric Ratchet Buckles";
  if (/\broll[- ]?top(?:\s*(?:clos|seal|fold|system))?/i.test(allText)) return "Roll-Top Closure";
  if (/\bquick[- ]?release\s*(?:buckle|clasp|strap)/i.test(allText)) return "Quick-Release Buckle";
  if (/\bykk\b(?:\s*(?:heavy[- ]?duty|waterproof))?\s*zip/i.test(allText)) return "YKK Zippers";
  return "";
}

function extractConceptFromTexts(concept: SpecConcept, texts: PreparedTexts): string {
  const { allText } = texts;
  if (!allText) return "";

  switch (concept) {
    case "capacity":
      return extractCapacityFromTexts(texts);
    case "weight_in_ml":
      return extractVolumeInMlFromTexts(texts);
    case "certification":
      return extractCertificationFromTexts(allText);
    case "waterproof":
      return extractWaterproofFromTexts(allText);
    case "material":
      return extractMaterialFromTexts(allText);
    case "closure_type":
      return extractClosureFromTexts(allText);

    case "pinlock_ready": {
      const m = allText.match(/\bpin[- ]?lock(?:\s*(120|70|30))?(?:\s*(?:max\s*vision))?\b/i);
      if (m) {
        if (hasNegationNear(allText, m.index || 0, m[0].length)) return "Not Pinlock Ready";
        const after = allText.slice((m.index || 0) + m[0].length, (m.index || 0) + m[0].length + 28).toLowerCase();
        if (/\b(?:included|in\s*(?:the\s*)?box)\b/.test(after)) {
          return m[1] ? `Pinlock ${m[1]} Lens Included` : "Pinlock Lens Included";
        }
        return m[1] ? `Pinlock ${m[1]} Ready` : "Pinlock Anti-Fog Ready";
      }
      const af = allText.match(/\banti[- ]?fog\s*(?:visor|ready|insert|shield|treatment)\b/i);
      if (af && !hasNegationNear(allText, af.index || 0, af[0].length)) return "Anti-Fog Visor Ready";
      return "";
    }

    case "sun_visor": {
      if (/\bno\s+(?:internal\s+)?sun\s*visor\b|\bwithout\s+(?:internal\s+)?sun\s*visor\b/i.test(allText)) {
        return "No Sun Visor";
      }
      const m = allText.match(/\b(?:internal|drop[- ]?down|integrated|retractable)\s*(?:uv\s*400\s*)?sun\s*visor\b|\bdual\s*visor\b|\btwin\s*shield\b/i);
      if (m && !hasNegationNear(allText, m.index || 0, m[0].length)) {
        return "Internal Retractable Sun Visor";
      }
      return "";
    }

    case "bluetooth_ready": {
      const btVer = allText.match(/\bbluetooth\s*(?:v\s*)?(5\.[0-4]|4\.[0-2])\b/i);
      if (btVer) return `Bluetooth ${btVer[1]}`;
      const m = allText.match(/\b(?:speaker\s*pockets|intercom[- ]?ready|bluetooth[- ]?ready|bluetooth\s*prepared)\b/i);
      if (m && !hasNegationNear(allText, m.index || 0, m[0].length)) {
        return "Bluetooth / Intercom Ready";
      }
      return "";
    }

    case "intercom_range": {
      const m = allText.match(/\b(?:up\s*to\s*)?(\d+(?:\.\d+)?)\s*(km|m|meters?|metres?)\b(?=.{0,32}(?:range|intercom|mesh|riders))/i);
      if (m) return `Up to ${m[1]} ${m[2].toLowerCase()}`;
      return "";
    }

    case "battery_runtime": {
      const m = allText.match(/\b(?:up\s*to\s*)?(\d+)\s*(hours?|hrs?)\s*(?:talk\s*time|battery(?:\s*life)?)\b/i);
      if (m) return `Up to ${m[1]} Hours Talk Time`;
      return "";
    }

    case "rain_cover": {
      const rc = allText.match(/\brain\s*cover\b/i);
      if (rc) {
        if (hasNegationNear(allText, rc.index || 0, rc[0].length)) return "Not Included";
        if (/hi[- ]?vi[sz]|seam[- ]?sealed|100%\s*waterproof/i.test(allText)) {
          return "Included (Waterproof / Seam-Sealed)";
        }
        return "Included";
      }
      return "";
    }

    case "touchscreen_friendly": {
      const m = allText.match(/\btouch\s*screen(?:\s*(?:friendly|compatible|enabling|layer))?\b/i);
      if (m) {
        if (hasNegationNear(allText, m.index || 0, m[0].length)) return "No";
        return "Yes (Touchscreen Compatible)";
      }
      return "";
    }

    case "glove_type": {
      if (/\bfull\s*gauntlet\b/i.test(allText)) return "Full Gauntlet";
      if (/\bshort\s*cuff\b/i.test(allText)) return "Short Cuff";
      if (/\b(?:mx|motocross|off[- ]?road)\s*(?:gloves?)?\b/i.test(texts.primaryText)) return "Off-Road / MX";
      return "";
    }

    case "knuckle_protection": {
      if (/\bcarbon\s*fib(?:er|re)\s*knuckle/i.test(allText)) return "Carbon Fiber Knuckle Protectors";
      if (/\btpu\s*(?:hard\s*)?knuckle|\bhard\s*knuckle\b/i.test(allText)) return "TPU Hard Molded Knuckles";
      if (/\bknox\s*sps\b/i.test(allText)) return "Knox SPS Scaphoid Sliders & Knuckle Armor";
      if (/\btpr\s*knuckle|\bviscoelastic\b/i.test(allText)) return "TPR / Viscoelastic Knuckle Protection";
      return "";
    }

    case "boot_type": {
      if (/\badventure\s*touring\b/i.test(allText)) return "Adventure Touring";
      if (/\b(?:off[- ]?road|motocross|enduro)\b/i.test(texts.primaryText)) return "Off-Road / Enduro";
      if (/\b(?:track|racing)\s*boots?\b/i.test(allText)) return "Sport / Track Racing";
      if (/\b(?:urban|short|city)\s*(?:riding\s*)?boots?\b/i.test(allText)) return "Urban / Short Cuff";
      return "";
    }

    case "ankle_protection": {
      if (/\btpu\b.{0,24}\b(?:ankle|shin)\b|\b(?:ankle|shin)\b.{0,24}\btpu\b/i.test(allText)) {
        return "TPU Ankle & Shin Protection";
      }
      if (/\bankle\s*(?:cup|brace|disc|protector|support)\b/i.test(allText)) {
        return "Reinforced Ankle Support & Guards";
      }
      return "";
    }

    case "thermal_liner": {
      const m = allText.match(/\b(?:detachable|removable|standalone)?\s*(?:thermal|warm|winter)\s*(?:liner|vest|insulation)\b/i);
      if (m && !hasNegationNear(allText, m.index || 0, m[0].length)) {
        return "Detachable Thermal Liner Included";
      }
      return "";
    }

    case "ventilation": {
      if (/\b3d\s*air\s*mesh\b|\bhigh[- ]?flow\s*mesh\b/i.test(allText)) return "High-Flow 3D Air Mesh Panels";
      if (/\bzippered\s*(?:air\s*)?vents\b|\bair\s*vents\b/i.test(allText)) return "Multi-Point Zippered Air Vents";
      if (/\bperforated\b/i.test(allText) && /\bventilation\b/i.test(allText)) return "Perforated Airflow Panels";
      return "";
    }

    case "formulation": {
      if (/\bwhite\s*solid\s*lubricant|\bsynthetic\b.{0,30}\b(?:chain\s*lube|lubricant)\b/i.test(allText)) {
        return "Synthetic Anti-Fling Chain Formula";
      }
      if (/\bchain\s*cleaner\b/i.test(texts.primaryText)) return "Heavy-Duty Degreasing Chain Cleaner";
      return "";
    }

    case "application_type": {
      if (/\baerosol\s*spray\b/i.test(allText)) return "Aerosol Spray";
      if (/\btrigger\s*spray\b/i.test(allText)) return "Trigger Spray Bottle";
      return "";
    }

    case "magnetic_non_magnetic": {
      const m = allText.match(/\bmolle\s*loops?\b|\buniversal\s*straps?\b|\btail\s*straps?\b/i);
      if (m) return "Strap-On / MOLLE Loop Mounting";
      if (/\bneodymium\s*magnet/i.test(allText)) return "Magnetic (Neodymium Tank Magnets)";
      return "";
    }

    case "convertible_in_backpack": {
      const m = allText.match(/\bconverts?\s*(?:to|into)\s*(?:a\s*)?backpack\b|\bbackpack\s*straps\b/i);
      if (m && !hasNegationNear(allText, m.index || 0, m[0].length)) return "Yes - Converts to Backpack";
      return "";
    }

    case "bike_compatibility": {
      if (/\buniversal\s*fit(?:ment)?\b|\buniversal\b/i.test(texts.primaryText)) return "Universal Fit";
      if (/\bdirect\s*bolt[- ]?on\b/i.test(allText)) return "Direct Bolt-On";
      return "";
    }

    case "motorcycle_model": {
      if (/\buniversal\b/i.test(texts.primaryText) && !/\bfor\s+(?:royal enfield|ktm|bmw|himalayan|triumph|honda|yamaha|bajaj)\b/i.test(texts.primaryText)) {
        return "Universal Motorcycle Fit";
      }
      return "";
    }

    case "placement": {
      if (/\bradiator\s*guard\b/i.test(texts.primaryText)) return "Radiator";
      if (/\b(?:exhaust|slip[- ]?on|db\s*killer)\b/i.test(texts.primaryText)) return "Exhaust / Silencer";
      if (/\bcrash\s*guard\b|\bframe\s*slider\b/i.test(texts.primaryText)) return "Engine / Frame";
      if (/\bhandlebar\s*riser|\bhandlebar\b/i.test(texts.primaryText)) return "Handlebar";
      return "";
    }

    case "warranty": {
      if (/\bno\s+warranty\b/i.test(allText)) return "No Warranty";
      const m = allText.match(/\b(\d+)\s*(year|years|month|months)\s*(?:manufacturer\s*|official\s*|brand\s*)?warranty\b|\blifetime\s*warranty\b/i);
      if (m && !hasNegationNear(allText, m.index || 0, m[0].length)) {
        if (/lifetime/i.test(m[0])) return "Lifetime Warranty";
        const unitLabel = m[2].toLowerCase().startsWith("year")
          ? Number(m[1]) === 1
            ? "Year"
            : "Years"
          : Number(m[1]) === 1
            ? "Month"
            : "Months";
        return `${m[1]} ${unitLabel} Manufacturer Warranty`;
      }
      return "";
    }

    default:
      return "";
  }
}

function buildAttributeLookup(
  attributes?: Record<string, string> | Map<string, string> | null
): { exact: Map<string, string>; normalized: Map<string, string> } {
  const exact = new Map<string, string>();
  const normalized = new Map<string, string>();
  if (!attributes) return { exact, normalized };

  const entries: Array<[string, unknown]> =
    attributes instanceof Map ? Array.from(attributes.entries()) : Object.entries(attributes);

  for (const [rawKey, rawVal] of entries) {
    const keyTrimmed = String(rawKey || "").trim();
    if (!keyTrimmed || /["'|,<>{}()[\]]/.test(keyTrimmed)) continue;

    const cleanRaw = typeof rawVal === "string" ? rawVal.trim() : String(rawVal ?? "").trim();
    const cleanVal = cleanMagentoAttributeString(cleanRaw);
    if (isJunkSpecValue(cleanVal)) continue;

    const lowerKey = keyTrimmed.toLowerCase();
    const normKey = normalizeLookupKey(keyTrimmed);
    if (!exact.has(lowerKey)) exact.set(lowerKey, cleanVal);
    if (normKey && !normalized.has(normKey)) normalized.set(normKey, cleanVal);
  }

  return { exact, normalized };
}

/**
 * Generates ordered PDP technical specifications strictly from a Category Specifications & Attributes Template.
 * Never auto-generates unconfigured attribute keys and never scrapes arbitrary bullet lists.
 *
 * When `productContext` is supplied, blank template fields also check structured product fields
 * and run conservative factual extraction on `name` / `shortDescription` / `description`.
 */
export function buildSpecificationsFromTemplate(
  templateFields: SpecFieldDefinition[] | undefined | null,
  attributes?: Record<string, string> | Map<string, string> | null,
  productContext?: ProductSpecExtractionContext | null
): ProductSpecificationItem[] {
  if (!Array.isArray(templateFields) || templateFields.length === 0) {
    return [];
  }

  const { exact: exactAttrLookup, normalized: normalizedAttrLookup } = buildAttributeLookup(attributes);
  const templateKeys = new Set(
    templateFields.map((f) => normalizeLookupKey(f.key || "")).filter(Boolean)
  );
  const preparedTexts = productContext ? prepareTexts(productContext) : null;

  const seenLabels = new Set<string>();
  const seenKeys = new Set<string>();
  const result: ProductSpecificationItem[] = [];

  for (const field of templateFields) {
    const rawKey = (field.key || "").trim();
    const label = (field.label || "").trim();
    if (!rawKey || !label) continue;

    const lowerKey = rawKey.toLowerCase();
    const normKey = normalizeLookupKey(rawKey);
    if (!normKey || seenKeys.has(normKey) || seenLabels.has(label.toLowerCase())) continue;

    const concept = inferSpecConcept(rawKey, label);

    // Tier 1: Explicit product.attributes lookup (exact key -> synonyms for field key/concept)
    let resolvedValue = exactAttrLookup.get(lowerKey) ?? normalizedAttrLookup.get(normKey) ?? "";

    if (!resolvedValue && concept) {
      const synonyms = ATTRIBUTES_BY_CONCEPT[concept] || [];
      for (const syn of synonyms) {
        if (templateKeys.has(syn)) continue;
        const candidate = exactAttrLookup.get(syn) ?? normalizedAttrLookup.get(syn);
        if (candidate) {
          resolvedValue = concept === "gender" ? formatGenderValue(candidate) : candidate;
          break;
        }
      }
    }

    // Tier 2: Explicit structured Product schema fields
    if (!resolvedValue && productContext && concept) {
      resolvedValue = resolveStructuredField(concept, productContext);
    }

    // Tier 3: Conservative factual extraction from product name & descriptions
    if (!resolvedValue && preparedTexts && concept) {
      resolvedValue = extractConceptFromTexts(concept, preparedTexts);
    }

    if (!resolvedValue || isJunkSpecValue(resolvedValue)) continue;

    seenKeys.add(normKey);
    seenLabels.add(label.toLowerCase());
    result.push({
      key: rawKey,
      label,
      value: resolvedValue.trim(),
      isHighlight: isHighlightSpec(rawKey, resolvedValue),
    });
  }

  return result;
}
