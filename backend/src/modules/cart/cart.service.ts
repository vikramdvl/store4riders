import { CartRepository } from "./cart.repository";
import { ProductRepository } from "../product/product.repository";
import { SettingRepository } from "../settings/setting.repository";
import { ICart, ICartItem } from "@store4riders/shared-types";
import { calculateTax, calculateInclusiveTax, getTaxRateFromClass } from "@store4riders/shared-utils";

/**
 * @class CartService
 * @description Core business logic for Shopping Cart.
 * Highlights:
 * - Upserts carts automatically for new users.
 * - Auto-merges items if the same variant is added twice.
 * - Dynamically recalculates totals, GST tax, and shipping on every action.
 */
export class CartService {
  
  static async getCart(userId: string): Promise<ICart> {
    let cart = await CartRepository.findByUserId(userId);
    if (!cart) {
      cart = await CartRepository.upsert(userId, { items: [], summary: { subtotal: 0, tax: 0, shipping: 0, total: 0 } });
    }
    return this.recalculateSummary(cart);
  }

  static async addItem(userId: string, item: ICartItem): Promise<ICart> {
    const cart = await this.getCart(userId);
    
    const normVariantId = (item.variantId || "").trim().toLowerCase();
    const itemColor = (item.product?.selectedColor || "").trim().toLowerCase();
    const itemSize = (item.product?.selectedSize || "").trim().toLowerCase();
    const itemProdId = String(item.productId || item.product?.id || item.product?._id || "").trim();

    // Check if item exists in cart
    const existingIndex = cart.items.findIndex((i) => {
      const iProdId = String(i.productId || i.product?.id || i.product?._id || "").trim();
      const sameProduct =
        (iProdId && itemProdId && iProdId === itemProdId) ||
        (Boolean(i.product?.slug) && Boolean(item.product?.slug) && i.product.slug === item.product.slug);

      if (!sameProduct) return false;

      // 1. If both items have selectedColor and/or selectedSize, compare them directly
      const iColor = (i.product?.selectedColor || "").trim().toLowerCase();
      const iSize = (i.product?.selectedSize || "").trim().toLowerCase();
      if ((itemColor || itemSize) && (iColor || iSize)) {
        return iColor === itemColor && iSize === itemSize;
      }

      // 2. Otherwise match by variantId
      const iVariant = String(i.variantId || "").trim().toLowerCase();
      return iVariant === normVariantId;
    });

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += item.quantity;
      if (item.product) {
        cart.items[existingIndex].product = {
          ...(cart.items[existingIndex].product || {}),
          ...item.product,
        };
      }
    } else {
      item.id = item.id || crypto.randomUUID();
      cart.items.push(item);
    }

