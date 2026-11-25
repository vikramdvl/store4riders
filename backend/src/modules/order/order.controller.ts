import { NextRequest, NextResponse } from "next/server";
import { OrderService } from "./order.service";
import { OrderRepository } from "./order.repository";
import { OrderValidator } from "./order.validator";
import { ApiResponse } from "../../core/response/ApiResponse";
import { ENV } from "../../core/config/env";
import { ValidationError, ForbiddenError } from "../../core/errors/AppError";
import { UserService } from "../user/user.service";

/**
 * @class OrderController
 * @description Minimal HTTP controller for Orders and Payments.
 * Responsibilities:
 * 1. Extract payloads via OrderValidator.
 * 2. Delegate to OrderService.
 * 3. Return standardized API responses.
 */
export class OrderController {
  
  static async create(req: NextRequest) {
    const { userId, data } = await OrderValidator.validateCreate(req);
    const idempotencyKey = req.headers.get("Idempotency-Key") || (data as any).idempotencyKey || "";
    const result = await OrderService.createOrder(userId, { ...data, idempotencyKey });
    return ApiResponse.success(result, "Order created", 201);
  }


  static async syncPaymentStatus(req: NextRequest) {
    let userId: string | undefined = undefined;
    try {
      userId = OrderValidator.extractUserId(req);
    } catch {}
    const body = await req.json().catch(() => ({}));
    const orderId = body.orderId || req.nextUrl.searchParams.get("orderId");
    if (!orderId) {
      return ApiResponse.error("Order ID or Order Number is required", 400);
    }
    const result = await OrderService.syncPaymentStatus(orderId, userId);
    return ApiResponse.success(result, "Payment status checked");
  }
  static async verify(req: NextRequest) {
    const { userId, data } = await OrderValidator.validateVerify(req);
    await OrderService.verifyPayment(
      userId,
      data.gatewayOrderId,
      data.paymentId,
      data.signature,
      {
        paymentData: data.paymentData,
        tezResponse: data.tezResponse,
        utr: data.utr,
      }
    );
    return ApiResponse.success(null, "Payment verified successfully");
  }

  static async myOrders(req: NextRequest) {
    const userId = OrderValidator.extractUserId(req);
    try {
      const { UserModel } = await import("../user/user.model");
      const userDoc: any = await UserModel.findById(userId).select("email phone addresses").lean().exec();
      if (userDoc?.email) {
        await OrderRepository.linkGuestOrders(userDoc.email, userId);
      }
      const { AuthService } = await import("../auth/auth.service");
      await AuthService.syncUserFromLinkedOrders(userId, userDoc);
    } catch {
      // Non-blocking sync fallback
    }
    const orders = await OrderRepository.findByUserId(userId);
    return ApiResponse.success(orders, "Orders fetched successfully");
  }

  static async getById(req: NextRequest, id: string) {
    const userId = OrderValidator.extractUserId(req);
    const order = await OrderRepository.findById(id);
    if (!order || order.userId !== userId) {
      return ApiResponse.error("Order not found", 404);
    }
    return ApiResponse.success(order, "Order fetched successfully");
  }

