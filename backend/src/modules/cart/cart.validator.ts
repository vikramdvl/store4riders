import { NextRequest } from "next/server";
import { 
  cartItemSchema, 
  updateCartItemSchema, 
  removeCartItemSchema, 
  syncCartSchema 
} from "@store4riders/shared-validation";
import { extractUserFromAuth } from "../../core/middlewares/auth";

/**
 * CartValidator
 * 
 * Extracts and validates payload data and user authentication context 
 * for shopping cart operations.
 */
export class CartValidator {
  
  /**
   * Extracts the authenticated user's ID for cart retrieval.
   * 
   * @param {NextRequest} req - The incoming HTTP request.
   * @returns {string} The authenticated user's ID.
   */
  static extractUserId(req: NextRequest) {
    return extractUserFromAuth(req);
  }

  /**
   * Validates the payload for adding an item to the cart.
   * 
   * @param {NextRequest} req - The incoming HTTP request.
   * @returns {Promise<{userId: string, data: any}>} The user ID and validated cart item.
   */
  static async validateAddItem(req: NextRequest) {
    const userId = extractUserFromAuth(req);
    const body = await req.json().catch(() => ({}));
    const data = cartItemSchema.parse(body);
    return { userId, data };
  }

  /**
   * Validates the payload for updating an item's quantity in the cart.
   */
  static async validateUpdateQuantity(req: NextRequest) {
    const userId = extractUserFromAuth(req);
    const body = await req.json().catch(() => ({}));
    const data = updateCartItemSchema.parse(body);
    return { userId, data };
  }

  /**
   * Validates the payload for removing an item from the cart.
   */
  static async validateRemoveItem(req: NextRequest) {
    const userId = extractUserFromAuth(req);
    const searchParams = req.nextUrl?.searchParams;
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const productId = body.productId || searchParams?.get("productId") || undefined;
    const variantId = body.variantId !== undefined ? body.variantId : (searchParams?.get("variantId") || undefined);
    const itemId = body.itemId || searchParams?.get("itemId") || undefined;

    const data = removeCartItemSchema.parse({
      productId,
      variantId,
      itemId,
    });
    return { userId, data };
  }

  /**
   * Validates the payload for syncing local cart items to the database.
   */
  static async validateSyncCart(req: NextRequest) {
    const userId = extractUserFromAuth(req);
    const body = await req.json().catch(() => ({}));
    const data = syncCartSchema.parse(body);
    return { userId, data };
  }
}
