import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { generateTokens } from "../../../core/utils/jwt";
import { signGuestOrderToken } from "../../../core/utils/guestOrderToken";
import { OrderController } from "../order.controller";
import { OrderService } from "../order.service";
import { OrderRepository } from "../order.repository";
import { OrderModel } from "../order.model";
import { PaymentRepository } from "../../payment/payment.repository";
import { shippingRouter } from "../../shipping/shipping.route";
import { ShipmentRepository } from "../../shipping/shipment.repository";
import { returnRouter } from "../../return/return.route";
import { ReturnRepository } from "../../return/return.repository";
import { paymentRouter } from "../../payment/payment.route";
import { uploadRouter } from "../../upload/upload.route";
import { ProductController } from "../../product/product.controller";
import { UserRepository } from "../../user/user.repository";
import { PaymentGatewayFactory } from "../../../core/payments/PaymentGatewayFactory";
import { middleware as backendEdgeMiddleware } from "../../../middleware";

vi.mock("../../../core/cache/redis", () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  deleteCache: vi.fn().mockResolvedValue(undefined),
  setCacheIfAbsent: vi.fn().mockResolvedValue(true),
  incrementCacheCounter: vi.fn().mockResolvedValue(1),
  consumeCacheOnce: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../core/middlewares/rateLimiter", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(undefined),
  checkOrderRateLimit: vi.fn().mockResolvedValue(undefined),
  checkPaymentSyncRateLimit: vi.fn().mockResolvedValue(undefined),
  checkGeneralApiRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../core/payments/PaymentGatewayFactory", () => ({
  PaymentGatewayFactory: {
    create: vi.fn(),
  },
}));

