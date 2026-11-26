import mongoose, { Schema, Document } from "mongoose";
import { IUrlRedirect } from "@store4riders/shared-types";

export interface IUrlRedirectDocument extends Omit<IUrlRedirect, "_id">, Document {}

const urlRedirectSchema = new Schema<IUrlRedirectDocument>(
  {
    fromPath: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    toPath: {
      type: String,
      required: true,
      trim: true,
    },
    statusCode: {
      type: Number,
      enum: [301, 302],
      default: 301,
    },
    source: {
      type: String,
      enum: ["manual", "auto_product", "auto_category", "auto_brand", "auto_blog"],
      default: "manual",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    hitCount: {
      type: Number,
      default: 0,
    },
    lastHitAt: {
      type: Date,
      default: null,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

urlRedirectSchema.index({ fromPath: 1, isActive: 1 });
urlRedirectSchema.index({ toPath: 1 });

export const UrlRedirectModel =
  mongoose.models.UrlRedirect ||
  mongoose.model<IUrlRedirectDocument>("UrlRedirect", urlRedirectSchema);
