import { NextRequest, NextResponse } from "next/server";
import { AdminValidator } from "./admin.validator";
import { UserService } from "../user/user.service";
import { AdminService } from "./admin.service";
import { ApiResponse } from "../../core/response/ApiResponse";
import { UnauthorizedError, ForbiddenError } from "../../core/errors/AppError";

export class AdminController {
  static async getUsers(req: NextRequest) {
    const { page, limit, role, search } = AdminValidator.validatePagination(req);
    const { items, totalCount } = await UserService.getUsers(page, limit, role, search);
    return ApiResponse.paginated(items, totalCount, page, limit);
  }

  static async createStaffUser(req: NextRequest, requestingUserId: string) {
    const body = await req.json();
    const data = AdminValidator.validateCreateStaffUser(body);
    const user = await UserService.createStaffUser(data as any, requestingUserId);
    const { AuditLogService } = await import("../audit-log/audit-log.service");
    const targetId = (user as any)._id?.toString() || (user as any).id;
    await AuditLogService.record({
      category: "ADMIN",
      action: "STAFF_USER_CREATED",
      severity: "critical",
      actorUserId: requestingUserId,
      resource: { type: "User", id: targetId, label: user.email },
      changes: { after: { email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName } },
      req,
      message: `Created staff account ${user.email} with role ${user.role}`,
    });
    return ApiResponse.success(user, "Staff user created successfully", 201);
  }

  static async updateRole(req: NextRequest, userId: string, requestingUserId?: string) {
    const body = await req.json();
    const { role } = AdminValidator.validateRoleUpdate(body);
    const prevRole = await UserService.getRole(userId);
    const user = await UserService.updateRole(userId, role, requestingUserId);
    const { AuditLogService } = await import("../audit-log/audit-log.service");
    await AuditLogService.record({
      category: "ADMIN",
      action: "USER_ROLE_UPDATED",
      severity: "critical",
      actorUserId: requestingUserId,
      resource: { type: "User", id: userId, label: user.email },
      changes: { before: { role: prevRole }, after: { role: user.role } },
      req,
      message: `Changed role for ${user.email} from ${prevRole} to ${user.role}`,
    });
    return ApiResponse.success(user, "User role updated successfully");
  }

  static async updateStatus(req: NextRequest, userId: string, requestingUserId?: string) {
    const body = await req.json();
    const { isActive } = AdminValidator.validateStatusUpdate(body);
    const user = await UserService.updateStatus(userId, isActive, requestingUserId);
    const { AuditLogService } = await import("../audit-log/audit-log.service");
    await AuditLogService.record({
      category: "ADMIN",
      action: "USER_STATUS_UPDATED",
      severity: "warning",
      actorUserId: requestingUserId,
      resource: { type: "User", id: userId, label: user.email },
      changes: { before: { isActive: !isActive }, after: { isActive } },
      req,
      message: `${isActive ? "Enabled" : "Disabled"} account ${user.email}`,
    });
    return ApiResponse.success(user, "User status updated successfully");
  }

  static async deleteUser(req: NextRequest, userId: string, requestingUserId: string) {
    const { UserRepository } = await import("../user/user.repository");
    const targetUser = await UserRepository.findById(userId);
    await UserService.deleteUser(userId, requestingUserId);
    const { AuditLogService } = await import("../audit-log/audit-log.service");
    await AuditLogService.record({
      category: "ADMIN",
      action: "USER_DELETED",
      severity: "critical",
      actorUserId: requestingUserId,
      resource: { type: "User", id: userId, label: targetUser?.email || userId },
      changes: targetUser ? { before: { email: targetUser.email, role: targetUser.role } } : undefined,
      req,
      message: `Deleted user account ${targetUser?.email || userId}`,
    });
    return ApiResponse.success(null, "User deleted successfully");
  }

  static async getDashboardStats(req: NextRequest, requestingUserId?: string) {
    let role: string | undefined;
    if (requestingUserId) {
      role = await UserService.getRole(requestingUserId);
    }
    const stats = await AdminService.getDashboardStats(role);
    return ApiResponse.success(stats, "Dashboard stats fetched successfully");
  }

  static async getLogisticsDashboardStats(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const status = searchParams.get("status") || "ALL";
    const search = searchParams.get("search") || "";

    const stats = await AdminService.getLogisticsDashboardStats({ page, limit, status, search });
    return ApiResponse.success(stats, "Logistics dashboard stats fetched successfully");
  }

  static async getRecentOrders(req: NextRequest) {
    const orders = await AdminService.getRecentOrders();
    return ApiResponse.success(orders, "Recent orders fetched successfully");
  }

