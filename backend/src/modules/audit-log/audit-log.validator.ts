import { NextRequest } from "next/server";
import { auditLogQuerySchema, AuditLogQueryInput } from "@store4riders/shared-validation";
import { ValidationError } from "../../core/errors/AppError";

export class AuditLogValidator {
  static validateQuery(req: NextRequest): AuditLogQueryInput {
    const { searchParams } = new URL(req.url);
    const raw = {
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      category: searchParams.get("category") || undefined,
      severity: searchParams.get("severity") || undefined,
      status: searchParams.get("status") || undefined,
      action: searchParams.get("action") || undefined,
      resourceType: searchParams.get("resourceType") || undefined,
      search: searchParams.get("search") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    };

    const parsed = auditLogQuerySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "query"}: ${i.message}`).join(", ");
      throw new ValidationError(msg || "Invalid audit log query parameters");
    }
    return parsed.data;
  }

  static validateId(id: string): string {
    const trimmed = (id || "").trim();
    if (!trimmed || trimmed.length > 64) {
      throw new ValidationError("Invalid audit log ID");
    }
    return trimmed;
  }
}
