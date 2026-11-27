import { describe, it, expect, vi, beforeEach } from "vitest";
import { CCavenueGateway } from "../CCavenueGateway";
import { ENV } from "../../config/env";
import crypto from "crypto";

describe("CCavenueGateway", () => {
  const gateway = new CCavenueGateway();
  const testWorkingKey = "12345678901234567890123456789012"; // 32 chars

  function encryptResponse(data: string, workingKey: string): string {
    const m = crypto.createHash("md5");
    m.update(workingKey);
    const key = m.digest();
    const iv = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f]);
    const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
  }

  beforeEach(() => {
    process.env.CCAVENUE_MERCHANT_ID = "88305";
    process.env.CCAVENUE_ACCESS_CODE = "AVDL81FJ12BN26LDNB";
    process.env.CCAVENUE_WORKING_KEY = testWorkingKey;
    process.env.CCAVENUE_MODE = "live";
    (ENV as any).CCAVENUE_MODE = "live";
    (ENV as any).CCAVENUE_WORKING_KEY = testWorkingKey;
    process.env.API_URL = "http://localhost:4000";
    process.env.FRONTEND_URL = "http://localhost:3000";
  });

  it("should generate encrypted payload and correct live actionUrl", async () => {
    const mockOrder: any = {
      orderNumber: "OD-S4R-2610100088",
      shippingAddress: {
        fullName: "Vikram Kumar",
        street: "Sector 14",
        city: "Gurugram",
        state: "Haryana",
        pincode: "122001",
        country: "India",
        phone: "9876543210",
      },
      userEmail: "test@example.com",
    };

    const result = await gateway.createOrder(mockOrder, 1500);

    expect(result.gatewayOrderId).toBe("OD-S4R-2610100088");
    expect(result.gatewayResponse.access_code).toBe("AVDL81FJ12BN26LDNB");
    expect(result.gatewayResponse.actionUrl).toBe(
      "https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction"
    );

    // Decrypt the encRequest to verify its inner query string structure
    const encRequest = result.gatewayResponse.encRequest;
    const m = crypto.createHash("md5");
    m.update(testWorkingKey);
    const key = m.digest();
    const iv = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f]);
    const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
    let decrypted = decipher.update(encRequest, "hex", "utf8");
    decrypted += decipher.final("utf8");

    // Verify key parameters are present and uncorrupted
    expect(decrypted).toContain("tid=");
    expect(decrypted).toContain("merchant_id=88305");
    expect(decrypted).toContain("order_id=OD-S4R-2610100088");
    expect(decrypted).toContain("amount=1500.00");
    expect(decrypted).toContain("currency=INR");
    expect(decrypted).toContain("redirect_url=https://store4riders.com/api/v1/orders/webhook/ccavenue");
    expect(decrypted).toContain("cancel_url=https://store4riders.com/api/v1/orders/webhook/ccavenue/cancel");
    expect(decrypted).toContain("billing_name=Vikram Kumar");
    expect(decrypted).not.toContain("https%3A%2F%2F");
  });

  it("should point to test endpoint when mode is test", async () => {
    process.env.CCAVENUE_MODE = "test";
    (ENV as any).CCAVENUE_MODE = "test";

    const mockOrder: any = {
      orderNumber: "OD-TEST-001",
      shippingAddress: { fullName: "Tester", phone: "9999999999" },
    };

    const result = await gateway.createOrder(mockOrder, 500);
    expect(result.gatewayResponse.actionUrl).toBe(
      "https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction"
    );
  });

  it("should verify valid decrypted payment response", async () => {
    const rawData = "order_id=OD-S4R-2610100088&tracking_id=312009876543&order_status=Success&amount=1500.00&currency=INR";
    const encResp = encryptResponse(rawData, testWorkingKey);

    const mockPayment: any = { amount: 1500 };
    const result = await gateway.verifyPayment(mockPayment, { encResp });

    expect(result.success).toBe(true);
    expect(result.gatewayPaymentId).toBe("312009876543");
  });

  it("should reject verification if amount is tampered (less than expected)", async () => {
    const rawData = "order_id=OD-S4R-2610100088&tracking_id=312009876543&order_status=Success&amount=10.00&currency=INR";
    const encResp = encryptResponse(rawData, testWorkingKey);

    const mockPayment: any = { amount: 1500 };
    const result = await gateway.verifyPayment(mockPayment, { encResp });

    expect(result.success).toBe(false);
    expect(result.message).toBe("Amount mismatch detected");
  });

  it("should reject verification if currency is tampered (non-INR)", async () => {
    const rawData = "order_id=OD-S4R-2610100088&tracking_id=312009876543&order_status=Success&amount=1500.00&currency=USD";
    const encResp = encryptResponse(rawData, testWorkingKey);

    const mockPayment: any = { amount: 1500 };
    const result = await gateway.verifyPayment(mockPayment, { encResp });

    expect(result.success).toBe(false);
    expect(result.message).toBe("Currency mismatch detected");
  });

  it("should decrypt and parse S2S webhook payload", async () => {
    const rawData = "order_id=OD-S4R-2610100088&tracking_id=312009876543&order_status=Success&amount=1500.00&bank_ref_no=HDFC123456";
    const encResp = encryptResponse(rawData, testWorkingKey);

    const body = `encResp=${encResp}`;
    const result = await gateway.handleWebhook({}, body);

    expect(result.event).toBe("payment.captured");
    expect(result.gatewayOrderId).toBe("OD-S4R-2610100088");
    expect(result.payload.id).toBe("312009876543");
    expect(result.payload.amount).toBe(1500);
    expect(result.payload.bankRefNo).toBe("HDFC123456");
  });

  it("should emit payment.pending with namespaced event ID for Awaited/Initiated CCAvenue webhook", async () => {
    const rawData = "order_id=OD-S4R-2610100089&tracking_id=312009876544&order_status=Awaited&amount=1500.00";
    const encResp = encryptResponse(rawData, testWorkingKey);

    const result = await gateway.handleWebhook({}, `encResp=${encResp}`);

    expect(result.event).toBe("payment.pending");
    expect(result.id).toBe("312009876544:payment.pending");
    expect(result.payload.isCancelled).toBe(false);
  });

  it("should mark Aborted CCAvenue webhook as isCancelled=true", async () => {
    const rawData = "order_id=OD-S4R-2610100090&tracking_id=312009876545&order_status=Aborted&amount=1500.00";
    const encResp = encryptResponse(rawData, testWorkingKey);

    const result = await gateway.handleWebhook({}, `encResp=${encResp}`);

    expect(result.event).toBe("payment.failed");
    expect(result.id).toBe("312009876545:payment.failed");
    expect(result.payload.isCancelled).toBe(true);
  });

  it("should emit payment.failed with isCancelled=false for declined Failure status", async () => {
    const rawData = "order_id=OD-S4R-2610100091&tracking_id=312009876546&order_status=Failure&status_message=Bank+declined&amount=1500.00";
    const encResp = encryptResponse(rawData, testWorkingKey);

    const result = await gateway.handleWebhook({}, `encResp=${encResp}`);

    expect(result.event).toBe("payment.failed");
    expect(result.payload.isCancelled).toBe(false);
    expect(result.payload.statusMessage).toBe("Bank declined");
  });

  it("should emit payment.pending when CCAvenue webhook order_status is empty", async () => {
    const rawData = "order_id=OD-S4R-2610100092&tracking_id=312009876547&amount=1500.00";
    const encResp = encryptResponse(rawData, testWorkingKey);

    const result = await gateway.handleWebhook({}, `encResp=${encResp}`);

    expect(result.event).toBe("payment.pending");
    expect(result.id).toBe("312009876547:payment.pending");
  });

  it("should reject corrupted encResp payloads cleanly", async () => {
    await expect(gateway.handleWebhook({}, "encResp=deadbeefnotvalid")).rejects.toThrow();
  });

  it("should gracefully handle plaintext status=1 response in getPaymentStatus", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      text: async () => "status=1&enc_response=Order Not Found",
    } as any);

    const status = await gateway.getPaymentStatus("OD-S4R-MISSING");
    expect(status.order_status).toBe("unknown");
    expect(status.status_message).toContain("Order Not Found");

    fetchSpy.mockRestore();
  });

  it("should decrypt valid status=0 Order_Status_Result JSON in getPaymentStatus", async () => {
    const jsonPayload = JSON.stringify({
      Order_Status_Result: { order_no: "OD-S4R-100", order_status: "Shipped", reference_no: "998877", order_amt: "1500.00" },
    });
    const encResp = encryptResponse(jsonPayload, testWorkingKey);

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      text: async () => `status=0&enc_response=${encResp}`,
    } as any);

    const status = await gateway.getPaymentStatus("OD-S4R-100");
    expect(status.Order_Status_Result.order_status).toBe("Shipped");
    expect(status.Order_Status_Result.reference_no).toBe("998877");

    fetchSpy.mockRestore();
  });

  it("should emit refund.processed for CCAvenue Refunded webhook with deterministic dedup ID", async () => {
    const rawData = "order_id=OD-S4R-REF1&order_status=Refunded&amount=750.00&bank_ref_no=ARN1122";
    const encResp = encryptResponse(rawData, testWorkingKey);

    const r1 = await gateway.handleWebhook({}, `encResp=${encResp}`);
    const r2 = await gateway.handleWebhook({}, `encResp=${encResp}`);

    expect(r1.event).toBe("refund.processed");
    expect(r1.payload.amount).toBe(750);
    expect(r1.id).toBe(r2.id);
  });

  it("should emit payment.disputed for CCAvenue chargeback or high risk webhooks", async () => {
    const rawData = "order_id=OD-S4R-RISK1&tracking_id=312009876999&order_status=Success&risk_status=High&amount=2500.00";
    const encResp = encryptResponse(rawData, testWorkingKey);

    const res = await gateway.handleWebhook({}, `encResp=${encResp}`);
    expect(res.event).toBe("payment.disputed");
    expect(res.payload.disputeId).toBe("312009876999");
  });
});
