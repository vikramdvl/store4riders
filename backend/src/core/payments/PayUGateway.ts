import crypto from "crypto";
import { PaymentGateway, GatewayOrderResult, VerifyPaymentResult, RefundResult } from "./PaymentGateway";
import { IOrder, IPayment } from "@store4riders/shared-types";
import { ENV } from "../config/env";
import { AppError } from "../errors/AppError";
import { logger } from "../utils/logger";

function timingSafeCompare(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a.toLowerCase());
  const bufB = Buffer.from(b.toLowerCase());
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const PENDING_UNMAPPED_STATUSES = new Set([
  "pending",
  "initiated",
  "in progress",
  "in_progress",
  "auth",
]);

function parseWebhookBody(rawBody: string): Record<string, string> {
  const trimmed = (rawBody || "").trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed || {})) {
      if (v !== undefined && v !== null) {
        out[k] = String(v);
      }
    }
    return out;
  }
  const params = new URLSearchParams(rawBody);
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export class PayUGateway implements PaymentGateway {
  
  async createOrder(order: IOrder, amount: number): Promise<GatewayOrderResult> {
    const key = (ENV.PAYU_MERCHANT_KEY || process.env.PAYU_MERCHANT_KEY || "").trim();
    const salt = (ENV.PAYU_SALT || process.env.PAYU_SALT || "").trim();

    const isPlaceholder = (val: string) => !val || val.startsWith("your_") || val === "your_payu_key" || val === "your_payu_salt";
    if (isPlaceholder(key) || isPlaceholder(salt)) {
      throw new AppError("PayU credentials in backend/.env are missing or set to placeholder values ('your_payu_key'). Please update backend/.env with your real PayU Merchant Key and Salt.", 400);
    }
    
    // PayU txnid MUST be strictly <= 25 characters.
    // "T" (1) + Date.now() (13) + 4 random hex chars = 18 chars total.
    const txnid = `T${Date.now()}${crypto.randomBytes(2).toString("hex")}`;
    const productInfo = "Store4Riders Order";
    const firstName = (order.shippingAddress?.fullName?.split(" ")[0] || "Customer").replace(/\|/g, "").trim() || "Customer";
    const email = ((order as any).userEmail || order.guestEmail || `${firstName.toLowerCase()}@store4riders.com`).replace(/\|/g, "").trim();
    
    // PayU expects amount formatted with 2 decimal places (e.g. 5002.26)
    const formattedAmount = Number(amount).toFixed(2);
    const phone = order.shippingAddress?.phone?.replace(/\D/g, "").slice(-10) || "";

    // PayU Hash formula: sha512(key|txnid|amount|productinfo|firstname|email|||||||||||salt)
    const hashString = `${key}|${txnid}|${formattedAmount}|${productInfo}|${firstName}|${email}|||||||||||${salt}`;
    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    const rawApiUrl = (ENV.API_URL || ENV.NEXT_PUBLIC_API_URL || ENV.FRONTEND_URL || "").trim();
    if (!rawApiUrl) {
      throw new AppError("API_URL or FRONTEND_URL is not configured. PayU surl/furl cannot be generated.", 500);
    }
    const cleanApiBase = rawApiUrl.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");

    const mode = (ENV.PAYU_MODE || process.env.PAYU_MODE || "test").trim().toLowerCase();
    const actionUrl = mode === "live"
      ? "https://secure.payu.in/_payment"
      : "https://test.payu.in/_payment";

    const payuPayload: Record<string, string> = {
      key,
      txnid,
      amount: formattedAmount,
      productinfo: productInfo,
      firstname: firstName,
      email,
      phone,
      hash,
      surl: `${cleanApiBase}/api/v1/orders/webhook/payu/success`,
      furl: `${cleanApiBase}/api/v1/orders/webhook/payu/failure`,
      curl: `${cleanApiBase}/api/v1/orders/webhook/payu/cancel`,
      actionUrl,
    };

    // IMPORTANT: We MUST return the raw payload and let the browser's HTML form submit it.
    // If we use a server-side fetch to capture the 302 redirect here, PayU's backend 
    // will lock the transaction token to the Server's IP address. When the user's browser
    // loads the URL, the IP mismatch causes the token to be rejected, and the PayU 
    // React App will display a generic "No payment ID found in URL" error.
    return {
      gatewayOrderId: txnid,
      gatewayResponse: payuPayload
    };
  }

  async verifyPayment(payment: IPayment, verificationData: any): Promise<VerifyPaymentResult> {
    const key = (verificationData.key || ENV.PAYU_MERCHANT_KEY || process.env.PAYU_MERCHANT_KEY || "").trim();
    const salt = (ENV.PAYU_SALT || process.env.PAYU_SALT || "").trim();

    if (!key || !salt) {
      throw new AppError("PayU credentials are not configured", 500);
    }
    
    // PayU reverse hash verification
    // Standard format: sha512(SALT|status|udf10|udf9|udf8|udf7|udf6|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
    const { status, txnid, amount, productinfo, firstname, email, hash, additionalCharges } = verificationData;

    const baseElements = [
      salt,
      status || "",
      verificationData.udf10 || "",
      verificationData.udf9 || "",
      verificationData.udf8 || "",
      verificationData.udf7 || "",
      verificationData.udf6 || "",
      verificationData.udf5 || "",
      verificationData.udf4 || "",
      verificationData.udf3 || "",
      verificationData.udf2 || "",
      verificationData.udf1 || "",
      email || "",
      firstname || "",
      productinfo || "",
      amount || "",
      txnid || "",
      key || "",
    ];

    const hashString = baseElements.join("|");
    const generatedHash = crypto.createHash("sha512").update(hashString).digest("hex").toLowerCase();
    
    let isValid = timingSafeCompare(generatedHash, hash);
    
    if (!isValid && additionalCharges) {
      const hashWithCharges = [additionalCharges, ...baseElements].join("|");
      const generatedWithCharges = crypto.createHash("sha512").update(hashWithCharges).digest("hex").toLowerCase();
      isValid = timingSafeCompare(generatedWithCharges, hash);
    }

    if (!isValid) {
      logger.warn(`PayU signature mismatch: generated ${generatedHash} vs received ${hash}`);
      return { success: false, message: "Invalid PayU signature" };
    }

    // CRITICAL SECURITY: Verify the amount paid matches the amount in our database!
    const paidAmount = parseFloat(amount);
    if (isNaN(paidAmount) || Math.round(paidAmount * 100) < Math.round(payment.amount * 100)) {
      logger.error(`Amount tampering detected! Expected ${payment.amount}, got ${paidAmount}`);
      return { success: false, message: "Amount mismatch detected" };
    }

    return {
      success: String(status || "").trim().toLowerCase() === "success",
      gatewayPaymentId: verificationData.mihpayid,
    };
  }

  async handleWebhook(headers: any, rawBody: string): Promise<any> {
    let params: Record<string, string>;
    try {
      params = parseWebhookBody(rawBody);
    } catch {
      throw new AppError("Malformed PayU webhook payload", 400);
    }

    // PayU sends webhook as form-urlencoded (or JSON depending on webhook configuration)
    const status = params.status || "";
    const actionRaw = params.action || params.type || "";
    const unmappedStatusRaw = params.unmappedstatus || "";
    const errorMessage = params.error_Message || params.field9 || params.remark || "";
    const txnid = (params.txnid || params.txn_id || "").trim();
    const amount = params.amount || params.cb_amount || "";
    const productinfo = params.productinfo || "";
    const firstname = params.firstname || "";
    const email = params.email || "";
    const hash = params.hash || "";
    const mihpayid = (params.mihpayid || params.payu_id || "").trim();
    const bankArn = (params.bank_arn || "").trim();
    const additionalCharges = params.additionalCharges;
    const configuredKey = (ENV.PAYU_MERCHANT_KEY || process.env.PAYU_MERCHANT_KEY || "").trim();
    const key = configuredKey || (params.key || "").trim();
    const salt = (ENV.PAYU_SALT || process.env.PAYU_SALT || "").trim();
    const mode = (ENV.PAYU_MODE || process.env.PAYU_MODE || "test").trim().toLowerCase();

    const isDisputePayload =
      String(params.event || "").trim().toLowerCase() === "dispute" ||
      Boolean(params.cb_id);

    if (!txnid || (!isDisputePayload && !hash)) {
      throw new AppError("Invalid PayU webhook payload", 400);
    }

    if (!key || !salt) {
      throw new AppError("PayU credentials are not configured", 500);
    }

    if (mode === "live" && configuredKey && params.key && params.key.trim() !== configuredKey) {
      logger.warn(`PayU webhook key mismatch: expected configured merchant key, got ${params.key}`);
      throw new AppError("Invalid PayU webhook signature", 400);
    }

    if (!isDisputePayload || hash) {
      // PayU reverse hash verification
      const baseElements = [
        salt,
        status,
        params.udf10 || "",
        params.udf9 || "",
        params.udf8 || "",
        params.udf7 || "",
        params.udf6 || "",
        params.udf5 || "",
        params.udf4 || "",
        params.udf3 || "",
        params.udf2 || "",
        params.udf1 || "",
        email,
        firstname,
        productinfo,
        amount,
        txnid,
        key,
      ];

      const hashString = baseElements.join("|");
      const generatedHash = crypto.createHash("sha512").update(hashString).digest("hex").toLowerCase();

      let isValid = timingSafeCompare(generatedHash, hash);

      if (!isValid && additionalCharges) {
        const hashWithCharges = [additionalCharges, ...baseElements].join("|");
        const generatedWithCharges = crypto.createHash("sha512").update(hashWithCharges).digest("hex").toLowerCase();
        isValid = timingSafeCompare(generatedWithCharges, hash);
      }

      if (!isValid) {
        logger.warn(`PayU webhook signature mismatch: generated ${generatedHash} vs received ${hash}`);
        // In live mode, strictly reject invalid signatures. In test mode, log and allow.
        if (mode === "live") {
          throw new AppError("Invalid PayU webhook signature", 400);
        }
      }
    }

    const headerEventId = headers?.["x-payu-event-id"];

    if (isDisputePayload) {
      const cbId = String(params.cb_id || txnid);
      const cbStatus = String(params.cb_status || status || "Open").trim();
      const dedupId =
        headerEventId ||
        `dispute:${cbId}:${cbStatus.toLowerCase().replace(/\s+/g, "_")}`;

      return {
        event: "payment.disputed",
        gatewayOrderId: txnid,
        id: dedupId,
        payload: {
          id: mihpayid,
          disputeId: cbId,
          disputeStatus: cbStatus,
          reasonCode: params.reason_code || "",
          dueDate: params.due_date || "",
          amount: parseFloat(amount || "0"),
          status: cbStatus,
          isCancelled: false,
        },
      };
    }

    const normalizedStatus = status.trim().toLowerCase();
    const normalizedAction = actionRaw.trim().toLowerCase();
    const normalizedUnmapped = unmappedStatusRaw.trim().toLowerCase();

    const isRefund =
      normalizedAction === "refund" ||
      normalizedStatus === "refund" ||
      normalizedStatus === "refunded" ||
      normalizedUnmapped === "refund" ||
      normalizedUnmapped === "refunded";

    const isPending =
      !isRefund &&
      normalizedStatus !== "success" &&
      (normalizedStatus === "pending" || PENDING_UNMAPPED_STATUSES.has(normalizedUnmapped));
    const isCancelled =
      !isRefund &&
      normalizedStatus !== "success" &&
      (normalizedUnmapped.includes("cancel") ||
        errorMessage.toLowerCase().includes("cancel") ||
        normalizedStatus === "cancel" ||
        normalizedStatus === "cancelled");

    // Preserve distinct deduplication IDs for pending/failed vs captured so a pending callback never blocks a later capture webhook
    const eventName = isRefund
      ? "refund.processed"
      : normalizedStatus === "success"
      ? "payment.captured"
      : isPending
      ? "payment.pending"
      : "payment.failed";
    const deterministicDigest = crypto
      .createHash("sha256")
      .update(`payu:${txnid}:${eventName}:${normalizedStatus}:${amount}:${bankArn}`)
      .digest("hex")
      .slice(0, 24);
    const dedupId =
      headerEventId ||
      (isRefund
        ? `refund:${mihpayid || bankArn || deterministicDigest}:${amount}`
        : mihpayid
        ? eventName === "payment.captured"
          ? mihpayid
          : `${mihpayid}:${eventName}`
        : `payu_${deterministicDigest}`);

    return {
      event: eventName,
      gatewayOrderId: txnid,
      id: dedupId,
      payload: {
        id: mihpayid,
        refundId: params.request_id || bankArn || mihpayid,
        bankArn,
        amount: parseFloat(amount || "0"),
        status: normalizedStatus,
        unmappedStatus: normalizedUnmapped,
        error_Message: errorMessage,
        isCancelled,
      },
    };
  }

  async initiateRefund(payment: IPayment, amount?: number): Promise<RefundResult> {
    try {
      const key = (ENV.PAYU_MERCHANT_KEY || process.env.PAYU_MERCHANT_KEY || "").trim();
      const salt = (ENV.PAYU_SALT || process.env.PAYU_SALT || "").trim();
      if (!key || !salt) {
        throw new AppError("PayU credentials are not configured", 500);
      }
      const refundAmount = amount || payment.amount;
      
      const command = "cancel_refund_transaction";
      const var1 = payment.gatewayPaymentId; // PayU's mihpayid
      
      if (!var1) {
         throw new AppError("Gateway Payment ID missing for refund", 400);
      }

      // Hash: sha512(key|command|var1|salt)
      const hashString = `${key}|${command}|${var1}|${salt}`;
      const hash = crypto.createHash("sha512").update(hashString).digest("hex");

      const params = new URLSearchParams();
      params.append("key", key);
      params.append("command", command);
      params.append("hash", hash);
      params.append("var1", var1);
      params.append("var2", Number(refundAmount).toFixed(2));
      params.append("var3", payment.gatewayOrderId);

      const mode = (ENV.PAYU_MODE || process.env.PAYU_MODE || "test").trim().toLowerCase();
      const payuUrl = mode === "live"
        ? "https://info.payu.in/merchant/postservice.php?form=2"
        : "https://test.payu.in/merchant/postservice.php?form=2";

      const response = await fetch(payuUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        signal: AbortSignal.timeout(15000),
      });

      const result = await response.json();

      if (result.status === 1 || result.status === "1") {
         return {
           success: true,
           refundId: result.request_id || `payu_ref_${Date.now()}`,
           message: result.msg || "Refund successful",
         };
      }

      return {
        success: false,
        message: result.msg || "Refund failed at gateway",
      };
    } catch (error: any) {
      logger.error("PayU Refund Error", { error: error.message });
      return { success: false, message: error.message || "PayU Refund API Error" };
    }
  }

  async getPaymentStatus(gatewayOrderId: string): Promise<any> {
    try {
      const key = (ENV.PAYU_MERCHANT_KEY || process.env.PAYU_MERCHANT_KEY || "").trim();
      const salt = (ENV.PAYU_SALT || process.env.PAYU_SALT || "").trim();
      if (!key || !salt) {
        throw new AppError("PayU credentials are not configured", 500);
      }
      const command = "verify_payment";
      const var1 = gatewayOrderId;

      const hashString = `${key}|${command}|${var1}|${salt}`;
      const hash = crypto.createHash("sha512").update(hashString).digest("hex");

      const params = new URLSearchParams();
      params.append("key", key);
      params.append("command", command);
      params.append("hash", hash);
      params.append("var1", var1);

      const mode = (ENV.PAYU_MODE || process.env.PAYU_MODE || "test").trim().toLowerCase();
      const payuUrl = (mode === "live")
        ? "https://info.payu.in/merchant/postservice.php?form=2"
        : "https://test.payu.in/merchant/postservice.php?form=2";

      const response = await fetch(payuUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        signal: AbortSignal.timeout(15000),
      });

      return await response.json();
    } catch (error: any) {
      logger.error("PayU Status Error", { error: error.message });
      throw new AppError("Failed to fetch PayU payment status", 500);
    }
  }
}
