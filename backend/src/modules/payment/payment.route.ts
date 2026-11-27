import { NextRequest } from "next/server";
import { PaymentController } from "./payment.controller";
import { ApiResponse } from "../../core/response/ApiResponse";
import { extractUserFromAuth } from "../../core/middlewares/auth";

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment management and webhooks
 */
export async function paymentRouter(req: NextRequest, routePath: string) {
  const method = req.method;
  const cleanPath = String(routePath || "").replace(/^\/+/, "");

  // Pattern: POST /api/v1/payments/webhook/:gateway
  if (method === "POST" && cleanPath.startsWith("webhook/")) {
    const gateway = cleanPath.split("/")[1];
    if (!gateway) return ApiResponse.error("Gateway required", 400);
    return PaymentController.handleWebhook(req, { params: { gateway } });
  }

  // Pattern: GET /api/v1/payments/:id (Authenticated owner or staff only)
  if (method === "GET" && cleanPath.length > 0) {
    extractUserFromAuth(req);
    const id = cleanPath.split("/")[0];
    if (id) {
      return PaymentController.getPaymentStatus(req, { params: { id } });
    }
  }

  return ApiResponse.error("Method Not Allowed in Payment Router", 405);
}
