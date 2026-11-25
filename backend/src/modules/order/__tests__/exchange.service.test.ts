import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderService } from "../order.service";
import { OrderRepository } from "../order.repository";
import { SettingRepository } from "../../settings/setting.repository";
import { PaymentRepository } from "../../payment/payment.repository";
import { ProductRepository } from "../../product/product.repository";
import { PaymentGatewayFactory } from "../../../core/payments/PaymentGatewayFactory";
import { ShipmentService } from "../../shipping/shipment.service";
import { UserRepository } from "../../user/user.repository";

vi.mock("../order.repository");
vi.mock("../../settings/setting.repository");
vi.mock("../../payment/payment.repository");
vi.mock("../../product/product.repository");
vi.mock("../../../core/payments/PaymentGatewayFactory");
vi.mock("../../shipping/shipment.service");
vi.mock("../../user/user.repository");
vi.mock("../../../core/queue/email.queue", () => ({
  addEmailJob: vi.fn(),
}));
vi.mock("../../../core/cache/redis", () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(true),
  deleteCache: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../../core/config/env", () => ({
  ENV: {
    FRONTEND_URL: "http://localhost:3000",
    PAYU_MERCHANT_KEY: "test_key",
    PAYU_SALT: "test_salt",
  },
}));
vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal<any>();
  const startSessionMock = vi.fn().mockResolvedValue({
    withTransaction: vi.fn().mockImplementation(async (cb: any) => cb()),
    endSession: vi.fn().mockResolvedValue(true),
  });
  return {
    ...actual,
    models: actual.models || {},
    model: actual.model || vi.fn(),
    startSession: startSessionMock,
    default: {
      ...(actual.default || actual),
      models: actual.default?.models || actual.models || {},
      model: actual.default?.model || actual.model || vi.fn(),
      startSession: startSessionMock,
    },
  };
});