  static async webhook(req: NextRequest, routePath?: string[]) {
    // CRITICAL: Must read raw text for HMAC validation. Fall back to searchParams for GET redirects.
    const searchParamsStr = req.nextUrl ? req.nextUrl.searchParams.toString() : "";
    const rawBody = (await req.text()) || searchParamsStr;
    
    const headers: Record<string, string> = {};
    req.headers.forEach((val, key) => { headers[key.toLowerCase()] = val; });

    const gatewayType = (routePath && routePath[1]) || "unknown";
    const isRedirect = routePath && ["payu", "snapmint", "ccavenue"].includes(routePath[1]);
    const frontendUrl = ENV.FRONTEND_URL;

    const getOrderId = () => {
      try {
        if (rawBody.trim().startsWith("{")) {
          const parsed = JSON.parse(rawBody);
          return (
            parsed.merchantOrderId ||
            parsed.merchant_order_id ||
            parsed.merchant_oid ||
            parsed.txnid ||
            parsed.order_id ||
            parsed.orderId ||
            parsed.orderNo ||
            ""
          );
        }
        const params = new URLSearchParams(rawBody);
        return (
          params.get("merchantOrderId") ||
          params.get("merchant_order_id") ||
          params.get("merchant_oid") ||
          params.get("txnid") ||
          params.get("order_id") ||
          params.get("orderId") ||
          params.get("orderNo") ||
          ""
        );
      } catch {
        return "";
      }
    };

    try {
      let webhookResult: any = null;
      if (gatewayType && gatewayType !== "unknown") {
        webhookResult = await OrderService.handleWebhook(rawBody, headers, gatewayType);
        const orderRef = webhookResult?.orderNumber || webhookResult?.orderId || getOrderId();
        const isWebhookSuccess = Boolean(webhookResult?.success);
        const { AuditLogService } = await import("../audit-log/audit-log.service");
        await AuditLogService.record({
          category: "PAYMENT",
          action: "PAYMENT_WEBHOOK_PROCESSED",
          severity: isWebhookSuccess ? "info" : "warning",
          status: isWebhookSuccess ? "success" : "failure",
          resource: { type: "Payment", id: orderRef || undefined, label: orderRef || gatewayType.toUpperCase() },
          req,
          message: `Processed ${gatewayType.toUpperCase()} payment webhook${orderRef ? ` for ${orderRef}` : ""}: ${isWebhookSuccess ? "success" : "failed/cancelled"}`,
          metadata: { gateway: gatewayType, isExchangeFee: Boolean(webhookResult?.isExchangeFee) },
        });
      }
      
      // Redirect user back to frontend after webhook processing
      if (isRedirect) {
        const orderId = webhookResult?.orderNumber || webhookResult?.orderId || getOrderId();
        const orderParam = orderId ? `&orderId=${encodeURIComponent(orderId)}` : "";

        // True success requires both verification success and non-failure route
        const isFailureRoute = routePath && routePath[2] === "failure";
        const isSuccess = Boolean(webhookResult?.success) && !isFailureRoute;

        if (webhookResult?.isExchangeFee && webhookResult?.orderId) {
          const feeStatus = isSuccess ? "true" : "false";
          return NextResponse.redirect(
            `${frontendUrl}/account/orders/${encodeURIComponent(String(webhookResult.orderId))}?exchangeFeePaid=${feeStatus}`,
            303
          );
        }

        if (isSuccess) {
          return NextResponse.redirect(`${frontendUrl}/checkout?success=true${orderParam}`, 303);
        } else {
          const isCancelled = (() => {
            try {
              const bodyLower = rawBody.toLowerCase();
              return (
                bodyLower.includes("usercancelled") ||
                bodyLower.includes("user cancelled") ||
                bodyLower.includes("cancelled by user") ||
                bodyLower.includes("status=cancel") ||
                bodyLower.includes("status=aborted") ||
                bodyLower.includes("unmappedstatus=usercancelled")
              );
            } catch {
              return false;
            }
          })();

          if (isCancelled) {
            return NextResponse.redirect(`${frontendUrl}/checkout?cancelled=true${orderParam}`, 303);
          } else {
            return NextResponse.redirect(`${frontendUrl}/checkout?failed=true${orderParam}`, 303);
          }
        }
      }

      return ApiResponse.success(webhookResult, "Webhook processed");
    } catch (err: any) {
      const orderRef = getOrderId();
      try {
        const { AuditLogService } = await import("../audit-log/audit-log.service");
        await AuditLogService.record({
          category: "PAYMENT",
          action: "PAYMENT_WEBHOOK_ERROR",
          severity: "critical",
          status: "failure",
          resource: { type: "Payment", id: orderRef || undefined, label: orderRef || gatewayType.toUpperCase() },
          req,
          message: `${gatewayType.toUpperCase()} payment webhook error${orderRef ? ` for ${orderRef}` : ""}: ${err?.message || "Verification error"}`,
          metadata: { gateway: gatewayType },
        });
      } catch {}
      if (isRedirect) {
        const orderId = orderRef;
        const orderParam = orderId ? `&orderId=${encodeURIComponent(orderId)}` : "";
        return NextResponse.redirect(`${frontendUrl}/checkout?failed=true${orderParam}`, 303);
      }
      return ApiResponse.error(err.message, err.statusCode || 500);
    }
  }

