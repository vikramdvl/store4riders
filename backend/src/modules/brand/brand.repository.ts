import mongoose from "mongoose";
import { BrandModel } from "./brand.model";
import { IBrand } from "@store4riders/shared-types";

export class BrandRepository {
  static async findAll(includeInactive: boolean = false, includeDeleted: boolean = false): Promise<IBrand[]> {
    const filter: Record<string, any> = {};
    if (!includeDeleted) {
      filter.isDeleted = { $ne: true };
    }
    if (!includeInactive) {
      filter.isActive = { $ne: false };
    }
    return BrandModel.find(filter)
      .collation({ locale: "en", strength: 2 })
      .sort({ name: 1 })
      .lean()
      .exec() as unknown as IBrand[];
  }

  static async findById(id: string): Promise<IBrand | null> {
    if (mongoose.isValidObjectId(id)) {
      return BrandModel.findById(id).lean().exec() as unknown as IBrand | null;
    }
    const cleanSlug = id.replace(/^brand-/, "").toLowerCase().trim();
    return BrandModel.findOne({ slug: cleanSlug }).lean().exec() as unknown as IBrand | null;
  }

  static async findBySlug(slug: string): Promise<IBrand | null> {
    const clean = (slug || "").toLowerCase().replace(/\.html$/i, "").trim();
    return BrandModel.findOne({
      $or: [
        { slug: clean },
        { aliases: clean },
        { slug: new RegExp(`^${clean.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`, "i") },
        { aliases: new RegExp(`^${clean.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`, "i") },
      ]
    }).lean().exec() as unknown as IBrand | null;
  }

  static async create(data: Partial<IBrand>): Promise<IBrand> {
    const brand = new BrandModel(data);
    return (await brand.save()).toObject() as IBrand;
  }

  static async update(id: string, data: Partial<IBrand>): Promise<IBrand | null> {
    if (mongoose.isValidObjectId(id)) {
      return BrandModel.findByIdAndUpdate(id, data, { new: true })
        .lean()
        .exec() as unknown as IBrand | null;
    }
    const cleanSlug = id.replace(/^brand-/, "").toLowerCase().trim();
    return BrandModel.findOneAndUpdate(
      { $or: [{ slug: cleanSlug }, { slug: id }] },
      data,
      { new: true }
    )
      .lean()
      .exec() as unknown as IBrand | null;
  }

  static async delete(id: string): Promise<IBrand | null> {
    if (mongoose.isValidObjectId(id)) {
      return BrandModel.findByIdAndDelete(id).lean().exec() as unknown as IBrand | null;
    }
    const cleanSlug = id.replace(/^brand-/, "").toLowerCase().trim();
    return BrandModel.findOneAndDelete({ slug: cleanSlug }).lean().exec() as unknown as IBrand | null;
  }

  static async insertManySafe(brands: Partial<IBrand>[]): Promise<void> {
    if (!brands || brands.length === 0) return;
    try {
      await BrandModel.insertMany(brands, { ordered: false });
    } catch {
      // Ignore duplicate key errors if already inserted
    }
  }
}
