import crypto from "crypto";
import { PaymentGateway, GatewayOrderResult, VerifyPaymentResult, RefundResult } from "./PaymentGateway";
import { IOrder, IPayment } from "@store4riders/shared-types";
import { ENV } from "../config/env";
import { AppError } from "../errors/AppError";
import { logger } from "../utils/logger";

export class CCavenueGateway implements PaymentGateway {
  
  private encrypt(plainText: string, workingKey: string): string {
    const m = crypto.createHash("md5");
    m.update(workingKey);
    const key = m.digest();
    const iv = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f]);
    const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
    let encoded = cipher.update(plainText, "utf8", "hex");
    encoded += cipher.final("hex");
    return encoded;
  }

  private decrypt(encText: string, workingKey: string): string {
    const m = crypto.createHash("md5");
    m.update(workingKey);
    const key = m.digest();
    const iv = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f]);
    const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
    let decoded = decipher.update(encText, "hex", "utf8");
    decoded += decipher.final("utf8");
    return decoded;
  }

  async createOrder(order: IOrder, amount: number): Promise<GatewayOrderResult> {
    const merchantId = (ENV.CCAVENUE_MERCHANT_ID || process.env.CCAVENUE_MERCHANT_ID || "").trim();
    const accessCode = (ENV.CCAVENUE_ACCESS_CODE || process.env.CCAVENUE_ACCESS_CODE || "").trim();
    const workingKey = (ENV.CCAVENUE_WORKING_KEY || process.env.CCAVENUE_WORKING_KEY || "").trim();

    const isPlaceholder = (val: string) => !val || val.startsWith("your_") || val === "your_ccavenue_id" || val === "your_ccavenue_access_code" || val === "your_ccavenue_working_key";
    if (isPlaceholder(merchantId) || isPlaceholder(accessCode) || isPlaceholder(workingKey)) {
      throw new AppError("CCAvenue credentials in backend/.env are missing or set to placeholder values ('your_ccavenue_id'). Please update backend/.env with your real CCAvenue Merchant ID, Access Code, and Working Key.", 400);
    }

    const orderId = String(order.orderNumber || (order as any)._id || order.id || `ORD-${Date.now()}`);
    
    const rawApiUrl = (ENV.API_URL || ENV.NEXT_PUBLIC_API_URL || ENV.FRONTEND_URL || "").trim();
    if (!rawApiUrl) {
      throw new AppError("API_URL or FRONTEND_URL is not configured. CCAvenue redirect URLs cannot be generated.", 500);
    }
    const cleanApiBase = rawApiUrl.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");

    const mode = (ENV.CCAVENUE_MODE || process.env.CCAVENUE_MODE || "test").trim().toLowerCase();
    const isLive = mode === "live";

    let redirectUrl = (ENV.CCAVENUE_REDIRECT_URL || process.env.CCAVENUE_REDIRECT_URL || "").trim();
    if (!redirectUrl) {
      if (isLive && cleanApiBase.includes("localhost")) {
        redirectUrl = "https://store4riders.com/api/v1/orders/webhook/ccavenue";
      } else {
        redirectUrl = `${cleanApiBase}/api/v1/orders/webhook/ccavenue`;
      }
    }

    let cancelUrl = ((order as any)?.cancelUrl || ENV.CCAVENUE_CANCEL_URL || process.env.CCAVENUE_CANCEL_URL || "").trim();
    if (!cancelUrl) {
      if (isLive && cleanApiBase.includes("localhost")) {
        cancelUrl = "https://store4riders.com/api/v1/orders/webhook/ccavenue/cancel";
      } else {
        cancelUrl = `${cleanApiBase}/api/v1/orders/webhook/ccavenue/cancel`;
      }
    }
    
    const formattedAmount = Number(amount).toFixed(2);

    // Sanitizer for text fields to prevent parameter splitting corruption
    const sanitizeText = (val: string, maxLen: number) =>
      val.replace(/[&=#]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLen);

    // Extract customer billing details from shippingAddress / order
    const shipping = order.shippingAddress;
    const billingName = sanitizeText(shipping?.fullName || (order as any).fullName || "Valued Customer", 60);
    const billingAddress = sanitizeText(shipping?.street || shipping?.addressLine1 || "Address", 150);
    const billingCity = sanitizeText(shipping?.city || "City", 30);
    const billingState = sanitizeText(shipping?.state || "State", 30);
    const billingZip = sanitizeText(shipping?.pincode || "000000", 10);
    const billingCountry = sanitizeText(shipping?.country || "India", 50);
    const rawPhone = (shipping?.phone || (order as any).phone || "").replace(/\D/g, "");
    const billingTel = rawPhone.slice(-10);
    const billingEmail = sanitizeText((order as any).userEmail || order.guestEmail || "", 60);

    const payload: Record<string, string> = {
      tid: String(Date.now()),
      merchant_id: merchantId,
      order_id: orderId,
      currency: "INR",
      amount: formattedAmount,
      redirect_url: redirectUrl,
      cancel_url: cancelUrl,
      language: "EN",
    };

    if (billingName) payload.billing_name = billingName;
    if (billingAddress) payload.billing_address = billingAddress;
    if (billingCity) payload.billing_city = billingCity;
    if (billingState) payload.billing_state = billingState;
    if (billingZip) payload.billing_zip = billingZip;
    if (billingCountry) payload.billing_country = billingCountry;
    if (billingTel) payload.billing_tel = billingTel;
    if (billingEmail) payload.billing_email = billingEmail;

    if (billingName) payload.delivery_name = billingName;
    if (billingAddress) payload.delivery_address = billingAddress;
    if (billingCity) payload.delivery_city = billingCity;
    if (billingState) payload.delivery_state = billingState;
    if (billingZip) payload.delivery_zip = billingZip;
    if (billingCountry) payload.delivery_country = billingCountry;
    if (billingTel) payload.delivery_tel = billingTel;

    // CCAvenue standard: query string concatenation (param=value&param=value) without URL-encoding URLs
    const merchantData = Object.entries(payload)
      .filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== "")
      .map(([k, v]) => `${k}=${String(v).trim()}`)
      .join("&");

    const encryptedData = this.encrypt(merchantData, workingKey);

    const actionUrl = isLive
      ? "https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction"
      : "https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction";

    return {
      gatewayOrderId: orderId,
      gatewayResponse: {
        command: "initiateTransaction",
        access_code: accessCode,
        encRequest: encryptedData,
        actionUrl,
      }
    };
  }

  async verifyPayment(payment: IPayment, verificationData: any): Promise<VerifyPaymentResult> {
    const workingKey = (ENV.CCAVENUE_WORKING_KEY || process.env.CCAVENUE_WORKING_KEY || "").trim();
    if (!workingKey) {
      throw new AppError("CCAvenue credentials are not configured", 500);
    }
    const { encResp } = verificationData;
    
    try {
      const decryptedData = this.decrypt(encResp, workingKey);
      const params = new URLSearchParams(decryptedData);
      
      const orderStatus = params.get("order_status");
      const trackingId = params.get("tracking_id");
      const paidAmountStr = params.get("amount") || "0";
      
      if (!trackingId || !orderStatus) {
        throw new AppError("Invalid CCavenue response data", 400);
      }
      
      const currency = params.get("currency") || "INR";
      if (currency.toUpperCase() !== "INR") {
        logger.error(`CCAvenue Currency tampering detected! Expected INR, got ${currency}`);
        return { success: false, message: "Currency mismatch detected" };
      }

      const paidAmount = parseFloat(paidAmountStr);
      if (isNaN(paidAmount) || Math.round(paidAmount * 100) < Math.round(payment.amount * 100)) {
        logger.error(`CCAvenue Amount tampering detected! Expected ${payment.amount}, got ${paidAmount}`);
        return { success: false, message: "Amount mismatch detected" };
      }

      const normalizedStatus = String(orderStatus).trim().toLowerCase();
      if (normalizedStatus === "success" || normalizedStatus === "successful") {
        return { success: true, gatewayPaymentId: trackingId };
      }
      return { success: false, message: `CCAvenue payment failed: ${orderStatus}` };
    } catch (err) {
      return { success: false, message: "Failed to decrypt CCAvenue response" };
    }
  }

  async handleWebhook(headers: any, rawBody: string): Promise<any> {
    const params = new URLSearchParams(rawBody);
    const encResp = params.get("encResp") || params.get("enc_response");
    
    if (!encResp) {
      throw new AppError("Invalid CCAvenue webhook payload: missing encResp", 400);
    }
    
    const workingKey = (ENV.CCAVENUE_WORKING_KEY || process.env.CCAVENUE_WORKING_KEY || "").trim();
    if (!workingKey) {
      throw new AppError("CCAvenue credentials are not configured", 500);
    }
    
    try {
      const decryptedData = this.decrypt(encResp, workingKey);
      const decParams = new URLSearchParams(decryptedData);
      
      const orderStatus = decParams.get("order_status") || "";
      const riskStatus = (decParams.get("risk_status") || "").trim().toLowerCase();
      const orderId = decParams.get("order_id") || decParams.get("order_no");
      const trackingId = decParams.get("tracking_id") || "";
      const amount = decParams.get("amount") || "0";
      const statusMessage = decParams.get("status_message") || "";
      const bankRefNo = decParams.get("bank_ref_no") || "";
      const paymentMode = decParams.get("payment_mode") || "";

      if (!orderId) {
        throw new AppError("Missing order_id in CCAvenue webhook", 400);
      }

      const normalizedStatus = orderStatus.trim().toLowerCase();
      const isRefund =
        normalizedStatus === "refunded" ||
        normalizedStatus === "refund" ||
        normalizedStatus.includes("refund");
      const isDisputed =
        !isRefund &&
        (normalizedStatus.includes("chargeback") ||
          normalizedStatus.includes("dispute") ||
          riskStatus === "high");
      const isSuccess =
        !isRefund &&
        !isDisputed &&
        (normalizedStatus === "success" ||
          normalizedStatus === "successful" ||
          normalizedStatus === "shipped");
      const isPending =
        !isRefund &&
        !isDisputed &&
        !isSuccess &&
        (!normalizedStatus ||
          normalizedStatus === "awaited" ||
          normalizedStatus === "initiated" ||
          normalizedStatus === "pending" ||
          normalizedStatus === "timeout");
      const isCancelled =
        !isRefund &&
        !isDisputed &&
        !isSuccess &&
        !isPending &&
        (normalizedStatus === "aborted" ||
          normalizedStatus === "cancelled" ||
          normalizedStatus === "cancel" ||
          statusMessage.toLowerCase().includes("cancel"));

      const eventName = isRefund
        ? "refund.processed"
        : isDisputed
        ? "payment.disputed"
        : isSuccess
        ? "payment.captured"
        : isPending
        ? "payment.pending"
        : "payment.failed";

      const rawHeaderEventId = headers["x-ccavenue-event-id"];
      const deterministicFallback = `ccav_${crypto
        .createHash("sha256")
        .update(`ccav:${orderId}:${eventName}:${normalizedStatus}:${amount}:${bankRefNo}`)
        .digest("hex")
        .slice(0, 24)}`;
      const baseEventId = rawHeaderEventId || trackingId || deterministicFallback;
      const eventId = rawHeaderEventId
        ? rawHeaderEventId
        : eventName === "payment.captured"
        ? baseEventId
        : isRefund
        ? `refund:${baseEventId}:${amount}`
        : `${baseEventId}:${eventName}`;

      return {
        event: eventName,
        gatewayOrderId: orderId,
        id: eventId,
        payload: {
          id: trackingId,
          refundId: isRefund ? trackingId || bankRefNo || deterministicFallback : undefined,
          disputeId: isDisputed ? trackingId || bankRefNo || orderId : undefined,
          disputeStatus: isDisputed ? orderStatus || `Risk: ${riskStatus}` : undefined,
          amount: parseFloat(amount),
          status: orderStatus,
          statusMessage,
          bankRefNo,
          paymentMode,
          isCancelled,
        },
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      logger.error("Failed to decrypt CCAvenue webhook payload", { error: err.message });
      throw new AppError(err.message || "Failed to decrypt CCAvenue webhook payload", 400);
    }
  }

  async initiateRefund(payment: IPayment, amount?: number): Promise<RefundResult> {
    try {
      const accessCode = (ENV.CCAVENUE_ACCESS_CODE || process.env.CCAVENUE_ACCESS_CODE || "").trim();
      const workingKey = (ENV.CCAVENUE_WORKING_KEY || process.env.CCAVENUE_WORKING_KEY || "").trim();
      const merchantId = (ENV.CCAVENUE_MERCHANT_ID || process.env.CCAVENUE_MERCHANT_ID || "").trim();
      const mode = (ENV.CCAVENUE_MODE || process.env.CCAVENUE_MODE || "test").trim().toLowerCase();
      if (!merchantId || !accessCode || !workingKey) {
        throw new AppError("CCAvenue credentials are not configured", 500);
      }
      
      const refundAmount = amount || payment.amount;
      const refNo = payment.gatewayPaymentId;

      if (!refNo) {
        throw new AppError("CCAvenue Tracking ID (Gateway Payment ID) missing", 400);
      }

      const refundData = {
        reference_no: refNo,
        refund_amount: Number(refundAmount).toFixed(2),
        refund_ref_no: `ref_${Date.now()}`
      };

      const encryptedData = this.encrypt(JSON.stringify(refundData), workingKey);
      
      const params = new URLSearchParams();
      params.append("request_type", "JSON");
      params.append("access_code", accessCode);
      params.append("command", "refundOrder");
      params.append("response_type", "JSON");
      params.append("version", "1.1");
      params.append("request_data", encryptedData);

      const ccavUrl = mode === "live"
        ? "https://api.ccavenue.com/apis/servlet/DoWebTrans"
        : "https://apitest.ccavenue.com/apis/servlet/DoWebTrans";

      const response = await fetch(ccavUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        signal: AbortSignal.timeout(15000)
      });

      const responseText = await response.text();
      const paramsRes = new URLSearchParams(responseText);
      const encResponse = paramsRes.get("enc_response");
      const status = paramsRes.get("status");
      
      if (status === "0" && encResponse) {
        const decResp = this.decrypt(encResponse, workingKey);
        const result = JSON.parse(decResp);
        
        if (result.Refund_Order_Result?.refund_status === "0") {
          return {
            success: true,
            refundId: refundData.refund_ref_no,
            message: "Refund successful"
          };
        } else {
          return {
            success: false,
            message: result.Refund_Order_Result?.reason || "Refund failed at gateway"
          };
        }
      }

      return {
        success: false,
        message: "CCAvenue API Error or invalid response"
      };

    } catch (error: any) {
      logger.error("CCAvenue Refund Error", { error: error.message });
      return { success: false, message: error.message || "CCAvenue Refund API Error" };
    }
  }

  async getPaymentStatus(gatewayOrderId: string): Promise<any> {
    try {
      const merchantId = (ENV.CCAVENUE_MERCHANT_ID || process.env.CCAVENUE_MERCHANT_ID || "").trim();
      const accessCode = (ENV.CCAVENUE_ACCESS_CODE || process.env.CCAVENUE_ACCESS_CODE || "").trim();
      const workingKey = (ENV.CCAVENUE_WORKING_KEY || process.env.CCAVENUE_WORKING_KEY || "").trim();
      const mode = (ENV.CCAVENUE_MODE || process.env.CCAVENUE_MODE || "test").trim().toLowerCase();

      if (!merchantId || !accessCode || !workingKey) {
        throw new AppError("CCAvenue credentials are not configured", 500);
      }

      const statusData = { order_no: gatewayOrderId };
      const encryptedData = this.encrypt(JSON.stringify(statusData), workingKey);

      const params = new URLSearchParams();
      params.append("request_type", "JSON");
      params.append("access_code", accessCode);
      params.append("command", "orderStatusTracker");
      params.append("response_type", "JSON");
      params.append("version", "1.1");
      params.append("request_data", encryptedData);

      const ccavUrl = mode === "live"
        ? "https://api.ccavenue.com/apis/servlet/DoWebTrans"
        : "https://apitest.ccavenue.com/apis/servlet/DoWebTrans";

      const response = await fetch(ccavUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        signal: AbortSignal.timeout(15000)
      });

      const responseText = await response.text();
      const paramsRes = new URLSearchParams(responseText);
      const apiStatus = paramsRes.get("status");
      const encResponse = paramsRes.get("enc_response");

      // CCAvenue returns status=1 with plaintext enc_response when order lookup failed or transaction is not settled yet
      if (apiStatus === "1") {
        logger.warn("CCAvenue status API returned non-zero status", {
          gatewayOrderId,
          message: encResponse || responseText,
        });
        return {
          order_status: "unknown",
          status_message: encResponse || "CCAvenue status temporarily unavailable",
        };
      }

      if (encResponse) {
        const decResp = this.decrypt(encResponse, workingKey);
        return JSON.parse(decResp);
      }
      throw new AppError("Invalid response from CCAvenue status API", 500);
    } catch (error: any) {
      logger.error("CCAvenue Status Error", { error: error.message });
      throw new AppError("Failed to fetch CCAvenue payment status", 500);
    }
  }
}
