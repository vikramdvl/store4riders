import mongoose from "mongoose";
import { IAuditLog, IAuditLogStats } from "@store4riders/shared-types";
import { AuditLogQueryInput } from "@store4riders/shared-validation";
import { AuditLogModel } from "./audit-log.model";

/**
 * @class AuditLogRepository
 * @description Append-only data access layer for AuditLog documents.
 * Intentionally exposes NO update or delete methods to enforce log immutability.
 */
export class AuditLogRepository {
  static async create(entry: Omit<IAuditLog, "_id" | "id" | "createdAt">): Promise<IAuditLog> {
    const doc = new AuditLogModel({
      ...entry,
      createdAt: new Date(),
    });
    return (await doc.save()).toObject() as unknown as IAuditLog;
  }

  static buildFilterQuery(filters: Partial<AuditLogQueryInput>): Record<string, any> {
    const query: Record<string, any> = {};

    if (filters.category) query.category = filters.category;
    if (filters.severity) query.severity = filters.severity;
    if (filters.status) query.status = filters.status;
    if (filters.action) {
      const escapedAction = filters.action.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      query.action = { $regex: escapedAction, $options: "i" };
    }
    if (filters.resourceType) {
      const escapedType = filters.resourceType.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      query["resource.type"] = { $regex: `^${escapedType}$`, $options: "i" };
    }

    if (filters.startDate || filters.endDate) {
      const dateQuery: Record<string, Date> = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        if (!Number.isNaN(start.getTime())) dateQuery.$gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        if (!Number.isNaN(end.getTime())) {
          // Include full end day when date-only string (YYYY-MM-DD) is passed
          if (/^\d{4}-\d{2}-\d{2}$/.test(filters.endDate)) {
            end.setUTCHours(23, 59, 59, 999);
          }
          dateQuery.$lte = end;
        }
      }
      if (Object.keys(dateQuery).length > 0) {
        query.createdAt = dateQuery;
      }
    }

    if (filters.search && filters.search.trim()) {
      const escaped = filters.search.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      query.$or = [
        { message: { $regex: escaped, $options: "i" } },
        { action: { $regex: escaped, $options: "i" } },
        { "actor.email": { $regex: escaped, $options: "i" } },
        { "actor.name": { $regex: escaped, $options: "i" } },
        { "resource.label": { $regex: escaped, $options: "i" } },
        { "resource.id": { $regex: escaped, $options: "i" } },
        { "context.ip": { $regex: escaped, $options: "i" } },
      ];
    }

    return query;
  }

  static async findPaginated(filters: AuditLogQueryInput): Promise<{ items: IAuditLog[]; totalCount: number }> {
    const query = this.buildFilterQuery(filters);
    const skip = (filters.page - 1) * filters.limit;

    const [items, totalCount] = await Promise.all([
      AuditLogModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filters.limit)
        .lean()
        .exec() as unknown as Promise<IAuditLog[]>,
      AuditLogModel.countDocuments(query).exec(),
    ]);

    return { items, totalCount };
  }

  static async findById(id: string): Promise<IAuditLog | null> {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    return AuditLogModel.findById(id).lean().exec() as unknown as Promise<IAuditLog | null>;
  }

  static async getLast24hStats(): Promise<IAuditLogStats> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalLast24h, failedLoginsLast24h, criticalChangesLast24h, paymentAndShippingFailuresLast24h] =
      await Promise.all([
        AuditLogModel.countDocuments({ createdAt: { $gte: since } }).exec(),
        AuditLogModel.countDocuments({
          createdAt: { $gte: since },
          category: "AUTH",
          status: "failure",
        }).exec(),
        AuditLogModel.countDocuments({
          createdAt: { $gte: since },
          severity: "critical",
        }).exec(),
        AuditLogModel.countDocuments({
          createdAt: { $gte: since },
          category: { $in: ["PAYMENT", "SHIPPING"] },
          status: "failure",
        }).exec(),
      ]);

    return {
      totalLast24h,
      failedLoginsLast24h,
      criticalChangesLast24h,
      paymentAndShippingFailuresLast24h,
    };
  }
}