  static async adminGetAll(req: NextRequest) {
    const userId = OrderValidator.extractUserId(req);
    const role = await UserService.getRole(userId);
    const allowed = ["super_admin", "admin", "logistic", "customer_care", "order_manager", "customer_support"];
    if (!allowed.includes(role)) {
      throw new ForbiddenError("Staff access required");
    }
    const query = OrderValidator.validateAdminGetQuery(req);
    const result = await OrderService.getAllAdmin(query, query.page, query.limit);
    return ApiResponse.paginated(result.items, result.total, query.page, query.limit);
  }

  static async adminGetCounts(req: NextRequest) {
    const userId = OrderValidator.extractUserId(req);
    const role = await UserService.getRole(userId);
    const allowed = ["super_admin", "admin", "logistic", "customer_care", "order_manager", "customer_support"];
    if (!allowed.includes(role)) {
      throw new ForbiddenError("Staff access required");
    }
    const counts = await OrderService.getAdminCounts();
    return ApiResponse.success(counts, "Order counts fetched");
  }

  static async adminSuggest(req: NextRequest) {
    const userId = OrderValidator.extractUserId(req);
    const role = await UserService.getRole(userId);
    const allowed = ["super_admin", "admin", "logistic", "customer_care", "order_manager", "customer_support"];
    if (!allowed.includes(role)) {
      throw new ForbiddenError("Staff access required");
    }
    const { q } = OrderValidator.validateSuggestQuery(req);
    const items = await OrderService.suggestAdmin(q);
    return ApiResponse.success(items, "Order suggestions fetched");
  }

  static async adminGetById(req: NextRequest, id: string) {
    const userId = OrderValidator.extractUserId(req);
    const role = await UserService.getRole(userId);
    const allowed = ["super_admin", "admin", "logistic", "customer_care", "order_manager", "customer_support"];
    if (!allowed.includes(role)) {
      throw new ForbiddenError("Staff access required");
    }
    const order = await OrderService.getOrderById(id);
    return ApiResponse.success(order, "Order details fetched");
  }

  static async adminUpdateStatus(req: NextRequest, id: string) {
    const userId = OrderValidator.extractUserId(req);
    const role = await UserService.getRole(userId);
    const { status } = await OrderValidator.validateAdminUpdateStatus(req);

    if (role === "customer_care" && status !== "cancelled") {
      throw new ForbiddenError("Customer Care can only cancel orders");
    }

    let prevOrder: any = null;
    try {
      prevOrder = await OrderRepository.findById(id);
    } catch {}
    const updated = await OrderService.adminUpdateStatus(id, status);
    try {
      const { AuditLogService } = await import("../audit-log/audit-log.service");
      await AuditLogService.record({
        category: "ADMIN",
        action: "ORDER_STATUS_UPDATED",
        severity: status === "cancelled" ? "warning" : "info",
        actorUserId: userId,
        resource: { type: "Order", id, label: (updated as any)?.orderNumber || prevOrder?.orderNumber || id },
        changes: { before: { status: prevOrder?.status }, after: { status } },
        req,
        message: `Updated order ${(updated as any)?.orderNumber || id} status from ${prevOrder?.status || "unknown"} to ${status}`,
      });
    } catch {}
    return ApiResponse.success(updated, "Order status updated");
  }

