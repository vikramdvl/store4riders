import crypto from "crypto";
import mongoose from "mongoose";
import { OrderRepository } from "./order.repository";
import { ProductRepository } from "../product/product.repository";
import { CartService } from "../cart/cart.service";
import { UserRepository } from "../user/user.repository";
import { CouponService } from "../coupon/coupon.service";
import { SettingRepository } from "../settings/setting.repository";
import { PaymentRepository } from "../payment/payment.repository";
import { PaymentGatewayFactory } from "../../core/payments/PaymentGatewayFactory";
import { IOrder, IPayment, IExchangeDetails, IExchangeItem } from "@store4riders/shared-types";
import { AppError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "../../core/errors/AppError";
import { signGuestOrderToken, verifyGuestOrderToken } from "../../core/utils/guestOrderToken";
import { addEmailJob } from "../../core/queue/email.queue";
import { logger } from "../../core/utils/logger";
import { ENV } from "../../core/config/env";
import { calculateTax, calculateInclusiveTax, getTaxRateFromClass, parseExchangeNote, findExchangeRequestNote, inferExchangeProgressFromNotes, getExchangeWindowStatus } from "@store4riders/shared-utils";
import { getCache, setCache, deleteCache } from "../../core/cache/redis";
import { withTransactionSafe } from "../../core/database/transaction";

export class OrderService {
  
  static async generateOrderNumber(): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const seq = await OrderRepository.getNextOrderSequence();
    return `OD-S4R-${yy}${mm}${seq}`;
  }

  static async createOrder(userId: string | undefined, input: any) { 
    const { shippingAddressId, shippingAddress, guestEmail, paymentMethod, couponCode, idempotencyKey, customerGstin, businessName } = input;
    const sanitizedGstin = customerGstin ? String(customerGstin).trim().toUpperCase() : undefined;
    const sanitizedBusinessName = businessName ? String(businessName).trim() : undefined;

    if (sanitizedGstin) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(sanitizedGstin)) {
        throw new ValidationError("Invalid 15-digit GSTIN format (e.g. 27AAPCS1234F1Z5)");
      }
      if (!sanitizedBusinessName) {
        throw new ValidationError("Company / Business Name is required when providing a GSTIN");
      }
    }
    
    if (idempotencyKey) {
      const existingOrder = await OrderRepository.findByIdempotencyKey(idempotencyKey);
      if (existingOrder) {
        return {
          orderId: String((existingOrder as any)._id || existingOrder.id),
          gatewayOrderId: existingOrder.gatewayOrderId || "",
          amount: existingOrder.pricing.total,
          orderNumber: existingOrder.orderNumber,
          paymentMethod: existingOrder.paymentMethod,
        };
      }
    }

    let user: any = null;
    if (userId) {
      try {
        user = await UserRepository.findById(userId);
      } catch {}
    }

    const cleanGuestEmail = (guestEmail || input.email || (shippingAddress as any)?.email || "")?.toLowerCase()?.trim() || undefined;
    const cleanUserEmail = user?.email ? String(user.email).toLowerCase().trim() : undefined;
    const resolvedCustomerEmail = cleanGuestEmail || cleanUserEmail || undefined;

    let shippingAddressSnapshot: any;

    if (shippingAddress) {
      shippingAddressSnapshot = {
        fullName: shippingAddress.fullName || input.fullName || (user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "Customer"),
        phone: shippingAddress.phone || input.phone || user?.phone || "0000000000",
        addressLine1: shippingAddress.addressLine1 || shippingAddress.street,
        street: shippingAddress.street || shippingAddress.addressLine1,
        addressLine2: shippingAddress.addressLine2 || "",
        city: shippingAddress.city,
        state: shippingAddress.state,
        pincode: shippingAddress.pincode,
        country: shippingAddress.country,
        ...(resolvedCustomerEmail ? { email: resolvedCustomerEmail } : {}),
      };
    } else if (userId) {
      if (!user) user = await UserRepository.findById(userId);
      if (!user) throw new AppError("User not found", 404);

      const userAddress = user.addresses?.find((a: any) => a.id === shippingAddressId || String(a._id) === shippingAddressId);
      if (!userAddress) throw new AppError("Shipping address not found", 400);

      shippingAddressSnapshot = {
        fullName: input.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.name || "Customer",
        phone: input.phone || user.phone || "0000000000",
        addressLine1: userAddress.addressLine1 || userAddress.street,
        street: userAddress.street || userAddress.addressLine1,
        addressLine2: userAddress.addressLine2 || "",
        city: userAddress.city,
        state: userAddress.state,
        pincode: userAddress.pincode,
        country: userAddress.country,
        ...(resolvedCustomerEmail ? { email: resolvedCustomerEmail } : {}),
      };
    } else {
      throw new AppError("Shipping address is required", 400);
    }

    // Sync or enrich user profile when customer places an order with full name / phone / address
    if (userId && user) {
      try {
        const effectiveFullName = (shippingAddressSnapshot?.fullName || input.fullName || "").trim();
        const effectivePhone = (shippingAddressSnapshot?.phone || input.phone || "").trim();
        const userUpdates: any = {};

        if (effectiveFullName) {
          const parts = effectiveFullName.split(/\s+/);
          const first = parts[0] || "";
          const last = parts.length > 1 ? parts.slice(1).join(" ") : "";
          if (first && (user.lastName === "User" || user.firstName === "Guest" || !user.lastName)) {
            if (first && user.firstName !== first) userUpdates.firstName = first;
            if (last && user.lastName !== last) userUpdates.lastName = last;
            else if (user.lastName === "User" && !last) userUpdates.lastName = "";
          }
        }

        if (effectivePhone && (!user.phone || !user.phone.trim() || user.phone === "0000000000")) {
          userUpdates.phone = effectivePhone;
        }

        // Auto-save delivery address if user has no saved addresses
        if ((!user.addresses || user.addresses.length === 0) && (shippingAddressSnapshot?.addressLine1 || shippingAddressSnapshot?.street)) {
          userUpdates.addresses = [{
            id: crypto.randomUUID(),
            street: shippingAddressSnapshot.addressLine1 || shippingAddressSnapshot.street || "",
            city: shippingAddressSnapshot.city || "",
            state: shippingAddressSnapshot.state || "",
            pincode: shippingAddressSnapshot.pincode || "",
            country: shippingAddressSnapshot.country || "India",
            isDefault: true,
          }];
        }

        if (Object.keys(userUpdates).length > 0) {
          await UserRepository.update(userId, userUpdates);
          if (userUpdates.firstName) user.firstName = userUpdates.firstName;
          if (userUpdates.lastName !== undefined) user.lastName = userUpdates.lastName;
          if (userUpdates.phone) user.phone = userUpdates.phone;
          if (userUpdates.addresses) user.addresses = userUpdates.addresses;
        }
      } catch (err) {
        logger.warn(`Failed to auto-sync user profile during order creation: ${err}`);
      }
    }

    let cartItems = input.items || [];
    
    // Fallback to database cart if not provided in payload (only for logged-in users)
    if (cartItems.length === 0 && userId) {
      const cart = await CartService.getCart(userId);
      if (cart && cart.items) {
        cartItems = cart.items;
      }
    }

    // SERVER-SIDE SERVICEABILITY GATE — prevents orders for undeliverable pincodes
    // Frontend check is just UX; this is the real backend guard. Cannot be bypassed.
    const pincode = shippingAddressSnapshot.pincode;
    if (pincode && /^\d{6}$/.test(pincode)) {
      try {
        const { ShipmentService } = await import("../shipping/shipment.service");
        const serviceability = await ShipmentService.checkServiceability(pincode, 0.5, paymentMethod === "cod");
        
        // Check if ANY provider can deliver to this pincode
        if (!serviceability.serviceable) {
          throw new AppError(
            `Delivery is not available for pincode ${pincode}. Please use a different shipping address.`,
            400
          );
        }

        // If COD order, check if any provider supports COD at this pincode
        if (paymentMethod === "cod") {
          if (!serviceability.codAvailable) {
            throw new AppError(
              `Cash on Delivery is not available for pincode ${pincode}. Please use online payment.`,
              400
            );
          }
        }
      } catch (error: any) {
        // If it's our AppError (serviceability failed), re-throw it
        if (error instanceof AppError) throw error;
        // If external API failed, log warning but allow order (graceful degradation)
        // We don't want courier API downtime to block all orders
        logger.warn(`[OrderService] Serviceability check failed for pincode ${pincode}, allowing order: ${error.message}`);
      }
    }

    const settings = await SettingRepository.getSettings();
    const defaultTaxRate = typeof settings.taxRate === "number" ? settings.taxRate : 18;
    const freeShippingThreshold = settings.freeShippingThreshold || 0;
    const shippingCost = settings.shippingCost || 0;

    let subtotal = 0;
    let totalTax = 0;
    let discount = 0;
    const orderItems: any[] = [];

    for (const item of cartItems) {
      const product = await ProductRepository.findById(item.productId);
      if (!product) throw new AppError(`Product ${item.productId} not found`, 404);

      let unitPrice = product.basePrice;
      if (product.specialPrice) {
        const now = new Date();
        const fromDate = product.specialPriceFromDate ? new Date(product.specialPriceFromDate) : null;
        const toDate = product.specialPriceToDate ? new Date(product.specialPriceToDate) : null;
        
        const isStarted = fromDate ? now >= fromDate : true;
        const isNotExpired = toDate ? now <= toDate : true;
        
        if (isStarted && isNotExpired) {
          unitPrice = product.specialPrice;
        }
      }
      if (item.variantId) {
        const variant = product.variants?.find((v: any) => v.id === item.variantId || v.sku === item.variantId);
        if (variant) {
          unitPrice = (variant.specialPrice && variant.specialPrice > 0) ? variant.specialPrice : variant.price;
        }
      }

      const itemTotal = unitPrice * item.quantity;
      subtotal += itemTotal;
      
      const isInclusive = settings.gstPricingMode !== "exclusive";
      const itemTaxRate = getTaxRateFromClass(product.taxClassName, defaultTaxRate);
      const itemTax = isInclusive
        ? calculateInclusiveTax(itemTotal, itemTaxRate).taxAmount
        : calculateTax(itemTotal, itemTaxRate);
      totalTax += itemTax;

      const itemHsnCode = (item.variantId ? product.variants?.find((v: any) => v.id === item.variantId || v.sku === item.variantId)?.hsnCode : undefined) || product.hsnCode || "";

      const variantObj = item.variantId ? product.variants?.find((v: any) => v.id === item.variantId || v.sku === item.variantId) : null;
      let itemImage = (variantObj as any)?.imageUrl
        || (variantObj as any)?.image
        || (variantObj as any)?.images?.[0]?.url
        || "";

      if (!itemImage && variantObj?.attributes?.color && Array.isArray(product.images) && product.images.length > 0) {
        const vCol = String(variantObj.attributes.color).trim().toLowerCase();
        const matched = product.images.find((img: any) => {
          const alt = (img?.altText || "").toLowerCase();
          const url = (img?.url || "").toLowerCase();
          return alt.includes(vCol) || url.includes(vCol);
        });
        if (matched?.url) itemImage = matched.url;
      }

      if (!itemImage) {
        itemImage = product.images?.[0]?.url
          || (product as any).thumbnail
          || (product as any).image
          || "";
      }

      const rawShipCost = product.attributes instanceof Map
        ? product.attributes.get("ship_cost")
        : (product.attributes as any)?.ship_cost;
      const itemShipCost = Number(rawShipCost) || (product as any).shippingFee || 0;
      const isItemFreeShipping = itemShipCost > 0 ? false : Boolean(product.isFreeShipping);

      const itemWeight =
        variantObj?.weight && Number(variantObj.weight) > 0
          ? Number(variantObj.weight)
          : product.weight && Number(product.weight) > 0
          ? Number(product.weight)
          : undefined;
      const itemWeightUnit =
        variantObj?.weight && Number(variantObj.weight) > 0
          ? (variantObj as any).weightUnit || product.weightUnit || "kg"
          : product.weightUnit || "kg";
      const itemLength =
        variantObj?.length && Number(variantObj.length) > 0
          ? Number(variantObj.length)
          : product.length && Number(product.length) > 0
          ? Number(product.length)
          : undefined;
      const itemBreadth =
        variantObj?.breadth && Number(variantObj.breadth) > 0
          ? Number(variantObj.breadth)
          : product.breadth && Number(product.breadth) > 0
          ? Number(product.breadth)
          : undefined;
      const itemHeight =
        variantObj?.height && Number(variantObj.height) > 0
          ? Number(variantObj.height)
          : product.height && Number(product.height) > 0
          ? Number(product.height)
          : undefined;
      const itemDimensionUnit = (variantObj as any)?.dimensionUnit || product.dimensionUnit || "cm";

      orderItems.push({
        productId: String(product._id),
        variantId: item.variantId,
        name: product.name,
        sku: item.variantId ? (variantObj?.sku || product.sku) : product.sku,
        quantity: item.quantity,
        unitPrice,
        taxRate: itemTaxRate,
        taxAmount: itemTax,
        hsnCode: itemHsnCode,
        allowBackorders: product.allowBackorders,
        isFreeShipping: isItemFreeShipping,
        shippingFee: itemShipCost > 0 ? itemShipCost : 0,
        image: itemImage,
        slug: product.slug || "",
        ...(itemWeight !== undefined ? { weight: itemWeight, weightUnit: itemWeightUnit } : {}),
        ...(itemLength !== undefined ? { length: itemLength } : {}),
        ...(itemBreadth !== undefined ? { breadth: itemBreadth } : {}),
        ...(itemHeight !== undefined ? { height: itemHeight } : {}),
        ...(itemLength !== undefined || itemBreadth !== undefined || itemHeight !== undefined
          ? { dimensionUnit: itemDimensionUnit }
          : {}),
      });
    }

    let couponDiscount = 0;
    if (couponCode) {
      if (!userId) {
        throw new AppError("Please sign in or create an account to use promo coupons", 401);
      }
      const couponResult = await CouponService.validateCoupon({
        code: couponCode,
        items: cartItems,
        cartTotal: subtotal,
        userId,
      });
      couponDiscount = couponResult.discountAmount;
      // Pro-rate tax reduction if coupon applies and round to 2 decimals
      if (subtotal > 0) {
        totalTax = totalTax * (1 - (couponDiscount / subtotal));
        totalTax = Math.round(totalTax * 100) / 100;
      }
    }

    const discountedSubtotal = Math.max(0, subtotal - couponDiscount);

    const isInclusive = settings.gstPricingMode !== "exclusive";
    const allFreeShipping = orderItems.length > 0 && orderItems.every((item: any) => item.isFreeShipping);
    const qualifiesForFreeShipping = allFreeShipping || (freeShippingThreshold > 0 && discountedSubtotal >= freeShippingThreshold);

    // Calculate maximum heavy freight item surcharge if applicable
    const maxItemShippingSurcharge = orderItems.reduce((max: number, item: any) => Math.max(max, item.shippingFee || 0), 0);
    const applicableStandardShipping = Math.max(shippingCost, maxItemShippingSurcharge);

    const shipping = qualifiesForFreeShipping
      ? (maxItemShippingSurcharge > 0 ? maxItemShippingSurcharge : 0)
      : (discountedSubtotal > 0 ? applicableStandardShipping : 0);

    // COD Cash Handling Charges (Tiered couriers fee configurable via Admin Settings)
    let codHandlingFee = 0;
    if (paymentMethod === "cod" && settings.codHandlingFeeEnabled !== false) {
      const threshold = typeof settings.codHandlingFeeThreshold === "number" ? settings.codHandlingFeeThreshold : 5000;
      const tier1 = typeof settings.codHandlingFeeTier1Amount === "number" ? settings.codHandlingFeeTier1Amount : 100;
      const tier2 = typeof settings.codHandlingFeeTier2Amount === "number" ? settings.codHandlingFeeTier2Amount : 200;
      codHandlingFee = discountedSubtotal <= threshold ? tier1 : tier2;
    }

    const totalAmount = Math.round((isInclusive
      ? discountedSubtotal + shipping + codHandlingFee
      : discountedSubtotal + totalTax + shipping + codHandlingFee) * 100) / 100;

    const pricing: any = {
      subtotal,
      discount,
      couponCode,
      couponDiscount,
      tax: totalTax,
      taxRate: defaultTaxRate, // Keep for backward compatibility or display
      shipping,
      codHandlingFee,
      total: totalAmount
    };

    let gatewayAmount = totalAmount;
    let collectGatewayForCod = false;
    let actualGatewayType = paymentMethod;

    if (paymentMethod === "cod") {
      pricing.codAmountToCollect = totalAmount;
      if (settings.codPartialPaymentEnabled && settings.codPartialPaymentType && settings.codPartialPaymentValue && ENV.PAYU_MERCHANT_KEY && ENV.PAYU_SALT) {
        let partialAmount = 0;
        if (settings.codPartialPaymentType === "percentage") {
          partialAmount = (totalAmount * settings.codPartialPaymentValue) / 100;
        } else if (settings.codPartialPaymentType === "fixed") {
          partialAmount = settings.codPartialPaymentValue;
        }
        
        if (partialAmount > 0 && partialAmount < totalAmount) {
          pricing.codPartialPaymentAmount = partialAmount;
          pricing.codAmountToCollect = totalAmount - partialAmount;
          gatewayAmount = partialAmount;
          collectGatewayForCod = true;
          // When COD requires partial payment, default to PayU for the partial amount collection
          actualGatewayType = "payu";
        }
      }
    }

    if (paymentMethod === "snapmint") {
      // Lock Snapmint payment record amount to rounded integer rupee matching SnapmintGateway's orderValue payload
      gatewayAmount = Math.round(totalAmount);
      const snapmintMin = typeof settings.snapmintMinOrderValue === "number" ? settings.snapmintMinOrderValue : 0;

      if (snapmintMin > 0 && totalAmount < snapmintMin) {
        throw new AppError(
          `Snapmint Cardless EMI is applicable on orders above ₹${snapmintMin.toLocaleString("en-IN")} (Current order: ₹${Math.round(totalAmount)}). Please choose another payment method or add more items to your cart.`,
          400
        );
      }
    }

    const orderNumber = await this.generateOrderNumber();

    let resultData: any;
    let postCommitEmails: Array<[string, string, string]> = [];
    // Cache gateway session across MongoDB TransientTransactionError retries so S2S gateways (Snapmint) are called at most once
    let cachedGatewayResult: { gatewayOrderId: string; gatewayResponse: any } | null = null;
    try {
      resultData = await withTransactionSafe(async (session) => {
      postCommitEmails = [];
      // If guestEmail was explicitly provided and does not match the active session user,
      // save it as a guest order so it can be claimed/linked by the guest upon register/login
      const isMismatchedUser = Boolean(userId && user && cleanGuestEmail && user.email?.toLowerCase().trim() !== cleanGuestEmail);
      const effectiveUserId = isMismatchedUser ? undefined : userId;
      const effectiveGuestEmail = cleanGuestEmail || (!effectiveUserId ? cleanUserEmail : undefined);

      const orderData: Partial<IOrder> = {
        orderNumber,
        ...(effectiveUserId ? { userId: effectiveUserId } : {}),
        ...(effectiveGuestEmail ? { guestEmail: effectiveGuestEmail } : {}),
        ...(resolvedCustomerEmail ? { customerEmail: resolvedCustomerEmail } : {}),
        status: "pending_payment", // Even for pure COD without partial, we might keep it pending until manual confirm, or auto confirm. We will leave it pending_payment
        pricing,
        items: orderItems,
        shippingAddress: shippingAddressSnapshot,
        paymentMethod,
        ...(sanitizedGstin ? { customerGstin: sanitizedGstin } : {}),
        ...(sanitizedBusinessName ? { businessName: sanitizedBusinessName } : {}),
        idempotencyKey,
      };

      const order = await OrderRepository.create(orderData, session);
      const orderIdStr = String((order as any)._id || (order as any).id || "");
      
      let gatewayOrderId = "";
      let gatewayResponse: any = null;
      
      if (paymentMethod !== "cod" || collectGatewayForCod) {
        if (!cachedGatewayResult) {
          const gateway = PaymentGatewayFactory.create(actualGatewayType);
          cachedGatewayResult = await gateway.createOrder(
            {
              ...orderData,
              id: orderIdStr,
              userEmail: user?.email,
              snapmintMinOrderValue: settings.snapmintMinOrderValue,
              ...(input.clientIp ? { clientIp: input.clientIp } : {}),
            } as any,
            gatewayAmount
          );
        }
        gatewayOrderId = cachedGatewayResult.gatewayOrderId;
        gatewayResponse = cachedGatewayResult.gatewayResponse;
        
        await PaymentRepository.create({
          orderId: orderIdStr,
          status: "created",
          amount: gatewayAmount,
          gatewayOrderId,
          method: paymentMethod as any,
          gateway: actualGatewayType as any,
          webhookEvents: [],
          idempotencyKey,
        }, session);
      } else {
        // Pure COD without partial payment online
        
        let allStockDecremented = true;
        const decrementedItems = [];
        if (orderItems && orderItems.length > 0) {
          for (const itm of orderItems) {
            const success = await ProductRepository.decrementStock(itm.productId, itm.variantId, itm.quantity, session);
            if (success) {
              decrementedItems.push(itm);
            } else {
              allStockDecremented = false;
              break;
            }
          }
        }

        if (!allStockDecremented) {
          for (const itm of decrementedItems) {
            await ProductRepository.incrementStock(itm.productId, itm.variantId, itm.quantity, session);
          }
          throw new AppError("Insufficient stock for one or more items", 400); // Throws out of transaction since it's COD, it won't have payment to refund
        }

        // Auto-confirm the order since there's no gateway involved
        await OrderRepository.updateStatus(orderIdStr, "confirmed", {}, session);
        
        for (const itm of orderItems) {
          await ProductRepository.incrementSalesCount(itm.productId, itm.quantity, session);
        }
        if (couponCode) {
          await CouponService.incrementUsage(couponCode, userId, session);
        }
        if (userId) {
          await CartService.clearCart(userId, session);
        }
        if (user?.email || guestEmail) {
          const emailTarget = user?.email || guestEmail;
          postCommitEmails.push([emailTarget, "Order Confirmed (Cash on Delivery)", `Your order #${orderNumber} has been placed successfully via Cash on Delivery.`]);
        }
      }

      if (gatewayOrderId) {
        await OrderRepository.updateStatus(orderIdStr, "pending_payment", {
          gatewayOrderId,
        }, session);
      }

      return { 
        orderId: orderIdStr, 
        gatewayOrderId: gatewayOrderId, 
        amount: gatewayAmount, 
        orderNumber,
        gatewayResponse,
        paymentMethod: actualGatewayType,
        ...(!userId
          ? { guestOrderToken: signGuestOrderToken(gatewayOrderId || orderNumber, guestEmail) }
          : {}),
      };
      });
    } catch (err: any) {
      if (idempotencyKey && err?.code === 11000) {
        const existingOrder = await OrderRepository.findByIdempotencyKey(idempotencyKey);
        if (existingOrder) {
          return {
            orderId: String((existingOrder as any)._id || existingOrder.id),
            gatewayOrderId: existingOrder.gatewayOrderId || "",
            amount: existingOrder.pricing.total,
            orderNumber: existingOrder.orderNumber,
            paymentMethod: existingOrder.paymentMethod,
            ...(!userId && !existingOrder.userId
              ? {
                  guestOrderToken: signGuestOrderToken(
                    existingOrder.gatewayOrderId || existingOrder.orderNumber,
                    (existingOrder as any).guestEmail || existingOrder.shippingAddress?.email
                  ),
                }
              : {}),
          };
        }
      }
      throw err;
    }

    for (const [to, subject, body] of postCommitEmails) {
      addEmailJob(to, subject, body);
    }

    if (resultData) {
      try {
        const { adminEventHub } = await import("../../core/events/adminEventHub");
        adminEventHub.publish("ORDER_CREATED", {
          orderId: (resultData as any).orderId,
          orderNumber: (resultData as any).orderNumber,
          paymentMethod: (resultData as any).paymentMethod,
          amount: (resultData as any).amount,
        });
      } catch {}
    }

    return resultData;
  }

  private static async executeStockFailureAutoRefund(
    order: any,
    payment: any,
    gatewayPaymentId?: string,
    contextLabel = "OrderService"
  ): Promise<{ refunded: boolean; refundId?: string; errorMessage?: string }> {
    const orderIdStr = String(order?._id || order?.id || "");
    const paymentIdStr = String(payment?._id || payment?.id || "");
    const effectiveGatewayPaymentId = gatewayPaymentId || payment?.gatewayPaymentId;

    try {
      const gateway = PaymentGatewayFactory.create(payment.gateway);
      const refundResult = await gateway.initiateRefund({
        ...(payment as unknown as IPayment),
        gatewayPaymentId: effectiveGatewayPaymentId,
      });

      if (refundResult?.success) {
        const refundId = refundResult.refundId || `auto_ref_${Date.now()}`;
        try {
          if (typeof PaymentRepository.addRefund === "function") {
            await PaymentRepository.addRefund(paymentIdStr, {
              refundId,
              amount: Number(payment.amount) || 0,
              status: "processed",
              createdAt: new Date(),
            });
          }
          await PaymentRepository.atomicStatusTransition(
            paymentIdStr,
            "captured",
            "refunded",
            effectiveGatewayPaymentId ? { gatewayPaymentId: effectiveGatewayPaymentId } : {}
          );
          if (orderIdStr) {
            await OrderRepository.updateStatus(orderIdStr, "failed", {
              failureReason: `Insufficient stock after capture; automatic refund initiated (Ref: ${refundId})`,
            });
            await OrderRepository.addNote(orderIdStr, {
              text: `Stock exhausted after payment capture. Automatic refund succeeded (Refund Ref: ${refundId}, Payment Ref: ${effectiveGatewayPaymentId || "N/A"}).`,
              author: "system",
              timestamp: new Date(),
            });
          }
        } catch (persistErr: any) {
          logger.error(`[${contextLabel}] Refund succeeded (${refundId}) but failed persisting refund metadata: ${persistErr.message}`);
        }

        const emailTarget = order?.guestEmail || order?.customerEmail;
        if (emailTarget) {
          addEmailJob(
            emailTarget,
            `Automatic Refund Initiated — Order #${order.orderNumber}`,
            `Your payment of INR ${payment.amount} was captured, but one or more items went out of stock. An automatic refund (Ref: ${refundId}) has been initiated and will credit back per RBI TAT (1-5 business days).`
          );
        }

        logger.info(`[${contextLabel}] Initiated automatic refund (${refundId}) for payment ${paymentIdStr} due to insufficient stock.`);
        return { refunded: true, refundId };
      }

      const reason = refundResult?.message || "Gateway declined automatic refund request";
      throw new Error(reason);
    } catch (err: any) {
      const errMsg = err?.message || "Unknown refund failure";
      logger.error(
        `CRITICAL REFUND ALERT [${contextLabel}]: Stock exhausted after capture for order ${order?.orderNumber || orderIdStr} (Payment ${paymentIdStr}), automatic refund FAILED: ${errMsg}`
      );
      try {
        if (orderIdStr) {
          await OrderRepository.updateStatus(orderIdStr, "failed", {
            failureReason: `URGENT MANUAL REFUND REQUIRED: Stock exhausted after payment capture; automatic refund failed (${errMsg})`,
          });
          await OrderRepository.addNote(orderIdStr, {
            text: `[URGENT MANUAL REFUND REQUIRED] Customer payment of INR ${payment?.amount || 0} captured (Ref: ${effectiveGatewayPaymentId || "N/A"}), but stock ran out and auto-refund failed: ${errMsg}`,
            author: "system",
            timestamp: new Date(),
          });
        }
        const emailTarget = order?.guestEmail || order?.customerEmail;
        if (emailTarget) {
          addEmailJob(
            emailTarget,
            `Order Stock Update & Refund Pending — Order #${order?.orderNumber || orderIdStr}`,
            `We received your payment of INR ${payment?.amount || 0}, however one or more items went out of stock. Our finance team has been alerted to process your refund manually (1-5 business days). Order Ref: #${order?.orderNumber || orderIdStr}.`
          );
        }
      } catch {}
      return { refunded: false, errorMessage: errMsg };
    }
  }

  static async verifyPayment(
    userId: string | undefined,
    gatewayOrderId: string,
    paymentId: string,
    signature: string,
    extraData?: { paymentData?: any; tezResponse?: any; utr?: string; guestToken?: string; requireCallerProof?: boolean }
  ) {
    let stockFailed = false;
    let paymentRecord: any = null;
    let postCommitEmails: Array<[string, string, string]> = [];
    await withTransactionSafe(async (session) => {
      stockFailed = false;
      postCommitEmails = [];
      const paymentByGateway = await PaymentRepository.findByGatewayOrderId(gatewayOrderId, session);
      const order =
        (await OrderRepository.findByGatewayOrderId(gatewayOrderId, session)) ||
        (paymentByGateway?.orderId ? await OrderRepository.findById(paymentByGateway.orderId, session) : null);
      if (!order) throw new AppError("Order not found", 404);

      // Strict ownership check (no bypassing registered-order ownership by omitting auth)
      if (order.userId) {
        if (userId) {
          if (String(order.userId) !== String(userId)) {
            throw new AppError("Order belongs to different user", 403);
          }
        } else if (extraData?.requireCallerProof) {
          throw new UnauthorizedError("Authentication required to verify this order");
        }
      } else if (extraData?.requireCallerProof || extraData?.guestToken !== undefined) {
        if (!verifyGuestOrderToken(extraData?.guestToken, order)) {
          throw new ForbiddenError("Valid guest order verification token is required");
        }
      }

      const orderIdStr = String((order as any)._id || order.id);
      const payment = paymentByGateway
        || (order.gatewayOrderId ? await PaymentRepository.findByGatewayOrderId(order.gatewayOrderId, session) : null)
        || (await PaymentRepository.findByOrderId(orderIdStr, session));
      if (!payment) throw new AppError("Payment record not found", 404);
      paymentRecord = payment;

      const gateway = PaymentGatewayFactory.create(payment.gateway);
      const verifyResult = await gateway.verifyPayment(payment as unknown as IPayment, {
        gatewayOrderId,
        paymentId,
        signature,
        paymentData: extraData?.paymentData,
        tezResponse: extraData?.tezResponse,
        utr: extraData?.utr || (signature && /^\d{12}$/.test(signature) ? signature : undefined),
      });

      if (!verifyResult.success) {
        throw new AppError(verifyResult.message || "Payment verification failed", 400);
      }

      if (payment.paymentPurpose === "exchange_fee") {
        await this.applyExchangeFeeCapture(
          order,
          payment,
          verifyResult.gatewayPaymentId || paymentId || gatewayOrderId,
          session
        );
        return;
      }

      if (order.status !== "confirmed") {
        const orderIdStr = String((order as any)._id || order.id);
        
        let allStockDecremented = true;
        const decrementedItems = [];
        if (order.items && order.items.length > 0) {
          for (const itm of order.items) {
            const success = await ProductRepository.decrementStock(itm.productId, itm.variantId, itm.quantity, session);
            if (success) {
              decrementedItems.push(itm);
            } else {
              allStockDecremented = false;
              break;
            }
          }
        }

        const paymentIdStr = String((payment as any)._id || payment.id);
        const fromVerifyStatuses = ["created", "pending", "failed"] as any;

        if (!allStockDecremented) {
          // Manual rollback of stock
          for (const itm of decrementedItems) {
            await ProductRepository.incrementStock(itm.productId, itm.variantId, itm.quantity, session);
          }

          const racedInsufficientStock = await PaymentRepository.atomicStatusTransition(
            paymentIdStr,
            fromVerifyStatuses,
            "captured",
            { gatewayPaymentId: verifyResult.gatewayPaymentId },
            session
          );
          if (racedInsufficientStock === null) {
            return;
          }

          await OrderRepository.updateStatus(orderIdStr, "failed", { paymentId, paymentSignature: signature }, session);
          stockFailed = true;
          return;
        }

        const transitionedPayment = await PaymentRepository.atomicStatusTransition(
          paymentIdStr,
          fromVerifyStatuses,
          "captured",
          { gatewayPaymentId: verifyResult.gatewayPaymentId },
          session
        );
        if (transitionedPayment === null) {
          for (const itm of decrementedItems) {
            await ProductRepository.incrementStock(itm.productId, itm.variantId, itm.quantity, session);
          }
          logger.info(`verifyPayment skipped duplicate confirmation because payment ${paymentIdStr} was already captured.`);
          return;
        }

        await OrderRepository.updateStatus(orderIdStr, "confirmed", { paymentId, paymentSignature: signature }, session);
        
        for (const itm of order.items) {
          await ProductRepository.incrementSalesCount(itm.productId, itm.quantity, session);
        }

        if (order.pricing && order.pricing.couponCode) {
          await CouponService.incrementUsage(order.pricing.couponCode, order.userId, session);
        }
        if (order.userId) {
          await CartService.clearCart(order.userId, session);
        }

        if (order.userId) {
          const user = await UserRepository.findById(order.userId);
          if (user) {
            postCommitEmails.push([user.email, "Order Confirmed", `Your payment of ${paymentId} was successful.`]);
          }
        } else if (order.guestEmail) {
          postCommitEmails.push([order.guestEmail, "Order Confirmed", `Your payment of ${paymentId} was successful.`]);
        }
      }
    });

    for (const [to, subject, body] of postCommitEmails) {
      addEmailJob(to, subject, body);
    }

    if (stockFailed && paymentRecord) {
      // Initiate refund outside the transaction since it's an external API call
      await this.executeStockFailureAutoRefund(
        { ...(paymentRecord.order || {}), _id: paymentRecord.orderId, orderNumber: gatewayOrderId },
        paymentRecord,
        paymentId,
        "verifyPayment"
      );
      throw new AppError("Insufficient stock for one or more items. Your payment will be refunded.", 400);
    }
  }

  static async handleWebhook(rawBody: string, headers: any, gatewayType: string) {
    // Note: We now expect the gatewayRoute to pass the gatewayType explicitly (e.g. /webhooks/payu)
    if (!gatewayType || gatewayType === "unknown") throw new AppError("Unknown webhook source", 400);

    const gateway = PaymentGatewayFactory.create(gatewayType);
    const event = await gateway.handleWebhook(headers, rawBody);
    
    // Extract info specific to gateway
    let gatewayOrderId = event?.gatewayOrderId || "";
    let eventName = event?.event || "";
    let paymentEntity = event?.payload || null;

    if (!gatewayOrderId) {
      logger.warn(`Webhook received without gatewayOrderId for ${gatewayType}`);
      return { success: false, message: "Missing gatewayOrderId" };
    }

    // Security: Snapmint Checkout 3.0 callbacks lack an HMAC checksum, so never trust a claimed capture or refund without S2S verification
    if (gatewayType === "snapmint" && (eventName === "payment.captured" || eventName === "refund.processed")) {
      try {
        const liveStatus = await gateway.getPaymentStatus(gatewayOrderId);
        const s2sCheck = this.evaluateGatewaySyncResponse("snapmint", gatewayOrderId, liveStatus);
        if (eventName === "payment.captured") {
          if (s2sCheck.isSuccess) {
            if (s2sCheck.gatewayPaymentId && paymentEntity && !paymentEntity.id) {
              paymentEntity.id = s2sCheck.gatewayPaymentId;
            }
          } else if (s2sCheck.isPending) {
            logger.info(`Snapmint webhook capture downgraded to pending after S2S check for ${gatewayOrderId}`);
            eventName = "payment.pending";
          } else {
            logger.error(
              `CRITICAL SECURITY ALERT: Unverified Snapmint capture webhook rejected against S2S status for ${gatewayOrderId}`
            );
            eventName = "payment.failed";
            if (paymentEntity) {
              paymentEntity.isCancelled = s2sCheck.isCancelled;
              paymentEntity.statusMessage = s2sCheck.failureReason || "Rejected by Snapmint S2S verification";
            }
          }
        } else if (eventName === "refund.processed") {
          const snapPayload = liveStatus?.data && typeof liveStatus.data === "object" ? liveStatus.data : liveStatus;
          const liveState = String(snapPayload?.order_status || snapPayload?.status || "").trim().toLowerCase();
          if (!liveState.includes("refund")) {
            logger.warn(`Ignoring unconfirmed Snapmint refund webhook for ${gatewayOrderId} (S2S state: ${liveState || "unknown"})`);
            return { success: false, message: "Unconfirmed Snapmint refund webhook" };
          }
        }
      } catch {
        if (eventName === "payment.captured") {
          eventName = "payment.pending";
        } else {
          return { success: false, message: "Unable to verify Snapmint refund against S2S API" };
        }
      }
    }

    let stockFailed = false;
    let paymentRecord: any = null;
    let finalOrderNumber = "";
    let finalOrderId = "";
    let guestOrderToken: string | undefined = undefined;
    let isExchangeFeePayment = false;
    let postCommitEmails: Array<[string, string, string]> = [];
    let postCommitDisputeAlert: { orderId: string; orderNumber: string; noteText: string; gateway: string } | null = null;

    await withTransactionSafe(async (session) => {
      stockFailed = false;
      postCommitEmails = [];
      postCommitDisputeAlert = null;
      const paymentByGateway = await PaymentRepository.findByGatewayOrderId(gatewayOrderId, session);
      const order =
        (await OrderRepository.findByGatewayOrderId(gatewayOrderId, session)) ||
        (paymentByGateway?.orderId ? await OrderRepository.findById(paymentByGateway.orderId, session) : null);

        if (!order) {
          logger.warn(`Order not found for Gateway Order ID: ${gatewayOrderId}`);
          return;
        }

        finalOrderNumber = order.orderNumber;
        finalOrderId = String((order as any)._id || order.id);
        if (!order.userId) {
          try {
            const guestEmail = (order as any).guestEmail || order.shippingAddress?.email || (order as any).customerEmail || "";
            guestOrderToken = signGuestOrderToken(finalOrderNumber || gatewayOrderId, guestEmail);
          } catch {}
        }

        let payment = paymentByGateway;
        if (!payment) {
          payment = await PaymentRepository.findByOrderId(finalOrderId, session);
        }
        if (!payment) {
          logger.warn(`Payment not found for Gateway Order ID: ${gatewayOrderId}`);
          return;
        }
        paymentRecord = payment;
        isExchangeFeePayment = payment.paymentPurpose === "exchange_fee";

        const orderIdStr = String((order as any)._id || order.id);
        const paymentIdStr = String((payment as any)._id || payment.id);
        const eventId = headers["x-payu-event-id"] || headers["x-ccavenue-event-id"] || event?.id;

        if (eventId) {
          if (typeof PaymentRepository.claimWebhookEvent === "function") {
            const claimed = await PaymentRepository.claimWebhookEvent(paymentIdStr, eventId, session);
            if (claimed === false) {
              logger.info(`Webhook event ${eventId} already processed for payment ${paymentIdStr}`);
              return;
            }
          } else {
            const alreadyProcessed = await PaymentRepository.hasProcessedEvent(paymentIdStr, eventId);
            if (alreadyProcessed) {
              logger.info(`Webhook event ${eventId} already processed for payment ${paymentIdStr}`);
              return;
            }
            await PaymentRepository.addWebhookEvent(paymentIdStr, eventId, session);
          }
        }

        if (isExchangeFeePayment) {
          if (eventName === "payment.captured") {
            if (paymentEntity?.amount !== undefined && paymentEntity.amount !== null) {
              const receivedAmountPaise = Math.round(Number(paymentEntity.amount) * 100);
              const expectedAmountPaise = Math.round(Number(payment.amount) * 100);
              if (Number.isNaN(receivedAmountPaise) || receivedAmountPaise < expectedAmountPaise) {
                logger.error(
                  `CRITICAL SECURITY ALERT: Exchange fee amount tampering detected for order ${orderIdStr}! Expected ₹${payment.amount}, received ₹${paymentEntity.amount}`
                );
                await PaymentRepository.atomicStatusTransition(
                  paymentIdStr,
                  ["created", "pending"],
                  "failed",
                  {},
                  session
                );
                return;
              }
            }
            await this.applyExchangeFeeCapture(
              order,
              payment,
              paymentEntity?.id || gatewayOrderId,
              session
            );
          } else if (eventName === "payment.pending") {
            await PaymentRepository.atomicStatusTransition(
              paymentIdStr,
              "created",
              "pending",
              { ...(paymentEntity?.id ? { gatewayPaymentId: paymentEntity.id } : {}) },
              session
            );
          } else if (eventName === "payment.failed") {
            await PaymentRepository.atomicStatusTransition(
              paymentIdStr,
              ["created", "pending"],
              "failed",
              {},
              session
            );
          }
          return;
        }

        if (eventName === "payment.captured") {
          if (["confirmed", "processing", "packed", "shipped", "delivered"].includes(order.status)) return;

          // CRITICAL SECURITY: Verify payment amount matches order payment record amount
          if (paymentEntity?.amount !== undefined && paymentEntity.amount !== null) {
            const receivedAmountPaise = Math.round(Number(paymentEntity.amount) * 100);
            const expectedAmountPaise = Math.round(Number(payment.amount) * 100);
            if (Number.isNaN(receivedAmountPaise) || receivedAmountPaise < expectedAmountPaise) {
              logger.error(
                `CRITICAL SECURITY ALERT: Payment amount tampering detected for order ${orderIdStr}! Expected ₹${payment.amount}, received ₹${paymentEntity.amount}`
              );
              await OrderRepository.updateStatus(orderIdStr, "failed", {
                failureReason: `Amount tampering detected: expected ₹${payment.amount}, received ₹${paymentEntity.amount}`
              }, session);
              await PaymentRepository.atomicStatusTransition(
                paymentIdStr,
                ["created", "pending"],
                "failed",
                {},
                session
              );
              return;
            }
          }
          
          let allStockDecremented = true;
          const decrementedItems = [];
          if (order.items && order.items.length > 0) {
            for (const itm of order.items) {
              const success = await ProductRepository.decrementStock(itm.productId, itm.variantId, itm.quantity, session);
              if (success) {
                decrementedItems.push(itm);
              } else {
                allStockDecremented = false;
                break;
              }
            }
          }

          const fromCaptureStatuses = payment.status === "failed" ? ["created", "pending", "failed"] as any : ["created", "pending"] as any;

          if (!allStockDecremented) {
            for (const itm of decrementedItems) {
              await ProductRepository.incrementStock(itm.productId, itm.variantId, itm.quantity, session);
            }

            const racedInsufficientStock = await PaymentRepository.atomicStatusTransition(
              paymentIdStr,
              fromCaptureStatuses,
              "captured",
              { gatewayPaymentId: paymentEntity?.id },
              session
            );
            if (racedInsufficientStock === null) {
              return;
            }

            await OrderRepository.updateStatus(orderIdStr, "failed", { paymentId: paymentEntity?.id }, session);
            stockFailed = true;
            return;
          }

          // Atomic guard prevents duplicate stock/coupon/email side effects if concurrent webhook/sync-payment already captured payment
          const transitionedPayment = await PaymentRepository.atomicStatusTransition(
            paymentIdStr,
            fromCaptureStatuses,
            "captured",
            { gatewayPaymentId: paymentEntity?.id },
            session
          );
          if (transitionedPayment === null) {
            for (const itm of decrementedItems) {
              await ProductRepository.incrementStock(itm.productId, itm.variantId, itm.quantity, session);
            }
            logger.info(`Webhook skipped duplicate side effects for order ${orderIdStr} (already captured concurrently).`);
            return;
          }

          await OrderRepository.updateStatus(orderIdStr, "confirmed", { paymentId: paymentEntity?.id }, session);
          
          for (const itm of order.items) {
            await ProductRepository.incrementSalesCount(itm.productId, itm.quantity, session);
          }

          if (order.pricing && order.pricing.couponCode) {
            await CouponService.incrementUsage(order.pricing.couponCode, order.userId, session);
          }
          if (order.userId) {
            await CartService.clearCart(order.userId, session);
          }

          if (order.userId) {
            const user = await UserRepository.findById(order.userId);
            if (user) {
              postCommitEmails.push([user.email, "Order Confirmed", `Your payment was successfully captured.`]);
            }
          } else if (order.guestEmail) {
            postCommitEmails.push([order.guestEmail, "Order Confirmed", `Your payment was successfully captured.`]);
          }
          logger.info(`Webhook successfully processed order ${orderIdStr}`);
        } 
        else if (eventName === "payment.pending") {
          // Keep order in pending_payment and do not fire a premature failure email while bank settles
          await PaymentRepository.atomicStatusTransition(
            paymentIdStr,
            "created",
            "pending",
            { ...(paymentEntity?.id ? { gatewayPaymentId: paymentEntity.id } : {}) },
            session
          );
          logger.info(`Webhook recorded pending payment confirmation for order ${orderIdStr}`);
        }
        else if (eventName === "payment.failed") {
          if (order.status !== "pending_payment") return;
          const failureReason = event?.payload?.statusMessage || event?.payload?.error_Message || (event?.payload?.status ? `Payment failed: ${event.payload.status}` : "Payment declined or cancelled by customer at gateway");
          await OrderRepository.updateStatus(orderIdStr, "failed", { failureReason }, session);
          await PaymentRepository.atomicStatusTransition(paymentIdStr, ["created", "pending"], "failed", {}, session);
          
          if (order.userId) {
            const user = await UserRepository.findById(order.userId);
            if (user) {
              postCommitEmails.push([user.email, "Payment Failed", `Your payment attempt failed: ${failureReason}. Please try again.`]);
            }
          } else if (order.guestEmail) {
            postCommitEmails.push([order.guestEmail, "Payment Failed", `Your payment attempt failed: ${failureReason}. Please try again.`]);
          }
          logger.info(`Webhook processed failure for order ${orderIdStr}: ${failureReason}`);
        }
        else if (eventName === "refund.processed") {
          const parsedRefundAmt = Number(paymentEntity?.amount);
          const refundAmount = Number.isFinite(parsedRefundAmt) && parsedRefundAmt > 0 ? parsedRefundAmt : (Number(payment.amount) || 0);
          const refundRefId = String(paymentEntity?.refundId || paymentEntity?.bankArn || paymentEntity?.id || eventId || `wh_ref_${Date.now()}`);
          const existingRefunds: any[] = Array.isArray(payment.refunds) ? payment.refunds : [];
          const alreadyLoggedRefund = existingRefunds.some((r: any) => String(r?.refundId || "") === refundRefId);
          const refundedSoFar = existingRefunds.reduce((sum: number, r: any) => sum + (Number(r?.amount) || 0), 0);
          const newTotalRefunded = refundedSoFar + (alreadyLoggedRefund ? 0 : refundAmount);
          const paymentTotal = Number(payment.amount) || refundAmount;
          const isFullRefund = paymentTotal > 0 ? newTotalRefunded + 0.01 >= paymentTotal : true;

          if (!alreadyLoggedRefund && refundAmount > 0 && typeof PaymentRepository.addRefund === "function") {
            await PaymentRepository.addRefund(
              paymentIdStr,
              {
                refundId: refundRefId,
                amount: refundAmount,
                status: "processed",
                createdAt: new Date(),
              },
              session
            );
          }

          await PaymentRepository.atomicStatusTransition(
            paymentIdStr,
            ["captured", "partially_refunded"],
            isFullRefund ? "refunded" : "partially_refunded",
            {},
            session
          );

          if (isFullRefund && order.status !== "refunded") {
            if (["confirmed", "processing", "packed"].includes(order.status)) {
              for (const itm of order.items || []) {
                await ProductRepository.incrementStock(itm.productId, itm.variantId, itm.quantity, session);
                await ProductRepository.decrementSalesCount(itm.productId, itm.quantity, session);
              }
            }
            await OrderRepository.updateStatus(orderIdStr, "refunded", null, session);
          }

          if (typeof OrderRepository.addNote === "function") {
            await OrderRepository.addNote(
              orderIdStr,
              {
                text: `${isFullRefund ? "Full" : "Partial"} refund confirmed by ${gatewayType.toUpperCase()} webhook (Ref: ${refundRefId}, Amount: INR ${refundAmount}).`,
                author: "system",
                timestamp: new Date(),
              },
              session
            );
          }

          if (order.userId) {
            const user = await UserRepository.findById(order.userId);
            if (user) {
              postCommitEmails.push([user.email, "Refund Processed", `Your refund of INR ${refundAmount} has been processed (Ref: ${refundRefId}).`]);
            }
          } else if (order.guestEmail) {
            postCommitEmails.push([order.guestEmail, "Refund Processed", `Your refund of INR ${refundAmount} has been processed (Ref: ${refundRefId}).`]);
          }
          logger.info(`Webhook processed ${isFullRefund ? "full" : "partial"} refund for order ${orderIdStr}`);
        }
        else if (eventName === "payment.disputed") {
          const cbId = String(paymentEntity?.disputeId || paymentEntity?.id || eventId || "N/A");
          const cbStatus = String(paymentEntity?.disputeStatus || paymentEntity?.status || "Open");
          const cbReason = String(paymentEntity?.reasonCode || paymentEntity?.statusMessage || "Bank/Cardholder Dispute");
          const cbAmount = paymentEntity?.amount ? Number(paymentEntity.amount) : (Number(payment.amount) || 0);
          const dueDate = String(paymentEntity?.dueDate || "Review urgently (RBI URCS 15-day TAT)");
          const noteText = `[CHARGEBACK / DISPUTE ALERT] ${gatewayType.toUpperCase()} Dispute ID: ${cbId} | Status: ${cbStatus} | Disputed Amount: INR ${cbAmount} | Reason: ${cbReason} | Due: ${dueDate}`;

          if (typeof OrderRepository.addNote === "function") {
            await OrderRepository.addNote(
              orderIdStr,
              { text: noteText, author: "system", timestamp: new Date() },
              session
            );
          }
          postCommitDisputeAlert = {
            orderId: orderIdStr,
            orderNumber: finalOrderNumber || gatewayOrderId,
            noteText,
            gateway: gatewayType,
          };
          logger.warn(`Dispute/chargeback webhook recorded for order ${orderIdStr}: ${noteText}`);
        }
      });

    for (const [to, subject, body] of postCommitEmails) {
      addEmailJob(to, subject, body);
    }

    if (postCommitDisputeAlert) {
      const disputeAlert = postCommitDisputeAlert as { orderId: string; orderNumber: string; noteText: string; gateway: string };
      try {
        const { adminEventHub } = await import("../../core/events/adminEventHub");
        adminEventHub.publish("PAYMENT_DISPUTE", {
          orderId: disputeAlert.orderId,
          orderNumber: disputeAlert.orderNumber,
          gateway: disputeAlert.gateway,
          message: disputeAlert.noteText,
        });
      } catch {}
    }

    if (stockFailed && paymentRecord) {
      await this.executeStockFailureAutoRefund(
        { _id: finalOrderId, orderNumber: finalOrderNumber },
        paymentRecord,
        paymentEntity?.id,
        "handleWebhook"
      );
    }

    return {
      success: eventName === "payment.captured" && !stockFailed,
      isPending: eventName === "payment.pending",
      isCancelled: Boolean(paymentEntity?.isCancelled),
      isExchangeFee: isExchangeFeePayment,
      orderNumber: finalOrderNumber || gatewayOrderId,
      orderId: finalOrderId || gatewayOrderId,
      ...(guestOrderToken ? { guestOrderToken } : {}),
      eventName,
      message:
        eventName === "payment.captured"
          ? stockFailed
            ? "Insufficient stock"
            : "Payment captured"
          : eventName === "payment.pending"
          ? "Payment pending bank confirmation"
          : "Payment failed",
    };
  }


  private static evaluateGatewaySyncResponse(gateway: string, gatewayOrderId: string, liveStatus: any, expectedAmount?: number) {
    let isSuccess = false;
    let isPending = false;
    let isCancelled = false;
    let gatewayPaymentId = "";
    let failureReason: string | undefined = undefined;

    if (gateway === "payu") {
      const rawTransObj = liveStatus?.transaction_details?.[gatewayOrderId];
      const transObj = typeof rawTransObj === "object" && rawTransObj !== null ? rawTransObj : null;
      const rawStatus = String(transObj?.status || "").trim().toLowerCase();
      const rawUnmapped = String(transObj?.unmappedstatus || "").trim().toLowerCase();
      const errMsg = String(transObj?.error_Message || transObj?.field9 || "").trim();

      const pendingSet = new Set(["pending", "initiated", "in progress", "in_progress", "auth"]);
      isSuccess = rawStatus === "success" || rawUnmapped === "captured";
      isPending = !isSuccess && (rawStatus === "pending" || pendingSet.has(rawUnmapped) || !transObj);
      isCancelled = !isSuccess && (rawUnmapped.includes("cancel") || errMsg.toLowerCase().includes("cancel"));
      gatewayPaymentId = transObj?.mihpayid || "";

      if (isSuccess && expectedAmount && transObj?.amt !== undefined && transObj?.amt !== "") {
        const paidAmt = parseFloat(String(transObj.amt));
        if (!isNaN(paidAmt) && Math.round(paidAmt * 100) < Math.round(expectedAmount * 100)) {
          logger.error(`PayU sync amount mismatch for ${gatewayOrderId}: expected ${expectedAmount}, got ${paidAmt}`);
          isSuccess = false;
          isPending = false;
          failureReason = "Amount mismatch detected";
        }
      }
      if (!isSuccess && !isPending && errMsg && errMsg.toLowerCase() !== "no error") {
        failureReason = errMsg;
      }
    } else if (gateway === "ccavenue") {
      const ccPayload =
        liveStatus?.Order_Status_Result && typeof liveStatus.Order_Status_Result === "object"
          ? liveStatus.Order_Status_Result
          : liveStatus;
      const ccStatus = String(ccPayload?.order_status || ccPayload?.status || "").trim().toLowerCase();
      const ccErrMsg = String(ccPayload?.status_message || ccPayload?.order_bank_response || "").trim();

      isSuccess =
        ccStatus === "success" ||
        ccStatus === "successful" ||
        ccStatus === "shipped" ||
        ccStatus === "captured";
      isPending =
        !isSuccess &&
        (!ccStatus ||
          ccStatus === "awaited" ||
          ccStatus === "initiated" ||
          ccStatus === "pending" ||
          ccStatus === "timeout" ||
          ccStatus === "unknown" ||
          ccStatus === "network_error");
      isCancelled =
        !isSuccess &&
        !isPending &&
        (ccStatus === "aborted" ||
          ccStatus === "cancelled" ||
          ccStatus === "cancel" ||
          ccStatus === "user cancelled");
      gatewayPaymentId = String(ccPayload?.tracking_id || ccPayload?.reference_no || "");

      const ccAmtRaw = ccPayload?.order_amt ?? ccPayload?.amount;
      if (isSuccess && expectedAmount && ccAmtRaw !== undefined && ccAmtRaw !== "") {
        const paidAmt = parseFloat(String(ccAmtRaw));
        if (!isNaN(paidAmt) && Math.round(paidAmt * 100) < Math.round(expectedAmount * 100)) {
          logger.error(`CCAvenue sync amount mismatch for ${gatewayOrderId}: expected ${expectedAmount}, got ${paidAmt}`);
          isSuccess = false;
          isPending = false;
          failureReason = "Amount mismatch detected";
        }
      }
      if (!isSuccess && !isPending && ccErrMsg && !failureReason) {
        failureReason = ccErrMsg;
      }
    } else if (gateway === "snapmint") {
      const snapPayload =
        liveStatus?.data && typeof liveStatus.data === "object" ? liveStatus.data : liveStatus;
      const snapStatus = String(
        snapPayload?.order_status || snapPayload?.status || snapPayload?.payment_status || ""
      )
        .trim()
        .toLowerCase();
      const snapErrMsg = String(snapPayload?.message || snapPayload?.error || "").trim();

      isSuccess =
        snapStatus === "success" ||
        snapStatus === "completed" ||
        snapStatus === "authorized" ||
        snapStatus === "captured";
      isPending =
        !isSuccess &&
        (!snapStatus ||
          snapStatus === "pending" ||
          snapStatus === "initiated" ||
          snapStatus === "in_progress" ||
          snapStatus === "in progress" ||
          snapStatus === "processing" ||
          snapStatus === "awaited" ||
          snapStatus === "unknown" ||
          snapStatus === "network_error");
      isCancelled =
        !isSuccess &&
        !isPending &&
        (snapStatus === "cancelled" ||
          snapStatus === "canceled" ||
          snapStatus === "aborted" ||
          snapStatus === "user_cancelled");
      gatewayPaymentId = String(snapPayload?.id || snapPayload?.payment_id || snapPayload?.token || "");

      const snapAmtRaw = snapPayload?.orderValue ?? snapPayload?.order_value ?? snapPayload?.amount;
      if (isSuccess && expectedAmount && snapAmtRaw !== undefined && snapAmtRaw !== "") {
        const paidAmt = parseFloat(String(snapAmtRaw));
        if (!isNaN(paidAmt) && Math.round(paidAmt * 100) < Math.round(expectedAmount * 100)) {
          logger.error(`Snapmint sync amount mismatch for ${gatewayOrderId}: expected ${expectedAmount}, got ${paidAmt}`);
          isSuccess = false;
          isPending = false;
          failureReason = "Amount mismatch detected";
        }
      }
      if (!isSuccess && !isPending && snapErrMsg && !failureReason) {
        failureReason = snapErrMsg;
      }
    } else if (gateway === "upi" || gateway === "gpay") {
      isSuccess = liveStatus?.status === "SUCCESS" || liveStatus?.isSuccess === true;
      isPending = !isSuccess && String(liveStatus?.status || "").toUpperCase() === "PENDING";
      gatewayPaymentId = liveStatus?.gatewayPaymentId || "";
    }

    const gatewayStatus = isSuccess
      ? "confirmed"
      : isPending
      ? "pending"
      : isCancelled
      ? "cancelled"
      : "failed";

    return { isSuccess, isPending, isCancelled, gatewayPaymentId, failureReason, gatewayStatus };
  }

  static async syncPaymentStatus(
    orderIdOrNumber: string,
    userId?: string,
    options?: { requireCallerProof?: boolean; guestToken?: string; includeGuestToken?: boolean }
  ) {
    const isObjectId = mongoose.Types.ObjectId.isValid(orderIdOrNumber);
    const paymentByGateway = await PaymentRepository.findByGatewayOrderId(orderIdOrNumber);
    const order = await OrderRepository.findByGatewayOrderId(orderIdOrNumber) 
      || (isObjectId ? await OrderRepository.findById(orderIdOrNumber) : null)
      || (paymentByGateway?.orderId ? await OrderRepository.findById(paymentByGateway.orderId) : null);

    if (!order) {
      throw new NotFoundError("Order");
    }

    if (order.userId) {
      if (userId) {
        if (String(order.userId) !== String(userId)) {
          throw new AppError("Unauthorized access to this order", 403);
        }
      } else if (options?.requireCallerProof) {
        throw new UnauthorizedError("Authentication required to access this order");
      }
    } else if (options?.requireCallerProof || options?.guestToken !== undefined) {
      if (!verifyGuestOrderToken(options?.guestToken, order)) {
        throw new ForbiddenError("Valid guest order verification token is required");
      }
    } else if (userId) {
      const caller = await UserRepository.findById(userId);
      const callerEmail = String(caller?.email || "").trim().toLowerCase();
      const orderEmail = String(
        (order as any).guestEmail || order.shippingAddress?.email || (order as any).customerEmail || ""
      )
        .trim()
        .toLowerCase();
      if (!callerEmail || !orderEmail || callerEmail !== orderEmail) {
        throw new AppError("Unauthorized access to this order", 403);
      }
    }

    const orderIdStr = String((order as any)._id || order.id);
    const guestTokenSuffix =
      options?.includeGuestToken && !order.userId
        ? {
            guestOrderToken: signGuestOrderToken(
              order.orderNumber || order.gatewayOrderId || orderIdStr,
              (order as any).guestEmail || order.shippingAddress?.email || (order as any).customerEmail || ""
            ),
          }
        : {};

    // Handle Exchange Fee payment sync separately without altering main order confirmed status
    if (paymentByGateway?.paymentPurpose === "exchange_fee") {
      if (order.exchangeDetails?.shippingFeeStatus === "paid_online") {
        return {
          status: order.status,
          orderNumber: order.orderNumber,
          isConfirmed: true,
          isPending: false,
          isCancelled: false,
          gatewayStatus: "confirmed",
          isExchangeFee: true,
          message: "Exchange shipping fee is already paid!",
        };
      }
      try {
        const gateway = PaymentGatewayFactory.create(paymentByGateway.gateway);
        const liveStatus = await gateway.getPaymentStatus(paymentByGateway.gatewayOrderId);
        const evaluated = this.evaluateGatewaySyncResponse(
          paymentByGateway.gateway,
          paymentByGateway.gatewayOrderId,
          liveStatus,
          paymentByGateway.amount
        );

        if (evaluated.isSuccess) {
          await withTransactionSafe(async (session) => {
            await this.applyExchangeFeeCapture(
              order,
              paymentByGateway,
              evaluated.gatewayPaymentId || paymentByGateway.gatewayPaymentId || paymentByGateway.gatewayOrderId,
              session
            );
          });
          return {
            status: order.status,
            orderNumber: order.orderNumber,
            isConfirmed: true,
            isPending: false,
            isCancelled: false,
            gatewayStatus: "confirmed",
            isExchangeFee: true,
            reconciled: true,
            message: "Exchange shipping fee verified with bank!",
          };
        }

        return {
          status: order.status,
          orderNumber: order.orderNumber,
          isConfirmed: false,
          isPending: evaluated.isPending,
          isCancelled: evaluated.isCancelled,
          gatewayStatus: evaluated.gatewayStatus,
          isExchangeFee: true,
          message: evaluated.isPending
            ? "Exchange shipping fee is awaiting bank confirmation."
            : "Exchange shipping fee payment not confirmed yet.",
        };
      } catch {}

      return {
        status: order.status,
        orderNumber: order.orderNumber,
        isConfirmed: false,
        isPending: true,
        isCancelled: false,
        gatewayStatus: "pending",
        isExchangeFee: true,
        message: "Exchange shipping fee payment not confirmed yet.",
      };
    }

    // If order is already confirmed, processing, shipped, etc.
    if (order.status !== "pending_payment" && order.status !== "failed") {
      return {
        status: order.status,
        orderNumber: order.orderNumber,
        paymentMethod: order.paymentMethod,
        isConfirmed: true,
        isPending: false,
        isCancelled: false,
        gatewayStatus: "confirmed",
        message: "Order is already confirmed and active.",
        ...guestTokenSuffix,
      };
    }

    const payment = await PaymentRepository.findByGatewayOrderId(order.gatewayOrderId || "") 
      || await PaymentRepository.findByOrderId(orderIdStr);

    if (!payment || !payment.gateway || !payment.gatewayOrderId) {
      return {
        status: order.status,
        orderNumber: order.orderNumber,
        paymentMethod: order.paymentMethod,
        isConfirmed: false,
        isPending: false,
        isCancelled: false,
        gatewayStatus: "failed",
        failureReason: order.failureReason,
        message: "No online payment transaction found for this order.",
      };
    }

    try {
      const gateway = PaymentGatewayFactory.create(payment.gateway);
      const liveStatus = await gateway.getPaymentStatus(payment.gatewayOrderId);
      const evaluated = this.evaluateGatewaySyncResponse(
        payment.gateway,
        payment.gatewayOrderId,
        liveStatus,
        payment.amount
      );
      const gatewayPaymentId = evaluated.gatewayPaymentId || payment.gatewayPaymentId || "";

      if (evaluated.isSuccess) {
        let syncStockFailed = false;
        let syncPostCommitEmails: Array<[string, string, string]> = [];
        await withTransactionSafe(async (session) => {
          syncStockFailed = false;
          syncPostCommitEmails = [];
          const paymentIdStr = String((payment as any)._id || payment.id);
          const transitionedPayment = await PaymentRepository.atomicStatusTransition(
            paymentIdStr,
            ["created", "pending", "failed"],
            "captured",
            { gatewayPaymentId },
            session
          );

          // Only decrement stock and send emails when this request won the atomic transition
          if (transitionedPayment) {
            const decrementedItems: any[] = [];
            let allStockDecremented = true;
            for (const itm of order.items || []) {
              const decResult = await ProductRepository.decrementStock(
                itm.productId,
                itm.variantId,
                itm.quantity,
                session
              );
              if (decResult === false) {
                allStockDecremented = false;
                break;
              }
              decrementedItems.push(itm);
            }

            if (!allStockDecremented) {
              for (const itm of decrementedItems) {
                await ProductRepository.incrementStock(itm.productId, itm.variantId, itm.quantity, session);
              }
              await OrderRepository.updateStatus(
                orderIdStr,
                "failed",
                {
                  paymentId: gatewayPaymentId,
                  failureReason: "Insufficient stock after payment capture; refund initiated.",
                },
                session
              );
              syncStockFailed = true;
              return;
            }

            await OrderRepository.updateStatus(orderIdStr, "confirmed", { paymentId: gatewayPaymentId }, session);

            for (const itm of order.items || []) {
              await ProductRepository.incrementSalesCount(itm.productId, itm.quantity, session);
            }
            if (order.pricing && order.pricing.couponCode) {
              await CouponService.incrementUsage(order.pricing.couponCode, order.userId, session);
            }
            if (order.userId) {
              await CartService.clearCart(order.userId, session);
            }
            if (order.userId) {
              const user = await UserRepository.findById(order.userId);
              if (user?.email) {
                syncPostCommitEmails.push([user.email, "Order Confirmed", `Your payment of ${gatewayPaymentId || order.orderNumber} was successful.`]);
              }
            } else if (order.guestEmail) {
              syncPostCommitEmails.push([order.guestEmail, "Order Confirmed", `Your payment of ${gatewayPaymentId || order.orderNumber} was successful.`]);
            }
          } else {
            await OrderRepository.updateStatus(orderIdStr, "confirmed", { paymentId: gatewayPaymentId }, session);
          }
        });

        for (const [to, subject, body] of syncPostCommitEmails) {
          addEmailJob(to, subject, body);
        }

        if (syncStockFailed) {
          const refundOutcome = await this.executeStockFailureAutoRefund(
            order,
            payment,
            gatewayPaymentId,
            "syncPaymentStatus"
          );
          return {
            status: "failed",
            orderNumber: order.orderNumber,
            paymentMethod: order.paymentMethod,
            isConfirmed: false,
            isPending: false,
            isCancelled: false,
            gatewayStatus: "failed",
            failureReason: refundOutcome.refunded
              ? "Insufficient stock for one or more items. Automatic refund initiated."
              : "Insufficient stock after capture; manual refund queued by support.",
            message: refundOutcome.refunded
              ? "Payment captured, but stock ran out. Automatic refund has been initiated."
              : "Payment captured, but stock ran out. Support has been alerted to process your refund urgently.",
          };
        }

        return {
          status: "confirmed",
          orderNumber: order.orderNumber,
          paymentMethod: order.paymentMethod,
          isConfirmed: true,
          isPending: false,
          isCancelled: false,
          gatewayStatus: "confirmed",
          reconciled: true,
          message: "Payment successfully verified with bank! Your order is now confirmed.",
          ...guestTokenSuffix,
        };
      }

      if (evaluated.isPending) {
        return {
          status: order.status,
          orderNumber: order.orderNumber,
          paymentMethod: order.paymentMethod,
          isConfirmed: false,
          isPending: true,
          isCancelled: false,
          gatewayStatus: "pending",
          message: "Payment is awaiting confirmation from your bank. Please wait a moment...",
          ...guestTokenSuffix,
        };
      }

      return {
        status: order.status,
        orderNumber: order.orderNumber,
        paymentMethod: order.paymentMethod,
        isConfirmed: false,
        isPending: false,
        isCancelled: evaluated.isCancelled,
        gatewayStatus: evaluated.gatewayStatus,
        failureReason: evaluated.failureReason || order.failureReason || "Transaction not confirmed or was cancelled at gateway.",
        message: evaluated.isCancelled
          ? "Payment was cancelled at the payment gateway."
          : "Payment has not been completed or was declined.",
        ...guestTokenSuffix,
      };
    } catch (err: any) {
      return {
        status: order.status,
        orderNumber: order.orderNumber,
        paymentMethod: order.paymentMethod,
        isConfirmed: false,
        isPending: true,
        isCancelled: false,
        gatewayStatus: "pending",
        failureReason: order.failureReason,
        message: "Unable to reach gateway for status update at this moment.",
        ...guestTokenSuffix,
      };
    }
  }
  static async requestRefund(orderId: string, amount?: number, reason?: string) {
    // 1. Pre-flight read & validation OUTSIDE write transaction so TransientTransactionError retries can never double-refund
    const initialOrder = await OrderRepository.findById(orderId);
    if (!initialOrder) throw new AppError("Order not found", 404);

    if (
      initialOrder.status !== "confirmed" &&
      initialOrder.status !== "processing" &&
      initialOrder.status !== "shipped" &&
      initialOrder.status !== "delivered" &&
      initialOrder.status !== "failed"
    ) {
      throw new AppError(`Cannot refund order in ${initialOrder.status} status`, 400);
    }

    const initialPayment = await PaymentRepository.findByGatewayOrderId(initialOrder.gatewayOrderId || "");
    if (!initialPayment) throw new AppError("Payment record not found", 404);

    if (initialPayment.status !== "captured" && initialPayment.status !== "partially_refunded") {
      throw new AppError(`Cannot refund payment in ${initialPayment.status} status`, 400);
    }

    const refundAmount = amount !== undefined ? Number(amount) : Number(initialPayment.amount);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      throw new AppError("Invalid refund amount", 400);
    }
    const totalRefundedSoFar = initialPayment.refunds?.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0) || 0;

    if (totalRefundedSoFar + refundAmount > initialPayment.amount + 0.01) {
      throw new AppError("Refund amount exceeds total payment amount", 400);
    }

    // 2. Call external gateway API ONCE before opening DB write transaction
    const gateway = PaymentGatewayFactory.create(initialPayment.gateway);
    const refundResult = await gateway.initiateRefund(initialPayment as unknown as IPayment, refundAmount);

    if (!refundResult.success) {
      throw new AppError(refundResult.message || "Refund initiation failed", 400);
    }

    const refundRecord = {
      refundId: refundResult.refundId || `ref_${Date.now()}`,
      amount: refundAmount,
      reason: reason || "Customer request",
      createdAt: new Date(),
      status: "processed",
    };

    const paymentIdStr = String((initialPayment as any)._id || initialPayment.id);
    const isFullRefund = totalRefundedSoFar + refundAmount + 0.01 >= initialPayment.amount;
    const newPaymentStatus = isFullRefund ? "refunded" : "partially_refunded";
    let postCommitEmails: Array<[string, string, string]> = [];

    // 3. Persist financial & inventory mutations atomically inside DB transaction
    const outcome = await withTransactionSafe(async (session) => {
      postCommitEmails = [];
      const order = (await OrderRepository.findById(orderId, session)) || initialOrder;
      const payment = (await PaymentRepository.findByGatewayOrderId(order.gatewayOrderId || "", session)) || initialPayment;

      await PaymentRepository.addRefund(paymentIdStr, refundRecord as any, session);

      await PaymentRepository.atomicStatusTransition(
        paymentIdStr,
        ["captured", "partially_refunded"],
        newPaymentStatus,
        {},
        session
      );

      if (isFullRefund) {
        if (order.status === "failed") {
          await OrderRepository.updateStatus(
            orderId,
            "failed",
            { failureReason: `Manual refund processed (Ref: ${refundRecord.refundId})` },
            session
          );
        } else {
          await OrderRepository.updateStatus(orderId, "cancelled", { cancelReason: reason || "Refunded" }, session);

          // Restore stock only when inventory had actually been decremented (never inflate stock on failed orders)
          if (order.items && order.items.length > 0) {
            for (const itm of order.items) {
              await ProductRepository.incrementStock(itm.productId, itm.variantId, itm.quantity, session);
              await ProductRepository.decrementSalesCount(itm.productId, itm.quantity, session);
            }
          }

          if (order.pricing?.couponCode) {
            await CouponService.decrementUsage(order.pricing.couponCode, session);
          }
        }
      }

      const emailTarget = (order as any)?.guestEmail || (order as any)?.customerEmail;
      if (emailTarget) {
        postCommitEmails.push([
          emailTarget,
          `Refund Initiated — Order #${order.orderNumber || orderId}`,
          `A ${isFullRefund ? "full" : "partial"} refund of INR ${refundAmount} (Ref: ${refundRecord.refundId}) has been initiated and will reflect in 1-5 business days per RBI TAT.`,
        ]);
      } else if (order.userId) {
        const user = await UserRepository.findById(order.userId);
        if (user?.email) {
          postCommitEmails.push([
            user.email,
            `Refund Initiated — Order #${order.orderNumber || orderId}`,
            `A ${isFullRefund ? "full" : "partial"} refund of INR ${refundAmount} (Ref: ${refundRecord.refundId}) has been initiated and will reflect in 1-5 business days per RBI TAT.`,
          ]);
        }
      }

      return { success: true, refundId: refundRecord.refundId, status: newPaymentStatus, gatewayRefunded: Boolean(payment) };
    });

    for (const [to, subject, body] of postCommitEmails) {
      addEmailJob(to, subject, body);
    }

    return { success: true, refundId: outcome.refundId, status: outcome.status };
  }

  static async getOrderById(orderId: string) {
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    await OrderRepository.populateItemShippingSpecs(order);

    if (order.userId) {
      try {
        const { UserModel } = await import("../user/user.model");
        const user: any = await UserModel.findById(order.userId).select("email firstName lastName phone name").lean().exec();
        if (user) {
          (order as any).customer = user;
          (order as any).customerEmail = (order as any).customerEmail || (order as any).guestEmail || user.email;
          if (!order.shippingAddress?.fullName) {
            if (!order.shippingAddress) (order as any).shippingAddress = {} as any;
            (order.shippingAddress as any).fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || "Customer";
          }
          if (!order.shippingAddress?.phone && user.phone) {
            (order.shippingAddress as any).phone = user.phone;
          }
        }
      } catch {
        // graceful
      }
    } else {
      (order as any).customerEmail = (order as any).customerEmail || (order as any).guestEmail || "";
    }

    return order;
  }

  static async getAllAdmin(query: any, page: number, limit: number) {
    const dbQuery: any = {};
    if (query.status) {
      if (query.status === "failed") {
        dbQuery.status = { $in: ["failed", "pending_payment"] };
      } else if (query.status === "exchanges") {
        dbQuery.$or = [
          { status: { $in: ["return_requested", "return_approved", "return_picked", "returned"] } },
          { "exchangeDetails.stage": { $exists: true } },
          { "exchanges.stage": { $exists: true } },
        ];
      } else if (query.status === "return_picked") {
        dbQuery.status = "return_picked";
        dbQuery.$or = [
          { "exchangeDetails.stage": "picked_up" },
          { "exchangeDetails.stage": { $exists: false } },
        ];
      } else if (["qc_passed", "qc_failed", "fee_settled", "replacement_dispatched", "rejected"].includes(query.status)) {
        dbQuery["exchangeDetails.stage"] = query.status;
      } else if (query.status === "awaiting_fee") {
        dbQuery["exchangeDetails.stage"] = "qc_passed";
        dbQuery["exchangeDetails.shippingFeeStatus"] = "pending";
      } else if (query.status === "all_orders") {
        dbQuery.status = { $nin: ["failed", "pending_payment"] };
      } else if (query.status === "all" || query.status === "any") {
        // Show any status without restriction
      } else {
        dbQuery.status = query.status;
      }
    } else {
      // DEFAULT: Do NOT include failed or pending_payment transactions in the main orders list!
      // Main orders list only shows legitimate placed orders when browsing!
      // But if the merchant is searching for a specific order or customer, don't hide it just because payment failed or is pending!
      if (!query.search || !query.search.trim()) {
        dbQuery.status = { $nin: ["failed", "pending_payment"] };
      }
    }

    if (query.paymentMethod) {
      if (query.paymentMethod === "prepaid") {
        dbQuery.paymentMethod = { $ne: "cod" };
      } else {
        dbQuery.paymentMethod = query.paymentMethod;
      }
    }

    if (query.search && query.search.trim()) {
      const cleanSearch = query.search.trim();
      const strippedOrder = cleanSearch.replace(/^(order|ord|#|\s)+/i, "").trim();
      const escaped = cleanSearch.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const digits = cleanSearch.replace(/[^0-9]/g, "");

      // Match shipments (AWB, Courier Name)
      let shipmentOrderIds: string[] = [];
      try {
        const { ShipmentModel } = await import("../shipping/shipment.model");
        const matchingShipments = await ShipmentModel.find({
          $or: [
            { awb: { $regex: escaped, $options: "i" } },
            { courierName: { $regex: escaped, $options: "i" } }
          ]
        }).select("orderId").limit(50).lean().exec();
        shipmentOrderIds = matchingShipments.map((s) => s.orderId).filter(Boolean);
      } catch {
        // graceful
      }

      // Match registered users (email, phone, fullName)
      let userOrderIds: string[] = [];
      try {
        const { UserModel } = await import("../user/user.model");
        const userOrConditions: any[] = [
          { email: { $regex: escaped, $options: "i" } },
          { firstName: { $regex: escaped, $options: "i" } },
          { lastName: { $regex: escaped, $options: "i" } },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ["$firstName", " ", "$lastName"] },
                regex: escaped,
                options: "i"
              }
            }
          }
        ];
        if (digits.length >= 4) {
          userOrConditions.push({ phone: { $regex: digits, $options: "i" } });
        }
        const matchingUsers = await UserModel.find({ $or: userOrConditions }).select("_id").limit(50).lean().exec();
        userOrderIds = matchingUsers.map((u) => String(u._id));
      } catch {
        // graceful
      }

      const searchOr: any[] = [];

      if (strippedOrder) {
        const escapedOrder = strippedOrder.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        searchOr.push({ orderNumber: { $regex: escapedOrder, $options: "i" } });
      }

      if (digits.length >= 2) {
        searchOr.push({ orderNumber: { $regex: digits, $options: "i" } });
      }

      if (mongoose.Types.ObjectId.isValid(cleanSearch)) {
        searchOr.push({ _id: new mongoose.Types.ObjectId(cleanSearch) });
      }

      searchOr.push(
        { orderNumber: { $regex: escaped, $options: "i" } },
        { "shippingAddress.fullName": { $regex: escaped, $options: "i" } },
        { "shippingAddress.phone": { $regex: escaped, $options: "i" } },
        { "shippingAddress.city": { $regex: escaped, $options: "i" } },
        { "shippingAddress.state": { $regex: escaped, $options: "i" } },
        { "shippingAddress.pincode": { $regex: escaped, $options: "i" } },
        { guestEmail: { $regex: escaped, $options: "i" } },
        { "items.name": { $regex: escaped, $options: "i" } },
        { "items.sku": { $regex: escaped, $options: "i" } }
      );

      // Multi-word full name support
      const words = cleanSearch.split(/\s+/).filter(Boolean);
      if (words.length > 1) {
        const wordRegexes = words.map((w: string) => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"));
        searchOr.push({
          $and: wordRegexes.map((w: string) => ({ "shippingAddress.fullName": { $regex: w, $options: "i" } }))
        });
      }

      if (digits.length >= 4) {
        searchOr.push({ "shippingAddress.phone": { $regex: digits, $options: "i" } });
      }

      if (shipmentOrderIds.length > 0) {
        const validObjIds = shipmentOrderIds
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));
        if (validObjIds.length > 0) {
          searchOr.push({ _id: { $in: validObjIds } });
        }
        searchOr.push({ orderNumber: { $in: shipmentOrderIds } });
      }

      if (userOrderIds.length > 0) {
        searchOr.push({ userId: { $in: userOrderIds } });
      }

      if (dbQuery.$or) {
        const existingOr = dbQuery.$or;
        delete dbQuery.$or;
        dbQuery.$and = [...(dbQuery.$and || []), { $or: existingOr }, { $or: searchOr }];
      } else {
        dbQuery.$or = searchOr;
      }
    }
    if (query.userId) dbQuery.userId = query.userId;

    const result = await OrderRepository.findPaginated(dbQuery, page, limit);

    // Populate customer email and user details for user accounts if guestEmail is not on order
    const userIdsToFetch = result.items
      .filter((o: any) => !o.guestEmail && o.userId)
      .map((o: any) => o.userId);

    if (userIdsToFetch.length > 0) {
      try {
        const { UserModel } = await import("../user/user.model");
        const users = await UserModel.find({ _id: { $in: userIdsToFetch } }).select("email name phone").lean().exec();
        const userMap = new Map(users.map((u: any) => [String(u._id), u]));
        result.items.forEach((o: any) => {
          if (!o.guestEmail && o.userId && userMap.has(String(o.userId))) {
            const u = userMap.get(String(o.userId));
            (o as any).customerEmail = u.email;
            if (!o.shippingAddress?.fullName) {
              if (!o.shippingAddress) o.shippingAddress = {} as any;
              o.shippingAddress.fullName = u.name;
            }
          } else {
            (o as any).customerEmail = o.guestEmail || "";
          }
        });
      } catch (err) {
        // graceful
      }
    } else {
      result.items.forEach((o: any) => {
        (o as any).customerEmail = o.guestEmail || "";
      });
    }

    return result;
  }

  static async suggestAdmin(q: string) {
    if (!q || !q.trim() || q.trim().length < 2) return [];
    const cleanSearch = q.trim();
    const cacheKey = `order_suggest_${encodeURIComponent(cleanSearch.toLowerCase())}`;
    try {
      const cached = await getCache(cacheKey);
      if (cached && Array.isArray(cached)) return cached;
    } catch {
      // ignore
    }

    const { OrderModel } = await import("./order.model");
    const escaped = cleanSearch.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const strippedOrder = cleanSearch.replace(/^(order|ord|#|\s)+/i, "").trim();
    const digits = cleanSearch.replace(/[^0-9]/g, "");

    const searchOr: any[] = [];
    if (strippedOrder) {
      const escapedOrder = strippedOrder.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      searchOr.push({ orderNumber: { $regex: escapedOrder, $options: "i" } });
    }
    if (digits.length >= 2) {
      searchOr.push({ orderNumber: { $regex: digits, $options: "i" } });
    }
    if (mongoose.Types.ObjectId.isValid(cleanSearch)) {
      searchOr.push({ _id: new mongoose.Types.ObjectId(cleanSearch) });
    }

    searchOr.push(
      { orderNumber: { $regex: escaped, $options: "i" } },
      { "shippingAddress.fullName": { $regex: escaped, $options: "i" } },
      { "shippingAddress.phone": { $regex: escaped, $options: "i" } },
      { "shippingAddress.city": { $regex: escaped, $options: "i" } },
      { guestEmail: { $regex: escaped, $options: "i" } },
      { "items.name": { $regex: escaped, $options: "i" } },
      { "items.sku": { $regex: escaped, $options: "i" } }
    );

    if (digits.length >= 4) {
      searchOr.push({ "shippingAddress.phone": { $regex: digits, $options: "i" } });
    }

    const items = await OrderModel.find({ $or: searchOr })
      .select("_id orderNumber status paymentMethod pricing.total guestEmail userId shippingAddress.fullName shippingAddress.phone shippingAddress.city shippingAddress.state createdAt items.name items.image items.sku items.quantity")
      .sort({ createdAt: -1 })
      .limit(6)
      .lean()
      .exec();

    // Cache for 15s to prevent hammering MongoDB while typing
    try {
      await setCache(cacheKey, items, 15);
    } catch {
      // ignore
    }

    return items;
  }

  static async getAdminCounts() {
    const cacheKey = "admin_order_counts";
    const cached = await getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const { OrderModel } = await import("./order.model");
    const [
      activeCount,
      failedCount,
      exchangeCount,
      prepaidCount,
      codCount
    ] = await Promise.all([
      OrderModel.countDocuments({ status: { $nin: ["failed", "pending_payment"] } }).exec(),
      OrderModel.countDocuments({ status: { $in: ["failed", "pending_payment"] } }).exec(),
      OrderModel.countDocuments({
        $or: [
          { status: { $in: ["return_requested", "return_approved", "return_picked", "returned"] } },
          { "exchangeDetails.stage": { $exists: true } },
          { "exchanges.stage": { $exists: true } },
        ],
      }).exec(),
      OrderModel.countDocuments({ status: { $nin: ["failed", "pending_payment"] }, paymentMethod: { $ne: "cod" } }).exec(),
      OrderModel.countDocuments({ status: { $nin: ["failed", "pending_payment"] }, paymentMethod: "cod" }).exec(),
    ]);

    const result = {
      activeCount,
      failedCount,
      exchangeCount,
      prepaidCount,
      codCount
    };

    await setCache(cacheKey, result, 20); // 20s TTL
    return result;
  }

  static async addNote(orderId: string, author: string, text: string) {
    const existing = await OrderRepository.findById(orderId);
    if (!existing) throw new AppError("Order not found", 404);
    const dbId = String((existing as any)._id || existing.id || orderId);
    const note = {
      text,
      author,
      timestamp: new Date()
    };
    const order = await OrderRepository.addNote(dbId, note);
    if (!order) throw new AppError("Order not found", 404);
    return order;
  }

  static async adminUpdateStatus(orderId: string, newStatus: string) {
    const allowedStatuses = [
      "pending_payment", "confirmed", "processing", "packed", "shipped", 
      "delivered", "cancelled", "failed", "refunded", 
      "return_requested", "return_approved", "return_picked", "returned"
    ];

    if (!allowedStatuses.includes(newStatus)) {
      throw new AppError(`Invalid status: ${newStatus}`, 400);
    }

    const order = await OrderRepository.findById(orderId);
    if (!order) throw new AppError("Order not found", 404);

    const activeConfirmedStatuses = ["confirmed", "processing", "packed", "shipped"];
    const wasConfirmed = activeConfirmedStatuses.includes(order.status);
    const isNowCancelledOrRefunded = newStatus === "cancelled" || newStatus === "refunded";

    if (wasConfirmed && isNowCancelledOrRefunded) {
      // 1. Restore product stock & decrement sales count
      if (order.items && order.items.length > 0) {
        for (const itm of order.items) {
          await ProductRepository.incrementStock(itm.productId, itm.variantId, itm.quantity);
          await ProductRepository.decrementSalesCount(itm.productId, itm.quantity);
        }
      }
      // 2. Restore coupon usage quota
      if (order.pricing?.couponCode) {
        await CouponService.decrementUsage(order.pricing.couponCode);
      }
    } else if ((order.status === "cancelled" || order.status === "refunded") && activeConfirmedStatuses.includes(newStatus)) {
      // Re-deduct stock & re-increment coupon if transitioning back to active
      if (order.items && order.items.length > 0) {
        for (const itm of order.items) {
          await ProductRepository.decrementStock(itm.productId, itm.variantId, itm.quantity);
          await ProductRepository.incrementSalesCount(itm.productId, itm.quantity);
        }
      }
      if (order.pricing?.couponCode) {
        await CouponService.incrementUsage(order.pricing.couponCode, order.userId);
      }
    }

    const dbId = String((order as any)._id || order.id || orderId);
    const updatedOrder = await OrderRepository.updateStatus(dbId, newStatus);
    if (updatedOrder) {
      try {
        const { OrderModel } = await import("./order.model");
        await OrderModel.findByIdAndUpdate(dbId, { $unset: { invoiceUrl: 1 } });
      } catch {}
    }
    try {
      const { adminEventHub } = await import("../../core/events/adminEventHub");
      adminEventHub.publish("ORDER_STATUS_CHANGED", {
        orderId: dbId,
        status: newStatus,
      });
    } catch {}

    return updatedOrder;
  }

  static async adminDeleteOrder(orderId: string) {
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      throw new AppError("Order not found", 404);
    }
    const dbId = String((order as any)._id || order.id || orderId);
    await OrderRepository.deleteById(dbId);
    return true;
  }

  private static async invalidateAdminCountsCache() {
    try {
      await deleteCache("admin_order_counts");
    } catch {}
  }

  private static resolveExchangeDetails(
    order: IOrder,
    configuredShippingFee: number,
    exchangeId?: string
  ): IExchangeDetails {
    const exchangesList = Array.isArray((order as any).exchanges) ? (order as any).exchanges : [];
    if (exchangeId && exchangesList.length > 0) {
      const matched = exchangesList.find((ex: any) => ex?.exchangeId === exchangeId);
      if (matched) {
        return { ...matched };
      }
    }

    if (order.exchangeDetails && (!exchangeId || order.exchangeDetails.exchangeId === exchangeId)) {
      return { ...order.exchangeDetails };
    }

    if (exchangesList.length > 0) {
      const active =
        exchangesList.find((ex: any) => !["completed", "rejected", "qc_failed"].includes(ex?.stage)) ||
        exchangesList[exchangesList.length - 1];
      if (active) return { ...active };
    }

    const returnNote = findExchangeRequestNote(order.notes);
    const parsed = parseExchangeNote(returnNote?.text);
    const inferred = inferExchangeProgressFromNotes(order.notes, order.status, configuredShippingFee);

    return {
      stage: inferred.stage as IExchangeDetails["stage"],
      reasonType: parsed.reasonType || "Exchange Requested",
      desiredReplacement: parsed.replacementRequirement || "",
      customerNote: parsed.customerNote || "",
      requestedItemNames: parsed.itemsList || "",
      requestedAt: returnNote?.timestamp || order.updatedAt || new Date(),
      reverseAwb: inferred.reverseAwb || undefined,
      qcStatus: inferred.qcStatus,
      qcNotes: inferred.qcNotes || undefined,
      rejectionReason: inferred.rejectionReason || undefined,
      replacementAwb: inferred.replacementAwb || undefined,
      shippingFee: inferred.shippingFee,
      shippingFeeStatus: inferred.shippingFeeStatus as IExchangeDetails["shippingFeeStatus"],
    };
  }

  private static computeAggregateExchangeOrderStatus(
    order: IOrder,
    updatedExchange: IExchangeDetails,
    singleExchangeFallbackStatus: string
  ): string {
    const existingList: IExchangeDetails[] = Array.isArray((order as any).exchanges)
      ? [...(order as any).exchanges]
      : [];

    if (existingList.length === 0) {
      return singleExchangeFallbackStatus;
    }

    const targetId = updatedExchange.exchangeId;
    if (targetId) {
      const idx = existingList.findIndex((ex) => ex?.exchangeId === targetId);
      if (idx >= 0) existingList[idx] = updatedExchange;
      else existingList.push(updatedExchange);
    } else {
      existingList[existingList.length - 1] = updatedExchange;
    }

    if (existingList.length <= 1) {
      return singleExchangeFallbackStatus;
    }

    const stages = existingList.map((ex) => ex.stage);
    if (stages.some((s) => ["picked_up", "qc_passed", "fee_settled", "replacement_dispatched"].includes(s))) {
      return "return_picked";
    }
    if (stages.includes("approved")) return "return_approved";
    if (stages.includes("requested")) return "return_requested";
    if (stages.includes("completed")) return "returned";
    return "delivered";
  }

  private static matchOrderItemForExchange(orderItem: any, reqItem: any): boolean {
    const reqOrderItemId = reqItem?.orderItemId ? String(reqItem.orderItemId) : "";
    const oiId = String(orderItem?._id || orderItem?.id || "");
    if (reqOrderItemId && oiId && reqOrderItemId === oiId) return true;

    const reqProdId = reqItem?.productId ? String(reqItem.productId) : "";
    const oiProdId = String(orderItem?.productId || "");
    if (reqProdId && oiProdId && reqProdId === oiProdId) {
      const reqVar = reqItem?.variantId ? String(reqItem.variantId).toLowerCase() : "";
      const oiVar = orderItem?.variantId ? String(orderItem.variantId).toLowerCase() : "";
      if (reqVar) return reqVar === oiVar;
      const reqSku = reqItem?.sku ? String(reqItem.sku).toLowerCase() : "";
      const oiSku = orderItem?.sku ? String(orderItem.sku).toLowerCase() : "";
      if (reqSku) return reqSku === oiSku;
      return true;
    }
    return false;
  }

  private static async applyExchangeFeeCapture(
    order: IOrder,
    payment: any,
    gatewayPaymentId: string,
    session?: any
  ) {
    const orderIdStr = String((order as any)._id || order.id);
    const paymentIdStr = String((payment as any)._id || payment.id);
    const exchangesList = Array.isArray((order as any).exchanges) ? (order as any).exchanges : [];
    const matchedByGateway = exchangesList.find(
      (ex: any) => ex?.shippingFeeGatewayOrderId && ex.shippingFeeGatewayOrderId === payment.gatewayOrderId
    );
    const existing = this.resolveExchangeDetails(
      order,
      Number(payment.amount) || 0,
      matchedByGateway?.exchangeId
    );

    const transitioned = await PaymentRepository.atomicStatusTransition(
      paymentIdStr,
      ["created", "pending", "failed"],
      "captured",
      { gatewayPaymentId },
      session
    );

    if (!transitioned && existing.shippingFeeStatus === "paid_online") {
      return order;
    }

    const nextStage =
      existing.stage === "replacement_dispatched" || existing.stage === "completed"
        ? existing.stage
        : "fee_settled";

    const updatedExchange: IExchangeDetails = {
      ...existing,
      qcStatus: existing.qcStatus === "failed" ? "failed" : "passed",
      shippingFee: typeof payment.amount === "number" ? payment.amount : existing.shippingFee,
      shippingFeeStatus: "paid_online",
      shippingFeeCollectionMode: "online",
      shippingFeePaymentMethod: payment.gateway,
      shippingFeePaymentRef: gatewayPaymentId,
      shippingFeeGatewayOrderId: payment.gatewayOrderId,
      shippingFeePaidAt: new Date(),
      stage: nextStage,
    };

    const note = {
      text: `Exchange shipping fee of Rs. ${updatedExchange.shippingFee} paid online via ${String(payment.gateway || "online").toUpperCase()} (Ref: ${gatewayPaymentId}). Ready for replacement dispatch.`,
      author: order.userId || "customer",
      timestamp: new Date(),
    };

    const updated = await OrderRepository.updateExchangeDetails(
      orderIdStr,
      updatedExchange,
      undefined,
      note,
      session
    );
    await this.invalidateAdminCountsCache();

    const customerEmail = order.guestEmail || order.customerEmail;
    if (customerEmail) {
      addEmailJob(
        customerEmail,
        `Exchange Shipping Fee Received — Order #${order.orderNumber}`,
        `<p>Hello ${order.shippingAddress?.fullName || "Rider"},</p><p>We have received your 2-way exchange shipping fee of <strong>Rs. ${updatedExchange.shippingFee}</strong> for Order <strong>#${order.orderNumber}</strong> (Ref: ${gatewayPaymentId}).</p><p>Our warehouse team is now packing your replacement and will share tracking details shortly.</p>`
      );
    }

    return updated;
  }

  static async requestReturn(
    orderId: string,
    userId: string,
    reason: string,
    images?: string[],
    items?: Array<{
      orderItemId?: string;
      productId: string;
      variantId?: string;
      sku?: string;
      name?: string;
      quantity?: number;
      desiredReplacement?: string;
    }>
  ) {
    const order = await OrderRepository.findById(orderId);
    if (!order || !order.userId || String(order.userId) !== String(userId)) {
      throw new AppError("Order not found", 404);
    }

    const hasStructuredItems = Array.isArray(items) && items.length > 0;
    const isDeliveredOrExchanging = [
      "delivered",
      "return_requested",
      "return_approved",
      "return_picked",
      "returned",
    ].includes(order.status);

    if (hasStructuredItems ? !isDeliveredOrExchanging : order.status !== "delivered") {
      throw new AppError("Only delivered orders can be exchanged", 400);
    }

    const settings = await SettingRepository.getSettings();
    const windowDays = typeof settings.returnWindowDays === "number" ? settings.returnWindowDays : 7;
    const windowReferenceDate = (order as any).deliveredAt || (order as any).updatedAt;
    const windowStatus = getExchangeWindowStatus(windowReferenceDate, windowDays);
    if (!windowStatus.allowed) {
      if (windowStatus.reason === "disabled") {
        throw new AppError("Exchanges are currently disabled per store policy", 400);
      }
      throw new AppError(`Exchange window of ${windowDays} days has expired for this order`, 400);
    }

    const orderItems = Array.isArray(order.items) ? order.items : [];
    const existingExchanges: IExchangeDetails[] = Array.isArray((order as any).exchanges)
      ? (order as any).exchanges
      : order.exchangeDetails?.stage
      ? [order.exchangeDetails]
      : [];

    let resolvedExchangeItems: IExchangeItem[] | undefined;
    if (hasStructuredItems) {
      resolvedExchangeItems = [];
      for (const reqItem of items!) {
        const matchedOrderItem = orderItems.find((oi: any) => this.matchOrderItemForExchange(oi, reqItem));
        if (!matchedOrderItem) {
          throw new ValidationError(`Item ${reqItem.name || reqItem.productId} does not belong to this order`);
        }

        // Prevent duplicate active or completed exchange on the same item
        const alreadyCovered = existingExchanges.some((ex) => {
          if (ex.stage === "rejected" || ex.stage === "qc_failed") return false;
          if (Array.isArray(ex.items) && ex.items.length > 0) {
            return ex.items.some((exItm) => this.matchOrderItemForExchange(matchedOrderItem, exItm));
          }
          // Legacy order-level exchange without structured items covers all order items
          return true;
        });

        if (alreadyCovered) {
          throw new ValidationError(
            `${matchedOrderItem.name} already has an active or completed exchange request.`
          );
        }

        resolvedExchangeItems.push({
          orderItemId: String((matchedOrderItem as any)._id || matchedOrderItem.id || "") || undefined,
          productId: String(matchedOrderItem.productId),
          ...(matchedOrderItem.variantId ? { variantId: matchedOrderItem.variantId } : {}),
          sku: matchedOrderItem.sku || reqItem.sku || "EXCHANGE",
          name: matchedOrderItem.name,
          quantity: Math.min(matchedOrderItem.quantity || 1, reqItem.quantity || matchedOrderItem.quantity || 1),
          unitPrice: matchedOrderItem.unitPrice,
          ...(matchedOrderItem.image ? { image: matchedOrderItem.image } : {}),
          ...(reqItem.desiredReplacement ? { desiredReplacement: reqItem.desiredReplacement } : {}),
        });
      }
    }

    const configuredFee = typeof settings.exchangeShippingFee === "number" ? settings.exchangeShippingFee : 299;
    const parsed = parseExchangeNote(reason);
    const exchangeId = `ex_${crypto.randomUUID().slice(0, 8)}`;

    const computedItemNames = resolvedExchangeItems?.length
      ? resolvedExchangeItems.map((i) => `${i.name}${i.variantId ? ` [${i.variantId}]` : ""}`).join(", ")
      : parsed.itemsList || order.items?.map((i: any) => i.name).join(", ");

    const exchangeDetails: IExchangeDetails = {
      exchangeId,
      ...(resolvedExchangeItems?.length ? { items: resolvedExchangeItems } : {}),
      stage: "requested",
      reasonType: parsed.reasonType || "Exchange Requested",
      desiredReplacement: parsed.replacementRequirement || "",
      customerNote: parsed.customerNote || reason,
      requestedItemNames: computedItemNames,
      requestedAt: new Date(),
      qcStatus: "pending",
      shippingFee: configuredFee,
      shippingFeeStatus: configuredFee <= 0 ? "waived" : "pending",
    };

    const dbId = (order as any)._id?.toString() || order.id || orderId;
    const note = {
      text: `Exchange requested: ${reason}`,
      author: userId,
      timestamp: new Date(),
    };

    const nextOrderStatus = this.computeAggregateExchangeOrderStatus(
      order,
      exchangeDetails,
      "return_requested"
    );

    const updated = await OrderRepository.updateExchangeDetails(dbId, exchangeDetails, nextOrderStatus, note);
    await this.invalidateAdminCountsCache();
    return updated;
  }

  static async adminHandleReturn(
    orderId: string,
    action: string,
    adminNote?: string,
    options?: {
      exchangeId?: string;
      shippingFee?: number;
      reverseCourier?: string;
      reverseAwb?: string;
      reverseTrackingUrl?: string;
      warehouseId?: string;
      triggerCourier?: "none" | "shiprocket" | "delhivery" | "xpressbees" | "manual";
    }
  ) {
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      throw new AppError("Order not found", 404);
    }

    const dbId = (order as any)._id?.toString() || order.id || orderId;
    const settings = await SettingRepository.getSettings();
    const configuredFee = typeof settings.exchangeShippingFee === "number" ? settings.exchangeShippingFee : 299;
    const baseDetails = this.resolveExchangeDetails(order, configuredFee, options?.exchangeId);

    const hasRequestedExchange =
      order.status === "return_requested" ||
      (Array.isArray((order as any).exchanges) &&
        baseDetails.stage === "requested" &&
        ["return_requested", "return_approved", "return_picked", "returned"].includes(order.status));

    if (!hasRequestedExchange) {
      throw new AppError("Order is not in return_requested status", 400);
    }

    if (action === "reject") {
      const rejectionReason = adminNote?.trim() || "Exchange request rejected per store policy guidelines.";
      const updatedExchange: IExchangeDetails = {
        ...baseDetails,
        stage: "rejected",
        rejectionReason,
      };
      const nextStatus = this.computeAggregateExchangeOrderStatus(order, updatedExchange, "delivered");
      const updated = await OrderRepository.updateExchangeDetails(dbId, updatedExchange, nextStatus, {
        text: `Exchange rejected. Reason: ${rejectionReason}`,
        author: "Admin",
        timestamp: new Date(),
      });
      await this.invalidateAdminCountsCache();
      return updated;
    }

    const effectiveFee =
      typeof options?.shippingFee === "number" && options.shippingFee >= 0
        ? options.shippingFee
        : baseDetails.shippingFee;

    let reverseMeta: Partial<IExchangeDetails> = {};
    let reverseLog = "";

    const triggerProvider = options?.triggerCourier;
    if (
      triggerProvider === "shiprocket" ||
      triggerProvider === "delhivery" ||
      triggerProvider === "xpressbees"
    ) {
      const { ShipmentService } = await import("../shipping/shipment.service");
      const rev = await ShipmentService.createExchangeReverseShipment({
        orderId: dbId,
        provider: triggerProvider,
        ...(options?.warehouseId ? { warehouseId: options.warehouseId } : {}),
        ...(baseDetails.items?.length ? { exchangeItems: baseDetails.items } : {}),
      });
      reverseMeta = {
        reverseCourier: rev.courierName || `${triggerProvider.toUpperCase()} Reverse`,
        reverseAwb: rev.awb,
        reverseTrackingUrl: rev.trackingUrl,
        reverseShipmentId: rev.shipment?._id ? String(rev.shipment._id) : undefined,
        reverseStatus: "scheduled",
      };
      reverseLog = rev.awb
        ? ` Reverse pickup AWB: ${rev.awb} (${reverseMeta.reverseCourier}).`
        : ` Reverse pickup pushed to ${triggerProvider.toUpperCase()}.`;
    } else if (triggerProvider === "manual" && options?.reverseCourier && options?.reverseAwb) {
      const { ShipmentService } = await import("../shipping/shipment.service");
      const rev = await ShipmentService.createExchangeReverseShipment({
        orderId: dbId,
        provider: "manual",
        courierName: options.reverseCourier,
        awb: options.reverseAwb,
        trackingUrl: options.reverseTrackingUrl,
        ...(options?.warehouseId ? { warehouseId: options.warehouseId } : {}),
        ...(baseDetails.items?.length ? { exchangeItems: baseDetails.items } : {}),
      });
      reverseMeta = {
        reverseCourier: rev.courierName,
        reverseAwb: rev.awb,
        reverseTrackingUrl: rev.trackingUrl,
        reverseShipmentId: rev.shipment?._id ? String(rev.shipment._id) : undefined,
        reverseStatus: "scheduled",
      };
      reverseLog = ` Reverse pickup AWB: ${rev.awb} (${rev.courierName}).`;
    }

    const updatedExchange: IExchangeDetails = {
      ...baseDetails,
      ...reverseMeta,
      stage: "approved",
      approvedAt: new Date(),
      qcStatus: "pending",
      shippingFee: effectiveFee,
      shippingFeeStatus: effectiveFee <= 0 ? "waived" : baseDetails.shippingFeeStatus === "waived" ? "pending" : baseDetails.shippingFeeStatus,
    };

    const noteText = adminNote ? `Exchange approved. Note: ${adminNote}${reverseLog}` : `Exchange approved.${reverseLog}`;
    const nextStatus = this.computeAggregateExchangeOrderStatus(order, updatedExchange, "return_approved");
    const updated = await OrderRepository.updateExchangeDetails(dbId, updatedExchange, nextStatus, {
      text: noteText,
      author: "Admin",
      timestamp: new Date(),
    });
    await this.invalidateAdminCountsCache();
    return updated;
  }

  static async adminExchangePickup(
    orderId: string,
    payload: {
      exchangeId?: string;
      action: "schedule_reverse" | "mark_picked_up" | "update_tracking";
      provider?: "shiprocket" | "delhivery" | "xpressbees" | "manual";
      reverseCourier?: string;
      reverseAwb?: string;
      reverseTrackingUrl?: string;
      warehouseId?: string;
      weightKg?: number;
      length?: number;
      breadth?: number;
      height?: number;
    }
  ) {
    const order = await OrderRepository.findById(orderId);
    if (!order) throw new NotFoundError("Order");

    const dbId = (order as any)._id?.toString() || order.id || orderId;
    const settings = await SettingRepository.getSettings();
    const configuredFee = typeof settings.exchangeShippingFee === "number" ? settings.exchangeShippingFee : 299;
    const details = this.resolveExchangeDetails(order, configuredFee, payload.exchangeId);

    const canUpdatePickup =
      ["return_approved", "return_picked"].includes(order.status) ||
      ["approved", "picked_up"].includes(details.stage);

    if (!canUpdatePickup) {
      throw new ValidationError("Order must be in Exchange Approved or Picked Up state for reverse pickup updates");
    }

    if (payload.action === "schedule_reverse") {
      const { ShipmentService } = await import("../shipping/shipment.service");
      const rev = await ShipmentService.createExchangeReverseShipment({
        orderId: dbId,
        provider: payload.provider || "shiprocket",
        warehouseId: payload.warehouseId,
        courierName: payload.reverseCourier,
        awb: payload.reverseAwb,
        trackingUrl: payload.reverseTrackingUrl,
        ...(details.items?.length ? { exchangeItems: details.items } : {}),
        weightKg: payload.weightKg,
        length: payload.length,
        breadth: payload.breadth,
        height: payload.height,
      });

      const updatedExchange: IExchangeDetails = {
        ...details,
        reverseCourier: rev.courierName,
        reverseAwb: rev.awb,
        reverseTrackingUrl: rev.trackingUrl,
        reverseShipmentId: rev.shipment?._id ? String(rev.shipment._id) : details.reverseShipmentId,
        reverseStatus: "scheduled",
      };

      const updated = await OrderRepository.updateExchangeDetails(dbId, updatedExchange, undefined, {
        text: rev.awb
          ? `Reverse pickup scheduled via ${rev.courierName} (AWB: ${rev.awb})`
          : `Reverse pickup order created in ${rev.courierName || "Shiprocket"}`,
        author: "Admin",
        timestamp: new Date(),
      });
      await this.invalidateAdminCountsCache();
      return updated;
    }

    if (payload.action === "update_tracking") {
      const updatedExchange: IExchangeDetails = {
        ...details,
        ...(payload.reverseCourier ? { reverseCourier: payload.reverseCourier.trim() } : {}),
        ...(payload.reverseAwb ? { reverseAwb: payload.reverseAwb.trim() } : {}),
        ...(payload.reverseTrackingUrl !== undefined ? { reverseTrackingUrl: payload.reverseTrackingUrl.trim() } : {}),
        reverseStatus: details.reverseStatus || "scheduled",
      };
      return await OrderRepository.updateExchangeDetails(dbId, updatedExchange, undefined, {
        text: `Reverse tracking updated (${updatedExchange.reverseCourier || "Courier"}: ${updatedExchange.reverseAwb || "N/A"})`,
        author: "Admin",
        timestamp: new Date(),
      });
    }

    // mark_picked_up
    const updatedExchange: IExchangeDetails = {
      ...details,
      ...(payload.reverseCourier ? { reverseCourier: payload.reverseCourier.trim() } : {}),
      ...(payload.reverseAwb ? { reverseAwb: payload.reverseAwb.trim() } : {}),
      stage: details.qcStatus === "passed" ? details.stage : "picked_up",
      reverseStatus: "picked_up",
      pickedUpAt: new Date(),
    };
    const nextStatus = this.computeAggregateExchangeOrderStatus(order, updatedExchange, "return_picked");
    const updated = await OrderRepository.updateExchangeDetails(dbId, updatedExchange, nextStatus, {
      text: `Courier picked up exchange parcel from customer${updatedExchange.reverseAwb ? ` (AWB: ${updatedExchange.reverseAwb})` : ""}. In transit to warehouse for QC.`,
      author: "Admin",
      timestamp: new Date(),
    });
    await this.invalidateAdminCountsCache();
    return updated;
  }

  static async adminSubmitExchangeQc(
    orderId: string,
    adminUserId: string,
    payload: {
      exchangeId?: string;
      result: "passed" | "failed";
      tagsIntact: boolean;
      unusedCondition: boolean;
      packagingIntact: boolean;
      qcNotes: string;
      shippingFee?: number;
      feeCollectionMode?: "online" | "cod" | "waived";
    }
  ) {
    const order = await OrderRepository.findById(orderId);
    if (!order) throw new NotFoundError("Order");

    const dbId = (order as any)._id?.toString() || order.id || orderId;
    const settings = await SettingRepository.getSettings();
    const configuredFee = typeof settings.exchangeShippingFee === "number" ? settings.exchangeShippingFee : 299;
    const details = this.resolveExchangeDetails(order, configuredFee, payload.exchangeId);

    const canPerformQc =
      ["return_approved", "return_picked"].includes(order.status) ||
      ["approved", "picked_up"].includes(details.stage);

    if (!canPerformQc) {
      throw new ValidationError("QC inspection can only be performed on approved or picked-up exchange orders");
    }

    if (details.stage === "replacement_dispatched" || details.stage === "completed") {
      throw new ValidationError("Replacement is already dispatched or completed");
    }

    const requestedMode = payload.feeCollectionMode;
    const effectiveFee =
      requestedMode === "waived"
        ? 0
        : typeof payload.shippingFee === "number" && payload.shippingFee >= 0
        ? payload.shippingFee
        : details.shippingFee;

    const alreadyPaid = ["paid_online", "paid_manual"].includes(details.shippingFeeStatus);

    if (payload.result === "failed") {
      const updatedExchange: IExchangeDetails = {
        ...details,
        stage: "qc_failed",
        qcStatus: "failed",
        qcChecklist: {
          tagsIntact: payload.tagsIntact,
          unusedCondition: payload.unusedCondition,
          packagingIntact: payload.packagingIntact,
        },
        qcNotes: payload.qcNotes,
        qcInspectedAt: new Date(),
        qcInspectedBy: adminUserId,
        reverseStatus: "delivered_to_hub",
        rejectionReason: payload.qcNotes,
      };
      const nextStatus = this.computeAggregateExchangeOrderStatus(order, updatedExchange, "return_picked");
      const updated = await OrderRepository.updateExchangeDetails(dbId, updatedExchange, nextStatus, {
        text: `Warehouse QC FAILED: ${payload.qcNotes}`,
        author: "Admin",
        timestamp: new Date(),
      });
      await this.invalidateAdminCountsCache();

      const customerEmail = order.guestEmail || order.customerEmail;
      if (customerEmail) {
        addEmailJob(
          customerEmail,
          `Exchange Quality Inspection Update — Order #${order.orderNumber}`,
          `<p>Hello ${order.shippingAddress?.fullName || "Rider"},</p><p>Your exchange parcel for Order <strong>#${order.orderNumber}</strong> did not pass warehouse quality inspection.</p><p><strong>Reason:</strong> ${payload.qcNotes}</p><p>Our support team will reach out regarding re-shipping the parcel back to you.</p>`
        );
      }

      return updated;
    }

    if (requestedMode === "cod" && effectiveFee <= 0) {
      throw new ValidationError("COD exchange shipping fee must be greater than Rs. 0.");
    }

    let finalFeeStatus = details.shippingFeeStatus;
    let collectionMode: "online" | "cod" | "waived" = details.shippingFeeCollectionMode || "online";
    let paymentMethodVal = details.shippingFeePaymentMethod;

    if (alreadyPaid) {
      finalFeeStatus = details.shippingFeeStatus;
    } else if (effectiveFee <= 0 || requestedMode === "waived") {
      finalFeeStatus = "waived";
      collectionMode = "waived";
      paymentMethodVal = "waived";
    } else if (requestedMode === "cod" || (!requestedMode && details.shippingFeeStatus === "cod_on_replacement")) {
      finalFeeStatus = "cod_on_replacement";
      collectionMode = "cod";
      paymentMethodVal = "cod";
    } else {
      finalFeeStatus = "pending";
      collectionMode = "online";
    }

    const nextStage = finalFeeStatus === "pending" ? "qc_passed" : "fee_settled";

    const updatedExchange: IExchangeDetails = {
      ...details,
      stage: nextStage,
      qcStatus: "passed",
      qcChecklist: {
        tagsIntact: payload.tagsIntact,
        unusedCondition: payload.unusedCondition,
        packagingIntact: payload.packagingIntact,
      },
      qcNotes: payload.qcNotes,
      qcInspectedAt: new Date(),
      qcInspectedBy: adminUserId,
      reverseStatus: "delivered_to_hub",
      pickedUpAt: details.pickedUpAt || new Date(),
      shippingFee: effectiveFee,
      shippingFeeStatus: finalFeeStatus,
      shippingFeeCollectionMode: collectionMode,
      shippingFeePaymentMethod: paymentMethodVal,
    };

    const noteText =
      finalFeeStatus === "pending"
        ? `Warehouse QC PASSED (${payload.qcNotes}). Awaiting 2-way courier fee of Rs. ${effectiveFee} (Online Pay) from customer.`
        : finalFeeStatus === "cod_on_replacement"
        ? `Warehouse QC PASSED (${payload.qcNotes}). Exchange shipping fee set as COD ON REPLACEMENT PARCEL (Rs. ${effectiveFee} to be collected at delivery). Ready for replacement dispatch.`
        : `Warehouse QC PASSED (${payload.qcNotes}). Shipping fee status: ${finalFeeStatus}. Ready for replacement dispatch.`;

    const nextStatus = this.computeAggregateExchangeOrderStatus(order, updatedExchange, "return_picked");
    const updated = await OrderRepository.updateExchangeDetails(dbId, updatedExchange, nextStatus, {
      text: noteText,
      author: "Admin",
      timestamp: new Date(),
    });
    await this.invalidateAdminCountsCache();

    const customerEmail = order.guestEmail || order.customerEmail;
    if (customerEmail && finalFeeStatus === "pending" && effectiveFee > 0) {
      const orderUrl = `${ENV.FRONTEND_URL}/account/orders/${encodeURIComponent(dbId)}`;
      addEmailJob(
        customerEmail,
        `QC Passed! Pay Rs. ${effectiveFee} Shipping Fee for Exchange #${order.orderNumber}`,
        `<p>Hello ${order.shippingAddress?.fullName || "Rider"},</p><p>Good news! Your exchange gear for Order <strong>#${order.orderNumber}</strong> passed our warehouse quality inspection.</p><p>Please settle the 2-way pickup &amp; replacement shipping fee of <strong>Rs. ${effectiveFee}</strong> online inside your order page via PayU / UPI / Card to unlock immediate replacement dispatch.</p><p><a href="${orderUrl}">Pay Shipping Fee Online</a></p>`
      );
    }

    return updated;
  }

  static async adminSettleExchangeFee(
    orderId: string,
    adminUserId: string,
    payload: {
      exchangeId?: string;
      settlementMode: "online_pending" | "paid_manual" | "cod_on_replacement" | "waived";
      paymentRef?: string;
      shippingFee?: number;
      note?: string;
    }
  ) {
    const order = await OrderRepository.findById(orderId);
    if (!order) throw new NotFoundError("Order");

    const dbId = (order as any)._id?.toString() || order.id || orderId;
    const settings = await SettingRepository.getSettings();
    const configuredFee = typeof settings.exchangeShippingFee === "number" ? settings.exchangeShippingFee : 299;
    const details = this.resolveExchangeDetails(order, configuredFee, payload.exchangeId);

    if (details.qcStatus !== "passed") {
      throw new ValidationError("Quality check must pass before updating shipping fee mode");
    }

    if (details.stage === "replacement_dispatched" || details.stage === "completed") {
      throw new ValidationError("Cannot change fee mode after replacement parcel has been dispatched");
    }

    if (details.shippingFeeStatus === "paid_online" && payload.settlementMode === "online_pending") {
      throw new ValidationError("Customer has already paid the exchange shipping fee online");
    }

    if (payload.settlementMode === "paid_manual" && !payload.paymentRef?.trim()) {
      throw new ValidationError("UPI / Payment reference ID is required when marking fee as manually paid");
    }

    const effectiveFee =
      payload.settlementMode === "waived"
        ? 0
        : typeof payload.shippingFee === "number" && payload.shippingFee >= 0
        ? payload.shippingFee
        : details.shippingFee > 0
        ? details.shippingFee
        : configuredFee;

    if (
      (payload.settlementMode === "cod_on_replacement" || payload.settlementMode === "online_pending") &&
      effectiveFee <= 0
    ) {
      throw new ValidationError("Shipping fee amount must be greater than Rs. 0 for this mode");
    }

    const isOnlinePending = payload.settlementMode === "online_pending";
    const nextFeeStatus =
      payload.settlementMode === "online_pending" ? ("pending" as const) : payload.settlementMode;
    const nextStage = isOnlinePending ? ("qc_passed" as const) : ("fee_settled" as const);
    const collectionMode: "online" | "cod" | "waived" =
      payload.settlementMode === "cod_on_replacement"
        ? "cod"
        : payload.settlementMode === "waived"
        ? "waived"
        : "online";

    const updatedExchange: IExchangeDetails = {
      ...details,
      shippingFee: effectiveFee,
      shippingFeeStatus: nextFeeStatus,
      shippingFeeCollectionMode: collectionMode,
      shippingFeePaymentMethod:
        payload.settlementMode === "cod_on_replacement"
          ? "cod"
          : payload.settlementMode === "paid_manual"
          ? "manual_upi"
          : payload.settlementMode === "waived"
          ? "waived"
          : "payu",
      shippingFeePaymentRef: payload.paymentRef?.trim() || details.shippingFeePaymentRef,
      shippingFeePaidAt: payload.settlementMode === "paid_manual" ? new Date() : details.shippingFeePaidAt,
      stage: nextStage,
    };

    const modeDesc = isOnlinePending
      ? `enabled ONLINE PAY MODE (Rs. ${effectiveFee} — customer can pay via PayU/UPI on website)`
      : payload.settlementMode === "paid_manual"
      ? `marked PAID MANUALLY (Rs. ${effectiveFee}, Ref: ${payload.paymentRef?.trim()})`
      : payload.settlementMode === "cod_on_replacement"
      ? `set as COD ON REPLACEMENT PARCEL (Rs. ${effectiveFee} to be collected at delivery)`
      : `WAIVED by admin`;

    const updated = await OrderRepository.updateExchangeDetails(dbId, updatedExchange, undefined, {
      text: `Exchange shipping fee ${modeDesc}.${payload.note ? ` Note: ${payload.note}` : ""}`,
      author: `Admin (${adminUserId})`,
      timestamp: new Date(),
    });
    await this.invalidateAdminCountsCache();

    const customerEmail = order.guestEmail || order.customerEmail;
    if (customerEmail && isOnlinePending) {
      const orderUrl = `${ENV.FRONTEND_URL}/account/orders/${encodeURIComponent(dbId)}`;
      addEmailJob(
        customerEmail,
        `Pay Rs. ${effectiveFee} Exchange Shipping Fee — Order #${order.orderNumber}`,
        `<p>Hello ${order.shippingAddress?.fullName || "Rider"},</p><p>Online payment of <strong>Rs. ${effectiveFee}</strong> is now open for your gear exchange on Order <strong>#${order.orderNumber}</strong>.</p><p><a href="${orderUrl}">Click here to Pay via PayU / UPI / Card</a></p>`
      );
    }

    return updated;
  }

  static async initiateExchangeFeePayment(
    orderId: string,
    userId: string,
    paymentMethod: "payu" | "ccavenue" | "upi",
    exchangeId?: string
  ) {
    const order = await OrderRepository.findById(orderId);
    if (!order || !order.userId || String(order.userId) !== String(userId)) {
      throw new NotFoundError("Order");
    }

    const dbId = (order as any)._id?.toString() || order.id || orderId;
    const settings = await SettingRepository.getSettings();
    const configuredFee = typeof settings.exchangeShippingFee === "number" ? settings.exchangeShippingFee : 299;
    const details = this.resolveExchangeDetails(order, configuredFee, exchangeId);

    if (details.qcStatus !== "passed") {
      throw new ValidationError("Your exchange item must pass warehouse quality inspection before shipping fee payment opens.");
    }

    if (details.shippingFeeStatus === "paid_online" || details.shippingFeeStatus === "paid_manual" || details.shippingFeeStatus === "waived") {
      throw new ValidationError("Exchange shipping fee is already settled for this order.");
    }

    if (details.shippingFeeStatus === "cod_on_replacement") {
      throw new ValidationError("Shipping fee is set to Cash on Delivery when your replacement arrives.");
    }

    const feeAmount = Number(details.shippingFee);
    if (!feeAmount || feeAmount <= 0) {
      throw new ValidationError("No shipping fee is due for this exchange.");
    }

    const enabled = Array.isArray(settings.enabledGateways) ? settings.enabledGateways : [];
    const gatewayAllowed =
      paymentMethod === "upi"
        ? Boolean(settings.upiMerchantVpa || ENV.GOOGLE_PAY_MERCHANT_VPA)
        : enabled.length === 0 || enabled.includes(paymentMethod);
    if (!gatewayAllowed) {
      throw new ValidationError(`Payment gateway '${paymentMethod}' is currently unavailable.`);
    }

    const user = order.userId ? await UserRepository.findById(order.userId) : null;
    const userEmail = user?.email || order.guestEmail || order.customerEmail;
    const feeOrderNumber = `${order.orderNumber}-EXF-${Date.now().toString().slice(-4)}`;

    const gateway = PaymentGatewayFactory.create(paymentMethod);
    const cleanFrontendUrl = (ENV.FRONTEND_URL || "").replace(/\/$/, "");
    const gatewayResult = await gateway.createOrder(
      {
        ...order,
        id: dbId,
        orderNumber: feeOrderNumber,
        userEmail,
        ...(cleanFrontendUrl
          ? { cancelUrl: `${cleanFrontendUrl}/account/orders/${encodeURIComponent(dbId)}?exchangeFeePaid=false` }
          : {}),
      } as any,
      feeAmount
    );

    const gatewayOrderId = gatewayResult.gatewayOrderId;

    await PaymentRepository.create({
      orderId: dbId,
      status: "created",
      amount: feeAmount,
      gatewayOrderId,
      method: paymentMethod as any,
      gateway: paymentMethod as any,
      paymentPurpose: "exchange_fee",
      webhookEvents: [],
      idempotencyKey: `exf_${dbId}_${gatewayOrderId}`,
    });

    const updatedDetails: IExchangeDetails = {
      ...details,
      shippingFeeGatewayOrderId: gatewayOrderId,
    };
    await OrderRepository.updateExchangeDetails(dbId, updatedDetails);

    return {
      orderId: dbId,
      orderNumber: feeOrderNumber,
      gatewayOrderId,
      amount: feeAmount,
      gatewayResponse: gatewayResult.gatewayResponse,
      paymentMethod,
    };
  }

  static async adminDispatchReplacement(
    orderId: string,
    adminUserId: string,
    payload: {
      exchangeId?: string;
      provider: "shiprocket" | "delhivery" | "xpressbees" | "manual";
      warehouseId?: string;
      courierName?: string;
      awb?: string;
      trackingUrl?: string;
      replacementVariant?: string;
      weightKg?: number;
      length?: number;
      breadth?: number;
      height?: number;
      autoAssignAwb?: boolean;
    }
  ) {
    const order = await OrderRepository.findById(orderId);
    if (!order) throw new NotFoundError("Order");

    const dbId = (order as any)._id?.toString() || order.id || orderId;
    const settings = await SettingRepository.getSettings();
    const configuredFee = typeof settings.exchangeShippingFee === "number" ? settings.exchangeShippingFee : 299;
    const details = this.resolveExchangeDetails(order, configuredFee, payload.exchangeId);

    if (details.qcStatus !== "passed") {
      throw new ValidationError("Cannot dispatch replacement before Warehouse QC passes.");
    }

    if (details.stage === "replacement_dispatched" || details.stage === "completed") {
      throw new ValidationError("Replacement parcel has already been dispatched for this exchange.");
    }

    const isFeeSettled =
      details.shippingFee <= 0 ||
      ["paid_online", "paid_manual", "cod_on_replacement", "waived"].includes(details.shippingFeeStatus);

    if (!isFeeSettled) {
      throw new ValidationError(
        `Shipping fee (Rs. ${details.shippingFee}) is still pending. Collect fee online/manually or select 'COD on Replacement' before dispatching.`
      );
    }

    const isCodFee = details.shippingFeeStatus === "cod_on_replacement" && details.shippingFee > 0;
    const { ShipmentService } = await import("../shipping/shipment.service");
    const dispatchResult = await ShipmentService.createExchangeReplacementShipment({
      orderId: dbId,
      provider: payload.provider,
      warehouseId: payload.warehouseId,
      courierName: payload.courierName,
      awb: payload.awb,
      trackingUrl: payload.trackingUrl,
      replacementVariant: payload.replacementVariant || details.desiredReplacement,
      ...(details.items?.length ? { exchangeItems: details.items } : {}),
      isCodFee,
      codFeeAmount: isCodFee ? details.shippingFee : 0,
      weightKg: payload.weightKg,
      length: payload.length,
      breadth: payload.breadth,
      height: payload.height,
      autoAssignAwb: payload.autoAssignAwb,
    });

    const updatedExchange: IExchangeDetails = {
      ...details,
      ...(payload.replacementVariant ? { desiredReplacement: payload.replacementVariant.trim() } : {}),
      stage: "replacement_dispatched",
      replacementCourier: dispatchResult.courierName || payload.courierName || payload.provider.toUpperCase(),
      replacementAwb: dispatchResult.awb,
      replacementTrackingUrl: dispatchResult.trackingUrl,
      replacementShipmentId: dispatchResult.shipment?._id ? String(dispatchResult.shipment._id) : undefined,
      replacementDispatchedAt: new Date(),
    };

    const codTag = isCodFee ? ` [COD Fee: Rs. ${details.shippingFee} on delivery]` : " [Prepaid Rs. 0]";
    const noteText = `Replacement dispatched via ${updatedExchange.replacementCourier}${updatedExchange.replacementAwb ? ` (AWB: ${updatedExchange.replacementAwb})` : ""}${codTag}.`;

    const nextStatus = this.computeAggregateExchangeOrderStatus(order, updatedExchange, "return_picked");
    const updated = await OrderRepository.updateExchangeDetails(dbId, updatedExchange, nextStatus, {
      text: noteText,
      author: `Admin (${adminUserId})`,
      timestamp: new Date(),
    });
    await this.invalidateAdminCountsCache();

    const customerEmail = order.guestEmail || order.customerEmail;
    if (customerEmail) {
      addEmailJob(
        customerEmail,
        `Replacement Dispatched for Order #${order.orderNumber} — Store4Riders`,
        `<p>Hello ${order.shippingAddress?.fullName || "Rider"},</p><p>Your replacement gear (<strong>${updatedExchange.desiredReplacement || "Replacement"}</strong>) for Order <strong>#${order.orderNumber}</strong> has been dispatched via <strong>${updatedExchange.replacementCourier}</strong>.</p>${updatedExchange.replacementAwb ? `<p><strong>Tracking AWB:</strong> ${updatedExchange.replacementAwb}</p>` : ""}${isCodFee ? `<p><strong>Note:</strong> Courier will collect <strong>Rs. ${details.shippingFee}</strong> (2-way exchange shipping fee) upon delivery.</p>` : ""}`
      );
    }

    return updated;
  }

  static async adminCompleteExchange(orderId: string, adminUserId: string, exchangeId?: string) {
    const order = await OrderRepository.findById(orderId);
    if (!order) throw new NotFoundError("Order");

    const dbId = (order as any)._id?.toString() || order.id || orderId;
    const settings = await SettingRepository.getSettings();
    const configuredFee = typeof settings.exchangeShippingFee === "number" ? settings.exchangeShippingFee : 299;
    const details = this.resolveExchangeDetails(order, configuredFee, exchangeId);

    if (details.qcStatus !== "passed") {
      throw new ValidationError("Cannot mark exchange complete before Warehouse QC passes.");
    }

    const updatedExchange: IExchangeDetails = {
      ...details,
      stage: "completed",
      replacementCompletedAt: new Date(),
    };

    const nextStatus = this.computeAggregateExchangeOrderStatus(order, updatedExchange, "returned");
    const updated = await OrderRepository.updateExchangeDetails(dbId, updatedExchange, nextStatus, {
      text: "Exchange completed — replacement gear delivered to customer.",
      author: `Admin (${adminUserId})`,
      timestamp: new Date(),
    });
    await this.invalidateAdminCountsCache();
    return updated;
  }

  static async getInvoiceUrl(orderId: string, userId: string) {
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      throw new AppError("Order not found", 404);
    }
    // Allow admin to skip userId check (verified at controller layer) or enforce strict owner check
    if (userId !== "admin" && (!order.userId || String(order.userId) !== String(userId))) {
      throw new AppError("Unauthorized", 403);
    }

    if (order.status === "failed" || order.status === "pending_payment") {
      throw new ValidationError("Tax invoices cannot be generated for uncompleted or failed payment orders");
    }

    const { InvoiceGenerator } = require("../../core/utils/invoiceGenerator");
    const url = await InvoiceGenerator.getOrGenerateInvoiceUrl(order);
    return url;
  }

  static async resendInvoiceEmail(orderId: string): Promise<{ invoiceUrl: string; recipientEmail: string }> {
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    if (order.status === "failed" || order.status === "pending_payment") {
      throw new ValidationError("Tax invoices cannot be emailed for uncompleted or failed payment orders");
    }

    const { InvoiceGenerator } = require("../../core/utils/invoiceGenerator");
    const invoiceUrl = await InvoiceGenerator.getOrGenerateInvoiceUrl(order);

    let recipientEmail = order.guestEmail;
    if (!recipientEmail && order.userId) {
      try {
        const { UserModel } = await import("../user/user.model");
        const user = await UserModel.findById(order.userId).lean().exec();
        recipientEmail = (user as any)?.email;
      } catch {}
    }

    if (!recipientEmail) {
      throw new ValidationError("No customer email found for this order");
    }

    const isCod = String(order.paymentMethod || "").toLowerCase() === "cod";
    const advancePaid = isCod ? (order.pricing?.codPartialPaymentAmount || 0) : order.pricing?.total;
    const balanceDue = isCod
      ? (order.pricing?.codAmountToCollect !== undefined
          ? order.pricing.codAmountToCollect
          : Math.max(0, (order.pricing?.total || 0) - advancePaid))
      : 0;

    let activeReturnDays = 7;
    try {
      const storeSettings = await SettingRepository.getSettings();
      if (typeof storeSettings?.returnWindowDays === "number" && storeSettings.returnWindowDays >= 0) {
        activeReturnDays = storeSettings.returnWindowDays;
      }
    } catch {}
    const policyFooterLine =
      activeReturnDays > 0
        ? `* Note: Store4Riders operates under a strict ${activeReturnDays}-Day Size & Gear Exchange Policy. No monetary returns/refunds.`
        : `* Note: Store4Riders operates under a Final Sale Policy for this item. Size exchanges are not applicable.`;

    const emailSubject = `Tax Invoice for Order #${order.orderNumber} - Store4Riders`;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #AB1509; margin-top: 0;">Store4Riders Tax Invoice</h2>
        <p>Hello <strong>${order.shippingAddress?.fullName || "Rider"}</strong>,</p>
        <p>Thank you for choosing Store4Riders for your riding gear. Here is your official tax invoice for Order <strong>#${order.orderNumber}</strong>.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 15px; margin: 20px 0;">
          <h3 style="margin-top: 0; font-size: 14px; color: #0f172a;">Order & Payment Summary</h3>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Order ID:</strong> #${order.orderNumber}</p>
          <p style="margin: 4px 0; font-size: 13px;"><strong>Grand Total:</strong> Rs. ${order.pricing?.total?.toFixed(2)}</p>
          ${order.pricing?.couponDiscount && order.pricing.couponDiscount > 0 ? `
            <p style="margin: 4px 0; font-size: 13px; color: #16a34a;"><strong>Promo Coupon (${order.pricing.couponCode || ""}):</strong> -Rs. ${order.pricing.couponDiscount.toFixed(2)}</p>
          ` : ""}
          <p style="margin: 4px 0; font-size: 13px;"><strong>Payment Method:</strong> ${isCod ? "Cash on Delivery" : order.paymentMethod.toUpperCase()}</p>
          ${isCod ? `
            <p style="margin: 4px 0; font-size: 13px; color: #15803d;"><strong>Advance Paid Online:</strong> Rs. ${advancePaid.toFixed(2)}</p>
            <p style="margin: 4px 0; font-size: 14px; color: #b91c1c;"><strong>Balance Cash Due on Delivery:</strong> Rs. ${balanceDue.toFixed(2)}</p>
          ` : `
            <p style="margin: 4px 0; font-size: 13px; color: #15803d;"><strong>Payment Status:</strong> Paid in Full Online</p>
          `}
        </div>

        <div style="text-align: center; margin: 25px 0;">
          <a href="${invoiceUrl}" target="_blank" style="background-color: #AB1509; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
            Download Tax Invoice PDF
          </a>
        </div>

        <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
          ${policyFooterLine}
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">
          Store4Riders | Premium Motorcycle Riding Gear | support@store4riders.com
        </p>
      </div>
    `;

    try {
      const { addEmailJob } = require("../../core/queue/email.queue");
      await addEmailJob(recipientEmail, emailSubject, emailBody);
    } catch {
      try {
        const { sendEmail } = require("../../core/email/ses");
        await sendEmail(recipientEmail, emailSubject, emailBody);
      } catch (err: any) {
        logger.error("[OrderService] Failed to queue or send invoice email", err);
      }
    }

    // Add note on order
    await OrderRepository.addNote(orderId, {
      text: `Tax Invoice resent via email to ${recipientEmail}`,
      author: "admin",
      timestamp: new Date(),
    });

    return { invoiceUrl, recipientEmail };
  }

  static async adminAssignWarehouse(orderId: string, warehouseId: string): Promise<any> {
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    const { WarehouseRepository } = await import("../warehouse/warehouse.repository");
    const warehouse = await WarehouseRepository.findById(warehouseId);
    if (!warehouse) {
      throw new NotFoundError("Warehouse");
    }

    const note = {
      text: `Dispatch warehouse assigned to ${warehouse.name} (${warehouse.city}, ${warehouse.state})`,
      author: "admin",
      timestamp: new Date(),
    };

    const dbId = String((order as any)._id || order.id || orderId);
    const updatedOrder = await OrderRepository.updateWarehouse(dbId, warehouseId, note);

    // Also update any existing forward shipment
    try {
      const { ShipmentModel } = await import("../shipping/shipment.model");
      await ShipmentModel.updateMany({ orderId: dbId }, { $set: { warehouseId: String(warehouse._id) } });
    } catch {}

    // Regenerate invoice with updated warehouse
    try {
      const { InvoiceGenerator } = require("../../core/utils/invoiceGenerator");
      if (updatedOrder) {
        await InvoiceGenerator.generateAndSaveInvoice(updatedOrder);
      }
    } catch {}

    return updatedOrder;
  }

  static async cleanupAbandonedOrders(): Promise<number> {
    try {
      if (typeof OrderRepository.findStalePendingOrders !== "function") {
        const count = await OrderRepository.markStaleOrdersAsFailed();
        if (count > 0) {
          logger.info(`Cleaned up ${count} abandoned orders stuck in pending_payment`);
        }
        return count;
      }

      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const staleOrders = await OrderRepository.findStalePendingOrders(thirtyMinutesAgo, 50);

      let expiredCount = 0;
      let recoveredCount = 0;

      for (const staleOrder of staleOrders) {
        const orderRef = staleOrder.orderNumber || String((staleOrder as any)._id || staleOrder.id || "");
        const orderDbId = String((staleOrder as any)._id || staleOrder.id || "");
        if (!orderDbId) continue;

        let shouldExpire = true;
        if (staleOrder.paymentMethod && staleOrder.paymentMethod !== "cod") {
          try {
            const syncResult = await this.syncPaymentStatus(orderRef);
            if (syncResult?.isConfirmed) {
              recoveredCount++;
              shouldExpire = false;
            } else if (syncResult?.gatewayStatus === "pending") {
              const createdAtMs = staleOrder.createdAt ? new Date(staleOrder.createdAt).getTime() : 0;
              if (createdAtMs && createdAtMs > twoHoursAgo.getTime()) {
                shouldExpire = false;
              }
            }
          } catch {
            const createdAtMs = staleOrder.createdAt ? new Date(staleOrder.createdAt).getTime() : 0;
            if (createdAtMs && createdAtMs > twoHoursAgo.getTime()) {
              shouldExpire = false;
            }
          }
        }

        if (shouldExpire) {
          const updated = await OrderRepository.atomicStatusTransition(
            orderDbId,
            "pending_payment",
            "failed",
            { failureReason: "Checkout abandoned / Payment window expired (30m)" }
          );
          if (updated) {
            expiredCount++;
          }
        }
      }

      if (recoveredCount > 0 || expiredCount > 0) {
        logger.info(
          `Stale order reconciliation complete: recovered ${recoveredCount} captured orders, expired ${expiredCount} unpaid orders`
        );
      }
      return expiredCount;
    } catch (error: any) {
      logger.error("Failed to cleanup abandoned orders", { error: error.message });
      return 0;
    }
  }

  /**
   * Daily EOD financial reconciliation across the last 48 hours of failed online orders.
   * Recovers late bank captures (RBI P2M settlement window) and surfaces captured payments pending manual refund.
   */
  static async reconcileDailySettlements(): Promise<{
    checked: number;
    lateRecovered: number;
    pendingManualRefunds: number;
  }> {
    const metrics = { checked: 0, lateRecovered: 0, pendingManualRefunds: 0 };
    try {
      if (typeof OrderRepository.findRecentFailedGatewayOrders !== "function") {
        return metrics;
      }

      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const failedOrders = await OrderRepository.findRecentFailedGatewayOrders(fortyEightHoursAgo, 100);
      metrics.checked = failedOrders.length;

      for (const order of failedOrders) {
        const orderRef = order.orderNumber || String((order as any)._id || order.id || "");
        const gatewayOrderId = order.gatewayOrderId || "";
        if (!orderRef || !gatewayOrderId) continue;

        const payment = await PaymentRepository.findByGatewayOrderId(gatewayOrderId);
        if (!payment) continue;

        const hasRecordedRefund = Array.isArray(payment.refunds) && payment.refunds.length > 0;
        if (payment.status === "captured" && !hasRecordedRefund) {
          metrics.pendingManualRefunds++;
          logger.error(
            `CRITICAL EOD RECONCILIATION ALERT: Order #${orderRef} is 'failed' while payment ${payment.gatewayPaymentId || gatewayOrderId} (INR ${payment.amount}) remains 'captured' with no recorded refund.`
          );
          try {
            const { adminEventHub } = await import("../../core/events/adminEventHub");
            adminEventHub.publish("DAILY_RECONCILIATION_ALERT", {
              orderNumber: orderRef,
              gatewayOrderId,
              amount: payment.amount,
              message: `Order #${orderRef} has a captured payment (INR ${payment.amount}) in failed status requiring refund attention.`,
            });
          } catch {}
          continue;
        }

        if (["created", "pending", "failed"].includes(payment.status)) {
          try {
            const syncResult = await this.syncPaymentStatus(orderRef);
            if (syncResult?.isConfirmed) {
              metrics.lateRecovered++;
            }
          } catch {
            // Non-blocking: continue reconciling remaining orders
          }
        }
      }

      if (metrics.lateRecovered > 0 || metrics.pendingManualRefunds > 0) {
        logger.info(
          `Daily EOD settlement reconciliation complete: checked=${metrics.checked}, lateRecovered=${metrics.lateRecovered}, pendingManualRefunds=${metrics.pendingManualRefunds}`
        );
      }
      return metrics;
    } catch (error: any) {
      logger.error("Failed to run daily EOD settlement reconciliation", { error: error.message });
      return metrics;
    }
  }
}
