import { NextRequest } from "next/server";
import { ApiResponse } from "../../core/response/ApiResponse";
import { AuditLogService } from "./audit-log.service";
import { AuditLogValidator } from "./audit-log.validator";

/**
 * @class AuditLogController
 * @description Read-only HTTP controller for inspecting Admin Audit & Security Logs.
 */
export class AuditLogController {
  static async list(req: NextRequest) {
    const filters = AuditLogValidator.validateQuery(req);
    const { items, totalCount } = await AuditLogService.listLogs(filters);
    return ApiResponse.paginated(items, totalCount, filters.page, filters.limit);
  }

  static async stats() {
    const stats = await AuditLogService.getStats();
    return ApiResponse.success(stats, "Audit log summary stats fetched");
  }

  static async getById(id: string) {
    const validId = AuditLogValidator.validateId(id);
    const log = await AuditLogService.getById(validId);
    return ApiResponse.success(log, "Audit log entry fetched");
  }
}