  static async adminDeleteOrder(req: NextRequest, id: string) {
    const userId = OrderValidator.extractUserId(req);
    const role = await UserService.getRole(userId);
    if (role !== "admin" && role !== "super_admin") {
      throw new ForbiddenError("Only Admins can delete orders");
    }
    let prevOrder: any = null;
    try {
      prevOrder = await OrderRepository.findById(id);
    } catch {}
    await OrderService.adminDeleteOrder(id);
    try {
      const { AuditLogService } = await import("../audit-log/audit-log.service");
      await AuditLogService.record({
        category: "ADMIN",
        action: "ORDER_DELETED",
        severity: "critical",
        actorUserId: userId,
        resource: { type: "Order", id, label: prevOrder?.orderNumber || id },
        changes: prevOrder ? { before: { orderNumber: prevOrder.orderNumber, status: prevOrder.status } } : undefined,
        req,
        message: `Deleted order ${prevOrder?.orderNumber || id}`,
      });
    } catch {}
    return ApiResponse.success(null, "Order deleted successfully");
  }

  static async adminAddNote(req: NextRequest, id: string) {
    const userId = OrderValidator.extractUserId(req);
    const { text } = await OrderValidator.validateAdminAddNote(req);
    const updated = await OrderService.addNote(id, userId, text);
    return ApiResponse.success(updated, "Note added to order");
  }

  static async requestReturn(req: NextRequest, id: string) {
    const userId = OrderValidator.extractUserId(req);
    const { reason, images, items } = await OrderValidator.validateRequestReturn(req);
    const updated = await OrderService.requestReturn(id, userId, reason, images, items);
    return ApiResponse.success(updated, "Exchange requested successfully");
  }

  static async adminHandleReturn(req: NextRequest, id: string) {
    const userId = OrderValidator.extractUserId(req);
    const role = await UserService.getRole(userId);
    const allowed = ["super_admin", "admin", "logistic", "order_manager"];
    if (!allowed.includes(role)) {
      throw new ForbiddenError("Staff logistics/admin access required to manage exchanges");
    }
    const data = await OrderValidator.validateAdminHandleReturn(req);
    const updated = await OrderService.adminHandleReturn(id, data.action, data.adminNote, {
      exchangeId: data.exchangeId,
      shippingFee: data.shippingFee,
      reverseCourier: data.reverseCourier,
      reverseAwb: data.reverseAwb,
      reverseTrackingUrl: data.reverseTrackingUrl,
      warehouseId: data.warehouseId,
      triggerCourier: data.triggerCourier,
    });
    try {
      const { AuditLogService } = await import("../audit-log/audit-log.service");
      await AuditLogService.record({
        category: "ADMIN",
        action: `EXCHANGE_${data.action.toUpperCase()}D`,
        severity: "warning",
        actorUserId: userId,
        resource: { type: "OrderExchange", id, label: (updated as any)?.orderNumber || id },
        changes: { after: { action: data.action, shippingFee: data.shippingFee, triggerCourier: data.triggerCourier } },
        req,
        message: `${data.action === "approve" ? "Approved" : "Rejected"} exchange request for order ${(updated as any)?.orderNumber || id}`,
      });
    } catch {}
    return ApiResponse.success(updated, `Exchange ${data.action}d successfully`);
  }

  static async adminExchangePickup(req: NextRequest, id: string) {
    const userId = OrderValidator.extractUserId(req);
    const role = await UserService.getRole(userId);
    const allowed = ["super_admin", "admin", "logistic", "order_manager"];
    if (!allowed.includes(role)) {
      throw new ForbiddenError("Staff logistics/admin access required");
    }
    const data = await OrderValidator.validateExchangePickup(req);
    const updated = await OrderService.adminExchangePickup(id, data);
    return ApiResponse.success(updated, "Reverse pickup details updated");
  }

