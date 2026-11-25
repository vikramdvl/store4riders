import { NextRequest } from "next/server";
import {
  createOrderSchema,
  verifyPaymentSchema,
  adminHandleReturnSchema,
  exchangePickupSchema,
  exchangeQcSchema,
  exchangeFeeStatusSchema,
  exchangeFeePaySchema,
  exchangeDispatchSchema,
  exchangeRequestItemSchema,
} from "@store4riders/shared-validation";
import { extractUserFromAuth } from "../../core/middlewares/auth";

/**
 * OrderValidator
 * 
 * Handles extracting JSON payloads from incoming order requests
 * and strictly validating them against Zod schemas.
 */
export class OrderValidator {
  
  /**
   * Validates the payload for creating a new order.
   * 
   * @param {NextRequest} req - The incoming HTTP request.
   * @returns {Promise<{userId: string, data: any}>} The user ID and validated order data.
   */
  static async validateCreate(req: NextRequest) {
    let userId: string | undefined = undefined;
    try {
      userId = extractUserFromAuth(req);
    } catch (e) {
      // Allow guest users without tokens
    }
    const body = await req.json();
    const data = createOrderSchema.parse(body);
    return { userId, data };
  }

  /**
   * Validates the payload for verifying a gateway payment.
   * 
   * @param {NextRequest} req - The incoming HTTP request.
   * @returns {Promise<{userId: string, data: any}>} The user ID and validated payment data.
   */
  static async validateVerify(req: NextRequest) {
    let userId: string | undefined = undefined;
    try {
      userId = extractUserFromAuth(req);
    } catch {
      // Allow guest users without tokens
    }
    const body = await req.json();
    const data = verifyPaymentSchema.parse(body);
    return { userId, data };
  }

  /**
   * Extracts the authenticated user's ID.
   * 
   * @param {NextRequest} req - The incoming HTTP request.
   * @returns {string} The authenticated user's ID.
   */
  static extractUserId(req: NextRequest) {
    return extractUserFromAuth(req);
  }

  static async validateAdminUpdateStatus(req: NextRequest) {
    const { z } = require("zod");
    const schema = z.object({
      status: z.enum([
        "pending_payment", "confirmed", "processing", "packed", "shipped", 
        "delivered", "cancelled", "failed", "refunded", 
        "return_requested", "return_approved", "return_picked", "returned"
      ])
    });
    const body = await req.json();
    return schema.parse(body);
  }

  static async validateAdminAddNote(req: NextRequest) {
    const { z } = require("zod");
    const schema = z.object({
      text: z.string().min(1, "Note text is required").max(1000)
    });
    const body = await req.json();
    return schema.parse(body);
  }

  static validateAdminGetQuery(req: NextRequest) {
    const { z } = require("zod");
    const searchParams = req.nextUrl.searchParams;
    const schema = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
      status: z.string().optional(),
      paymentMethod: z.string().optional(),
      search: z.string().optional(),
      userId: z.string().optional(),
    });
    
    return schema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      status: searchParams.get("status") || undefined,
      paymentMethod: searchParams.get("paymentMethod") || undefined,
      search: searchParams.get("search") || undefined,
      userId: searchParams.get("userId") || undefined,
    });
  }

  static validateSuggestQuery(req: NextRequest) {
    const { z } = require("zod");
    const q = req.nextUrl.searchParams.get("q") || "";
    return z.object({
      q: z.string().default(""),
    }).parse({ q });
  }

  static async validateRequestReturn(req: NextRequest) {
    const { z } = require("zod");
    const schema = z.object({
      reason: z
        .string()
        .trim()
        .min(5, "Reason must be at least 5 characters")
        .max(1000, "Reason cannot exceed 1000 characters"),
      images: z.array(z.string().url("Invalid image URL")).max(5).optional(),
      items: z.array(exchangeRequestItemSchema).max(20).optional(),
    });
    const body = await req.json();
    const parsed = schema.parse(body);
    // Sanitize reason to prevent XSS / script injection attacks
    parsed.reason = parsed.reason.replace(/<[^>]*>?/gm, "").replace(/[<>{}$`\\]/g, "").trim();
    if (Array.isArray(parsed.items)) {
      parsed.items = parsed.items.map((item: any) => ({
        ...item,
        ...(item.desiredReplacement
          ? {
              desiredReplacement: String(item.desiredReplacement)
                .replace(/<[^>]*>?/gm, "")
                .replace(/[<>{}$`\\]/g, "")
                .trim(),
            }
          : {}),
      }));
    }
    return parsed;
  }

  static async validateExchangeComplete(req: NextRequest) {
    const { z } = require("zod");
    const schema = z.object({
      exchangeId: z.string().max(100).optional(),
    });
    const body = await req.json().catch(() => ({}));
    return schema.parse(body || {});
  }

  static async validateAdminHandleReturn(req: NextRequest) {
    const body = await req.json();
    return adminHandleReturnSchema.parse(body);
  }

  static async validateExchangePickup(req: NextRequest) {
    const body = await req.json();
    return exchangePickupSchema.parse(body);
  }

  static async validateExchangeQc(req: NextRequest) {
    const body = await req.json();
    const parsed = exchangeQcSchema.parse(body);
    parsed.qcNotes = parsed.qcNotes.replace(/<[^>]*>?/gm, "").trim();
    return parsed;
  }

  static async validateExchangeFeeStatus(req: NextRequest) {
    const body = await req.json();
    return exchangeFeeStatusSchema.parse(body);
  }

  static async validateExchangeFeePay(req: NextRequest) {
    const body = await req.json();
    return exchangeFeePaySchema.parse(body);
  }

  static async validateExchangeDispatch(req: NextRequest) {
    const body = await req.json();
    return exchangeDispatchSchema.parse(body);
  }
}