vi.mock("../../../core/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Cross-User IDOR, Header Spoofing & Access Control Hardening", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks Customer B from accessing Customer A order details, shipments, returns, and invoices", async () => {
    const custBToken = generateTokens("user_attacker", "customer", 0).accessToken;

    vi.spyOn(UserRepository, "findById").mockImplementation(async (id: string) => ({
      _id: id,
      email: id === "user_attacker" ? "attacker@example.com" : "victim@example.com",
      role: "customer",
      isActive: true,
      tokenVersion: 0,
    }) as any);

    // 1. OrderController.getById blocks cross-user access
    vi.spyOn(OrderRepository, "findById").mockResolvedValue({
      _id: "ord_victim_1",
      orderNumber: "OD-VICTIM-1",
      userId: "user_victim",
      status: "confirmed",
      pricing: { total: 5000 },
      items: [],
    } as any);

    const getOrderReq = new NextRequest("https://api.store4riders.com/api/v1/orders/ord_victim_1", {
      headers: { Authorization: `Bearer ${custBToken}` },
    });
    const orderRes = await OrderController.getById(getOrderReq, "ord_victim_1");
    expect(orderRes.status).toBe(404);

    // 2. Shipping tracking GET /shipping/order/:orderId blocks Customer B
    vi.spyOn(OrderModel, "findOne").mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({
            _id: "ord_victim_1",
            orderNumber: "OD-VICTIM-1",
            userId: "user_victim",
          }),
        }),
      }),
    } as any);
    const findShipSpy = vi.spyOn(ShipmentRepository, "findByOrderId").mockResolvedValue([]);

    const shipReq = new NextRequest("https://api.store4riders.com/api/v1/shipping/order/ord_victim_1", {
      headers: { Authorization: `Bearer ${custBToken}` },
    });
    await expect(shippingRouter(shipReq, ["order", "ord_victim_1"])).rejects.toThrow(
      "You do not have permission to view shipments for this order"
    );
    expect(findShipSpy).not.toHaveBeenCalled();

    // 3. OrderService.requestReturn, initiateExchangeFeePayment, getInvoiceUrl block Customer B
    await expect(OrderService.requestReturn("ord_victim_1", "user_attacker", "Wrong size")).rejects.toThrow(
      "Order not found"
    );
    await expect(
      OrderService.initiateExchangeFeePayment("ord_victim_1", "user_attacker", "payu")
    ).rejects.toThrow("Order");
    await expect(OrderService.getInvoiceUrl("ord_victim_1", "user_attacker")).rejects.toThrow("Unauthorized");
  });

  it("blocks x-user-role / x-user-id header spoofing in ReturnRouter and ReturnController", async () => {
    const custBToken = generateTokens("user_attacker", "customer", 0).accessToken;
    vi.spyOn(UserRepository, "findById").mockResolvedValue({
      _id: "user_attacker",
      email: "attacker@example.com",
      role: "customer",
      isActive: true,
      tokenVersion: 0,
    } as any);

    // Spoofing x-user-role: admin must be rejected by real RBAC
    const forgedAdminReq = new NextRequest("https://api.store4riders.com/api/v1/returns/admin", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${custBToken}`,
        "x-user-role": "admin",
      },
    });
    await expect(returnRouter(forgedAdminReq, ["admin"])).rejects.toThrow("Permission denied");

    // Spoofing x-user-id header cannot create a return on Victim's order
    vi.spyOn(OrderRepository, "findById").mockResolvedValue({
      _id: "ord_victim_2",
      orderNumber: "OD-VICTIM-2",
      userId: "user_victim",
      pricing: { total: 4200 },
    } as any);
    const createReturnSpy = vi.spyOn(ReturnRepository, "create");

    const forgedReturnReq = new NextRequest("https://api.store4riders.com/api/v1/returns", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${custBToken}`,
        "x-user-id": "user_victim",
      },
      body: JSON.stringify({
        orderId: "ord_victim_2",
        items: [{ productId: "prod_1", quantity: 1, reason: "Defective helmet visor received — requesting return" }],
        refundMethod: "upi",
        upiId: "attacker@upi",
      }),
    });

    await expect(returnRouter(forgedReturnReq, [])).rejects.toThrow(
      "You do not have permission to request a return for this order"
    );
    expect(createReturnSpy).not.toHaveBeenCalled();
  });

  it("prevents unauthenticated and cross-user sync-payment/verify IDOR while allowing signed guest tokens", async () => {
    // 1. Registered user's order cannot be synced or verified anonymously by omitting token
    vi.spyOn(OrderRepository, "findByGatewayOrderId").mockResolvedValue({
      _id: "ord_reg_1",
      orderNumber: "OD-REG-1",
      gatewayOrderId: "txn_reg_1",
      userId: "user_owner_1",
      status: "pending_payment",
      pricing: { total: 2500 },
    } as any);
    vi.spyOn(PaymentRepository, "findByGatewayOrderId").mockResolvedValue({
      _id: "pay_reg_1",
      orderId: "ord_reg_1",
      gatewayOrderId: "txn_reg_1",
      gateway: "payu",
      amount: 2500,
      status: "pending",
    } as any);

    const anonSyncReq = new NextRequest("https://api.store4riders.com/api/v1/orders/sync-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "OD-REG-1" }),
    });
    await expect(OrderController.syncPaymentStatus(anonSyncReq)).rejects.toThrow(
      "Authentication required to access this order"
    );

    const anonVerifyReq = new NextRequest("https://api.store4riders.com/api/v1/orders/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gatewayOrderId: "txn_reg_1",
        paymentId: "pay_123",
        signature: "sig_123",
      }),
    });
    await expect(OrderController.verify(anonVerifyReq)).rejects.toThrow(
      "Authentication required to verify this order"
    );

    // 2. Guest order requires valid HMAC guestToken; wrong/missing token fails 403, valid token succeeds
    vi.spyOn(OrderRepository, "findByGatewayOrderId").mockResolvedValue({
      _id: "ord_guest_1",
      orderNumber: "OD-GUEST-1",
      gatewayOrderId: "txn_guest_1",
      guestEmail: "guest@example.com",
      status: "confirmed",
      pricing: { total: 1999 },
    } as any);
    vi.spyOn(PaymentRepository, "findByGatewayOrderId").mockResolvedValue(null);
    vi.spyOn(PaymentGatewayFactory, "create").mockReturnValue({
      getPaymentStatus: vi.fn().mockResolvedValue({ status: "success" }),
    } as any);

    const badGuestReq = new NextRequest("https://api.store4riders.com/api/v1/orders/sync-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "OD-GUEST-1", guestToken: "12345.deadbeef" }),
    });
    await expect(OrderController.syncPaymentStatus(badGuestReq)).rejects.toThrow(
      "Valid guest order verification token is required"
    );

    const validGuestToken = signGuestOrderToken("OD-GUEST-1", "guest@example.com");
    const goodGuestReq = new NextRequest("https://api.store4riders.com/api/v1/orders/sync-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "OD-GUEST-1", guestToken: validGuestToken }),
    });
    const goodRes = await OrderController.syncPaymentStatus(goodGuestReq);
    expect(goodRes.status).toBe(200);
  });

  it("blocks unauthorized access to /payments/:id, /upload/*, /products?scope=admin, and spoofed /docs cookie", async () => {
    const custBToken = generateTokens("user_attacker", "customer", 0).accessToken;
    vi.spyOn(UserRepository, "findById").mockResolvedValue({
      _id: "user_attacker",
      email: "attacker@example.com",
      role: "customer",
      isActive: true,
      tokenVersion: 0,
    } as any);

    // 1. /payments/:id blocks unauthenticated and cross-user requests
    const anonPaymentReq = new NextRequest("https://api.store4riders.com/api/v1/payments/pay_1");
    await expect(paymentRouter(anonPaymentReq, "pay_1")).rejects.toThrow("No access token provided");

    vi.spyOn(PaymentRepository, "findById").mockResolvedValue({
      _id: "pay_victim_1",
      orderId: "ord_victim_1",
      gatewayOrderId: "txn_victim_1",
      amount: 3200,
      status: "captured",
      method: "upi",
    } as any);
    vi.spyOn(OrderRepository, "findById").mockResolvedValue({
      _id: "ord_victim_1",
      userId: "user_victim",
    } as any);

    const crossUserPayReq = new NextRequest("https://api.store4riders.com/api/v1/payments/pay_victim_1", {
      headers: { Authorization: `Bearer ${custBToken}` },
    });
    const crossPayRes = await paymentRouter(crossUserPayReq, "pay_victim_1");
    expect(crossPayRes.status).toBe(403);

    // 2. /upload/* rejects customer tokens
    const uploadReq = new NextRequest("https://api.store4riders.com/api/v1/upload/presigned-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${custBToken}`,
      },
      body: JSON.stringify({ fileName: "hack.webp", fileType: "image/webp" }),
    });
    await expect(uploadRouter(uploadReq, ["presigned-url"])).rejects.toThrow("Admin portal session required");

    // 3. GET /products?scope=admin rejects unauthenticated and customer access
    const anonProductAdminReq = new NextRequest("https://api.store4riders.com/api/v1/products?scope=admin");
    await expect(ProductController.list(anonProductAdminReq)).rejects.toThrow("No access token provided");

    // 4. Backend /docs middleware rejects static forged cookie value "authenticated"
    const forgedDocsReq = new NextRequest("https://api.store4riders.com/docs", {
      headers: { cookie: "docs_auth_session=authenticated" },
    });
    const docsRes = await backendEdgeMiddleware(forgedDocsReq);
    expect(docsRes.status).toBe(307);
    expect(docsRes.headers.get("location")).toContain("/docs/login");
  });
});
