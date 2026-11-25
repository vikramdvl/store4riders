import { z } from "zod";

export const auditLogCategorySchema = z.enum(["AUTH", "ADMIN", "PAYMENT", "SHIPPING", "SYSTEM"]);
export const auditLogSeveritySchema = z.enum(["info", "warning", "critical"]);
export const auditLogStatusSchema = z.enum(["success", "failure"]);

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  category: auditLogCategorySchema.optional(),
  severity: auditLogSeveritySchema.optional(),
  status: auditLogStatusSchema.optional(),
  action: z.string().trim().max(120).optional(),
  resourceType: z.string().trim().max(80).optional(),
  search: z.string().trim().max(200).optional(),
  startDate: z.string().trim().max(40).optional(),
  endDate: z.string().trim().max(40).optional(),
});

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;
