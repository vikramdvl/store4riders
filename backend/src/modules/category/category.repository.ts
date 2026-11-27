/**
 * @class CategoryRepository
 * @description Direct database access layer for Categories.
 * Keeps Mongoose specifics completely hidden from the Service layer.
 */
import mongoose from "mongoose";
import { CategoryModel } from "./category.model";
import { ICategory } from "@store4riders/shared-types";
import { CATEGORY_ALIAS_MAP } from "../product/product.category-constants";

export class CategoryRepository {
  /**
   * Helper to resolve all direct and reverse aliases for a category slug.
   */
  private static getCategoryAliases(slug: string): string[] {
    const cleanSlug = slug.toLowerCase().trim();
    const aliasSet = new Set<string>();

    // 1. Direct aliases
    const direct = CATEGORY_ALIAS_MAP[cleanSlug] || [];
    for (const a of direct) aliasSet.add(a);

    // 2. Reverse aliases (where cleanSlug appears in another category's alias list)
    for (const [key, list] of Object.entries(CATEGORY_ALIAS_MAP)) {
      if (list.includes(cleanSlug)) {
        aliasSet.add(key);
        for (const a of list) aliasSet.add(a);
      }
    }

    aliasSet.delete(cleanSlug);
    return Array.from(aliasSet);
  }

  static async findAll(): Promise<ICategory[]> {
    const categories = (await CategoryModel.find().lean().exec()) as unknown as ICategory[];
    for (const cat of categories) {
      if (cat.slug === "motorcycle-riding-boots" && cat.name === "Riding Boots") {
        cat.name = "Motorcycle riding boots";
        CategoryModel.updateOne({ _id: cat._id }, { $set: { name: "Motorcycle riding boots" } }).exec().catch(() => {});
      } else if (cat.slug === "motorcycle-bags-bike-luggage" && cat.name === "Luggage & Bags") {
        cat.name = "Motorcycle Bags / Bike Luggage";
        CategoryModel.updateOne({ _id: cat._id }, { $set: { name: "Motorcycle Bags / Bike Luggage" } }).exec().catch(() => {});
      }
    }
    return categories;
  }

  static async findBySlug(slug: string): Promise<ICategory | null> {
    if (!slug) return null;
    const cleanSlug = slug.replace(/\.html$/i, "").toLowerCase().trim();
    const direct = await CategoryModel.findOne({ slug: cleanSlug }).lean().exec();
    if (direct) {
      const res = direct as unknown as ICategory;
      if (res.slug === "motorcycle-riding-boots" && res.name === "Riding Boots") {
        res.name = "Motorcycle riding boots";
        CategoryModel.updateOne({ _id: res._id }, { $set: { name: "Motorcycle riding boots" } }).exec().catch(() => {});
      } else if (res.slug === "motorcycle-bags-bike-luggage" && res.name === "Luggage & Bags") {
        res.name = "Motorcycle Bags / Bike Luggage";
        CategoryModel.updateOne({ _id: res._id }, { $set: { name: "Motorcycle Bags / Bike Luggage" } }).exec().catch(() => {});
      }
      return res;
    }

    // Try singular / plural
    const singular = cleanSlug.endsWith("s") ? cleanSlug.slice(0, -1) : `${cleanSlug}s`;
    const bySingular = await CategoryModel.findOne({ slug: singular }).lean().exec();
    if (bySingular) return bySingular as unknown as ICategory;

    // Try aliases from CATEGORY_ALIAS_MAP (bidirectional)
    const aliases = this.getCategoryAliases(cleanSlug);
    if (aliases.length > 0) {
      const byAlias = await CategoryModel.findOne({ slug: { $in: aliases } }).lean().exec();
      if (byAlias) return byAlias as unknown as ICategory;
    }

    return null;
  }

  static async create(data: Partial<ICategory>): Promise<ICategory> {
    const category = new CategoryModel(data);
    return (await category.save()).toObject() as ICategory;
  }

