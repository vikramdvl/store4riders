import { NextRequest } from "next/server";
import { CouponService } from "./coupon.service";
import { CouponValidator } from "./coupon.validator";
import { ApiResponse } from "../../core/response/ApiResponse";

export class CouponController {
  static async getPublicActiveCoupons() {
    const coupons = await CouponService.getPublicActiveCoupons();
    return ApiResponse.success(coupons, "Active promo coupons fetched successfully");
  }

  static async validate(req: NextRequest, userId?: string) {
    const { code, items, cartTotal } = await CouponValidator.validateApplyCoupon(req);
    const result = await CouponService.validateCoupon({
      code,
      items,
      cartTotal,
      userId,
    });
    return ApiResponse.success(result, result.message);
  }

  static async list(req: NextRequest) {
    const query = CouponValidator.validateListQuery(req);
    const { items, total, page, limit } = await CouponService.listCoupons(query);
    return ApiResponse.paginated(items, total, page, limit);
  }

  static async getById(req: NextRequest, id: string) {
    const coupon = await CouponService.getCouponById(id);
    return ApiResponse.success(coupon, "Coupon details fetched successfully");
  }

  static async create(req: NextRequest) {
    const data = await CouponValidator.validateCreate(req);
    const coupon = await CouponService.createCoupon(data as any);
    try {
      const { extractUserFromAuth } = await import("../../core/middlewares/auth");
      const actorUserId = extractUserFromAuth(req);
      const { AuditLogService } = await import("../audit-log/audit-log.service");
      const couponId = (coupon as any)._id?.toString() || (coupon as any).id;
      await AuditLogService.record({
        category: "ADMIN",
        action: "COUPON_CREATED",
        severity: "info",
        actorUserId,
        resource: { type: "Coupon", id: couponId, label: (coupon as any).code },
        changes: { after: data as any },
        req,
        message: `Created promo coupon ${(coupon as any).code || ""}`,
      });
    } catch {}
    return ApiResponse.success(coupon, "Coupon created successfully", 201);
  }

  static async update(req: NextRequest, id: string) {
    const data = await CouponValidator.validateUpdate(req);
    const coupon = await CouponService.updateCoupon(id, data as any);
    try {
      const { extractUserFromAuth } = await import("../../core/middlewares/auth");
      const actorUserId = extractUserFromAuth(req);
      const { AuditLogService } = await import("../audit-log/audit-log.service");
      await AuditLogService.record({
        category: "ADMIN",
        action: "COUPON_UPDATED",
        severity: "info",
        actorUserId,
        resource: { type: "Coupon", id, label: (coupon as any).code || id },
        changes: { after: data as any },
        req,
        message: `Updated promo coupon ${(coupon as any).code || id}`,
      });
    } catch {}
    return ApiResponse.success(coupon, "Coupon updated successfully");
  }

  static async delete(req: NextRequest, id: string) {
    let prevCoupon: any = null;
    try {
      prevCoupon = await CouponService.getCouponById(id);
    } catch {}
    await CouponService.deleteCoupon(id);
    try {
      const { extractUserFromAuth } = await import("../../core/middlewares/auth");
      const actorUserId = extractUserFromAuth(req);
      const { AuditLogService } = await import("../audit-log/audit-log.service");
      await AuditLogService.record({
        category: "ADMIN",
        action: "COUPON_DELETED",
        severity: "warning",
        actorUserId,
        resource: { type: "Coupon", id, label: prevCoupon?.code || id },
        changes: prevCoupon ? { before: { code: prevCoupon.code, discountType: prevCoupon.discountType, discountValue: prevCoupon.discountValue } } : undefined,
        req,
        message: `Deleted promo coupon ${prevCoupon?.code || id}`,
      });
    } catch {}
    return ApiResponse.success({ id }, "Coupon deleted successfully");
  }
}
