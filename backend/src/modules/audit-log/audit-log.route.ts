import { NextRequest, NextResponse } from "next/server";
import { AuditLogController } from "./audit-log.controller";
import { extractUserFromAuth } from "../../core/middlewares/auth";
import { checkAdmin } from "../../core/middlewares/admin";
import { UserService } from "../user/user.service";

/**
 * @swagger
 * tags:
 *   name: AuditLogs
 *   description: Read-only security, authentication, payment, shipping, and admin audit trail
 *
 * /api/v1/admin/audit-logs:
 *   get:
 *     summary: List paginated audit logs with category, severity, status, and search filters
 *     tags: [AuditLogs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 25 }
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [AUTH, ADMIN, PAYMENT, SHIPPING, SYSTEM] }
 *       - in: query
 *         name: severity
 *         schema: { type: string, enum: [info, warning, critical] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [success, failure] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated list of audit logs
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *
 * /api/v1/admin/audit-logs/stats:
 *   get:
 *     summary: Fetch 24-hour audit log summary counts
 *     tags: [AuditLogs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Summary counts for last 24 hours
 *
 * /api/v1/admin/audit-logs/{id}:
 *   get:
 *     summary: Fetch single audit log detail entry
 *     tags: [AuditLogs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Audit log entry fetched
 *       404:
 *         description: Entry not found
 */
export async function auditLogRouter(req: NextRequest, routePath: string[]): Promise<NextResponse | null> {
  const method = req.method;
  const pathLen = routePath.length;

  if (method !== "GET") {
    return null;
  }

  const userId = extractUserFromAuth(req);
  await checkAdmin(userId, UserService.getRole);

  if (pathLen === 0) {
    return await AuditLogController.list(req);
  }

  if (pathLen === 1 && routePath[0] === "stats") {
    return await AuditLogController.stats();
  }

  if (pathLen === 1) {
    return await AuditLogController.getById(routePath[0]);
  }

  return null;
}