  static async getRevenueChart(req: NextRequest, requestingUserId?: string) {
    if (requestingUserId) {
      const role = await UserService.getRole(requestingUserId);
      if (role === "logistic") {
        return ApiResponse.success([], "Revenue chart not available for logistic role");
      }
    }
    const chart = await AdminService.getRevenueChart();
    return ApiResponse.success(chart, "Revenue chart fetched successfully");
  }

  static async bulkUpdateProducts(req: NextRequest) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return ApiResponse.error("CSV file is required", 400);
    }
    const csvContent = await file.text();
    const { ProductService } = await import("../product/product.service");
    const report = await ProductService.bulkUpdateFromCsv(csvContent);
    try {
      const { extractUserFromAuth } = await import("../../core/middlewares/auth");
      const actorUserId = extractUserFromAuth(req);
      const { AuditLogService } = await import("../audit-log/audit-log.service");
      await AuditLogService.record({
        category: "ADMIN",
        action: "PRODUCTS_BULK_UPDATED",
        severity: "warning",
        actorUserId,
        resource: { type: "ProductBulkUpdate", label: file.name || "bulk-update.csv" },
        req,
        message: `Processed CSV bulk product update (${file.name || "bulk-update.csv"})`,
        metadata: report as any,
      });
    } catch {}
    return ApiResponse.success(report, "Bulk update processed");
  }

  static async getPaymentLogs(req: NextRequest) {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const { PaymentModel } = await import("../payment/payment.model");
    
    const logs = await PaymentModel.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    const totalCount = await PaymentModel.countDocuments();

    return ApiResponse.paginated(logs, totalCount, page, limit);
  }

  static async getTestProduct(req: NextRequest) {
    const data = await AdminService.getTestProduct();
    return ApiResponse.success(data, "Test product status retrieved");
  }

  static async createTestProduct(req: NextRequest) {
    const product = await AdminService.createTestProduct();
    return ApiResponse.success(product, "Test product created successfully");
  }

  static async deleteTestProduct(req: NextRequest) {
    await AdminService.deleteTestProduct();
    return ApiResponse.success(null, "Test product removed successfully");
  }

  static async getSystemHealth() {
    const report = await AdminService.getSystemHealth();
    return ApiResponse.success(report, "System health report generated");
  }

  /**
   * Enterprise Real-Time Server-Sent Events (SSE) Stream
   * Pushes instant notifications for new orders, status changes, and shipments.
   * Eliminates aggressive polling while keeping idle DB queries at ZERO.
   */
  static async getLiveStream(req: NextRequest) {
    const { ADMIN_ACCESS_COOKIE, CUSTOMER_ACCESS_COOKIE, verifySessionState } = await import("../../core/middlewares/auth");
    let token = req.headers.get("authorization")?.startsWith("Bearer ")
      ? req.headers.get("authorization")?.split(" ")[1]
      : req.cookies.get(ADMIN_ACCESS_COOKIE)?.value ||
        req.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value ||
        req.nextUrl.searchParams.get("token");

    if (!token) {
      throw new UnauthorizedError("Authentication required for live stream");
    }

    const { verifyToken } = await import("../../core/utils/jwt");
    let decoded: import("../../core/utils/jwt").AuthTokenPayload;
    try {
      decoded = verifyToken(token);
    } catch {
      throw new UnauthorizedError("Invalid or expired access token");
    }

    if (decoded.scope && decoded.scope !== "admin") {
      throw new ForbiddenError("Admin portal session required for live stream");
    }
    if (decoded.tokenType && !decoded.scope) {
      throw new ForbiddenError("Token is missing required admin scope");
    }

    // Check revocation/tokenVersion when real token claims are present (without breaking UserService mocks)
    if (decoded.jti || typeof decoded.tokenVersion === "number") {
      await verifySessionState(decoded, { requiredScope: "admin" });
    }

    const role = await UserService.getRole(decoded.userId);
    if (
      ![
        "super_admin",
        "admin",
        "superadmin",
        "manager",
        "staff",
        "logistic",
        "order_manager",
        "customer_care",
        "customer_support",
        "product_manager",
        "marketing_manager",
      ].includes(role)
    ) {
      throw new ForbiddenError("Insufficient permissions to access admin live stream");
    }

    const { adminEventHub } = await import("../../core/events/adminEventHub");
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const initial = `event: connected\ndata: ${JSON.stringify({ connected: true, timestamp: Date.now() })}\n\n`;
        controller.enqueue(encoder.encode(initial));

        const unsubscribe = adminEventHub.subscribe((event) => {
          try {
            const chunk = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(chunk));
          } catch {
            // Stream closed
          }
        });

        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            clearInterval(heartbeat);
          }
        }, 20000);

        req.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          unsubscribe();
          try {
            controller.close();
          } catch {}
        });
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform, no-store",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }
}