  /**
   * Robust category lookup by MongoDB ObjectId, slug, singular/plural, or alias.
   */
  static async findById(id: string): Promise<ICategory | null> {
    if (!id) return null;
    const cleanId = String(id).trim();

    // 1. Valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(cleanId)) {
      const byId = await CategoryModel.findById(cleanId).lean().exec();
      if (byId) {
        const res = byId as unknown as ICategory;
        if (res.slug === "motorcycle-riding-boots" && res.name === "Riding Boots") {
          res.name = "Motorcycle riding boots";
          CategoryModel.updateOne({ _id: res._id }, { $set: { name: "Motorcycle riding boots" } }).exec().catch(() => {});
        } else if (res.slug === "motorcycle-bags-bike-luggage" && res.name === "Luggage & Bags") {
          res.name = "Motorcycle Bags / Bike Luggage";
          CategoryModel.updateOne({ _id: res._id }, { $set: { name: "Motorcycle Bags / Bike Luggage" } }).exec().catch(() => {});
        }
        return res;
      }
    }

    const cleanSlug = cleanId.toLowerCase().replace(/\.html$/i, "");

    // 2. Direct slug match
    const bySlug = await CategoryModel.findOne({
      $or: [{ slug: cleanSlug }, { id: cleanSlug }]
    }).lean().exec();
    if (bySlug) return bySlug as unknown as ICategory;

    // 3. Singular / plural variant
    const singular = cleanSlug.endsWith("s") ? cleanSlug.slice(0, -1) : `${cleanSlug}s`;
    const bySingular = await CategoryModel.findOne({ slug: singular }).lean().exec();
    if (bySingular) return bySingular as unknown as ICategory;

    // 4. Known aliases from CATEGORY_ALIAS_MAP (bidirectional)
    const aliases = this.getCategoryAliases(cleanSlug);
    if (aliases.length > 0) {
      const byAlias = await CategoryModel.findOne({ slug: { $in: aliases } }).lean().exec();
      if (byAlias) return byAlias as unknown as ICategory;
    }

    // 5. Name match (case-insensitive) fallback
    const namePattern = cleanSlug.replace(/-/g, " ");
    const byName = await CategoryModel.findOne({
      name: { $regex: new RegExp(`^${namePattern}$`, "i") }
    }).lean().exec();
    if (byName) return byName as unknown as ICategory;

    return null;
  }

  /**
   * Robust category update by _id, slug, singular/plural, or alias.
   * Auto-upserts/creates if the category document does not yet exist in MongoDB.
   */
  static async update(id: string, data: Partial<ICategory>): Promise<ICategory | null> {
    if (!id) return null;

    // 1. First find any existing document using robust lookup
    const existing = await this.findById(id);

    if (existing) {
      const updateData: Record<string, any> = { ...data };
      const unsetData: Record<string, 1> = {};
      if (updateData.parentId === "" || updateData.parentId === "null" || updateData.parentId === null) {
        delete updateData.parentId;
        unsetData.parentId = 1;
      }
      const updateOps: Record<string, any> = { $set: updateData };
      if (Object.keys(unsetData).length > 0) {
        updateOps.$unset = unsetData;
      }
      const updated = await CategoryModel.findByIdAndUpdate(
        existing._id,
        updateOps,
        { new: true }
      ).lean().exec();
      return updated as unknown as ICategory;
    }

    // 2. If it does not exist in DB: AUTO-UPSERT / CREATE it
    const cleanSlug = (data.slug || id)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const cleanName = data.name || cleanSlug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

    const newDoc = new CategoryModel({
      ...data,
      name: cleanName,
      slug: cleanSlug,
      includeInMenu: data.includeInMenu !== false,
      parentId: data.parentId === "" || data.parentId === "null" ? undefined : data.parentId,
    });

    const saved = await newDoc.save();
    return saved.toObject() as ICategory;
  }

  static async updateMany(filter: Record<string, any>, data: Record<string, any>): Promise<void> {
    await CategoryModel.updateMany(filter, data).exec();
  }

  /**
   * Robust delete: finds by id/slug/alias and deletes the document.
   */
  static async delete(id: string): Promise<void> {
    if (!id) return;
    const existing = await this.findById(id);
    if (existing) {
      await CategoryModel.findByIdAndDelete(existing._id).exec();
    }
  }
}