    const updatedCart = await this.recalculateSummary(cart);
    return await CartRepository.upsert(userId, updatedCart);
  }

  static async updateQuantity(userId: string, productId: string, quantity: number, variantId?: string | null): Promise<ICart> {
    const cart = await this.getCart(userId);
    const normVariantId = (variantId || "").trim().toLowerCase();
    const pIdStr = String(productId).trim();

    const matchesItem = (i: ICartItem) => {
      const matchProd =
        String(i.productId).trim() === pIdStr ||
        (i.product && (
          String(i.product.id || "").trim() === pIdStr ||
          String(i.product._id || "").trim() === pIdStr ||
          String(i.product.slug || "").trim() === pIdStr
        ));
      const matchVar = String(i.variantId || "").trim().toLowerCase() === normVariantId;
      return matchProd && matchVar;
    };

    if (quantity <= 0) {
      cart.items = cart.items.filter((i) => !matchesItem(i));
    } else {
      const item = cart.items.find((i) => matchesItem(i));
      if (item) {
        item.quantity = quantity;
      }
    }

    const updatedCart = await this.recalculateSummary(cart);
    return await CartRepository.upsert(userId, updatedCart);
  }

  static async removeItem(userId: string, productId?: string, variantId?: string | null, itemId?: string | null): Promise<ICart> {
    const cart = await this.getCart(userId);
    const normVariantId = (variantId || "").trim().toLowerCase();
    const pIdStr = productId ? String(productId).trim() : null;

    cart.items = cart.items.filter((i) => {
      // 1. If itemId is provided, match by item.id OR item._id
      if (itemId) {
        if (i.id && String(i.id).trim() === String(itemId).trim()) return false;
        if ((i as any)._id && String((i as any)._id).trim() === String(itemId).trim()) return false;
      }

      // 2. If productId is provided, match by productId or product._id/id/slug
      if (pIdStr) {
        const matchesProductId =
          String(i.productId).trim() === pIdStr ||
          (i.product && (
            String(i.product.id || "").trim() === pIdStr ||
            String(i.product._id || "").trim() === pIdStr ||
            String(i.product.slug || "").trim() === pIdStr
          ));

        if (matchesProductId) {
          if (variantId !== undefined && variantId !== null && variantId !== "") {
            const iVariant = String(i.variantId || "").trim().toLowerCase();
            return iVariant !== normVariantId;
          }
          return false;
        }
      }
      return true;
    });

    const updatedCart = await this.recalculateSummary(cart);
    return await CartRepository.upsert(userId, updatedCart);
  }

  static async syncCart(userId: string, localItems: ICartItem[]): Promise<ICart> {
    const cart = await this.getCart(userId);

    for (const localItem of localItems) {
      const normVariantId = localItem.variantId || "";
      const existingIndex = cart.items.findIndex(
        (i) => i.productId === localItem.productId && (i.variantId || "") === normVariantId
      );
      if (existingIndex > -1) {
        cart.items[existingIndex].quantity += localItem.quantity;
        if (localItem.product) {
          cart.items[existingIndex].product = {
            ...(cart.items[existingIndex].product || {}),
            ...localItem.product,
          };
        }
      } else {
        cart.items.push({
          ...localItem,
          id: localItem.id || crypto.randomUUID(),
        });
      }
    }

    const updatedCart = await this.recalculateSummary(cart);
    return await CartRepository.upsert(userId, updatedCart);
  }

  static async clearCart(userId: string, session?: any): Promise<void> {
    await CartRepository.clear(userId, session);
  }

  static async recalculateSummary(cart: ICart): Promise<ICart> {
    let subtotal = 0;

    for (const item of cart.items) {
      const product = await ProductRepository.findById(item.productId);
      if (product) {
        let price = product.basePrice;
        if (product.specialPrice) {
          const now = new Date();
          const fromDate = product.specialPriceFromDate ? new Date(product.specialPriceFromDate) : null;
          const toDate = product.specialPriceToDate ? new Date(product.specialPriceToDate) : null;
          
          const isStarted = fromDate ? now >= fromDate : true;
          const isNotExpired = toDate ? now <= toDate : true;
          
          if (isStarted && isNotExpired) {
            price = product.specialPrice;
          }
        }
        if (item.variantId && product.variants?.length) {
          const variant = product.variants.find(
            (v) => v.id === item.variantId || v.sku === item.variantId
          );
          if (variant && variant.price) {
            price = variant.price;
          }
        }
        subtotal += price * item.quantity;
        
        // Calculate per-item tax
        const settings = await SettingRepository.getSettings();
        const isInclusive = settings.gstPricingMode !== "exclusive";
        const defaultTaxRate = typeof settings.taxRate === "number" ? settings.taxRate : 18;
        const itemTaxRate = getTaxRateFromClass(product.taxClassName, defaultTaxRate);
        const itemTotal = price * item.quantity;
        const itemTax = isInclusive
          ? calculateInclusiveTax(itemTotal, itemTaxRate).taxAmount
          : calculateTax(itemTotal, itemTaxRate);
        
        // Enrich product details so all devices receive full render data
        item.product = {
          _id: String((product as any)._id || (product as any).id),
          id: String((product as any)._id || (product as any).id),
          name: product.name,
          basePrice: product.basePrice,
          price: price,
          specialPrice: product.specialPrice,
          images: product.images || [],
          image: product.images?.[0]?.url || (item.product?.image || ""),
          slug: product.slug,
          taxClassName: product.taxClassName,
          allowBackorders: product.allowBackorders,
          ...(item.product || {}),
        };
        // Pass the calculated tax back up
        (item as any).calculatedTax = itemTax;
      }
    }

    const settings = await SettingRepository.getSettings();
    const isInclusive = settings.gstPricingMode !== "exclusive";
    const freeShippingThreshold = settings.freeShippingThreshold;
    const shippingCost = settings.shippingCost;
    const defaultTaxRate = typeof settings.taxRate === "number" ? settings.taxRate : 18;

    let totalTax = 0;
    for (const item of cart.items) {
      if ((item as any).calculatedTax !== undefined) {
        totalTax += (item as any).calculatedTax;
        delete (item as any).calculatedTax;
      } else {
        // Fallback for edge cases
        const itemPrice = ((item.product as any)?.price || 0) * item.quantity;
        totalTax += isInclusive
          ? calculateInclusiveTax(itemPrice, defaultTaxRate).taxAmount
          : calculateTax(itemPrice, defaultTaxRate);
      }
    }

    const qualifiesForFreeShipping = freeShippingThreshold > 0 && subtotal >= freeShippingThreshold;
    const shipping = qualifiesForFreeShipping ? 0 : (subtotal > 0 ? shippingCost : 0);
    const total = isInclusive
      ? subtotal + shipping
      : subtotal + totalTax + shipping;

    cart.summary = { subtotal, tax: totalTax, shipping, total };
    return cart;
  }
}
