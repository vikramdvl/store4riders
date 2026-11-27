import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderService } from "../order.service";
import { OrderRepository } from "../order.repository";
import { ProductRepository } from "../../product/product.repository";
import { PaymentRepository } from "../../payment/payment.repository";
import { PaymentGatewayFactory } from "../../../core/payments/PaymentGatewayFactory";
import { CartService } from "../../cart/cart.service";
import { CouponService } from "../../coupon/coupon.service";
import { addEmailJob } from "../../../core/queue/email.queue";

vi.mock("../order.repository");
vi.mock("../../product/product.repository");
vi.mock("../../payment/payment.repository");
vi.mock("../../../core/payments/PaymentGatewayFactory");
vi.mock("../../cart/cart.service", () => ({
  CartService: { clearCart: vi.fn().mockResolvedValue(true) },
}));
vi.mock("../../coupon/coupon.service", () => ({
  CouponService: { incrementUsage: vi.fn().mockResolvedValue(true) },
}));
vi.mock("../../user/user.repository", () => ({
  UserRepository: { findById: vi.fn().mockResolvedValue({ email: "rider@store4riders.com" }) },
}));
vi.mock("../../../core/queue/email.queue", () => ({
  addEmailJob: vi.fn(),
}));
vi.mock("../../../core/config/env", () => ({
  ENV: { PAYU_MERCHANT_KEY: "test_key", PAYU_SALT: "test_salt" },
}));
vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    default: {
      ...(actual.default || actual),
      models: {},
      model: vi.fn(),
      startSession: vi.fn().mockResolvedValue({
        withTransaction: vi.fn().mockImplementation(async (cb: any) => cb()),
        endSession: vi.fn().mockResolvedValue(true),
      }),
    },
  };
});

