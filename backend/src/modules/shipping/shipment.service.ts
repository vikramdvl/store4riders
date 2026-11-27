import mongoose from "mongoose";
import { AppError, NotFoundError, ValidationError } from "../../core/errors/AppError";
import { ShipmentModel } from "./shipment.model";
import { ShipmentRepository } from "./shipment.repository";
import { OrderModel } from "../order/order.model";
import { ProductModel } from "../product/product.model";
import { WarehouseRepository } from "../warehouse/warehouse.repository";
import { WarehouseModel } from "../warehouse/warehouse.model";
import { PincodeService } from "../pincode/pincode.service";
import { ShippingProviderFactory } from "../../core/shipping/ShippingProviderFactory";
import { CreateShipmentInput } from "../../core/shipping/ShippingProvider";
import { logger } from "../../core/utils/logger";
import { getCache, setCache } from "../../core/cache/redis";
import { ENV } from "../../core/config/env";
import { SettingRepository } from "../settings/setting.repository";
import {
  estimateOrderPackageDimensions,
  calculateVolumetricWeight,
  calculateChargeableWeight,
  type IPackageSpecInputItem,
  type IPackageBoxPreset,
} from "@store4riders/shared-utils";

export class ShipmentService {
  /**
   * Action 1: Push Order to Shiprocket (Option B flow).
   * Creates unfulfilled order in Shiprocket Dashboard where Admin can
   * open the order, select Pickup Location (Kolkata/Pune etc.), edit weight,
   * choose courier, and print labels.
   */
  static async pushOrderToShiprocket(
    orderIdOrParams: string | {
      orderId: string;
      warehouseId?: string;
      weightKg?: number;
      length?: number;
      breadth?: number;
      height?: number;
      autoAssignAwb?: boolean;
      recipientPhone?: string;
    },
    warehouseIdLegacy?: string
  ): Promise<any> {
    const opts = typeof orderIdOrParams === "string"
      ? { orderId: orderIdOrParams, warehouseId: warehouseIdLegacy }
      : orderIdOrParams;

    const { 
      orderId, 
      warehouseId, 
      weightKg, 
      length: customL, 
      breadth: customB, 
      height: customH,
      autoAssignAwb = false // Default to false: sends to Shiprocket dashboard for manual courier selection
    } = opts;
    const order = await OrderModel.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    if (opts.recipientPhone) {
      const cleanPhone = opts.recipientPhone.replace(/\D/g, "").slice(-10);
      if (cleanPhone.length === 10) {
        if (!order.shippingAddress) {
          (order as any).shippingAddress = {};
        }
        order.shippingAddress.phone = cleanPhone;
        await OrderModel.findByIdAndUpdate(orderId, { "shippingAddress.phone": cleanPhone });
      }
    }

    // Check if shipment already created for this order
    const existingShipment = await ShipmentModel.findOne({ orderId });
    if (existingShipment && existingShipment.provider === "shiprocket" && existingShipment.providerShipmentId) {
      return {
        shipment: existingShipment,
        message: "Order already pushed to Shiprocket",
      };
    }

    // Determine package weight & dimensions: user-provided > product/variant DB specs + warehouse presets > defaults
    const resolvedDims = await this.resolveOrderPackageDimensions(order, {
      weightKg,
      length: customL,
      breadth: customB,
      height: customH,
    });
    const totalWeight = resolvedDims.weight;
    const finalLength = resolvedDims.length;
    const finalBreadth = resolvedDims.breadth;
    const finalHeight = resolvedDims.height;
    const volumetricWeight = Number(calculateVolumetricWeight(finalLength, finalBreadth, finalHeight).toFixed(2));
    const chargeableWeight = Number(calculateChargeableWeight(totalWeight, volumetricWeight).toFixed(2));
    const packageEntry = {
      length: finalLength,
      breadth: finalBreadth,
      height: finalHeight,
      weight: totalWeight,
      volumetricWeight,
      chargeableWeight,
      skuList: (order.items || []).map((i: any) => i.sku).filter(Boolean),
    };

    // Resolve warehouse: explicitly passed > order.warehouseId > default warehouse
    let targetWarehouse: any = null;
    if (warehouseId) {
      targetWarehouse = await WarehouseRepository.findById(warehouseId);
    } else if (order.warehouseId) {
      targetWarehouse = await WarehouseRepository.findById(order.warehouseId);
    }
    if (!targetWarehouse) {
      targetWarehouse = await WarehouseRepository.findDefault();
    }
    const pickupLocation = targetWarehouse?.shiprocketLocationId || targetWarehouse?.pincode;

    const input: CreateShipmentInput = {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      paymentMethod: order.paymentMethod === "cod" ? "cod" : "prepaid",
      totalAmount: order.pricing.codAmountToCollect || order.pricing.total,
      shippingAddress: {
        fullName: order.shippingAddress.fullName,
        phone: order.shippingAddress.phone,
        addressLine1: order.shippingAddress.addressLine1 || order.shippingAddress.street || "",
        addressLine2: order.shippingAddress.addressLine2 || "",
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        pincode: order.shippingAddress.pincode,
        country: order.shippingAddress.country || "India",
      },
      email: order.guestEmail || "customer@store4riders.com",
      items: order.items.map((i: any) => ({
        name: i.name,
        sku: i.sku,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      length: finalLength,
      breadth: finalBreadth,
      height: finalHeight,
      weight: Number(totalWeight.toFixed(2)),
      warehouseId: targetWarehouse ? String(targetWarehouse._id) : undefined,
      autoAssignAwb: Boolean(autoAssignAwb),
    };

    const providerInstance = ShippingProviderFactory.create("shiprocket");
    const result = await providerInstance.createShipment(input);

    // Save or update Shipment in DB
    let shipment = existingShipment;
    if (!shipment) {
      shipment = new ShipmentModel({
        orderId: String(order._id),
        warehouseId: targetWarehouse ? String(targetWarehouse._id) : undefined,
        provider: "shiprocket",
        shipmentType: "forward",
        status: result.awb ? "AWB_ASSIGNED" : "SHIPMENT_CREATED",
        providerOrderId: result.providerOrderId,
        providerShipmentId: result.shipmentId,
        shipmentId: result.shipmentId,
        awb: result.awb,
        courierName: result.courierName,
        labelUrl: result.labelUrl,
        providerStatus: result.awb ? "AWB Generated" : "Order Created in Shiprocket Dashboard (Pending Courier Selection)",
        packages: [packageEntry],
        totalWeight: totalWeight,
        customerShippingCharge: order.pricing?.shipping || 0,
        codFee: order.paymentMethod === "cod" ? (order.pricing?.codAmountToCollect || 0) : 0,
        idempotencyKey: `sr_${order._id}_${Date.now()}`,
      });
    } else {
      shipment.provider = "shiprocket";
      if (targetWarehouse) {
        shipment.warehouseId = String(targetWarehouse._id);
      }
      shipment.status = result.awb ? "AWB_ASSIGNED" : "SHIPMENT_CREATED";
      if (result.providerOrderId) shipment.providerOrderId = result.providerOrderId;
      shipment.providerShipmentId = result.shipmentId;
      shipment.shipmentId = result.shipmentId;
      shipment.awb = result.awb;
      shipment.courierName = result.courierName;
      shipment.labelUrl = result.labelUrl;
      shipment.providerStatus = result.awb ? "AWB Generated" : "Order Created in Shiprocket Dashboard (Pending Courier Selection)";
      shipment.packages = [packageEntry];
      shipment.totalWeight = totalWeight;
    }
    await shipment.save();

    if (targetWarehouse) {
      order.warehouseId = String(targetWarehouse._id);
    }

    // Update Order with note
    if (!order.notes) {
      order.notes = [];
    }
    order.notes.push({
      text: result.awb
        ? `Dispatched via Shiprocket (${result.courierName || "Shiprocket"}). AWB: ${result.awb}`
        : `Pushed to Shiprocket Dashboard (Shipment ID: ${result.shipmentId}). Admin can select courier in Shiprocket.`,
      author: "admin",
      timestamp: new Date(),
    });
    if (order.status === "confirmed" || order.status === "processing" || order.status === "pending_payment") {
      order.status = result.awb ? "packed" : "processing";
    }
    await order.save();

    logger.info(`[ShipmentService] Order ${order.orderNumber} successfully pushed to Shiprocket (ID: ${result.shipmentId})`);

    return {
      success: true,
      shipment,
      message: result.awb
        ? `Order dispatched and AWB ${result.awb} assigned via Shiprocket`
        : `Order pushed to Shiprocket Dashboard (Shipment ID: ${result.shipmentId}). You can select courier inside Shiprocket.`,
    };
  }

  /**
   * Action 2: Direct Carrier Shipment (Failover / Alternative flow).
   * Dispatches order directly via Delhivery or Xpressbees using merchant's direct credentials.
   * Admin selects warehouse (Kolkata/Pune) directly in Store4Riders modal.
   */
  static async createDirectShipment(params: {
    orderId: string;
    provider: "delhivery" | "xpressbees";
    warehouseId: string;
    weightKg?: number;
    length?: number;
    breadth?: number;
    height?: number;
    recipientPhone?: string;
  }): Promise<any> {
    const { orderId, provider, warehouseId, weightKg, recipientPhone } = params;

    const order = await OrderModel.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    if (recipientPhone) {
      const cleanPhone = recipientPhone.replace(/\D/g, "").slice(-10);
      if (cleanPhone.length === 10) {
        if (!order.shippingAddress) {
          (order as any).shippingAddress = {};
        }
        order.shippingAddress.phone = cleanPhone;
        await OrderModel.findByIdAndUpdate(orderId, { "shippingAddress.phone": cleanPhone });
      }
    }

    const resolvedDims = await this.resolveOrderPackageDimensions(order, {
      weightKg,
      length: params.length,
      breadth: params.breadth,
      height: params.height,
    });
    const finalWeight = resolvedDims.weight;
    const finalLength = resolvedDims.length;
    const finalBreadth = resolvedDims.breadth;
    const finalHeight = resolvedDims.height;
    const volumetricWeight = Number(calculateVolumetricWeight(finalLength, finalBreadth, finalHeight).toFixed(2));
    const chargeableWeight = Number(calculateChargeableWeight(finalWeight, volumetricWeight).toFixed(2));
    const packageEntry = {
      length: finalLength,
      breadth: finalBreadth,
      height: finalHeight,
      weight: finalWeight,
      volumetricWeight,
      chargeableWeight,
      skuList: (order.items || []).map((i: any) => i.sku).filter(Boolean),
    };

    const warehouse = await WarehouseRepository.findById(warehouseId);
    if (!warehouse) {
      throw new NotFoundError("Warehouse");
    }

    const input: CreateShipmentInput = {
      warehouseId,
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      paymentMethod: order.paymentMethod === "cod" ? "cod" : "prepaid",
      totalAmount: order.pricing.codAmountToCollect || order.pricing.total,
      shippingAddress: {
        fullName: order.shippingAddress.fullName,
        phone: order.shippingAddress.phone,
        addressLine1: order.shippingAddress.addressLine1 || order.shippingAddress.street || "",
        addressLine2: order.shippingAddress.addressLine2 || "",
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        pincode: order.shippingAddress.pincode,
        country: order.shippingAddress.country || "India",
      },
      email: order.guestEmail || "customer@store4riders.com",
      items: order.items.map((i: any) => ({
        name: i.name,
        sku: i.sku,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      length: finalLength,
      breadth: finalBreadth,
      height: finalHeight,
      weight: finalWeight,
    };

    const providerInstance = ShippingProviderFactory.create(provider);
    const result = await providerInstance.createShipment(input);

    let shipment = await ShipmentModel.findOne({ orderId });
    if (!shipment) {
      shipment = new ShipmentModel({
        orderId: String(order._id),
        provider,
        shipmentType: "forward",
        status: result.awb ? "AWB_ASSIGNED" : "SHIPMENT_CREATED",
        providerShipmentId: result.shipmentId,
        awb: result.awb,
        warehouseId,
        courierName: result.courierName || provider,
        labelUrl: result.labelUrl,
        providerStatus: `Dispatched via ${provider} from ${warehouse.name}`,
        packages: [packageEntry],
        totalWeight: finalWeight,
        customerShippingCharge: order.pricing?.shipping || 0,
        codFee: order.paymentMethod === "cod" ? (order.pricing?.codAmountToCollect || 0) : 0,
        idempotencyKey: `direct_${provider}_${order._id}_${Date.now()}`,
      });
    } else {
      shipment.provider = provider;
      shipment.warehouseId = warehouseId;
      shipment.status = result.awb ? "AWB_ASSIGNED" : "SHIPMENT_CREATED";
      shipment.providerShipmentId = result.shipmentId;
      shipment.awb = result.awb;
      shipment.courierName = result.courierName || provider;
      shipment.labelUrl = result.labelUrl;
      shipment.providerStatus = `Dispatched via ${provider} from ${warehouse.name}`;
      shipment.packages = [packageEntry];
      shipment.totalWeight = finalWeight;
    }
    await shipment.save();

    // Transition Order to shipped if AWB assigned
    if (result.awb) {
      order.status = "shipped";
    } else {
      order.status = "packed";
    }
    order.warehouseId = warehouseId;
    if (!order.notes) {
      order.notes = [];
    }
    order.notes.push({
      text: `Dispatched directly via ${provider.toUpperCase()} from ${warehouse.name} (AWB: ${result.awb || "Pending"})`,
      author: "admin",
      timestamp: new Date(),
    });
    await order.save();

    logger.info(`[ShipmentService] Order ${order.orderNumber} dispatched via direct ${provider} (AWB: ${result.awb})`);

    return {
      success: true,
      shipment,
      message: `Dispatched successfully via ${provider.toUpperCase()}`,
    };
  }

  /**
   * Action 3: Manual AWB Entry (Emergency / Offline Franchise).
   */
  static async createManualShipment(params: {
    orderId: string;
    courierName: string;
    awb: string;
    trackingUrl?: string;
  }): Promise<any> {
    const { orderId, courierName, awb, trackingUrl } = params;

    const order = await OrderModel.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    if (!awb || !courierName) {
      throw new ValidationError("Courier name and AWB number are required");
    }

    const shipment = new ShipmentModel({
      orderId: String(order._id),
      provider: "manual",
      shipmentType: "forward",
      status: "AWB_ASSIGNED",
      awb,
      courierName,
      trackingUrl,
      providerStatus: `Manually dispatched via ${courierName}`,
      customerShippingCharge: order.pricing.shipping,
      idempotencyKey: `manual_${order._id}_${Date.now()}`,
    });
    await shipment.save();

    order.status = "shipped";
    if (!order.notes) order.notes = [];
    order.notes.push({
      text: `Manually dispatched via ${courierName} (AWB: ${awb})`,
      author: "admin",
      timestamp: new Date(),
    });
    await order.save();

    return {
      success: true,
      shipment,
      message: "Manual shipment recorded and order marked as shipped",
    };
  }

  private static async resolveOrderPackageDimensions(
    order: any,
    overrides?: { weightKg?: number; length?: number; breadth?: number; height?: number }
  ) {
    let specItems: IPackageSpecInputItem[] = [];
    const orderItems = Array.isArray(order?.items) ? order.items : [];

    try {
      const productIds = orderItems.map((i: any) => i.productId).filter(Boolean);
      const products =
        productIds.length > 0
          ? await ProductModel.find({ _id: { $in: productIds } })
              .select("sku weight weightUnit length breadth height dimensionUnit variants")
              .lean()
              .exec()
          : [];

      const productMap = new Map(products.map((p: any) => [String(p._id), p]));

      specItems = orderItems.map((item: any) => {
        const p: any = productMap.get(String(item.productId));
        const variant = (p?.variants || []).find(
          (v: any) =>
            (item.variantId && (v.id === item.variantId || v.sku === item.variantId)) ||
            (item.sku && v.sku === item.sku)
        );

        const vW = Number(variant?.weight);
        const pW = Number(p?.weight);
        const itemW = Number(item.weight);

        let weight: number | undefined;
        let weightUnit: string = "kg";
        if (vW > 0) {
          weight = vW;
          weightUnit = variant?.weightUnit || p?.weightUnit || item.weightUnit || "kg";
        } else if (pW > 0) {
          weight = pW;
          weightUnit = p?.weightUnit || item.weightUnit || "kg";
        } else if (itemW > 0) {
          weight = itemW;
          weightUnit = item.weightUnit || "kg";
        }

        const vL = Number(variant?.length);
        const vB = Number(variant?.breadth);
        const vH = Number(variant?.height);
        const pL = Number(p?.length);
        const pB = Number(p?.breadth);
        const pH = Number(p?.height);
        const itemL = Number(item.length);
        const itemB = Number(item.breadth || item.width);
        const itemH = Number(item.height);

        return {
          sku: item.sku,
          quantity: item.quantity || 1,
          weight,
          weightUnit,
          length: vL > 0 ? vL : pL > 0 ? pL : itemL > 0 ? itemL : undefined,
          breadth: vB > 0 ? vB : pB > 0 ? pB : itemB > 0 ? itemB : undefined,
          height: vH > 0 ? vH : pH > 0 ? pH : itemH > 0 ? itemH : undefined,
          dimensionUnit: variant?.dimensionUnit || p?.dimensionUnit || item.dimensionUnit || "cm",
        };
      });
    } catch {
      specItems = orderItems.map((item: any) => ({
        sku: item.sku,
        quantity: item.quantity || 1,
        weight: Number(item.weight) > 0 ? Number(item.weight) : undefined,
        weightUnit: item.weightUnit || "kg",
        length: Number(item.length) > 0 ? Number(item.length) : undefined,
        breadth: Number(item.breadth || item.width) > 0 ? Number(item.breadth || item.width) : undefined,
        height: Number(item.height) > 0 ? Number(item.height) : undefined,
        dimensionUnit: item.dimensionUnit || "cm",
      }));
    }

    const hasAnyDimensions = specItems.some(
      (i) => (i.length || 0) > 0 && (i.breadth || 0) > 0 && (i.height || 0) > 0
    );
    const needsAutoDimensions =
      hasAnyDimensions &&
      !(
        overrides?.length &&
        Number(overrides.length) > 0 &&
        overrides?.breadth &&
        Number(overrides.breadth) > 0 &&
        overrides?.height &&
        Number(overrides.height) > 0
      );

    let packagePresets: IPackageBoxPreset[] | undefined;
    if (needsAutoDimensions) {
      try {
        const settings = await SettingRepository.getSettings();
        if (Array.isArray(settings?.packagePresets)) {
          packagePresets = settings.packagePresets;
        }
      } catch {
        packagePresets = undefined;
      }
    }

    const estimated = estimateOrderPackageDimensions(specItems, packagePresets);

    const finalWeight =
      overrides?.weightKg !== undefined && overrides.weightKg !== null && Number(overrides.weightKg) > 0
        ? Number(Number(overrides.weightKg).toFixed(2))
        : estimated.weight;
    const finalLength =
      overrides?.length !== undefined && overrides.length !== null && Number(overrides.length) > 0
        ? Math.round(Number(overrides.length))
        : estimated.length;
    const finalBreadth =
      overrides?.breadth !== undefined && overrides.breadth !== null && Number(overrides.breadth) > 0
        ? Math.round(Number(overrides.breadth))
        : estimated.breadth;
    const finalHeight =
      overrides?.height !== undefined && overrides.height !== null && Number(overrides.height) > 0
        ? Math.round(Number(overrides.height))
        : estimated.height;

    return {
      weight: finalWeight > 0 ? finalWeight : 0.5,
      length: Math.max(1, finalLength),
      breadth: Math.max(1, finalBreadth),
      height: Math.max(1, finalHeight),
    };
  }

  private static resolveProviderTrackingUrl(provider: string, awb?: string): string | undefined {
    if (!awb) return undefined;
    if (provider === "shiprocket") return `https://shiprocket.co/tracking/${awb}`;
    if (provider === "delhivery") return `https://www.delhivery.com/track/package/${awb}`;
    if (provider === "xpressbees") return `https://www.xpressbees.com/track?awb=${awb}`;
    return undefined;
  }

  private static resolveScopedExchangeItems(order: any, exchangeItems?: any[]) {
    const orderItems = Array.isArray(order?.items) ? order.items : [];
    if (!Array.isArray(exchangeItems) || exchangeItems.length === 0) {
      return orderItems;
    }

    const matched: any[] = [];
    for (const exItem of exchangeItems) {
      const exOrderItemId = exItem.orderItemId ? String(exItem.orderItemId) : "";
      const exProductId = exItem.productId ? String(exItem.productId) : "";
      const exVariantId = exItem.variantId ? String(exItem.variantId) : "";
      const exSku = exItem.sku ? String(exItem.sku).toLowerCase() : "";

      const orderItem = orderItems.find((oi: any) => {
        if (exOrderItemId && String(oi._id || oi.id || "") === exOrderItemId) return true;
        const sameProduct = exProductId && String(oi.productId || "") === exProductId;
        if (sameProduct) {
          if (exVariantId) return String(oi.variantId || "") === exVariantId;
          if (exSku) return String(oi.sku || "").toLowerCase() === exSku;
          return true;
        }
        return exSku && String(oi.sku || "").toLowerCase() === exSku;
      });

      if (orderItem) {
        matched.push({
          ...orderItem,
          quantity: exItem.quantity || orderItem.quantity || 1,
          unitPrice: exItem.unitPrice ?? orderItem.unitPrice,
        });
      } else if (exItem.name || exItem.sku) {
        matched.push({
          productId: exItem.productId,
          variantId: exItem.variantId,
          name: exItem.name || "Exchange Gear",
          sku: exItem.sku || "EXCHANGE",
          quantity: exItem.quantity || 1,
          unitPrice: exItem.unitPrice || 1,
        });
      }
    }

    return matched.length > 0 ? matched : orderItems;
  }

  /**
   * Creates a Reverse Pickup Shipment (Customer Doorstep -> Warehouse Hub) for an Exchange.
   * Supports Shiprocket, Delhivery, Xpressbees, or Manual courier entry without touching forward checkout shipments.
   */
  static async createExchangeReverseShipment(params: {
    orderId: string;
    provider: "shiprocket" | "delhivery" | "xpressbees" | "manual";
    warehouseId?: string;
    courierName?: string;
    awb?: string;
    trackingUrl?: string;
    exchangeItems?: any[];
    weightKg?: number;
    length?: number;
    breadth?: number;
    height?: number;
  }): Promise<any> {
    const { orderId, provider, warehouseId, courierName, awb, trackingUrl, exchangeItems } = params;
    const order = await OrderModel.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    if (provider === "manual") {
      if (!courierName?.trim() || !awb?.trim()) {
        throw new ValidationError("Reverse courier name and AWB number are required for manual entry");
      }
      const shipment = new ShipmentModel({
        orderId: String(order._id),
        warehouseId: warehouseId || order.warehouseId,
        provider: "manual",
        shipmentType: "reverse",
        status: "AWB_ASSIGNED",
        awb: awb.trim(),
        courierName: courierName.trim(),
        trackingUrl: trackingUrl?.trim() || undefined,
        pickupStatus: "SCHEDULED",
        providerStatus: `Exchange Reverse Pickup scheduled via ${courierName.trim()}`,
        idempotencyKey: `exchange_rev_manual_${order._id}_${Date.now()}`,
      });
      await shipment.save();
      return {
        shipment,
        awb: shipment.awb,
        courierName: shipment.courierName,
        trackingUrl: shipment.trackingUrl,
        message: `Reverse pickup recorded (${shipment.courierName}: ${shipment.awb})`,
      };
    }

    let targetWarehouse: any = null;
    if (warehouseId) {
      targetWarehouse = await WarehouseRepository.findById(warehouseId);
    } else if (order.warehouseId) {
      targetWarehouse = await WarehouseRepository.findById(order.warehouseId);
    }
    if (!targetWarehouse) {
      targetWarehouse = await WarehouseRepository.findDefault();
    }

    if ((provider === "delhivery" || provider === "xpressbees") && !targetWarehouse) {
      throw new AppError(`Please select a return warehouse before scheduling a ${provider} reverse pickup`, 400);
    }

    const scopedItems = this.resolveScopedExchangeItems(order, exchangeItems);
    const dims = await this.resolveOrderPackageDimensions({ ...order, items: scopedItems }, params);
    const reverseOrderRef = `${order.orderNumber}-REV-${Date.now().toString().slice(-4)}`;

    const providerInstance = ShippingProviderFactory.create(provider);
    if (!providerInstance.createReverseShipment) {
      throw new AppError(`Selected shipping provider (${provider}) does not support reverse pickup creation`, 400);
    }

    const scopedTotal = scopedItems.reduce(
      (sum: number, i: any) => sum + Math.max(1, Number(i.unitPrice) || 0) * (i.quantity || 1),
      0
    );

    const input: CreateShipmentInput = {
      orderId: String(order._id),
      orderNumber: reverseOrderRef,
      paymentMethod: "prepaid",
      totalAmount: Math.max(1, scopedTotal || order.pricing?.total || 1),
      shippingAddress: {
        fullName: order.shippingAddress.fullName,
        phone: order.shippingAddress.phone,
        addressLine1: order.shippingAddress.addressLine1 || order.shippingAddress.street || "",
        addressLine2: order.shippingAddress.addressLine2 || "",
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        pincode: order.shippingAddress.pincode,
        country: order.shippingAddress.country || "India",
      },
      email: order.guestEmail || order.customerEmail || "customer@store4riders.com",
      items: scopedItems.map((i: any) => ({
        name: i.name,
        sku: i.sku,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      ...dims,
      warehouseId: targetWarehouse ? String(targetWarehouse._id) : undefined,
      autoAssignAwb: true,
    };

    const result = await providerInstance.createReverseShipment(input);
    const resolvedTrackingUrl = this.resolveProviderTrackingUrl(provider, result.awb);
    const providerDisplayName =
      provider === "shiprocket"
        ? "Shiprocket Reverse"
        : provider === "delhivery"
        ? "Delhivery Reverse"
        : "Xpressbees Reverse";

    const shipment = new ShipmentModel({
      orderId: String(order._id),
      warehouseId: targetWarehouse ? String(targetWarehouse._id) : undefined,
      provider,
      shipmentType: "reverse",
      status: result.awb ? "AWB_ASSIGNED" : "SHIPMENT_CREATED",
      providerOrderId: result.providerOrderId || reverseOrderRef,
      providerShipmentId: result.shipmentId,
      shipmentId: result.shipmentId,
      awb: result.awb,
      courierName: result.courierName || providerDisplayName,
      trackingUrl: resolvedTrackingUrl,
      pickupStatus: "SCHEDULED",
      providerStatus: result.message || `Reverse pickup created in ${provider.toUpperCase()}`,
      totalWeight: dims.weight,
      idempotencyKey: `exchange_rev_${provider}_${order._id}_${Date.now()}`,
    });
    await shipment.save();

    return {
      shipment,
      awb: result.awb,
      courierName: shipment.courierName,
      trackingUrl: resolvedTrackingUrl,
      message: result.message || `Reverse pickup pushed via ${provider.toUpperCase()}`,
    };
  }

  /**
   * Creates the Forward Replacement Dispatch Shipment after QC passes & shipping fee is settled/COD-marked.
   */
  static async createExchangeReplacementShipment(params: {
    orderId: string;
    provider: "shiprocket" | "delhivery" | "xpressbees" | "manual";
    warehouseId?: string;
    courierName?: string;
    awb?: string;
    trackingUrl?: string;
    replacementVariant?: string;
    exchangeItems?: any[];
    isCodFee?: boolean;
    codFeeAmount?: number;
    weightKg?: number;
    length?: number;
    breadth?: number;
    height?: number;
    autoAssignAwb?: boolean;
  }): Promise<any> {
    const {
      orderId,
      provider,
      warehouseId,
      courierName,
      awb,
      trackingUrl,
      replacementVariant,
      exchangeItems,
      isCodFee = false,
      codFeeAmount = 0,
      autoAssignAwb = true,
    } = params;

    const order = await OrderModel.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    const effectiveCodAmount = isCodFee && codFeeAmount > 0 ? Number(codFeeAmount) : 0;

    if (provider === "manual") {
      if (!courierName?.trim() || !awb?.trim()) {
        throw new ValidationError("Replacement courier name and AWB number are required for manual dispatch");
      }
      const shipment = new ShipmentModel({
        orderId: String(order._id),
        warehouseId: warehouseId || order.warehouseId,
        provider: "manual",
        shipmentType: "forward",
        status: "AWB_ASSIGNED",
        awb: awb.trim(),
        courierName: courierName.trim(),
        trackingUrl: trackingUrl?.trim() || undefined,
        providerStatus: `Exchange Replacement dispatched via ${courierName.trim()}`,
        codFee: effectiveCodAmount,
        customerShippingCharge: effectiveCodAmount,
        idempotencyKey: `exchange_fwd_manual_${order._id}_${Date.now()}`,
      });
      await shipment.save();

      return {
        shipment,
        awb: shipment.awb,
        courierName: shipment.courierName,
        trackingUrl: shipment.trackingUrl,
        message: `Replacement dispatched via ${shipment.courierName} (AWB: ${shipment.awb})`,
      };
    }

    let targetWarehouse: any = null;
    if (warehouseId) {
      targetWarehouse = await WarehouseRepository.findById(warehouseId);
    } else if (order.warehouseId) {
      targetWarehouse = await WarehouseRepository.findById(order.warehouseId);
    }
    if (!targetWarehouse) {
      targetWarehouse = await WarehouseRepository.findDefault();
    }

    if ((provider === "delhivery" || provider === "xpressbees") && !targetWarehouse) {
      throw new AppError("Please select a dispatch warehouse for direct carrier replacement dispatch", 400);
    }

    const scopedItems = this.resolveScopedExchangeItems(order, exchangeItems);
    const dims = await this.resolveOrderPackageDimensions({ ...order, items: scopedItems }, params);
    const replacementOrderRef = `${order.orderNumber}-EX-${Date.now().toString().slice(-4)}`;

    // When collecting ONLY the 2-way exchange shipping fee as COD (e.g. Rs. 299),
    // lock courier manifest COD + sub_total strictly to effectiveCodAmount so the
    // rider does not accidentally charge the original item price again at doorstep.
    const primaryExItem = scopedItems[0];
    const shipmentItems = effectiveCodAmount > 0
      ? [
          {
            name: `${primaryExItem?.name || "Exchange Gear"} (${replacementVariant || "Replacement"}) - Exchange Fee COD`,
            sku: `${primaryExItem?.sku || "EXCHANGE"}-EX`,
            quantity: 1,
            unitPrice: effectiveCodAmount,
          },
        ]
      : scopedItems.map((i: any) => ({
          name: replacementVariant ? `${i.name} [${replacementVariant}]` : i.name,
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        }));

    const scopedTotal = scopedItems.reduce(
      (sum: number, i: any) => sum + Math.max(1, Number(i.unitPrice) || 0) * (i.quantity || 1),
      0
    );
    const shipmentTotalAmount = effectiveCodAmount > 0
      ? effectiveCodAmount
      : Math.max(1, scopedTotal || order.pricing?.total || 1);

    const input: CreateShipmentInput = {
      warehouseId: targetWarehouse ? String(targetWarehouse._id) : undefined,
      orderId: String(order._id),
      orderNumber: replacementOrderRef,
      paymentMethod: effectiveCodAmount > 0 ? "cod" : "prepaid",
      totalAmount: shipmentTotalAmount,
      shippingAddress: {
        fullName: order.shippingAddress.fullName,
        phone: order.shippingAddress.phone,
        addressLine1: order.shippingAddress.addressLine1 || order.shippingAddress.street || "",
        addressLine2: order.shippingAddress.addressLine2 || "",
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        pincode: order.shippingAddress.pincode,
        country: order.shippingAddress.country || "India",
      },
      email: order.guestEmail || order.customerEmail || "customer@store4riders.com",
      items: shipmentItems,
      ...dims,
      autoAssignAwb: Boolean(autoAssignAwb),
    };

    const providerInstance = ShippingProviderFactory.create(provider);
    const result = await providerInstance.createShipment(input);

    const defaultTrackingUrl = this.resolveProviderTrackingUrl(provider, result.awb);

    const shipment = new ShipmentModel({
      orderId: String(order._id),
      warehouseId: targetWarehouse ? String(targetWarehouse._id) : undefined,
      provider,
      shipmentType: "forward",
      status: result.awb ? "AWB_ASSIGNED" : "SHIPMENT_CREATED",
      providerOrderId: result.providerOrderId || replacementOrderRef,
      providerShipmentId: result.shipmentId,
      shipmentId: result.shipmentId,
      awb: result.awb,
      courierName: result.courierName || provider,
      labelUrl: result.labelUrl,
      trackingUrl: defaultTrackingUrl,
      providerStatus: `Replacement dispatched via ${provider.toUpperCase()}`,
      totalWeight: dims.weight,
      customerShippingCharge: effectiveCodAmount,
      codFee: effectiveCodAmount,
      idempotencyKey: `exchange_fwd_${provider}_${order._id}_${Date.now()}`,
    });
    await shipment.save();

    return {
      shipment,
      awb: result.awb,
      courierName: shipment.courierName,
      trackingUrl: defaultTrackingUrl,
      message: result.message || `Replacement pushed via ${provider.toUpperCase()}`,
    };
  }

  /**
   * Fetch shipments for a customer order (strictly enforcing order ownership or staff role)
   */
  static async getShipmentsByOrderId(orderId: string, requesterUserId?: string) {
    if (requesterUserId) {
      const isObjectId = mongoose.Types.ObjectId.isValid(orderId);
      const order: any = await OrderModel.findOne(
        isObjectId ? { $or: [{ _id: orderId }, { orderNumber: orderId }] } : { orderNumber: orderId }
      )
        .select("_id orderNumber userId")
        .lean()
        .exec();

      if (!order) {
        const { UserService } = await import("../user/user.service");
        const role = await UserService.getRole(requesterUserId);
        if (role === "customer") {
          throw new NotFoundError("Order");
        }
        return ShipmentRepository.findByOrderId(orderId);
      }

      const isOwner = Boolean(order.userId && String(order.userId) === String(requesterUserId));
      if (!isOwner) {
        const { UserService } = await import("../user/user.service");
        const role = await UserService.getRole(requesterUserId);
        if (role === "customer") {
          const { ForbiddenError } = await import("../../core/errors/AppError");
          throw new ForbiddenError("You do not have permission to view shipments for this order");
        }
      }
    }

    return ShipmentRepository.findByOrderId(orderId);
  }

  /**
   * Paginated shipments list for Admin Dashboard
   */
  static async getPaginatedShipments(query: any, page: number, limit: number) {
    return ShipmentRepository.findPaginated(query, page, limit);
  }

  /**
   * Single shipment by ID
   */
  static async getShipmentById(id: string) {
    const shipment = await ShipmentRepository.findById(id);
    if (!shipment) {
      throw new NotFoundError("Shipment");
    }
    return shipment;
  }

  /**
   * Live tracking sync from Courier Provider
   */
  static async syncTracking(shipmentId: string): Promise<any> {
    const shipment = await ShipmentModel.findById(shipmentId);
    if (!shipment) {
      throw new NotFoundError("Shipment");
    }

    if (!shipment.awb) {
      if (shipment.provider === "shiprocket" && (shipment.providerOrderId || shipment.providerShipmentId || shipment.shipmentId)) {
        const orderIdToQuery = shipment.providerOrderId || shipment.providerShipmentId || shipment.shipmentId;
        const { ShiprocketProvider } = await import("../../core/shipping/ShiprocketProvider");
        const srProvider = new ShiprocketProvider();
        try {
          const orderDetails = await srProvider.getOrderDetails(orderIdToQuery!);
          const firstShipment = orderDetails?.shipments?.[0];
          const foundAwb = firstShipment?.awb || orderDetails?.awb_code;
          const foundCourier = firstShipment?.courier || orderDetails?.courier_name;

          if (foundAwb) {
            shipment.awb = foundAwb;
            shipment.courierName = foundCourier || "Shiprocket";
            shipment.status = "AWB_ASSIGNED";
            shipment.providerStatus = "AWB Assigned in Shiprocket Dashboard";
            shipment.trackingUrl = `https://shiprocket.co/tracking/${foundAwb}`;
            await shipment.save();

            const order = await OrderModel.findById(shipment.orderId);
            if (order) {
              const isReverse = shipment.shipmentType === "reverse";
              const isExchangeFwd = Boolean(shipment.idempotencyKey?.startsWith("exchange_fwd_"));
              if (isReverse) {
                order.set("exchangeDetails.reverseAwb", foundAwb);
                order.set("exchangeDetails.reverseCourier", shipment.courierName);
                order.set("exchangeDetails.reverseTrackingUrl", shipment.trackingUrl);
              } else if (isExchangeFwd) {
                order.set("exchangeDetails.replacementAwb", foundAwb);
                order.set("exchangeDetails.replacementCourier", shipment.courierName);
                order.set("exchangeDetails.replacementTrackingUrl", shipment.trackingUrl);
              } else {
                order.status = "packed";
              }
              if (!order.notes) order.notes = [];
              order.notes.push({
                text: `AWB ${foundAwb} synced from Shiprocket (${shipment.courierName})`,
                author: "admin",
                timestamp: new Date(),
              });
              await order.save();
            }
          } else {
            return {
              ...shipment.toObject(),
              message: "Order is in Shiprocket Dashboard, but AWB has not been assigned yet. Please assign courier inside Shiprocket.",
            };
          }
        } catch (srErr: any) {
          logger.warn(`Failed to check Shiprocket order status: ${srErr.message}`);
          throw new AppError("No AWB assigned yet. Please assign a courier in Shiprocket first.", 400);
        }
      } else {
        throw new AppError("No AWB assigned to this shipment yet", 400);
      }
    }

    let activeProvider = shipment.provider;
    if (activeProvider === "manual") {
      const cName = (shipment.courierName || "").toLowerCase();
      if (cName.includes("shiprocket")) {
        activeProvider = "shiprocket";
      } else if (cName.includes("delhivery")) {
        activeProvider = "delhivery";
      } else if (cName.includes("xpressbees")) {
        activeProvider = "xpressbees";
      } else {
        return shipment;
      }
    }

    if (!shipment.trackingUrl && shipment.awb) {
      if (activeProvider === "shiprocket") {
        shipment.trackingUrl = `https://shiprocket.co/tracking/${shipment.awb}`;
      } else if (activeProvider === "delhivery") {
        shipment.trackingUrl = `https://www.delhivery.com/track/package/${shipment.awb}`;
      } else if (activeProvider === "xpressbees") {
        shipment.trackingUrl = `https://www.xpressbees.com/track?awb=${shipment.awb}`;
      }
    }

    const providerInstance = ShippingProviderFactory.create(activeProvider);
    const trackingInfo = await providerInstance.getTrackingInfo(shipment.awb);

    if (trackingInfo.success) {
      shipment.providerStatus = trackingInfo.currentStatus;

      const normalized = trackingInfo.currentStatus.toLowerCase();
      const isReverse = shipment.shipmentType === "reverse";
      let linkedOrder: any = null;
      if (isReverse || !shipment.idempotencyKey) {
        const orderQuery: any = OrderModel.findById(shipment.orderId);
        linkedOrder =
          orderQuery && typeof orderQuery.lean === "function"
            ? await orderQuery.lean().exec()
            : await orderQuery;
      }
      const isExchangeFwd = Boolean(
        shipment.idempotencyKey?.startsWith("exchange_fwd_") ||
        (linkedOrder?.exchangeDetails?.replacementShipmentId &&
          String(linkedOrder.exchangeDetails.replacementShipmentId) === String(shipment._id))
      );

      if (normalized.includes("delivered")) {
        shipment.status = "DELIVERED";
        if (isReverse) {
          await OrderModel.findByIdAndUpdate(shipment.orderId, {
            $set: {
              ...(linkedOrder?.status === "returned" ? {} : { status: "return_picked" }),
              "exchangeDetails.reverseStatus": "delivered_to_hub",
              ...(linkedOrder?.exchangeDetails?.stage === "approved"
                ? { "exchangeDetails.stage": "picked_up", "exchangeDetails.pickedUpAt": new Date() }
                : {}),
            },
          });
        } else if (isExchangeFwd) {
          await OrderModel.findByIdAndUpdate(shipment.orderId, {
            $set: {
              status: "returned",
              "exchangeDetails.stage": "completed",
              "exchangeDetails.replacementCompletedAt": new Date(),
            },
          });
        } else {
          await OrderModel.findByIdAndUpdate(shipment.orderId, { status: "delivered", deliveredAt: new Date(), $unset: { invoiceUrl: 1 } });
        }
      } else if (normalized.includes("out for delivery")) {
        shipment.status = "OUT_FOR_DELIVERY";
      } else if (normalized.includes("transit") || normalized.includes("shipped") || normalized.includes("picked")) {
        shipment.status = "IN_TRANSIT";
        if (isReverse) {
          await OrderModel.findByIdAndUpdate(shipment.orderId, {
            $set: {
              ...(linkedOrder?.status === "returned" ? {} : { status: "return_picked" }),
              "exchangeDetails.reverseStatus": "in_transit",
              ...(linkedOrder?.exchangeDetails?.stage === "approved"
                ? { "exchangeDetails.stage": "picked_up", "exchangeDetails.pickedUpAt": new Date() }
                : {}),
            },
          });
        }
      }

      await shipment.save();

      if (trackingInfo.events && trackingInfo.events.length > 0) {
        try {
          const { ShippingTrackingEventModel } = await import("./models/shipping-tracking-event.model");
          for (const ev of trackingInfo.events) {
            const evTimestamp = ev.timestamp ? new Date(ev.timestamp) : new Date();
            await ShippingTrackingEventModel.updateOne(
              {
                shipmentId: String(shipment._id),
                internalState: shipment.status,
                eventTimestamp: evTimestamp,
              },
              {
                $setOnInsert: {
                  shipmentId: String(shipment._id),
                  awb: shipment.awb,
                  provider: shipment.provider,
                  internalState: shipment.status,
                  providerState: ev.providerStatus || ev.status || trackingInfo.currentStatus,
                  location: ev.location,
                  message: ev.activity || ev.description,
                  eventTimestamp: evTimestamp,
                },
              },
              { upsert: true }
            );
          }
        } catch {
          // Gracefully continue
        }
      }
    }

    return shipment;
  }

  /**
   * Request Courier Pickup
   */
  static async requestPickup(shipmentId: string): Promise<any> {
    const shipment = await ShipmentModel.findById(shipmentId);
    if (!shipment) {
      throw new NotFoundError("Shipment");
    }

    if (shipment.provider === "manual") {
      shipment.pickupStatus = "PICKED";
      await shipment.save();
      return { success: true, message: "Manual pickup recorded" };
    }

    const providerInstance = ShippingProviderFactory.create(shipment.provider);
    const result = await providerInstance.requestPickup(shipment.providerShipmentId || shipment.awb || "");

    if (result.success) {
      shipment.pickupStatus = "SCHEDULED";
      await shipment.save();
    }

    return result;
  }

  /**
   * Check Pincode Serviceability with Redis Caching
   */
  static async checkServiceability(deliveryPincode: string, weightKg: number = 0.5, isCod: boolean = false) {
    const cleanPincode = (deliveryPincode || "").trim();
    const isValidIndianPincode = /^[1-9][0-9]{5}$/.test(cleanPincode);

    // If pincode is not 6 digits, it cannot be serviced
    if (!isValidIndianPincode) {
      return {
        serviceable: false,
        codAvailable: false,
        message: "Please enter a valid 6-digit Indian PIN code",
      };
    }

    const isPlaceholder = (val?: string) =>
      !val ||
      val.includes("example.com") ||
      val.includes("your_") ||
      val.includes("placeholder") ||
      val.trim() === "";

    const hasConfiguredCredentials = Boolean(
      (!isPlaceholder(ENV.SHIPROCKET_EMAIL) && !isPlaceholder(ENV.SHIPROCKET_PASSWORD)) ||
      !isPlaceholder(ENV.DELHIVERY_API_KEY) ||
      !isPlaceholder(ENV.XPRESSBEES_API_KEY)
    );

    // 1. If carrier API credentials are not yet configured (e.g. dev/sandbox testing or flat rate delivery),
    // verify against our master database of 19,586 authentic Indian Post Office PIN codes!
    if (!hasConfiguredCredentials) {
      const pincodeDoc = await PincodeService.findByPincodeOrNull(cleanPincode);
      if (!pincodeDoc) {
        return {
          serviceable: false,
          codAvailable: false,
          message: `PIN code ${cleanPincode} is not a valid Indian postal location`,
        };
      }
      return {
        serviceable: true,
        codAvailable: true,
        provider: "standard",
        district: pincodeDoc.district,
        state: pincodeDoc.state,
      };
    }

    const cacheKey = `shipping:serviceability:${cleanPincode}:${weightKg}:${isCod}`;
    const cached = await getCache(cacheKey);
    if (cached && (cached as any).serviceable) {
      return cached;
    }

    const providers = ShippingProviderFactory.getAllProviders();
    let serviceable = false;
    let codAvailable = false;
    let fastestDays = 999;
    let selectedProvider = "standard";
    let hasLiveSuccessfulResponse = false;

    for (const provider of providers) {
      if (provider.checkServiceability) {
        try {
          const res = await provider.checkServiceability(cleanPincode, weightKg, isCod);
          hasLiveSuccessfulResponse = true;
          if (res.serviceable) {
            serviceable = true;
            if (res.codAvailable) codAvailable = true;
            if (res.estimatedDays && res.estimatedDays < fastestDays) {
              fastestDays = res.estimatedDays;
              selectedProvider = res.provider;
            }
          }
        } catch (err: any) {
          logger.warn(`Serviceability check failed for a provider: ${err.message}`);
        }
      }
    }

    // 2. If live provider APIs were unreachable or failed authentication (e.g. timeout, downtime),
    // check against our verified master database of 19,586 Indian Post Office PIN codes!
    // If it's a real postal location, allow standard/Speed Post delivery so checkout is not blocked.
    // If it's a fake/non-existent PIN code, reject it.
    if (!hasLiveSuccessfulResponse) {
      const pincodeDoc = await PincodeService.findByPincodeOrNull(cleanPincode);
      if (pincodeDoc) {
        return {
          serviceable: true,
          codAvailable: true,
          provider: "standard",
          district: pincodeDoc.district,
          state: pincodeDoc.state,
        };
      }
      return {
        serviceable: false,
        codAvailable: false,
        message: `PIN code ${cleanPincode} is not a valid Indian postal location`,
      };
    }

    const result = {
      serviceable,
      codAvailable,
      estimatedDays: fastestDays === 999 ? undefined : fastestDays,
      provider: selectedProvider,
    };

    // Cache successful serviceability for 24 hours
    if (serviceable) {
      await setCache(cacheKey, result, 86400);
    }
    return result;
  }

  /**
   * Handle Webhook from Shiprocket / Delhivery / Xpressbees
   * Automatically syncs:
   * 1. AWB & Live Tracking Status
   * 2. Pickup Warehouse chosen in Courier Dashboard (Shiprocket / Delhivery / Xpressbees)
   * 3. Order Origin State for Intra-State vs Inter-State GST Tax Invoices
   */
  static async handleWebhook(provider: string, payload: any, headers: Record<string, string>): Promise<void> {
    const providerInstance = ShippingProviderFactory.create(provider);
    const isValid = providerInstance.verifyWebhookSignature(payload, headers);
    if (!isValid) {
      throw new AppError("Invalid webhook signature", 401);
    }

    logger.info(`[ShipmentService] Processing webhook for provider: ${provider}`);

    // Universal normalization across courier payloads
    let orderRef: string | undefined;
    let awb: string | undefined;
    let courierName: string | undefined;
    let currentStatusRaw: string = "";
    let pickupLocationName: string | undefined;
    let pickupLocationId: string | undefined;
    let pickupPincode: string | undefined;
    let pickupState: string | undefined;
    let pickupCity: string | undefined;

    if (provider === "shiprocket") {
      orderRef = payload.channel_order_id || payload.order_id;
      awb = payload.awb || payload.awb_code;
      courierName = payload.courier_name;
      currentStatusRaw = (payload.current_status || payload.shipment_status || "").toLowerCase();
      pickupLocationName = (payload.pickup_location || payload.pickup_location_name || payload.origin || "").trim();
      pickupLocationId = payload.pickup_location_id ? String(payload.pickup_location_id) : undefined;
      pickupPincode = payload.pickup_pincode || payload.origin_pincode;
      pickupState = payload.pickup_state || payload.origin_state;
      pickupCity = payload.pickup_city || payload.origin_city;
    } else if (provider === "delhivery") {
      orderRef = payload.ref_num || payload.order_id || payload.client;
      awb = payload.waybill || payload.awb;
      courierName = "Delhivery";
      currentStatusRaw = (payload.status || payload.current_status || "").toLowerCase();
      pickupLocationName = (payload.pickup_location || payload.origin || "").trim();
      pickupPincode = payload.origin_pincode || payload.pickup_pincode;
      pickupState = payload.origin_state || payload.pickup_state;
      pickupCity = payload.origin_city || payload.pickup_city;
    } else if (provider === "xpressbees") {
      orderRef = payload.order_number || payload.order_id;
      awb = payload.awb || payload.tracking_id;
      courierName = "Xpressbees";
      currentStatusRaw = (payload.status || payload.current_status || "").toLowerCase();
      pickupLocationName = (payload.pickup_location || payload.origin || "").trim();
      pickupLocationId = payload.warehouse_id || payload.pickup_location_id;
      pickupPincode = payload.origin_pincode || payload.pickup_pincode;
      pickupState = payload.origin_state || payload.pickup_state;
      pickupCity = payload.origin_city;
    }

    // Resolve Order in DB (strip optional -REV-xxxx or -EX-xxxx suffix for exchange shipments)
    let order: any = null;
    if (orderRef) {
      const baseOrderRef = String(orderRef).replace(/-(REV|EX)(-\d+)?$/i, "");
      order = await OrderModel.findOne({
        $or: [
          { orderNumber: orderRef },
          { orderNumber: baseOrderRef },
          ...(mongoose.Types.ObjectId.isValid(orderRef) ? [{ _id: orderRef }] : []),
        ],
      });
    }

    // Resolve Shipment in DB
    let shipment: any = null;
    const shipmentQuery: any[] = [];
    if (awb) shipmentQuery.push({ awb });
    if (orderRef) shipmentQuery.push({ providerOrderId: orderRef });
    if (order && shipmentQuery.length === 0) shipmentQuery.push({ orderId: String(order._id) });
    if (orderRef && shipmentQuery.length === 0) shipmentQuery.push({ orderId: orderRef });

    if (shipmentQuery.length > 0) {
      shipment = await ShipmentModel.findOne({ $or: shipmentQuery }, undefined, {
        sort: { createdAt: -1 },
      });
    }

    if (!order && shipment?.orderId) {
      order = await OrderModel.findById(shipment.orderId);
    }

    // Match or Register Warehouse selected in Courier Dashboard
    let matchedWarehouse: any = null;
    if (pickupLocationName || pickupLocationId || pickupPincode) {
      const whQueries: any[] = [];
      if (provider === "shiprocket" && pickupLocationName) {
        whQueries.push({ shiprocketLocationId: pickupLocationName });
      }
      if (provider === "delhivery" && pickupLocationName) {
        whQueries.push({ delhiveryWarehouseName: pickupLocationName });
      }
      if (provider === "xpressbees" && pickupLocationId) {
        whQueries.push({ xpressbeesWarehouseId: pickupLocationId });
      }
      if (pickupLocationName) {
        whQueries.push({ name: new RegExp(`^${pickupLocationName}$`, "i") });
        whQueries.push({ warehouseCode: new RegExp(`^${pickupLocationName}$`, "i") });
      }
      if (pickupPincode) {
        whQueries.push({ pincode: String(pickupPincode).trim() });
      }

      if (whQueries.length > 0) {
        matchedWarehouse = await WarehouseModel.findOne({ $or: whQueries }).lean();
      }

      // Auto-register warehouse if new pickup location & state arrived from courier
      if (!matchedWarehouse && pickupLocationName && pickupState) {
        try {
          matchedWarehouse = await WarehouseModel.create({
            name: pickupLocationName,
            warehouseCode: pickupLocationName.toUpperCase().replace(/[^A-Z0-9]/g, "_").slice(0, 15) || "WH_" + Date.now(),
            contactPerson: "Courier Dispatch Hub",
            phone: "0000000000",
            email: "logistics@store4riders.com",
            addressLine1: pickupLocationName,
            city: pickupCity || pickupState,
            state: pickupState,
            pincode: pickupPincode ? String(pickupPincode).trim() : "411001",
            shiprocketLocationId: provider === "shiprocket" ? pickupLocationName : undefined,
            delhiveryWarehouseName: provider === "delhivery" ? pickupLocationName : undefined,
            xpressbeesWarehouseId: provider === "xpressbees" ? pickupLocationId : undefined,
            isDefault: false,
            isActive: true,
          });
          logger.info(`[ShipmentService] Auto-registered warehouse '${pickupLocationName}' in '${pickupState}' from ${provider} webhook`);
        } catch (err: any) {
          logger.warn(`[ShipmentService] Could not auto-create warehouse: ${err.message}`);
        }
      }
    }

    if (shipment) {
      if (awb && !shipment.awb) shipment.awb = awb;
      if (courierName) shipment.courierName = courierName;
      shipment.providerStatus = payload.current_status || payload.status || shipment.providerStatus;

      if (matchedWarehouse) {
        shipment.warehouseId = String(matchedWarehouse._id);
      }

      const isReverseShipment = shipment.shipmentType === "reverse";
      const isExchangeForwardShipment = Boolean(
        shipment.idempotencyKey?.startsWith("exchange_fwd_") ||
        (order?.exchangeDetails?.replacementShipmentId &&
          String(order.exchangeDetails.replacementShipmentId) === String(shipment._id))
      );

      if (isReverseShipment) {
        if (currentStatusRaw.includes("delivered")) {
          shipment.status = "DELIVERED";
          shipment.pickupStatus = "PICKED";
          if (order?.exchangeDetails) {
            await OrderModel.findByIdAndUpdate(order._id, {
              $set: {
                status: "return_picked",
                "exchangeDetails.reverseStatus": "delivered_to_hub",
                ...(order.exchangeDetails.stage === "approved" ? { "exchangeDetails.stage": "picked_up" } : {}),
              },
            });
          }
        } else if (currentStatusRaw.includes("picked") || currentStatusRaw.includes("transit") || currentStatusRaw.includes("shipped")) {
          shipment.status = "IN_TRANSIT";
          shipment.pickupStatus = "PICKED";
          if (order?.exchangeDetails) {
            await OrderModel.findByIdAndUpdate(order._id, {
              $set: {
                status: "return_picked",
                "exchangeDetails.reverseStatus": "in_transit",
                ...(order.exchangeDetails.stage === "approved"
                  ? { "exchangeDetails.stage": "picked_up", "exchangeDetails.pickedUpAt": new Date() }
                  : {}),
              },
            });
          }
        }
      } else if (isExchangeForwardShipment) {
        if (currentStatusRaw.includes("delivered")) {
          shipment.status = "DELIVERED";
          if (order?.exchangeDetails) {
            await OrderModel.findByIdAndUpdate(order._id, {
              $set: {
                status: "returned",
                "exchangeDetails.stage": "completed",
                "exchangeDetails.replacementCompletedAt": new Date(),
              },
            });
          }
        } else if (currentStatusRaw.includes("out for delivery")) {
          shipment.status = "OUT_FOR_DELIVERY";
        } else if (currentStatusRaw.includes("transit") || currentStatusRaw.includes("shipped")) {
          shipment.status = "IN_TRANSIT";
        } else if (currentStatusRaw.includes("rto")) {
          shipment.status = "RTO_INITIATED";
        }
      } else {
        if (currentStatusRaw.includes("delivered")) {
          shipment.status = "DELIVERED";
          if (order) await OrderModel.findByIdAndUpdate(order._id, { status: "delivered", deliveredAt: new Date(), $unset: { invoiceUrl: 1 } });
        } else if (currentStatusRaw.includes("out for delivery")) {
          shipment.status = "OUT_FOR_DELIVERY";
        } else if (currentStatusRaw.includes("transit") || currentStatusRaw.includes("shipped")) {
          shipment.status = "IN_TRANSIT";
          if (order && order.status !== "shipped" && order.status !== "delivered") {
            await OrderModel.findByIdAndUpdate(order._id, { status: "shipped" });
          }
        } else if (currentStatusRaw.includes("rto")) {
          shipment.status = "RTO_INITIATED";
        }
      }

      await shipment.save();
      logger.info(`[ShipmentService] Updated shipment status from ${provider} webhook to ${shipment.status}`);

      try {
        const { adminEventHub } = await import("../../core/events/adminEventHub");
        adminEventHub.publish("SHIPMENT_UPDATED", {
          shipmentId: String(shipment._id),
          orderId: String(shipment.orderId),
          orderNumber: order?.orderNumber,
          awb: shipment.awb,
          courierName: shipment.courierName,
          status: shipment.status,
        });
      } catch {}
    }

    // Sync Order warehouse and invalidate cached invoice URL (skip overriding main order warehouse on reverse pickup webhooks)
    if (order && matchedWarehouse && shipment?.shipmentType !== "reverse") {
      order.warehouseId = String(matchedWarehouse._id);
      order.invoiceUrl = undefined; // Invalidate cached invoice URL so PDF regenerates with live warehouse origin state
      if (!order.notes) order.notes = [];
      order.notes.push({
        text: `Dispatch warehouse synced from ${provider.toUpperCase()} Dashboard: ${matchedWarehouse.name} (${matchedWarehouse.state} - ${matchedWarehouse.pincode})`,
        author: "system",
        timestamp: new Date(),
      });
      await order.save();
      logger.info(`[ShipmentService] Order ${order.orderNumber} warehouse updated to ${matchedWarehouse.name} (${matchedWarehouse.state})`);
    }
  }
}