describe("OrderService Exchange & Reverse Logistics Lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(SettingRepository.getSettings).mockResolvedValue({
      exchangeShippingFee: 299,
      enabledGateways: ["payu", "ccavenue"],
      upiMerchantVpa: "store4riders@icici",
    } as any);
    vi.mocked(UserRepository.findById).mockResolvedValue({
      _id: "user_1",
      email: "rider@example.com",
    } as any);
  });

  it("initializes structured exchangeDetails with configured fee when delivered order requests exchange", async () => {
    vi.mocked(OrderRepository.findById).mockResolvedValue({
      _id: "ord_1",
      orderNumber: "OD-S4R-1001",
      userId: "user_1",
      status: "delivered",
      items: [{ name: "Rynox Helmet", sku: "RYN-L", quantity: 1 }],
    } as any);
    vi.mocked(OrderRepository.updateExchangeDetails).mockResolvedValue({ status: "return_requested" } as any);

    await OrderService.requestReturn(
      "ord_1",
      "user_1",
      "Type: Size Too Small | Item(s): Rynox Helmet [L] | Replacement: Need Size XL | Note: Tight around cheeks"
    );

    expect(OrderRepository.updateExchangeDetails).toHaveBeenCalledWith(
      "ord_1",
      expect.objectContaining({
        stage: "requested",
        reasonType: "Size Too Small",
        desiredReplacement: "Need Size XL",
        customerNote: "Tight around cheeks",
        qcStatus: "pending",
        shippingFee: 299,
        shippingFeeStatus: "pending",
      }),
      "return_requested",
      expect.objectContaining({ author: "user_1" })
    );
  });

  it("rejects exchange request cleanly and keeps order delivered with audit stage", async () => {
    vi.mocked(OrderRepository.findById).mockResolvedValue({
      _id: "ord_1",
      orderNumber: "OD-S4R-1001",
      status: "return_requested",
      exchangeDetails: {
        stage: "requested",
        reasonType: "Size Too Small",
        desiredReplacement: "Size XL",
        customerNote: "Too tight",
        shippingFee: 299,
        shippingFeeStatus: "pending",
      },
    } as any);
    vi.mocked(OrderRepository.updateExchangeDetails).mockResolvedValue({ status: "delivered" } as any);

    await OrderService.adminHandleReturn("ord_1", "reject", "Outside 7-day exchange window");

    expect(OrderRepository.updateExchangeDetails).toHaveBeenCalledWith(
      "ord_1",
      expect.objectContaining({
        stage: "rejected",
        rejectionReason: "Outside 7-day exchange window",
      }),
      "delivered",
      expect.any(Object)
    );
  });

  it("triggers Shiprocket reverse pickup upon approval when selected", async () => {
    vi.mocked(OrderRepository.findById).mockResolvedValue({
      _id: "ord_1",
      orderNumber: "OD-S4R-1001",
      status: "return_requested",
      exchangeDetails: {
        stage: "requested",
        reasonType: "Size Too Small",
        desiredReplacement: "Size XL",
        customerNote: "Too tight",
        shippingFee: 299,
        shippingFeeStatus: "pending",
      },
    } as any);
    vi.mocked(ShipmentService.createExchangeReverseShipment).mockResolvedValue({
      awb: "REV-AWB-999",
      courierName: "Shiprocket Reverse",
      trackingUrl: "https://shiprocket.co/tracking/REV-AWB-999",
      shipment: { _id: "ship_rev_1" },
    });
    vi.mocked(OrderRepository.updateExchangeDetails).mockResolvedValue({ status: "return_approved" } as any);

    await OrderService.adminHandleReturn("ord_1", "approve", "Approved XL", {
      triggerCourier: "shiprocket",
      shippingFee: 349,
    });

    expect(ShipmentService.createExchangeReverseShipment).toHaveBeenCalledWith({
      orderId: "ord_1",
      provider: "shiprocket",
    });
    expect(OrderRepository.updateExchangeDetails).toHaveBeenCalledWith(
      "ord_1",
      expect.objectContaining({
        stage: "approved",
        reverseAwb: "REV-AWB-999",
        shippingFee: 349,
        shippingFeeStatus: "pending",
      }),
      "return_approved",
      expect.any(Object)
    );
  });

  it("blocks customer fee payment until warehouse QC passes", async () => {
    vi.mocked(OrderRepository.findById).mockResolvedValue({
      _id: "ord_1",
      orderNumber: "OD-S4R-1001",
      userId: "user_1",
      status: "return_picked",
      exchangeDetails: {
        stage: "picked_up",
        qcStatus: "pending",
        shippingFee: 299,
        shippingFeeStatus: "pending",
      },
    } as any);

    await expect(
      OrderService.initiateExchangeFeePayment("ord_1", "user_1", "payu")
    ).rejects.toThrow(/quality inspection/i);
  });

  it("blocks replacement dispatch when QC passed but shipping fee is still pending", async () => {
    vi.mocked(OrderRepository.findById).mockResolvedValue({
      _id: "ord_1",
      orderNumber: "OD-S4R-1001",
      status: "return_picked",
      exchangeDetails: {
        stage: "qc_passed",
        qcStatus: "passed",
        shippingFee: 299,
        shippingFeeStatus: "pending",
      },
    } as any);

    await expect(
      OrderService.adminDispatchReplacement("ord_1", "admin_1", { provider: "shiprocket" })
    ).rejects.toThrow(/Shipping fee/i);
    expect(ShipmentService.createExchangeReplacementShipment).not.toHaveBeenCalled();
  });

  it("handles exchange_fee webhook capture without mutating original order stock or confirmed status", async () => {
    const orderDoc = {
      _id: "ord_1",
      orderNumber: "OD-S4R-1001",
      userId: "user_1",
      status: "return_picked",
      items: [{ productId: "prod_1", quantity: 1 }],
      shippingAddress: { fullName: "Vikram" },
      exchangeDetails: {
        stage: "qc_passed",
        qcStatus: "passed",
        reasonType: "Size Too Small",
        desiredReplacement: "Size XL",
        customerNote: "Tight fit",
        shippingFee: 299,
        shippingFeeStatus: "pending",
        shippingFeeGatewayOrderId: "T1234567890",
      },
    };
    const feePayment = {
      _id: "pay_fee_1",
      orderId: "ord_1",
      amount: 299,
      gateway: "payu",
      gatewayOrderId: "T1234567890",
      paymentPurpose: "exchange_fee",
      status: "created",
    };

    vi.mocked(PaymentGatewayFactory.create).mockReturnValue({
      handleWebhook: vi.fn().mockResolvedValue({
        event: "payment.captured",
        gatewayOrderId: "T1234567890",
        payload: { id: "mihpay_fee_1", amount: 299 },
      }),
    } as any);
    vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(orderDoc as any);
    vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(feePayment as any);

    const res = await OrderService.handleWebhook("raw=1", {}, "payu");

    expect(res.success).toBe(true);
    expect(res.isExchangeFee).toBe(true);
    expect(ProductRepository.decrementStock).not.toHaveBeenCalled();
    expect(OrderRepository.updateStatus).not.toHaveBeenCalled();
    expect(PaymentRepository.atomicStatusTransition).toHaveBeenCalledWith(
      "pay_fee_1",
      ["created", "pending", "failed"],
      "captured",
      { gatewayPaymentId: "mihpay_fee_1" },
      expect.anything()
    );
    expect(OrderRepository.updateExchangeDetails).toHaveBeenCalledWith(
      "ord_1",
      expect.objectContaining({
        stage: "fee_settled",
        shippingFeeStatus: "paid_online",
        shippingFeePaymentRef: "mihpay_fee_1",
      }),
      undefined,
      expect.any(Object),
      expect.anything()
    );
  });

  it("rejects tampered exchange_fee webhook amount without unlocking dispatch", async () => {
    const orderDoc = {
      _id: "ord_1",
      orderNumber: "OD-S4R-1001",
      status: "return_picked",
      exchangeDetails: { stage: "qc_passed", qcStatus: "passed", shippingFee: 299, shippingFeeStatus: "pending" },
    };
    const feePayment = {
      _id: "pay_fee_1",
      orderId: "ord_1",
      amount: 299,
      gateway: "payu",
      gatewayOrderId: "T1234567890",
      paymentPurpose: "exchange_fee",
      status: "created",
    };

    vi.mocked(PaymentGatewayFactory.create).mockReturnValue({
      handleWebhook: vi.fn().mockResolvedValue({
        event: "payment.captured",
        gatewayOrderId: "T1234567890",
        payload: { id: "mihpay_tamper", amount: 1 },
      }),
    } as any);
    vi.mocked(OrderRepository.findByGatewayOrderId).mockResolvedValue(orderDoc as any);
    vi.mocked(PaymentRepository.findByGatewayOrderId).mockResolvedValue(feePayment as any);

    await OrderService.handleWebhook("raw=1", {}, "payu");

    expect(PaymentRepository.atomicStatusTransition).toHaveBeenCalledWith(
      "pay_fee_1",
      ["created", "pending"],
      "failed",
      {},
      expect.anything()
    );
    expect(OrderRepository.updateExchangeDetails).not.toHaveBeenCalled();
  });

  it("allows replacement dispatch with COD amount when admin marks cod_on_replacement", async () => {
    vi.mocked(OrderRepository.findById).mockResolvedValue({
      _id: "ord_1",
      orderNumber: "OD-S4R-1001",
      status: "return_picked",
      shippingAddress: { fullName: "Vikram" },
      exchangeDetails: {
        stage: "fee_settled",
        qcStatus: "passed",
        reasonType: "Size Too Small",
        desiredReplacement: "Size XL",
        customerNote: "Tight",
        shippingFee: 299,
        shippingFeeStatus: "cod_on_replacement",
      },
    } as any);
    vi.mocked(ShipmentService.createExchangeReplacementShipment).mockResolvedValue({
      awb: "FWD-AWB-777",
      courierName: "Shiprocket",
      trackingUrl: "https://shiprocket.co/tracking/FWD-AWB-777",
      shipment: { _id: "ship_fwd_1" },
    });
    vi.mocked(OrderRepository.updateExchangeDetails).mockResolvedValue({ status: "return_picked" } as any);

    await OrderService.adminDispatchReplacement("ord_1", "admin_1", {
      provider: "shiprocket",
      replacementVariant: "Size XL Matte Black",
      autoAssignAwb: true,
    });

    expect(ShipmentService.createExchangeReplacementShipment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "ord_1",
        provider: "shiprocket",
        isCodFee: true,
        codFeeAmount: 299,
        replacementVariant: "Size XL Matte Black",
      })
    );
    expect(OrderRepository.updateExchangeDetails).toHaveBeenCalledWith(
      "ord_1",
      expect.objectContaining({
        stage: "replacement_dispatched",
        replacementAwb: "FWD-AWB-777",
      }),
      "return_picked",
      expect.any(Object)
    );
  });

  it("supports Delhivery and Xpressbees reverse pickup selection during approval and pickup stage", async () => {
    vi.mocked(OrderRepository.findById).mockResolvedValue({
      _id: "ord_del_1",
      orderNumber: "OD-S4R-2001",
      status: "return_requested",
      exchangeDetails: {
        stage: "requested",
        reasonType: "Size Too Small",
        desiredReplacement: "Size L",
        customerNote: "Loose",
        shippingFee: 299,
        shippingFeeStatus: "pending",
      },
    } as any);
    vi.mocked(ShipmentService.createExchangeReverseShipment).mockResolvedValue({
      awb: "DELH-REV-123",
      courierName: "Delhivery Reverse",
      trackingUrl: "https://www.delhivery.com/track/package/DELH-REV-123",
      shipment: { _id: "ship_del_rev" },
    });
    vi.mocked(OrderRepository.updateExchangeDetails).mockResolvedValue({ status: "return_approved" } as any);

    await OrderService.adminHandleReturn("ord_del_1", "approve", "Using Delhivery", {
      triggerCourier: "delhivery",
      warehouseId: "wh_pune",
    });

    expect(ShipmentService.createExchangeReverseShipment).toHaveBeenCalledWith({
      orderId: "ord_del_1",
      provider: "delhivery",
      warehouseId: "wh_pune",
    });
    expect(OrderRepository.updateExchangeDetails).toHaveBeenCalledWith(
      "ord_del_1",
      expect.objectContaining({
        stage: "approved",
        reverseCourier: "Delhivery Reverse",
        reverseAwb: "DELH-REV-123",
      }),
      "return_approved",
      expect.any(Object)
    );

    vi.mocked(OrderRepository.findById).mockResolvedValue({
      _id: "ord_xb_1",
      orderNumber: "OD-S4R-2002",
      status: "return_approved",
      exchangeDetails: {
        stage: "approved",
        reasonType: "Size Too Small",
        desiredReplacement: "Size XL",
        customerNote: "Tight",
        shippingFee: 299,
        shippingFeeStatus: "pending",
      },
    } as any);
    vi.mocked(ShipmentService.createExchangeReverseShipment).mockResolvedValue({
      awb: "XB-REV-456",
      courierName: "Xpressbees Reverse",
      trackingUrl: "https://www.xpressbees.com/track?awb=XB-REV-456",
      shipment: { _id: "ship_xb_rev" },
    });

    await OrderService.adminExchangePickup("ord_xb_1", {
      action: "schedule_reverse",
      provider: "xpressbees",
      warehouseId: "wh_blr",
    });

    expect(ShipmentService.createExchangeReverseShipment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "ord_xb_1",
        provider: "xpressbees",
        warehouseId: "wh_blr",
      })
    );
  });

  it("lets admin choose COD vs Online Pay directly during QC pass and toggle COD back to PayU online mode", async () => {
    vi.mocked(OrderRepository.findById).mockResolvedValue({
      _id: "ord_qc_1",
      orderNumber: "OD-S4R-3001",
      userId: "user_1",
      status: "return_picked",
      exchangeDetails: {
        stage: "picked_up",
        qcStatus: "pending",
        shippingFee: 299,
        shippingFeeStatus: "pending",
      },
    } as any);
    vi.mocked(OrderRepository.updateExchangeDetails).mockResolvedValue({ status: "return_picked" } as any);

    await OrderService.adminSubmitExchangeQc("ord_qc_1", "admin_1", {
      result: "passed",
      tagsIntact: true,
      unusedCondition: true,
      packagingIntact: true,
      qcNotes: "Intact tags and box",
      shippingFee: 299,
      feeCollectionMode: "cod",
    });

    expect(OrderRepository.updateExchangeDetails).toHaveBeenCalledWith(
      "ord_qc_1",
      expect.objectContaining({
        stage: "fee_settled",
        qcStatus: "passed",
        shippingFeeStatus: "cod_on_replacement",
        shippingFeeCollectionMode: "cod",
      }),
      "return_picked",
      expect.any(Object)
    );

    vi.mocked(OrderRepository.findById).mockResolvedValue({
      _id: "ord_qc_1",
      orderNumber: "OD-S4R-3001",
      userId: "user_1",
      status: "return_picked",
      shippingAddress: { fullName: "Vikram" },
      exchangeDetails: {
        stage: "fee_settled",
        qcStatus: "passed",
        shippingFee: 299,
        shippingFeeStatus: "cod_on_replacement",
        shippingFeeCollectionMode: "cod",
      },
    } as any);

    await OrderService.adminSettleExchangeFee("ord_qc_1", "admin_1", {
      settlementMode: "online_pending",
      shippingFee: 299,
    });

    expect(OrderRepository.updateExchangeDetails).toHaveBeenCalledWith(
      "ord_qc_1",
      expect.objectContaining({
        stage: "qc_passed",
        shippingFeeStatus: "pending",
        shippingFeeCollectionMode: "online",
      }),
      undefined,
      expect.any(Object)
    );
  });

  it("enforces store returnWindowDays policy dynamically from Admin settings (not hardcoded 7 days)", async () => {
    // 1. Admin sets 3-day window -> 5-day-old order is rejected
    vi.mocked(SettingRepository.getSettings).mockResolvedValueOnce({
      exchangeShippingFee: 299,
      returnWindowDays: 3,
    } as any);
    vi.mocked(OrderRepository.findById).mockResolvedValueOnce({
      _id: "ord_old_1",
      orderNumber: "OD-S4R-OLD",
      userId: "user_1",
      status: "delivered",
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    } as any);

    await expect(
      OrderService.requestReturn("ord_old_1", "user_1", "Type: Size Too Small | Replacement: Size XL | Note: Need larger size")
    ).rejects.toThrow(/Exchange window of 3 days has expired/i);

    // 2. Admin sets 14-day window -> 10-day-old order is allowed!
    vi.mocked(SettingRepository.getSettings).mockResolvedValueOnce({
      exchangeShippingFee: 299,
      returnWindowDays: 14,
    } as any);
    vi.mocked(OrderRepository.findById).mockResolvedValueOnce({
      _id: "ord_14d",
      orderNumber: "OD-S4R-14D",
      userId: "user_1",
      status: "delivered",
      items: [{ name: "Helmet", sku: "H-1", quantity: 1 }],
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    } as any);
    vi.mocked(OrderRepository.updateExchangeDetails).mockResolvedValueOnce({ status: "return_requested" } as any);

    await OrderService.requestReturn(
      "ord_14d",
      "user_1",
      "Type: Size Too Small | Replacement: Size XL | Note: Need larger size within 14-day window"
    );
    expect(OrderRepository.updateExchangeDetails).toHaveBeenCalled();
  });

  it("preserves exchange filter $or when admin searches by customer or order number", async () => {
    vi.mocked(OrderRepository.findPaginated).mockResolvedValueOnce({ items: [], total: 0 });

    await OrderService.getAllAdmin({ status: "exchanges", search: "Vikram" }, 1, 20);

    const queryArg = vi.mocked(OrderRepository.findPaginated).mock.calls[0]?.[0];
    expect(Array.isArray(queryArg.$and)).toBe(true);
    expect(queryArg.$and).toHaveLength(2);
    expect(queryArg.$or).toBeUndefined();
  });

  it("passes exchange cancelUrl to CCAvenue gateway for clean fee payment cancellation redirect", async () => {
    vi.mocked(OrderRepository.findById).mockResolvedValueOnce({
      _id: "ord_cc_1",
      orderNumber: "OD-S4R-CC1",
      userId: "user_1",
      status: "return_picked",
      exchangeDetails: {
        stage: "qc_passed",
        qcStatus: "passed",
        shippingFee: 299,
        shippingFeeStatus: "pending",
      },
    } as any);
    const createOrderMock = vi.fn().mockResolvedValue({
      gatewayOrderId: "OD-S4R-CC1-EXF-9999",
      gatewayResponse: { encRequest: "enc", accessCode: "acc" },
    });
    vi.mocked(PaymentGatewayFactory.create).mockReturnValueOnce({ createOrder: createOrderMock } as any);

    await OrderService.initiateExchangeFeePayment("ord_cc_1", "user_1", "ccavenue");

    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelUrl: "http://localhost:3000/account/orders/ord_cc_1?exchangeFeePaid=false",
      }),
      299
    );
  });

  it("allows individual item-level exchanges on a multi-item order and passes only the selected item to reverse courier", async () => {
    vi.mocked(OrderRepository.findById).mockResolvedValueOnce({
      _id: "ord_multi_1",
      orderNumber: "OD-S4R-MULTI1",
      userId: "user_1",
      status: "return_approved",
      deliveredAt: new Date().toISOString(),
      items: [
        { _id: "itm_1", productId: "prod_helmet", variantId: "L", sku: "HLM-L", name: "Axor Helmet", quantity: 1, unitPrice: 4500 },
        { _id: "itm_2", productId: "prod_gloves", variantId: "M", sku: "GLV-M", name: "Rynox Gloves", quantity: 1, unitPrice: 2500 },
      ],
      exchanges: [
        {
          exchangeId: "ex_first",
          stage: "approved",
          reasonType: "Size Too Small",
          desiredReplacement: "XL",
          customerNote: "Helmet tight",
          shippingFee: 299,
          shippingFeeStatus: "pending",
          items: [{ orderItemId: "itm_1", productId: "prod_helmet", variantId: "L", sku: "HLM-L", name: "Axor Helmet", quantity: 1, unitPrice: 4500 }],
        },
      ],
    } as any);
    vi.mocked(OrderRepository.updateExchangeDetails).mockResolvedValueOnce({ status: "return_approved" } as any);

    await OrderService.requestReturn(
      "ord_multi_1",
      "user_1",
      "Type: Size Too Small | Item(s): Rynox Gloves [M] | Replacement: Size L | Note: Tight fingers",
      undefined,
      [{ orderItemId: "itm_2", productId: "prod_gloves", variantId: "M", sku: "GLV-M", name: "Rynox Gloves", quantity: 1, desiredReplacement: "Size L" }]
    );

    expect(OrderRepository.updateExchangeDetails).toHaveBeenCalledWith(
      "ord_multi_1",
      expect.objectContaining({
        stage: "requested",
        items: [
          expect.objectContaining({
            orderItemId: "itm_2",
            productId: "prod_gloves",
            sku: "GLV-M",
            name: "Rynox Gloves",
            quantity: 1,
          }),
        ],
      }),
      "return_approved",
      expect.objectContaining({ author: "user_1" })
    );

    // Reject duplicate exchange on the already-active item
    vi.mocked(OrderRepository.findById).mockResolvedValueOnce({
      _id: "ord_multi_1",
      orderNumber: "OD-S4R-MULTI1",
      userId: "user_1",
      status: "return_approved",
      deliveredAt: new Date().toISOString(),
      items: [
        { _id: "itm_1", productId: "prod_helmet", variantId: "L", sku: "HLM-L", name: "Axor Helmet", quantity: 1, unitPrice: 4500 },
        { _id: "itm_2", productId: "prod_gloves", variantId: "M", sku: "GLV-M", name: "Rynox Gloves", quantity: 1, unitPrice: 2500 },
      ],
      exchanges: [
        {
          exchangeId: "ex_first",
          stage: "approved",
          items: [{ orderItemId: "itm_1", productId: "prod_helmet", variantId: "L", sku: "HLM-L", name: "Axor Helmet", quantity: 1 }],
        },
      ],
    } as any);

    await expect(
      OrderService.requestReturn(
        "ord_multi_1",
        "user_1",
        "Type: Size Too Small | Replacement: Size XL | Note: Duplicate request",
        undefined,
        [{ orderItemId: "itm_1", productId: "prod_helmet", variantId: "L", sku: "HLM-L", name: "Axor Helmet", quantity: 1 }]
      )
    ).rejects.toThrow(/already has an active or completed exchange/i);

    // Approve second item exchange -> sends ONLY gloves item to reverse shipment
    vi.mocked(OrderRepository.findById).mockResolvedValueOnce({
      _id: "ord_multi_1",
      orderNumber: "OD-S4R-MULTI1",
      status: "return_approved",
      exchanges: [
        {
          exchangeId: "ex_first",
          stage: "approved",
          shippingFee: 299,
          shippingFeeStatus: "pending",
          items: [{ orderItemId: "itm_1", productId: "prod_helmet", sku: "HLM-L", name: "Axor Helmet", quantity: 1 }],
        },
        {
          exchangeId: "ex_second",
          stage: "requested",
          shippingFee: 299,
          shippingFeeStatus: "pending",
          items: [{ orderItemId: "itm_2", productId: "prod_gloves", sku: "GLV-M", name: "Rynox Gloves", quantity: 1 }],
        },
      ],
    } as any);
    vi.mocked(ShipmentService.createExchangeReverseShipment).mockResolvedValueOnce({
      awb: "REV-GLV-1",
      courierName: "Shiprocket Reverse",
      trackingUrl: "https://shiprocket.co/tracking/REV-GLV-1",
      shipment: { _id: "ship_rev_glv" },
    });
    vi.mocked(OrderRepository.updateExchangeDetails).mockResolvedValueOnce({ status: "return_approved" } as any);

    await OrderService.adminHandleReturn("ord_multi_1", "approve", "Approved gloves", {
      exchangeId: "ex_second",
      triggerCourier: "shiprocket",
    });

    expect(ShipmentService.createExchangeReverseShipment).toHaveBeenCalledWith({
      orderId: "ord_multi_1",
      provider: "shiprocket",
      exchangeItems: [expect.objectContaining({ productId: "prod_gloves", sku: "GLV-M", name: "Rynox Gloves" })],
    });
  });
});