describe("OrderService Payment & Reconciliation Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Security: Amount tampering & IDOR checks", () => {
    it("blocks NaN amount string in webhook payload (cannot bypass numeric comparison)", async () => {
      const mockOrder = {
        _id: "ord_nan",
        orderNumber: "OD-NAN-1",
        status: "pending_payment",
        items: [{ productId: "prod1", quantity: 1 }],
      };
      const mockPayment = {
        _id: "pay_nan",
        gatewayOrderId: "txn_nan",
        status: "created",
        gateway: "payu",
        amount: 2500,
      };

      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(mockOrder as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(mockPayment as any);
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue({
        handleWebhook: vi.fn().mockResolvedValue({
          event: "payment.captured",
          gatewayOrderId: "txn_nan",
          payload: { id: "mih_nan", amount: NaN },
        }),
      } as any);

      await OrderService.handleWebhook("raw", {}, "payu");

      expect(ProductRepository.decrementStock).not.toHaveBeenCalled();
      expect(OrderRepository.updateStatus).toHaveBeenCalledWith(
        "ord_nan",
        "failed",
        expect.objectContaining({ failureReason: expect.stringContaining("Amount tampering detected") }),
        expect.anything()
      );
    });

    it("rejects syncPaymentStatus when caller userId does not own the order (IDOR protection)", async () => {
      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "ord_owner",
        orderNumber: "OD-OWNER-1",
        userId: "user_real_owner",
        status: "pending_payment",
      } as any);

      await expect(OrderService.syncPaymentStatus("OD-OWNER-1", "user_attacker")).rejects.toThrow(
        "Unauthorized access to this order"
      );
    });

    it("rejects underpaid amount during PayU and Snapmint S2S syncPaymentStatus", async () => {
      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "ord_amt",
        orderNumber: "OD-AMT-1",
        status: "pending_payment",
        paymentMethod: "snapmint",
        gatewayOrderId: "OD-AMT-1",
      } as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "pay_amt",
        gateway: "snapmint",
        gatewayOrderId: "OD-AMT-1",
        amount: 10000,
        status: "created",
      } as any);
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue({
        getPaymentStatus: vi.fn().mockResolvedValue({
          status: "AUTHORIZED",
          id: "snap_low",
          orderValue: "50",
        }),
      } as any);

      const res = await OrderService.syncPaymentStatus("OD-AMT-1");
      expect(res.isConfirmed).toBe(false);
      expect(res.isPending).toBe(false);
      expect(res.failureReason).toBe("Amount mismatch detected");
      expect(OrderRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe("Concurrency: Atomic single-capture guarantee", () => {
    it("rolls back stock and skips duplicate confirmation if handleWebhook loses atomic payment race", async () => {
      const mockOrder = {
        _id: "ord_race_wh",
        orderNumber: "OD-RACE-WH",
        userId: "user_1",
        status: "pending_payment",
        pricing: { couponCode: "RIDE10" },
        items: [{ productId: "prod_1", variantId: "var_1", quantity: 2 }],
      };
      const mockPayment = {
        _id: "pay_race_wh",
        gatewayOrderId: "txn_race_wh",
        status: "pending",
        gateway: "ccavenue",
        amount: 3000,
      };

      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(mockOrder as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(mockPayment as any);
      vi.mocked(ProductRepository.decrementStock).mockResolvedValue(true as any);
      vi.mocked(PaymentRepository.atomicStatusTransition).mockResolvedValue(null as any);
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue({
        handleWebhook: vi.fn().mockResolvedValue({
          event: "payment.captured",
          gatewayOrderId: "txn_race_wh",
          payload: { id: "track_1", amount: 3000 },
        }),
      } as any);

      await OrderService.handleWebhook("raw", {}, "ccavenue");

      expect(ProductRepository.incrementStock).toHaveBeenCalledWith("prod_1", "var_1", 2, expect.anything());
      expect(OrderRepository.updateStatus).not.toHaveBeenCalledWith(
        "ord_race_wh",
        "confirmed",
        expect.anything(),
        expect.anything()
      );
      expect(CouponService.incrementUsage).not.toHaveBeenCalled();
      expect(CartService.clearCart).not.toHaveBeenCalled();
      expect(addEmailJob).not.toHaveBeenCalled();
    });

    it("rolls back stock and skips duplicate confirmation if verifyPayment loses atomic payment race", async () => {
      const mockOrder = {
        _id: "ord_race_vf",
        userId: "user_1",
        status: "pending_payment",
        items: [{ productId: "prod_2", quantity: 1 }],
      };
      const mockPayment = {
        _id: "pay_race_vf",
        gatewayOrderId: "OD-VF-1",
        status: "pending",
        gateway: "snapmint",
        amount: 4500,
      };

      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(mockOrder as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(mockPayment as any);
      vi.mocked(ProductRepository.decrementStock).mockResolvedValue(true as any);
      vi.mocked(PaymentRepository.atomicStatusTransition).mockResolvedValue(null as any);
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue({
        verifyPayment: vi.fn().mockResolvedValue({ success: true, gatewayPaymentId: "snap_pay_1" }),
      } as any);

      await OrderService.verifyPayment("user_1", "OD-VF-1", "snap_pay_1", "sig");

      expect(ProductRepository.incrementStock).toHaveBeenCalledWith("prod_2", undefined, 1, expect.anything());
      expect(OrderRepository.updateStatus).not.toHaveBeenCalled();
      expect(addEmailJob).not.toHaveBeenCalled();
    });
  });

  describe("Late Webhook & Cron Stale Order Recovery", () => {
    it("recovers an order previously marked failed when a valid late capture webhook arrives", async () => {
      const failedOrder = {
        _id: "ord_late_1",
        orderNumber: "OD-LATE-1",
        userId: "user_late",
        status: "failed",
        items: [{ productId: "prod_late", quantity: 1 }],
      };
      const failedPayment = {
        _id: "pay_late_1",
        gatewayOrderId: "txn_late_1",
        status: "failed",
        gateway: "payu",
        amount: 1999,
      };

      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(failedOrder as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(failedPayment as any);
      vi.mocked(ProductRepository.decrementStock).mockResolvedValue(true as any);
      vi.mocked(PaymentRepository.atomicStatusTransition).mockResolvedValue(failedPayment as any);
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue({
        handleWebhook: vi.fn().mockResolvedValue({
          event: "payment.captured",
          gatewayOrderId: "txn_late_1",
          payload: { id: "mih_late_1", amount: 1999 },
        }),
      } as any);

      const res = await OrderService.handleWebhook("raw", {}, "payu");

      expect(res.success).toBe(true);
      expect(PaymentRepository.atomicStatusTransition).toHaveBeenCalledWith(
        "pay_late_1",
        ["created", "pending", "failed"],
        "captured",
        { gatewayPaymentId: "mih_late_1" },
        expect.anything()
      );
      expect(OrderRepository.updateStatus).toHaveBeenCalledWith(
        "ord_late_1",
        "confirmed",
        { paymentId: "mih_late_1" },
        expect.anything()
      );
      expect(CartService.clearCart).toHaveBeenCalledWith("user_late", expect.anything());
    });

    it("cleanupAbandonedOrders reconciles with gateways before expiring stale pending_payment orders", async () => {
      const fortyMinsAgo = new Date(Date.now() - 40 * 60 * 1000);
      vi.mocked(OrderRepository.findStalePendingOrders).mockResolvedValue([
        { _id: "ord_recover", orderNumber: "OD-REC", paymentMethod: "payu", status: "pending_payment", createdAt: fortyMinsAgo },
        { _id: "ord_keep", orderNumber: "OD-KEEP", paymentMethod: "snapmint", status: "pending_payment", createdAt: fortyMinsAgo },
        { _id: "ord_expire", orderNumber: "OD-EXP", paymentMethod: "ccavenue", status: "pending_payment", createdAt: fortyMinsAgo },
      ] as any);

      const syncSpy = vi
        .spyOn(OrderService, "syncPaymentStatus")
        .mockResolvedValueOnce({ status: "confirmed", orderNumber: "OD-REC", isConfirmed: true, gatewayStatus: "confirmed", message: "ok" } as any)
        .mockResolvedValueOnce({ status: "pending_payment", orderNumber: "OD-KEEP", isConfirmed: false, isPending: true, gatewayStatus: "pending", message: "wait" } as any)
        .mockResolvedValueOnce({ status: "failed", orderNumber: "OD-EXP", isConfirmed: false, isPending: false, gatewayStatus: "failed", message: "declined" } as any);

      vi.mocked(OrderRepository.atomicStatusTransition).mockResolvedValue({ _id: "ord_expire", status: "failed" } as any);

      const expiredCount = await OrderService.cleanupAbandonedOrders();

      expect(syncSpy).toHaveBeenCalledTimes(3);
      expect(expiredCount).toBe(1);
      expect(OrderRepository.atomicStatusTransition).toHaveBeenCalledTimes(1);
      expect(OrderRepository.atomicStatusTransition).toHaveBeenCalledWith(
        "ord_expire",
        "pending_payment",
        "failed",
        expect.objectContaining({ failureReason: expect.any(String) })
      );

      syncSpy.mockRestore();
    });
  });

  describe("Industry Hardening: Atomic Webhook Claim, Snapmint S2S Auth & Sync Oversell Guard", () => {
    it("skips duplicate webhook processing atomically when claimWebhookEvent returns false", async () => {
      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "ord_dup",
        orderNumber: "OD-DUP-1",
        status: "pending_payment",
        items: [{ productId: "prod_1", quantity: 1 }],
      } as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "pay_dup",
        gatewayOrderId: "txn_dup",
        status: "created",
        gateway: "payu",
        amount: 1500,
      } as any);
      vi.mocked(PaymentRepository.claimWebhookEvent).mockResolvedValue(false as any);
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue({
        handleWebhook: vi.fn().mockResolvedValue({
          event: "payment.captured",
          gatewayOrderId: "txn_dup",
          id: "mih_dup",
          payload: { id: "mih_dup", amount: 1500 },
        }),
      } as any);

      await OrderService.handleWebhook("raw", {}, "payu");

      expect(ProductRepository.decrementStock).not.toHaveBeenCalled();
      expect(OrderRepository.updateStatus).not.toHaveBeenCalled();
    });

    it("blocks spoofed Snapmint capture webhook when S2S getPaymentStatus rejects it", async () => {
      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "ord_snap_spoof",
        orderNumber: "OD-SNAP-SPOOF",
        status: "pending_payment",
        items: [{ productId: "prod_1", quantity: 1 }],
      } as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "pay_snap_spoof",
        gatewayOrderId: "OD-SNAP-SPOOF",
        status: "created",
        gateway: "snapmint",
        amount: 25000,
      } as any);
      vi.mocked(PaymentRepository.claimWebhookEvent).mockResolvedValue(true as any);
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue({
        handleWebhook: vi.fn().mockResolvedValue({
          event: "payment.captured",
          gatewayOrderId: "OD-SNAP-SPOOF",
          id: "fake_id",
          payload: { id: "fake_id", amount: 25000 },
        }),
        getPaymentStatus: vi.fn().mockResolvedValue({
          status: "rejected",
          message: "Forged token",
        }),
      } as any);

      const res = await OrderService.handleWebhook("raw", {}, "snapmint");

      expect(res.success).toBe(false);
      expect(res.eventName).toBe("payment.failed");
      expect(ProductRepository.decrementStock).not.toHaveBeenCalled();
      expect(OrderRepository.updateStatus).toHaveBeenCalledWith(
        "ord_snap_spoof",
        "failed",
        expect.any(Object),
        expect.anything()
      );
    });

    it("downgrades Snapmint webhook capture to pending when S2S reports in_progress", async () => {
      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "ord_snap_pend",
        orderNumber: "OD-SNAP-PEND",
        status: "pending_payment",
        items: [{ productId: "prod_1", quantity: 1 }],
      } as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "pay_snap_pend",
        gatewayOrderId: "OD-SNAP-PEND",
        status: "created",
        gateway: "snapmint",
        amount: 25000,
      } as any);
      vi.mocked(PaymentRepository.claimWebhookEvent).mockResolvedValue(true as any);
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue({
        handleWebhook: vi.fn().mockResolvedValue({
          event: "payment.captured",
          gatewayOrderId: "OD-SNAP-PEND",
          id: "snap_1",
          payload: { id: "snap_1", amount: 25000 },
        }),
        getPaymentStatus: vi.fn().mockResolvedValue({
          status: "in_progress",
        }),
      } as any);

      const res = await OrderService.handleWebhook("raw", {}, "snapmint");

      expect(res.success).toBe(false);
      expect(res.isPending).toBe(true);
      expect(res.eventName).toBe("payment.pending");
      expect(ProductRepository.decrementStock).not.toHaveBeenCalled();
    });

    it("keeps PayU verify_payment 'Not Found' string response in pending state safely", async () => {
      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "ord_nf",
        orderNumber: "OD-NF-1",
        status: "pending_payment",
        paymentMethod: "payu",
        gatewayOrderId: "TXN_NF_1",
      } as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "pay_nf",
        gateway: "payu",
        gatewayOrderId: "TXN_NF_1",
        amount: 1200,
        status: "created",
      } as any);
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue({
        getPaymentStatus: vi.fn().mockResolvedValue({
          status: 0,
          transaction_details: {
            TXN_NF_1: "Not Found",
          },
        }),
      } as any);

      const res = await OrderService.syncPaymentStatus("TXN_NF_1");
      expect(res.isConfirmed).toBe(false);
      expect(res.isPending).toBe(true);
      expect(res.gatewayStatus).toBe("pending");
    });

    it("rolls back stock and triggers auto-refund if syncPaymentStatus captures an out-of-stock item", async () => {
      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "ord_oos",
        orderNumber: "OD-OOS-1",
        status: "pending_payment",
        paymentMethod: "payu",
        gatewayOrderId: "TXN_OOS_1",
        items: [
          { productId: "prod_a", variantId: "var_a", quantity: 1 },
          { productId: "prod_b", quantity: 1 },
        ],
      } as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "pay_oos",
        gateway: "payu",
        gatewayOrderId: "TXN_OOS_1",
        amount: 3500,
        status: "pending",
      } as any);
      vi.mocked(PaymentRepository.atomicStatusTransition).mockResolvedValue({ _id: "pay_oos" } as any);
      vi.mocked(ProductRepository.decrementStock)
        .mockResolvedValueOnce(true as any)
        .mockResolvedValueOnce(false as any);

      const initiateRefundMock = vi.fn().mockResolvedValue({ success: true });
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue({
        getPaymentStatus: vi.fn().mockResolvedValue({
          transaction_details: {
            TXN_OOS_1: { status: "success", mihpayid: "mih_oos_1", amt: "3500.00" },
          },
        }),
        initiateRefund: initiateRefundMock,
      } as any);

      const res = await OrderService.syncPaymentStatus("TXN_OOS_1");

      expect(ProductRepository.incrementStock).toHaveBeenCalledWith("prod_a", "var_a", 1, expect.anything());
      expect(OrderRepository.updateStatus).toHaveBeenCalledWith(
        "ord_oos",
        "failed",
        expect.objectContaining({ paymentId: "mih_oos_1" }),
        expect.anything()
      );
      expect(initiateRefundMock).toHaveBeenCalledTimes(1);
      expect(PaymentRepository.atomicStatusTransition).toHaveBeenCalledWith(
        "pay_oos",
        "captured",
        "refunded",
        { gatewayPaymentId: "mih_oos_1" }
      );
      expect(res.isConfirmed).toBe(false);
      expect(res.gatewayStatus).toBe("failed");
    });

    it("adds urgent manual refund alert note and email when auto-refund fails after stock exhaustion", async () => {
      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "ord_ref_fail",
        orderNumber: "OD-REF-FAIL-1",
        guestEmail: "buyer@store4riders.com",
        status: "pending_payment",
        paymentMethod: "ccavenue",
        gatewayOrderId: "OD-REF-FAIL-1",
        items: [{ productId: "prod_a", quantity: 1 }],
      } as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "pay_ref_fail",
        gateway: "ccavenue",
        gatewayOrderId: "OD-REF-FAIL-1",
        amount: 5500,
        status: "pending",
      } as any);
      vi.mocked(PaymentRepository.atomicStatusTransition).mockResolvedValue({ _id: "pay_ref_fail" } as any);
      vi.mocked(ProductRepository.decrementStock).mockResolvedValueOnce(false as any);

      vi.mocked(PaymentGatewayFactory.create).mockReturnValue({
        getPaymentStatus: vi.fn().mockResolvedValue({
          order_status: "Success",
          tracking_id: "cc_track_99",
          amount: "5500.00",
        }),
        initiateRefund: vi.fn().mockResolvedValue({
          success: false,
          message: "IP not whitelisted for refund",
        }),
      } as any);

      const res = await OrderService.syncPaymentStatus("OD-REF-FAIL-1");

      expect(res.isConfirmed).toBe(false);
      expect(res.failureReason).toContain("manual refund");
      expect(OrderRepository.addNote).toHaveBeenCalledWith(
        "ord_ref_fail",
        expect.objectContaining({
          author: "system",
          text: expect.stringContaining("[URGENT MANUAL REFUND REQUIRED]"),
        })
      );
      expect(addEmailJob).toHaveBeenCalledWith(
        "buyer@store4riders.com",
        expect.stringContaining("Refund Pending"),
        expect.stringContaining("manual")
      );
    });

    it("allows manual requestRefund on a failed order when payment is still captured", async () => {
      vi.mocked(OrderRepository.findById).mockResolvedValue({
        _id: "ord_manual_ref",
        orderNumber: "OD-MAN-REF",
        status: "failed",
        gatewayOrderId: "TXN_MAN_REF",
        items: [],
      } as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "pay_manual_ref",
        gateway: "payu",
        gatewayOrderId: "TXN_MAN_REF",
        gatewayPaymentId: "mih_man_ref",
        amount: 2000,
        status: "captured",
        refunds: [],
      } as any);
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue({
        initiateRefund: vi.fn().mockResolvedValue({ success: true, refundId: "ref_manual_1" }),
      } as any);

      const res = await OrderService.requestRefund("ord_manual_ref", 2000, "Stock exhausted fallback");

      expect(res.refundId).toBe("ref_manual_1");
      expect(PaymentRepository.atomicStatusTransition).toHaveBeenCalledWith(
        "pay_manual_ref",
        ["captured", "partially_refunded"],
        "refunded",
        {},
        expect.anything()
      );
      expect(ProductRepository.incrementStock).not.toHaveBeenCalled();
    });
  });

  describe("2026 Standards: Post-Commit Side Effects, Partial Refunds, Disputes & EOD Reconciliation", () => {
    it("executes external refund API outside DB transaction so TransientTransactionError retries never double-refund", async () => {
      const mongooseMod = (await import("mongoose")).default;
      let txAttempts = 0;
      vi.spyOn(mongooseMod, "startSession").mockResolvedValueOnce({
        withTransaction: vi.fn().mockImplementation(async (cb: any) => {
          txAttempts++;
          await cb(); // simulate retry on TransientTransactionError
          txAttempts++;
          await cb();
        }),
        endSession: vi.fn().mockResolvedValue(true),
      } as any);

      vi.mocked(OrderRepository.findById).mockResolvedValue({
        _id: "ord_tx_retry",
        orderNumber: "OD-TX-RETRY",
        guestEmail: "rider@store4riders.com",
        status: "confirmed",
        gatewayOrderId: "TXN_TX_RETRY",
        items: [{ productId: "prod_1", quantity: 1 }],
      } as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "pay_tx_retry",
        gateway: "payu",
        gatewayOrderId: "TXN_TX_RETRY",
        gatewayPaymentId: "mih_retry",
        amount: 3000,
        status: "captured",
        refunds: [],
      } as any);

      const initiateRefund = vi.fn().mockResolvedValue({ success: true, refundId: "ref_once_only" });
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue({ initiateRefund } as any);

      const res = await OrderService.requestRefund("ord_tx_retry", 3000, "Customer request");

      expect(txAttempts).toBe(2);
      expect(initiateRefund).toHaveBeenCalledTimes(1);
      expect(res.refundId).toBe("ref_once_only");
      expect(addEmailJob).toHaveBeenCalledTimes(1);
    });

    it("handles partial and full dashboard refund.processed webhooks accurately", async () => {
      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "ord_wh_part",
        orderNumber: "OD-WH-PART",
        guestEmail: "buyer@store4riders.com",
        status: "confirmed",
        items: [{ productId: "prod_wh", quantity: 1 }],
      } as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "pay_wh_part",
        gateway: "payu",
        gatewayOrderId: "TXN_WH_PART",
        amount: 2000,
        status: "captured",
        refunds: [],
      } as any);
      vi.mocked(PaymentRepository.claimWebhookEvent).mockResolvedValue(true);
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue({
        handleWebhook: vi.fn().mockResolvedValue({
          event: "refund.processed",
          gatewayOrderId: "TXN_WH_PART",
          id: "refund:mih_wh_part:500",
          payload: { id: "mih_wh_part", refundId: "ARN-PART-1", amount: 500 },
        }),
      } as any);

      await OrderService.handleWebhook("raw", {}, "payu");

      expect(PaymentRepository.atomicStatusTransition).toHaveBeenCalledWith(
        "pay_wh_part",
        ["captured", "partially_refunded"],
        "partially_refunded",
        {},
        expect.anything()
      );
      expect(ProductRepository.incrementStock).not.toHaveBeenCalled();
    });

    it("records chargeback dispute alert note idempotently on payment.disputed webhook", async () => {
      vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "ord_cb",
        orderNumber: "OD-CB-1",
        status: "delivered",
        items: [],
      } as any);
      vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue({
        _id: "pay_cb",
        gateway: "payu",
        gatewayOrderId: "TXN_CB_1",
        amount: 4500,
        status: "captured",
      } as any);
      vi.mocked(PaymentRepository.claimWebhookEvent).mockResolvedValue(true);
      vi.mocked(PaymentGatewayFactory.create).mockReturnValue({
        handleWebhook: vi.fn().mockResolvedValue({
          event: "payment.disputed",
          gatewayOrderId: "TXN_CB_1",
          id: "dispute:cb_99:open",
          payload: { disputeId: "cb_99", disputeStatus: "Open", reasonCode: "Fraud", amount: 4500, dueDate: "2026-12-05" },
        }),
      } as any);

      await OrderService.handleWebhook("raw", {}, "payu");

      expect(OrderRepository.addNote).toHaveBeenCalledWith(
        "ord_cb",
        expect.objectContaining({
          author: "system",
          text: expect.stringContaining("[CHARGEBACK / DISPUTE ALERT]"),
        }),
        expect.anything()
      );
    });

    it("reconcileDailySettlements recovers late captures and flags failed orders with captured unrefunded payments", async () => {
      vi.mocked(OrderRepository.findRecentFailedGatewayOrders).mockResolvedValue([
        { _id: "ord_eod_alert", orderNumber: "OD-EOD-1", gatewayOrderId: "TXN_EOD_1", status: "failed", paymentMethod: "payu" },
        { _id: "ord_eod_late", orderNumber: "OD-EOD-2", gatewayOrderId: "TXN_EOD_2", status: "failed", paymentMethod: "ccavenue" },
      ] as any);

      vi.mocked(PaymentRepository.findByGatewayOrderId)
        .mockResolvedValueOnce({ _id: "pay_eod_1", gatewayOrderId: "TXN_EOD_1", amount: 3000, status: "captured", refunds: [] } as any)
        .mockResolvedValueOnce({ _id: "pay_eod_2", gatewayOrderId: "TXN_EOD_2", amount: 2200, status: "pending", refunds: [] } as any);

      const syncSpy = vi.spyOn(OrderService, "syncPaymentStatus").mockResolvedValueOnce({ isConfirmed: true } as any);

      const metrics = await OrderService.reconcileDailySettlements();

      expect(metrics.checked).toBe(2);
      expect(metrics.pendingManualRefunds).toBe(1);
      expect(metrics.lateRecovered).toBe(1);
      syncSpy.mockRestore();
    });
  });
});
