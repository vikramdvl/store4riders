import mongoose, { Schema } from "mongoose";
import { ICategory } from "@store4riders/shared-types";

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    faqs: [
      {
        question: { type: String, required: true },
        answer: { type: String, required: true },
      },
    ],
    parentId: { type: String },
    description: { type: String },
    image: { type: String },
    bannerImage: { type: String },
    metaTitle: { type: String },
    metaDescription: { type: String },
    metaKeywords: { type: String, default: "" },
    videoUrl: { type: String },
    includeInMenu: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    menuGroup: { type: String },
    menuLabel: { type: String, default: "" },
    menuNavSection: { type: String, default: "" },
    heroCategoryIds: [{ type: String }],
    badge: { type: String },
    badgeColor: { type: String },
    attributeSetCode: { type: String },
    hsnCode: { type: String },
    taxClassName: { type: String },
    weightUnit: { type: String, enum: ["kg", "g", "ml", "L"] },
    sizeChart: { type: String },
    size_chart: { type: String },
    specDefinitions: [
      {
        key: { type: String, required: true },
        label: { type: String, required: true },
        placeholder: { type: String, default: "" },
        presets: [{ type: String }],
      },
    ],
    filterConfig: [{
      code: { type: String, required: true },
      label: { type: String, required: true },
      type: { type: String, enum: ["checkbox", "swatch", "range"], default: "checkbox" },
      sortOrder: { type: Number, default: 0 },
      isActive: { type: Boolean, default: true },
    }],
  },
  { timestamps: true }
);

if (
  mongoose.models.Category &&
  (!mongoose.models.Category.schema.path("metaKeywords") || !mongoose.models.Category.schema.path("isDeleted"))
) {
  delete (mongoose.models as any).Category;
}

export const CategoryModel = mongoose.models.Category || mongoose.model<ICategory>("Category", categorySchema);
