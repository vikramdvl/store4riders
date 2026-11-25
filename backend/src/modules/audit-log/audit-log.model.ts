import mongoose, { Schema, Document } from "mongoose";
import { IAuditLog } from "@store4riders/shared-types";

export interface IAuditLogDocument extends Omit<IAuditLog, "_id" | "id" | "createdAt">, Document {
  createdAt: Date;
}

const AUDIT_LOG_TTL_SECONDS = 180 * 24 * 60 * 60; // 180 days automatic retention

const AuditLogSchema = new Schema<IAuditLogDocument>(
  {
    category: {
      type: String,
      enum: ["AUTH", "ADMIN", "PAYMENT", "SHIPPING", "SYSTEM"],
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "info",
      index: true,
    },
    status: {
      type: String,
      enum: ["success", "failure"],
      default: "success",
      index: true,
    },
    actor: {
      userId: { type: String, trim: true, index: true },
      email: { type: String, trim: true, lowercase: true },
      name: { type: String, trim: true },
      role: { type: String, trim: true },
    },
    resource: {
      type: { type: String, required: true, trim: true },
      id: { type: String, trim: true },
      label: { type: String, trim: true },
    },
    changes: {
      before: { type: Schema.Types.Mixed },
      after: { type: Schema.Types.Mixed },
    },
    context: {
      ip: { type: String, trim: true },
      userAgent: { type: String, trim: true, maxlength: 500 },
      method: { type: String, trim: true },
      path: { type: String, trim: true },
      requestId: { type: String, trim: true },
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    metadata: {
      type: Schema.Types.Mixed,
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

// TTL Index: Automatically expire audit logs after 180 days
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: AUDIT_LOG_TTL_SECONDS });
// Compound indexes for fast admin filtering & sorting
AuditLogSchema.index({ category: 1, createdAt: -1 });
AuditLogSchema.index({ severity: 1, createdAt: -1 });
AuditLogSchema.index({ status: 1, createdAt: -1 });
AuditLogSchema.index({ "resource.type": 1, "resource.id": 1, createdAt: -1 });

export const AuditLogModel =
  mongoose.models.AuditLog || mongoose.model<IAuditLogDocument>("AuditLog", AuditLogSchema);
