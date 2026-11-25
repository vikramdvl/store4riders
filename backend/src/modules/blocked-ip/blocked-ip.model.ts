import mongoose, { Schema, Document } from "mongoose";
import { IBlockedIp } from "@store4riders/shared-types";

export interface IBlockedIpDocument extends Omit<IBlockedIp, "_id" | "id" | "createdAt">, Document {
  createdAt: Date;
}

const BlockedIpSchema = new Schema<IBlockedIpDocument>(
  {
    ip: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 64,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    blockedBy: {
      userId: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      name: { type: String, trim: true },
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
    timestamps: false,
  }
);

// Automatically expire temporary IP blocks once expiresAt passes (null expiresAt = permanent)
BlockedIpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
BlockedIpSchema.index({ createdAt: -1 });

export const BlockedIpModel =
  mongoose.models.BlockedIp || mongoose.model<IBlockedIpDocument>("BlockedIp", BlockedIpSchema);