  static async adminSubmitExchangeQc(req: NextRequest, id: string) {
    const userId = OrderValidator.extractUserId(req);
    const role = await UserService.getRole(userId);
    const allowed = ["super_admin", "admin", "logistic", "order_manager"];
    if (!allowed.includes(role)) {
      throw new ForbiddenError("Staff logistics/admin access required to submit QC");
    }
    const data = await OrderValidator.validateExchangeQc(req);
    const updated = await OrderService.adminSubmitExchangeQc(id, userId, data);
    return ApiResponse.success(updated, `Exchange QC marked as ${data.result.toUpperCase()}`);
  }

  static async adminSettleExchangeFee(req: NextRequest, id: string) {
    const userId = OrderValidator.extractUserId(req);
    const role = await UserService.getRole(userId);
    const allowed = ["super_admin", "admin", "logistic", "order_manager"];
    if (!allowed.includes(role)) {
      throw new ForbiddenError("Staff logistics/admin access required");
    }
    const data = await OrderValidator.validateExchangeFeeStatus(req);
    const updated = await OrderService.adminSettleExchangeFee(id, userId, data);
    return ApiResponse.success(updated, "Exchange shipping fee updated");
  }

  static async initiateExchangeFeePayment(req: NextRequest, id: string) {
    const userId = OrderValidator.extractUserId(req);
    const data = await OrderValidator.validateExchangeFeePay(req);
    const result = await OrderService.initiateExchangeFeePayment(id, userId, data.paymentMethod, data.exchangeId);
    return ApiResponse.success(result, "Exchange shipping fee payment session initialized");
  }

  static async adminDispatchReplacement(req: NextRequest, id: string) {
    const userId = OrderValidator.extractUserId(req);
    const role = await UserService.getRole(userId);
    const allowed = ["super_admin", "admin", "logistic", "order_manager"];
    if (!allowed.includes(role)) {
      throw new ForbiddenError("Staff logistics/admin access required to dispatch replacement");
    }
    const data = await OrderValidator.validateExchangeDispatch(req);
    const updated = await OrderService.adminDispatchReplacement(id, userId, data);
    return ApiResponse.success(updated, "Replacement shipment dispatched successfully");
  }

  static async adminCompleteExchange(req: NextRequest, id: string) {
    const userId = OrderValidator.extractUserId(req);
    const role = await UserService.getRole(userId);
    const allowed = ["super_admin", "admin", "logistic", "order_manager"];
    if (!allowed.includes(role)) {
      throw new ForbiddenError("Staff logistics/admin access required");
    }
    const data = await OrderValidator.validateExchangeComplete(req);
    const updated = await OrderService.adminCompleteExchange(id, userId, data.exchangeId);
    return ApiResponse.success(updated, "Exchange marked as completed");
  }

  static async generateInvoice(req: NextRequest, id: string) {
    let userId = "";
    try {
      userId = OrderValidator.extractUserId(req);
    } catch {
      // Check if admin token is present if user token fails
    }
    
    const isAdmin = req.nextUrl.searchParams.get("admin") === "true";
    const effectiveUserId = isAdmin ? "admin" : userId;

    const invoiceUrl = await OrderService.getInvoiceUrl(id, effectiveUserId);
    return ApiResponse.success({ invoiceUrl }, "Invoice generated successfully");
  }

  static async adminResendInvoiceEmail(req: NextRequest, id: string) {
    const result = await OrderService.resendInvoiceEmail(id);
    return ApiResponse.success(result, `Invoice email sent to ${result.recipientEmail}`);
  }

  static async adminAssignWarehouse(req: NextRequest, id: string) {
    const userId = OrderValidator.extractUserId(req);
    const role = await UserService.getRole(userId);
    if (role === "customer_care") {
      throw new ForbiddenError("Customer Care cannot assign warehouses");
    }
    const body = await req.json();
    if (!body.warehouseId) {
      throw new ValidationError("warehouseId is required");
    }
    const updated = await OrderService.adminAssignWarehouse(id, body.warehouseId);
    return ApiResponse.success(updated, "Warehouse assigned to order successfully");
  }
}
