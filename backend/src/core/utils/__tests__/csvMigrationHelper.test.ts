import { describe, it, expect } from "vitest";
import {
  buildCsvMigrationPreview,
  buildDirectVariantUpdateSet,
  buildExistingProductUpdateDoc,
  mapCsvRowToProductData,
  parseColorSwatchesString,
  parseConfigurableVariationsString,
} from "../csvMigrationHelper";

const noopFormatImg = (url: string) => url.trim() || null;

describe("csvMigrationHelper - Partial CSV Safety & L/B/H Parsing", () => {
  it("parses separate length, breadth, height columns and weight units accurately", () => {
    const mapped = mapCsvRowToProductData(
      {
        sku: "AXOR-APEX-M",
        weight: "1550",
        weight_unit: "g",
        length: "36",
        breadth: "28",
        height: "28",
        dimension_unit: "cm",
      },
      noopFormatImg
    );

    expect(mapped.weight).toBe(1.55);
    expect(mapped.weightUnit).toBe("kg");
    expect(mapped.length).toBe(36);
    expect(mapped.breadth).toBe(28);
    expect(mapped.height).toBe(28);
    expect(mapped.dimensionUnit).toBe("cm");
    expect(mapped._present.hasName).toBe(false);
    expect(mapped._present.hasSlug).toBe(false);
    expect(mapped._present.hasQty).toBe(false);
    expect(mapped._present.hasWeight).toBe(true);
    expect(mapped._present.hasDimensions).toBe(true);
  });

  it("supports combined lbh column without leaking into attributes", () => {
    const mapped = mapCsvRowToProductData(
      {
        sku: "RYNOX-AIR-L",
        weight: "1.8kg",
        lbh: "42x34x14",
      },
      noopFormatImg
    );

    expect(mapped.length).toBe(42);
    expect(mapped.breadth).toBe(34);
    expect(mapped.height).toBe(14);
    expect(mapped.attributes).toEqual({});
  });

  it("never overwrites existing name, slug, qty, stockStatus, or attributes on a partial L/B/H CSV upload", () => {
    const mapped = mapCsvRowToProductData(
      {
        sku: "AXOR-APEX-M",
        weight: "1.6",
        length: "36",
        breadth: "28",
        height: "28",
      },
      noopFormatImg
    );

    const existingProduct = {
      sku: "AXOR-APEX-M",
      name: "Axor Apex Venomous Full Face Helmet",
      slug: "axor-apex-venomous-full-face-helmet",
      qty: 14,
      stockStatus: 1,
      status: "published",
      attributes: {
        helmet_type: "Full Face",
        certification: "ECE 22.06",
      },
    };

    const updateDoc = buildExistingProductUpdateDoc(mapped, existingProduct);

    expect(updateDoc).toEqual({
      weight: 1.6,
      weightUnit: "kg",
      length: 36,
      breadth: 28,
      height: 28,
      dimensionUnit: "cm",
    });
    expect(updateDoc.name).toBeUndefined();
    expect(updateDoc.slug).toBeUndefined();
    expect(updateDoc.qty).toBeUndefined();
    expect(updateDoc.stockStatus).toBeUndefined();
    expect(updateDoc.status).toBeUndefined();
    expect(updateDoc.attributes).toBeUndefined();
  });

  it("merges ship_cost with existing attributes instead of wiping specifications, and ignores Magento junk columns", () => {
    const mapped = mapCsvRowToProductData(
      {
        sku: "PADDOCK-STD-1",
        weight: "6.5",
        weight_unit: "kg",
        length: "72",
        breadth: "48",
        height: "15",
        ship_cost: "350",
        codazon_custom_tab: "<p>Old theme html</p>",
        "Product name": "Duplicate Legacy Name",
      },
      noopFormatImg
    );

    const existingProduct = {
      sku: "PADDOCK-STD-1",
      name: "Heavy Duty Paddock Stand",
      slug: "heavy-duty-paddock-stand",
      status: "published",
      attributes: {
        material: "Powder Coated Mild Steel",
        warranty: "1 Year",
      },
    };

    const updateDoc = buildExistingProductUpdateDoc(mapped, existingProduct);

    expect(updateDoc.attributes).toEqual({
      material: "Powder Coated Mild Steel",
      warranty: "1 Year",
      ship_cost: "350",
    });
    expect(updateDoc.attributes).not.toHaveProperty("codazon_custom_tab");
    expect(updateDoc.attributes).not.toHaveProperty("Product name");
  });

  it("never downgrades a published product to draft when status=0 is explicitly present in CSV", () => {
    const mapped = mapCsvRowToProductData(
      {
        sku: "PUB-ITEM",
        status: "0",
        qty: "5",
      },
      noopFormatImg
    );

    const updateDoc = buildExistingProductUpdateDoc(mapped, {
      sku: "PUB-ITEM",
      status: "published",
    });

    expect(updateDoc.status).toBe("published");
    expect(updateDoc.qty).toBe(5);
    expect(updateDoc.stockStatus).toBe(1);
  });

  it("never wipes existing variant color, size, stock, price, status, or images when partial configurable CSV updates only weight/LBH", () => {
    const parentMapped = mapCsvRowToProductData(
      {
        sku: "AXOR-CONF",
        product_type: "configurable",
        weight: "1.5",
        length: "36",
        breadth: "28",
        height: "28",
      },
      noopFormatImg
    );

    const childMapped = mapCsvRowToProductData(
      {
        sku: "AXOR-CONF-BLK-M",
        weight: "1.6",
        length: "37",
        breadth: "29",
        height: "29",
      },
      noopFormatImg
    );

    parentMapped.variants.push({
      sku: childMapped.sku,
      price: childMapped.basePrice,
      specialPrice: childMapped.specialPrice,
      stock: childMapped._present.hasQty ? childMapped.qty : childMapped.stockStatus,
      attributes: childMapped.attributes,
      weight: childMapped.weight,
      weightUnit: childMapped.weightUnit,
      length: childMapped.length,
      breadth: childMapped.breadth,
      height: childMapped.height,
      dimensionUnit: childMapped.dimensionUnit,
      status: childMapped.status === "published" ? "enabled" : "disabled",
      visibility: childMapped.visibility || "Not Visible Individually",
      images: childMapped.images,
      _present: childMapped._present,
    });

    const existingConfigurable = {
      sku: "AXOR-CONF",
      name: "Axor Apex Venomous",
      slug: "axor-apex-venomous",
      status: "published",
      variants: [
        {
          id: "v1",
          sku: "AXOR-CONF-BLK-M",
          price: 4999,
          specialPrice: 4499,
          stock: 12,
          status: "enabled",
          visibility: "Catalog, Search",
          imageUrl: "https://cdn.example.com/axor-blk.webp",
          altText: "Axor Apex Venomous - Black M",
          images: [{ id: "img1", url: "https://cdn.example.com/axor-blk.webp", altText: "Axor Black" }],
          attributes: { color: "Black", size: "M" },
        },
        {
          id: "v2",
          sku: "AXOR-CONF-RED-L",
          price: 4999,
          stock: 5,
          status: "enabled",
          attributes: { color: "Red", size: "L" },
        },
      ],
    };

    const updateDoc = buildExistingProductUpdateDoc(parentMapped, existingConfigurable);

    expect(updateDoc.variants).toHaveLength(2);
    expect(updateDoc.variants[0]).toMatchObject({
      id: "v1",
      sku: "AXOR-CONF-BLK-M",
      price: 4999,
      specialPrice: 4499,
      stock: 12,
      status: "enabled",
      visibility: "Catalog, Search",
      imageUrl: "https://cdn.example.com/axor-blk.webp",
      altText: "Axor Apex Venomous - Black M",
      attributes: { color: "Black", size: "M" },
      weight: 1.6,
      weightUnit: "kg",
      length: 37,
      breadth: 29,
      height: 29,
      dimensionUnit: "cm",
    });
    expect(updateDoc.variants[0]).not.toHaveProperty("_present");
    expect(updateDoc.variants[1]).toMatchObject({
      id: "v2",
      sku: "AXOR-CONF-RED-L",
      stock: 5,
      attributes: { color: "Red", size: "L" },
    });
  });

  it("never wipes any field when uploading ONLY sku + qty", () => {
    const mapped = mapCsvRowToProductData(
      {
        sku: "JACKET-01",
        qty: "25",
      },
      noopFormatImg
    );

    const existingProduct = {
      sku: "JACKET-01",
      name: "Rynox Tornado Pro 4 Jacket",
      slug: "rynox-tornado-pro-4-jacket",
      description: "<p>Full mesh riding jacket</p>",
      basePrice: 8950,
      specialPrice: 8450,
      qty: 5,
      stockStatus: 1,
      weight: 2.1,
      weightUnit: "kg",
      length: 55,
      breadth: 45,
      height: 14,
      dimensionUnit: "cm",
      brand: "Rynox",
      categoryId: "riding-jackets",
      categorySlugs: ["riding-gear", "riding-jackets"],
      images: [{ id: "i1", url: "https://cdn.example.com/jkt.webp", altText: "Tornado Pro 4" }],
      attributes: { material: "600D Cordura", armor: "Knox Microlock CE Level 2" },
      variants: [{ id: "v1", sku: "JACKET-01-L", price: 8950, stock: 5 }],
      status: "published",
    };

    const updateDoc = buildExistingProductUpdateDoc(mapped, existingProduct);

    expect(updateDoc).toEqual({
      qty: 25,
      stockStatus: 1,
    });
  });

  it("safely parses formatted prices and preserves all omitted/blank columns across full-template export", () => {
    const mapped = mapCsvRowToProductData(
      {
        "\ufeffsku": "GLOVE-01",
        name: "",
        description: "   ",
        short_description: "",
        url_key: "",
        price: "₹4,999",
        special_price: "3,999",
        special_from_date: "",
        special_to_date: "",
        weight: "",
        weight_unit: "",
        length: "",
        breadth: "",
        height: "",
        dimension_unit: "",
        is_in_stock: "",
        qty: "",
        status: "",
        visibility: "",
        categories: "",
        brand: "",
        base_image: "",
        additional_images: "",
        related_skus: "   ",
        upsell_skus: "",
        crosssell_skus: "",
        meta_title: "",
        meta_keyword: "",
        meta_description: "",
        ship_cost: "",
      },
      noopFormatImg
    );

    const updateDoc = buildExistingProductUpdateDoc(mapped, {
      sku: "GLOVE-01",
      name: "Full Gauntlet Gloves",
      slug: "full-gauntlet-gloves",
      status: "published",
      images: [{ id: "g1", url: "https://cdn.example.com/glove.webp", altText: "Gloves" }],
      attributes: { material: "Full Grain Leather" },
      relatedSkus: ["GLOVE-02"],
    });

    expect(updateDoc).toEqual({
      basePrice: 4999,
      specialPrice: 3999,
    });
    expect(updateDoc.relatedSkus).toBeUndefined();
    expect(updateDoc.images).toBeUndefined();
    expect(updateDoc.attributes).toBeUndefined();
    expect(updateDoc.status).toBeUndefined();
  });

  it("updates ONLY base_image without touching existing additional attributes or variants, and preserves matching export URLs", () => {
    const newImgMapped = mapCsvRowToProductData(
      {
        sku: "BOOT-01",
        base_image: "https://cdn.example.com/boot-new.webp",
      },
      noopFormatImg
    );

    const existingProduct = {
      sku: "BOOT-01",
      name: "Clan Scout Waterproof Boots",
      status: "published",
      images: [{ id: "old-id-1", url: "https://cdn.example.com/boot-old.webp", altText: "Old Boot" }],
      attributes: { waterproof: "Yes" },
    };

    const newImgUpdate = buildExistingProductUpdateDoc(newImgMapped, existingProduct);
    expect(newImgUpdate).toEqual({
      images: [{ url: "https://cdn.example.com/boot-new.webp", altText: "" }],
    });

    const sameUrlReuploadMapped = mapCsvRowToProductData(
      {
        sku: "BOOT-01",
        base_image: "https://cdn.example.com/boot-old.webp",
        weight: "2.2",
      },
      noopFormatImg
    );
    const sameUrlUpdate = buildExistingProductUpdateDoc(sameUrlReuploadMapped, existingProduct);
    expect(sameUrlUpdate).toEqual({
      weight: 2.2,
      weightUnit: "kg",
    });
  });

  it("updates ONLY categories without wiping title, price, images, or specs", () => {
    const mapped = mapCsvRowToProductData(
      {
        sku: "VISOR-01",
        categories: "Default Category/Helmets/Visors",
      },
      noopFormatImg
    );

    const updateDoc = buildExistingProductUpdateDoc(mapped, {
      sku: "VISOR-01",
      name: "Axor Clear Visor",
      basePrice: 850,
      status: "published",
    });

    expect(updateDoc.magentoCategories).toBe("Default Category/Helmets/Visors");
    expect(updateDoc.categoryId).toBeDefined();
    expect(updateDoc.categorySlugs.length).toBeGreaterThan(0);
    expect(updateDoc.name).toBeUndefined();
    expect(updateDoc.basePrice).toBeUndefined();
    expect(updateDoc.images).toBeUndefined();
  });

  it("rejects garbage price/qty/stock/date inputs without producing NaN or Invalid Date, and parses DD/MM/YYYY", () => {
    const mapped = mapCsvRowToProductData(
      {
        sku: "GARBAGE-TEST",
        price: "#N/A",
        special_price: "TBD",
        qty: "abc",
        is_in_stock: "maybe",
        special_from_date: "invalid-date",
        special_to_date: "27/11/2026",
      },
      noopFormatImg
    );

    const updateDoc = buildExistingProductUpdateDoc(mapped, {
      sku: "GARBAGE-TEST",
      status: "published",
    });

    expect(updateDoc.basePrice).toBeUndefined();
    expect(updateDoc.specialPrice).toBeUndefined();
    expect(updateDoc.qty).toBeUndefined();
    expect(updateDoc.stockStatus).toBeUndefined();
    expect(updateDoc.specialPriceFromDate).toBeUndefined();
    expect(updateDoc.specialPriceToDate).toBeInstanceOf(Date);
    expect(updateDoc.specialPriceToDate.toISOString()).toBe("2026-11-27T00:00:00.000Z");
  });

  it("builds sparse $set object for direct variant updates without touching unrelated fields", () => {
    const variantSet = buildDirectVariantUpdateSet(
      {
        sku: "AXOR-APEX-BLK-L",
        weight: "1600",
        weight_unit: "g",
        length: "37",
        breadth: "29",
        height: "28",
        qty: "",
        price: "",
        status: "",
      },
      noopFormatImg
    );

    expect(variantSet).toEqual({
      "variants.$.weight": 1.6,
      "variants.$.weightUnit": "kg",
      "variants.$.length": 37,
      "variants.$.breadth": 29,
      "variants.$.height": 28,
      "variants.$.dimensionUnit": "cm",
    });
  });

  it("converts omitted existing inch dimensions to cm when partial CSV updates only length in cm", () => {
    const mapped = mapCsvRowToProductData(
      {
        sku: "LUGGAGE-BOX",
        length: "40",
      },
      noopFormatImg
    );

    const updateDoc = buildExistingProductUpdateDoc(mapped, {
      sku: "LUGGAGE-BOX",
      length: 14,
      breadth: 10,
      height: 5,
      dimensionUnit: "in",
    });

    expect(updateDoc).toEqual({
      length: 40,
      breadth: 25.4,
      height: 12.7,
      dimensionUnit: "cm",
    });
  });

  it("matches existing variant SKUs case-insensitively without creating duplicates", () => {
    const parentMapped = mapCsvRowToProductData(
      { sku: "AXOR-CONF", product_type: "configurable" },
      noopFormatImg
    );
    const childMapped = mapCsvRowToProductData(
      { sku: "axor-conf-blk-m", weight: "1.7" },
      noopFormatImg
    );
    parentMapped.variants.push({
      sku: childMapped.sku,
      price: childMapped.basePrice,
      stock: 0,
      attributes: {},
      weight: childMapped.weight,
      weightUnit: childMapped.weightUnit,
      _present: childMapped._present,
    });

    const updateDoc = buildExistingProductUpdateDoc(parentMapped, {
      sku: "AXOR-CONF",
      status: "published",
      variants: [
        { id: "v1", sku: "AXOR-CONF-BLK-M", price: 4999, stock: 8, attributes: { color: "Black", size: "M" } },
      ],
    });

    expect(updateDoc.variants).toHaveLength(1);
    expect(updateDoc.variants[0]).toMatchObject({
      sku: "AXOR-CONF-BLK-M",
      price: 4999,
      stock: 8,
      weight: 1.7,
      weightUnit: "kg",
      attributes: { color: "Black", size: "M" },
    });
  });

  it("prevents dimension aliases and hsn_code from leaking into attributes", () => {
    const mapped = mapCsvRowToProductData(
      {
        sku: "TOPBOX-45L",
        pkg_length: "45",
        box_size: "45x40x32",
        hsn_code: "87141090",
        capacity: "45L",
      },
      noopFormatImg
    );

    expect(mapped.hsnCode).toBe("87141090");
    expect(mapped._present.hasHsnCode).toBe(true);
    expect(mapped.attributes).toEqual({ capacity: "45L" });
    expect(mapped.attributes).not.toHaveProperty("pkg_length");
    expect(mapped.attributes).not.toHaveProperty("box_size");
    expect(mapped.attributes).not.toHaveProperty("hsn_code");
  });

  it("parses pipe-separated configurable_variations into structured variants with attributes and presence flags", () => {
    const variants = parseConfigurableVariationsString(
      "sku=AXOR-BLK-M,color=Black,size=M,price=4999,qty=5|sku=AXOR-RED-L,colour=Matte.Red,size=L,special_price=4499,image=/red.jpg,status=0",
      5000,
      noopFormatImg
    );

    expect(variants).toHaveLength(2);
    expect(variants[0]).toMatchObject({
      sku: "AXOR-BLK-M",
      price: 4999,
      stock: 5,
      status: "enabled",
      attributes: { color: "Black", size: "M" },
      _present: { hasBasePrice: true, hasQty: true },
    });
    expect(variants[1]).toMatchObject({
      sku: "AXOR-RED-L",
      price: 5000,
      specialPrice: 4499,
      stock: 0,
      status: "disabled",
      imageUrl: "/red.jpg",
      attributes: { color: "Matte Red", size: "L" },
      _present: { hasBasePrice: false, hasSpecialPrice: true, hasStatus: true },
    });
  });

  it("parses color_swatches strings and generates slug from name when url_key is omitted", () => {
    const swatches = parseColorSwatchesString("Black=#111111|Black.Red=#AA0000");
    expect(swatches).toEqual({ Black: "#111111", "Black Red": "#AA0000" });

    const newProduct = mapCsvRowToProductData(
      { sku: "NEW-HELMET-1", name: "LS2 FF800 Storm II", price: "9950" },
      noopFormatImg
    );
    expect(newProduct.slug).toBe("ls2-ff800-storm-ii");
    expect(newProduct._present.hasSlug).toBe(false);
  });

  it("buildCsvMigrationPreview classifies creates, updates, variant updates, no-change, and skips accurately", () => {
    const report = buildCsvMigrationPreview({
      headers: ["sku", "old_sku", "name", "price", "qty", "weight", "length", "breadth", "height"],
      allRows: [
        { sku: "EXISTING-1", weight: "2.1", length: "40", breadth: "30", height: "25" },
        { sku: "VAR-M", qty: "9" },
        { sku: "NEW-GLOVE", name: "Viaterra Holeshot Gloves", price: "3499", qty: "12" },
        { sku: "UNCHANGED-1", name: "Same Name" },
        { sku: "BAD-ZERO", name: "Broken Item", price: "0" },
        { sku: "RENAMED-NEW", old_sku: "RENAMED-OLD" },
      ],
      existingRoots: [
        { sku: "EXISTING-1", name: "Existing Helmet", weight: 1.5, qty: 10, status: "published" },
        { sku: "UNCHANGED-1", name: "Same Name", status: "published" },
        { sku: "RENAMED-OLD", name: "Old SKU Product", basePrice: 1200, status: "published" },
      ],
      existingVariantParents: [
        {
          sku: "PAR-1",
          name: "Touring Jacket",
          variants: [{ id: "v1", sku: "VAR-M", price: 5000, stock: 3 }],
        },
      ],
      formatImageUrl: noopFormatImg,
    });

    expect(report.totalRows).toBe(6);
    expect(report.summary).toEqual({
      createCount: 1,
      updateCount: 2,
      variantUpdateCount: 1,
      variantCreateCount: 0,
      noChangeCount: 1,
      skipCount: 1,
    });

    const skipRow = report.rows.find((r) => r.sku === "BAD-ZERO");
    expect(skipRow?.action).toBe("skip");
    expect(skipRow?.reason).toContain("zero/missing price");

    const renameRow = report.rows.find((r) => r.sku === "RENAMED-NEW");
    expect(renameRow?.action).toBe("update");
    expect(renameRow?.changes).toContain("sku: RENAMED-OLD → RENAMED-NEW");

    const partialUpdate = report.rows.find((r) => r.sku === "EXISTING-1");
    expect(partialUpdate?.changes.some((c) => c.startsWith("weight:"))).toBe(true);
    expect(partialUpdate?.changes.some((c) => c.startsWith("name:"))).toBe(false);
  });

  it("applies mixed-unit conversion and additional_attributes color/size updates in child-only variant rows", () => {
    const directSet = buildDirectVariantUpdateSet(
      {
        sku: "VAR-NEW-SKU",
        old_sku: "VAR-OLD-SKU",
        length: "35",
        additional_attributes: "color=Matte.Black,size=XXL",
      },
      noopFormatImg,
      {
        sku: "VAR-OLD-SKU",
        length: 12,
        breadth: 10,
        height: 8,
        dimensionUnit: "in",
      }
    );

    expect(directSet).toEqual({
      "variants.$.length": 35,
      "variants.$.breadth": 25.4,
      "variants.$.height": 20.3,
      "variants.$.dimensionUnit": "cm",
      "variants.$.attributes.color": "Matte Black",
      "variants.$.attributes.size": "XXL",
      "variants.$.sku": "VAR-NEW-SKU",
    });
  });

  it("deduplicates duplicate SKU segments case-insensitively in configurable_variations", () => {
    const variants = parseConfigurableVariationsString(
      "sku=AX-M,color=Red,price=4500|sku=ax-m,size=M,qty=9,image=/ax-m.webp",
      5000,
      noopFormatImg
    );

    expect(variants).toHaveLength(1);
    expect(variants[0]).toMatchObject({
      price: 4500,
      stock: 9,
      imageUrl: "/ax-m.webp",
      attributes: { color: "Red", size: "M" },
    });
  });

  it("preview classifies ignored columns, DB parent child creation (variant_create), missing SKU skips, and >150 row truncation", () => {
    const bulkNormalRows = Array.from({ length: 155 }, (_, i) => ({
      sku: `BULK-${i + 1}`,
      name: `Riding Gear ${i + 1}`,
      price: "1999",
    }));

    const report = buildCsvMigrationPreview({
      headers: ["sku", "name", "price", "parent_sku", "capacity", "codazon_custom_tab"],
      allRows: [
        { name: "Row Without SKU", price: "999" },
        { sku: "NEW-CHILD-XL", parent_sku: "PAR-JKT", price: "6999", qty: "4", length: "42", breadth: "32", height: "14" },
        ...bulkNormalRows,
      ],
      existingRoots: [{ sku: "PAR-JKT", name: "Touring Jacket", basePrice: 6999 }],
      existingVariantParents: [],
      formatImageUrl: noopFormatImg,
    });

    expect(report.headerAnalysis.standardFields).toEqual(
      expect.arrayContaining(["sku", "name", "price", "parent_sku"])
    );
    expect(report.headerAnalysis.attributeColumns).toContain("capacity");
    expect(report.headerAnalysis.ignoredColumns).toContain("codazon_custom_tab");

    expect(report.summary.skipCount).toBe(1);
    expect(report.summary.variantCreateCount).toBe(1);
    expect(report.summary.createCount).toBe(155);
    expect(report.truncatedNormalRows).toBe(6);
    expect(report.rows[0]).toMatchObject({ action: "skip", reason: "SKU missing in row" });
    expect(report.rows.find((r) => r.sku === "NEW-CHILD-XL")?.action).toBe("variant_create");
  });

  it("strips polluted Action Camera / Phone Holder / Performance Parts CSV slugs for T-shirts, Intercoms, and Exhausts", () => {
    const tShirt = mapCsvRowToProductData(
      {
        sku: "AS-T-BEAS",
        name: "Beast T-Shirt",
        price: "999",
        categories:
          "Root Test 01/Gadgets/Action Cameras/Camera Accessories,Root Test 01/Merchandise/Biker T-shirts | Motorcycle T shirts",
      },
      noopFormatImg
    );
    expect(tShirt.categorySlugs).toContain("merchandise");
    expect(tShirt.categorySlugs).not.toContain("action-cameras");
    expect(tShirt.categorySlugs).not.toContain("camera-accessories");
    expect(tShirt.categorySlugs).not.toContain("gadgets");
    expect(tShirt.categorySlugs).not.toContain("motorcycle-accessories-online");

    const intercom = mapCsvRowToProductData(
      {
        sku: "BC10BC",
        name: "BluArmor C10 Bluetooth Communicator",
        price: "4999",
        categories: "Root Test 01/Gadgets/Bike Phone Holders,Root Test 01/Gadgets/Communicators",
      },
      noopFormatImg
    );
    expect(intercom.categorySlugs).toContain("communicators");
    expect(intercom.categorySlugs).not.toContain("bike-phone-holders");

    const exhaust = mapCsvRowToProductData(
      {
        sku: "RRSEFCGT650",
        name: "Red Rooster Stellar Exhaust For Continental GT 650",
        price: "18999",
        categories: "Root Test 01/Motorcycle Accessories | Bike Accessories/Performance Parts,Root Test 01/Bike Exhausts",
      },
      noopFormatImg
    );
    expect(exhaust.categorySlugs).toContain("exhausts");
    expect(exhaust.categorySlugs).not.toContain("performance-parts");
    expect(exhaust.categorySlugs).not.toContain("spares");

    const mxJersey = mapCsvRowToProductData(
      {
        sku: "AXCJ",
        name: "Axor X-Cross Motocross Jersey",
        price: "2499",
        categories: "Root Test 01/Riding Gear/Off-Road Motocross,Root Test 01/Merchandise/Biker T-shirts | Motorcycle T shirts",
      },
      noopFormatImg
    );
    expect(mxJersey.categorySlugs).toContain("riding-gear");
  });
});
