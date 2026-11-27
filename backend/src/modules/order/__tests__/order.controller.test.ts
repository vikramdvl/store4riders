import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { OrderController } from "../order.controller";
import { OrderService } from "../order.service";
import { OrderValidator } from "../order.validator";
import { UserService } from "../../user/user.service";

vi.mock("../order.service", () => ({
  OrderService: {
    handleWebhook: vi.fn(),
    syncPaymentStatus: vi.fn(),
  },
}));

vi.mock("../../audit-log/audit-log.service", () => ({
  AuditLogService: {
    record: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../core/config/env", () => ({
  ENV: {
    FRONTEND_URL: "https://www.store4riders.com/",
  },
}));

function makeWebhookReq(url: string, body: string): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

describe("OrderController.webhook PayU redirect reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects straight to checkout success when S2S sync confirms a pending PayU callback", async () => {
    vi.mocked(OrderService.handleWebhook).mockResolvedValue({
      success: false,
      isPending: true,
      isCancelled: false,
      isExchangeFee: false,
      orderNumber: "OD-S4R-2611001",
      orderId: "ord_1",
      eventName: "payment.pending",
      message: "Pending",
    } as any);

    vi.mocked(OrderService.syncPaymentStatus).mockResolvedValue({
      status: "confirmed",
      orderNumber: "OD-S4R-2611001",
      isConfirmed: true,
      isPending: false,
      isCancelled: false,
      gatewayStatus: "confirmed",
      message: "Confirmed",
    } as any);

    const req = makeWebhookReq(
      "https://api.store4riders.com/api/v1/orders/webhook/payu/failure",
      "txnid=T123&status=pending&unmappedstatus=in+progress"
    );
    const res = await OrderController.webhook(req, ["webhook", "payu", "failure"]);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://www.store4riders.com/checkout?success=true&orderId=OD-S4R-2611001"
    );
  });

  it("redirects to checkout?verifying=true when PayU is still pending bank settlement", async () => {
    vi.mocked(OrderService.handleWebhook).mockResolvedValue({
      success: false,
      isPending: true,
      isCancelled: false,
      isExchangeFee: false,
      orderNumber: "OD-S4R-2611002",
      orderId: "ord_2",
      eventName: "payment.pending",
      message: "Pending",
    } as any);

    vi.mocked(OrderService.syncPaymentStatus).mockResolvedValue({
      status: "pending_payment",
      orderNumber: "OD-S4R-2611002",
      isConfirmed: false,
      isPending: true,
      isCancelled: false,
      gatewayStatus: "pending",
      message: "Still pending",
    } as any);

    const req = makeWebhookReq(
      "https://api.store4riders.com/api/v1/orders/webhook/payu/failure",
      "txnid=T124&status=pending"
    );
    const res = await OrderController.webhook(req, ["webhook", "payu", "failure"]);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://www.store4riders.com/checkout?verifying=true&orderId=OD-S4R-2611002"
    );
  });

  it("redirects to checkout?verifying=true if surl webhook throws signature/db error before S2S settles", async () => {
    vi.mocked(OrderService.handleWebhook).mockRejectedValue(new Error("Invalid PayU webhook signature"));
    vi.mocked(OrderService.syncPaymentStatus).mockResolvedValue({
      status: "pending_payment",
      orderNumber: "OD-S4R-2611003",
      isConfirmed: false,
      isPending: true,
      isCancelled: false,
      gatewayStatus: "pending",
      message: "Pending",
    } as any);

    const req = makeWebhookReq(
      "https://api.store4riders.com/api/v1/orders/webhook/payu/success",
      "txnid=T125&status=success"
    );
    const res = await OrderController.webhook(req, ["webhook", "payu", "success"]);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://www.store4riders.com/checkout?verifying=true&orderId=OD-S4R-2611003"
    );
  });

  it("redirects to checkout?cancelled=true when user explicitly cancels at PayU", async () => {
    vi.mocked(OrderService.handleWebhook).mockResolvedValue({
      success: false,
      isPending: false,
      isCancelled: true,
      isExchangeFee: false,
      orderNumber: "OD-S4R-2611004",
      orderId: "ord_4",
      eventName: "payment.failed",
      message: "Cancelled",
    } as any);

    const req = makeWebhookReq(
      "https://api.store4riders.com/api/v1/orders/webhook/payu/cancel",
      "txnid=T126&status=failure&unmappedstatus=userCancelled"
    );
    const res = await OrderController.webhook(req, ["webhook", "payu", "cancel"]);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://www.store4riders.com/checkout?cancelled=true&orderId=OD-S4R-2611004"
    );
    expect(OrderService.syncPaymentStatus).not.toHaveBeenCalled();
  });

  it("redirects to checkout?failed=true only when furl reports definitive bank failure", async () => {
    vi.mocked(OrderService.handleWebhook).mockResolvedValue({
      success: false,
      isPending: false,
      isCancelled: false,
      isExchangeFee: false,
      orderNumber: "OD-S4R-2611005",
      orderId: "ord_5",
      eventName: "payment.failed",
      message: "Failed",
    } as any);

    vi.mocked(OrderService.syncPaymentStatus).mockResolvedValue({
      status: "failed",
      orderNumber: "OD-S4R-2611005",
      isConfirmed: false,
      isPending: false,
      isCancelled: false,
      gatewayStatus: "failed",
      message: "Bank declined",
    } as any);

    const req = makeWebhookReq(
      "https://api.store4riders.com/api/v1/orders/webhook/payu/failure",
      "txnid=T127&status=failure&unmappedstatus=failed"
    );
    const res = await OrderController.webhook(req, ["webhook", "payu", "failure"]);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://www.store4riders.com/checkout?failed=true&orderId=OD-S4R-2611005"
    );
  });

  it("redirects CCAvenue Awaited callback to checkout?verifying=true when S2S stays pending", async () => {
    vi.mocked(OrderService.handleWebhook).mockResolvedValue({
      success: false,
      isPending: true,
      isCancelled: false,
      isExchangeFee: false,
      orderNumber: "OD-S4R-2611006",
      orderId: "ord_6",
      eventName: "payment.pending",
      message: "Pending",
    } as any);

    vi.mocked(OrderService.syncPaymentStatus).mockResolvedValue({
      status: "pending_payment",
      orderNumber: "OD-S4R-2611006",
      isConfirmed: false,
      isPending: true,
      isCancelled: false,
      gatewayStatus: "pending",
      message: "Awaited",
    } as any);

    const req = makeWebhookReq(
      "https://api.store4riders.com/api/v1/orders/webhook/ccavenue",
      "encResp=dummy&orderNo=OD-S4R-2611006"
    );
    const res = await OrderController.webhook(req, ["webhook", "ccavenue"]);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://www.store4riders.com/checkout?verifying=true&orderId=OD-S4R-2611006"
    );
  });

  it("redirects Snapmint failure callback to checkout?success=true if S2S confirms authorization", async () => {
    vi.mocked(OrderService.handleWebhook).mockResolvedValue({
      success: false,
      isPending: false,
      isCancelled: false,
      isExchangeFee: false,
      orderNumber: "OD-S4R-2611007",
      orderId: "ord_7",
      eventName: "payment.failed",
      message: "Pending settlement",
    } as any);

    vi.mocked(OrderService.syncPaymentStatus).mockResolvedValue({
      status: "confirmed",
      orderNumber: "OD-S4R-2611007",
      isConfirmed: true,
      isPending: false,
      isCancelled: false,
      gatewayStatus: "confirmed",
      message: "Confirmed",
    } as any);

    const req = makeWebhookReq(
      "https://api.store4riders.com/api/v1/orders/webhook/snapmint/failure",
      "merchantOrderId=OD-S4R-2611007&status=pending"
    );
    const res = await OrderController.webhook(req, ["webhook", "snapmint", "failure"]);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://www.store4riders.com/checkout?success=true&orderId=OD-S4R-2611007"
    );
  });

  it("redirects exchange fee pending callback to account order details with ?exchangeFeePaid=pending", async () => {
    vi.mocked(OrderService.handleWebhook).mockResolvedValue({
      success: false,
      isPending: true,
      isCancelled: false,
      isExchangeFee: true,
      orderNumber: "OD-S4R-EX1",
      orderId: "ord_ex_1",
      eventName: "payment.pending",
      message: "Pending",
    } as any);

    vi.mocked(OrderService.syncPaymentStatus).mockResolvedValue({
      status: "return_approved",
      orderNumber: "OD-S4R-EX1",
      isConfirmed: false,
      isPending: true,
      isCancelled: false,
      isExchangeFee: true,
      gatewayStatus: "pending",
      message: "Pending",
    } as any);

    const req = makeWebhookReq(
      "https://api.store4riders.com/api/v1/orders/webhook/payu/failure",
      "txnid=EX-123&status=pending"
    );
    const res = await OrderController.webhook(req, ["webhook", "payu", "failure"]);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://www.store4riders.com/account/orders/OD-S4R-EX1?exchangeFeePaid=pending"
    );
  });

  it("validates syncPaymentStatus request payload against missing/non-string orderId", async () => {
    const emptyReq = new NextRequest("https://api.store4riders.com/api/v1/orders/sync-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "   " }),
    });
    await expect(OrderController.syncPaymentStatus(emptyReq)).rejects.toThrow();

    const nosqlReq = new NextRequest("https://api.store4riders.com/api/v1/orders/sync-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: { $ne: "" } }),
    });
    await expect(OrderController.syncPaymentStatus(nosqlReq)).rejects.toThrow();
  });

  it("allows staff/admin callers to sync any customer order while preserving customer scoping", async () => {
    vi.spyOn(OrderValidator, "validateSyncPayment")
      .mockResolvedValueOnce({ userId: "admin_1", orderId: "OD-CUST-1" })
      .mockResolvedValueOnce({ userId: "cust_2", orderId: "OD-CUST-1" });
    vi.spyOn(UserService, "getRole")
      .mockResolvedValueOnce("super_admin")
      .mockResolvedValueOnce("customer");
    vi.mocked(OrderService.syncPaymentStatus).mockResolvedValue({
      status: "confirmed",
      orderNumber: "OD-CUST-1",
      isConfirmed: true,
      gatewayStatus: "confirmed",
      message: "Confirmed",
    } as any);

    const reqAdmin = new NextRequest("https://api.store4riders.com/api/v1/orders/sync-payment", { method: "POST" });
    await OrderController.syncPaymentStatus(reqAdmin);
    expect(OrderService.syncPaymentStatus).toHaveBeenCalledWith("OD-CUST-1", undefined);

    const reqCustomer = new NextRequest("https://api.store4riders.com/api/v1/orders/sync-payment", { method: "POST" });
    await OrderController.syncPaymentStatus(reqCustomer);
    expect(OrderService.syncPaymentStatus).toHaveBeenCalledWith("OD-CUST-1", "cust_2");
  });

  it("enforces S2S webhook IP allowlist on /webhook/{gateway}/s2s and returns JSON when allowed", async () => {
    const prevAllowlist = process.env.PAYU_WEBHOOK_ALLOWED_IPS;
    process.env.PAYU_WEBHOOK_ALLOWED_IPS = "180.179.174.1";

    try {
      const blockedReq = new NextRequest("https://api.store4riders.com/api/v1/orders/webhook/payu/s2s", {
        method: "POST",
        headers: { "x-real-ip": "1.2.3.4" },
        body: "txnid=T1&status=success",
      });
      const blockedRes = await OrderController.webhook(blockedReq, ["webhook", "payu", "s2s"]);
      expect(blockedRes.status).toBe(403);

      vi.mocked(OrderService.handleWebhook).mockResolvedValue({
        success: true,
        orderNumber: "OD-S2S-1",
        eventName: "payment.captured",
      } as any);

      const allowedReq = new NextRequest("https://api.store4riders.com/api/v1/orders/webhook/payu/s2s", {
        method: "POST",
        headers: { "x-real-ip": "180.179.174.1" },
        body: "txnid=T1&status=success",
      });
      const allowedRes = await OrderController.webhook(allowedReq, ["webhook", "payu", "s2s"]);
      expect(allowedRes.status).toBe(200);
    } finally {
      if (prevAllowlist === undefined) {
        delete process.env.PAYU_WEBHOOK_ALLOWED_IPS;
      } else {
        process.env.PAYU_WEBHOOK_ALLOWED_IPS = prevAllowlist;
      }
    }
  });
});
