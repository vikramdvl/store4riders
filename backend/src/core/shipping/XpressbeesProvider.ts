import { shippingGet, shippingPost } from "./shippingApiClient";
import { 
  ShippingProvider, 
  CreateShipmentInput, 
  CreateShipmentResult, 
  ShippingRate, 
  TrackingInfoResult,
  GetRatesInput,
  PickupResult
} from "./ShippingProvider";
import { AppError } from "../errors/AppError";
import { logger } from "../utils/logger";
import { ENV } from "../config/env";
import { WarehouseRepository } from "../../modules/warehouse/warehouse.repository";

export class XpressbeesProvider implements ShippingProvider {
  
  private baseUrl = "https://ship.xpressbees.com/api"; // Sample base URL

  private getHeaders() {
    const token = ENV.XPRESSBEES_API_KEY;
    if (!token) {
      throw new AppError("Xpressbees API credentials not configured. Please add XPRESSBEES_API_KEY in backend/.env or select Shiprocket.", 400);
    }
    return {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const headers = this.getHeaders();
    const warehouse = input.warehouseId
      ? await WarehouseRepository.findById(input.warehouseId)
      : await WarehouseRepository.findDefault();
    if (!warehouse || !warehouse.pincode) {
      throw new AppError("Warehouse origin pincode not configured", 400);
    }
    const originPincode = warehouse.pincode;
    
    const payload = {
      order_number: input.orderNumber,
      payment_type: input.paymentMethod === "cod" ? "COD" : "Prepaid",
      consignee: {
        name: input.shippingAddress.fullName,
        address: input.shippingAddress.addressLine1,
        city: input.shippingAddress.city,
        state: input.shippingAddress.state,
        pincode: input.shippingAddress.pincode,
        phone: input.shippingAddress.phone,
      },
      pickup: {
        pincode: originPincode,
      },
      order_items: input.items.map((item) => ({
        name: item.name,
        sku: item.sku || "SKU-DEFAULT",
        units: item.quantity,
        selling_price: item.unitPrice,
      })),
      shipment: {
        length: input.length,
        breadth: input.breadth,
        height: input.height,
        weight: input.weight * 1000,
        amount: input.totalAmount,
      }
    };

    try {
      const response = await shippingPost(`${this.baseUrl}/shipments`, payload, { headers });
      const data = response.data.data;
      
      if (!response.data.status) {
        throw new AppError(response.data.message || "Failed to create Xpressbees shipment", 400);
      }

      return {
        success: true,
        shipmentId: data.shipment_id,
        awb: data.awb_number,
        courierName: "Xpressbees Express",
        message: "Shipment created successfully in Xpressbees"
      };
    } catch (error: any) {
      logger.error(`Xpressbees Create Shipment Error: ${JSON.stringify(error.response?.data || error.message)}`);
      throw new AppError("Failed to create Xpressbees shipment", 400);
    }
  }

  /**
   * Creates a Reverse Pickup (RVP) shipment in Xpressbees (Customer Doorstep -> Store Warehouse).
   */
  async createReverseShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const headers = this.getHeaders(); // Fail fast if XPRESSBEES_API_KEY is missing
    const warehouse = input.warehouseId
      ? await WarehouseRepository.findById(input.warehouseId)
      : await WarehouseRepository.findDefault();

    if (!warehouse || !warehouse.pincode || !warehouse.city || !warehouse.state || !warehouse.addressLine1) {
      throw new AppError(
        "Warehouse shipping address is incomplete. Please configure Warehouse address, city, state, and pincode in Admin -> Warehouses.",
        400
      );
    }

    const cleanCustomerPhone = (input.shippingAddress.phone || "").replace(/\D/g, "").slice(-10);
    if (!cleanCustomerPhone || cleanCustomerPhone.length !== 10) {
      throw new AppError("Customer phone number must contain a valid 10-digit mobile number for Xpressbees reverse pickup.", 400);
    }

    const cleanCustomerPin = (input.shippingAddress.pincode || "").replace(/\D/g, "").slice(0, 6);
    if (!cleanCustomerPin || cleanCustomerPin.length !== 6) {
      throw new AppError("Customer pickup pincode must be a valid 6-digit postal code for Xpressbees reverse pickup.", 400);
    }

    const cleanWarehousePhone = (warehouse.phone || "").replace(/\D/g, "").slice(-10);
    if (!cleanWarehousePhone || cleanWarehousePhone.length !== 10) {
      throw new AppError("Warehouse phone number must contain a valid 10-digit mobile number for Xpressbees reverse pickup.", 400);
    }

    const payload = {
      order_number: input.orderNumber,
      shipment_date: new Date().toISOString().split("T")[0],
      is_return: 1,
      is_rvp: true,
      payment_type: "Prepaid",
      pickup_customer_name: input.shippingAddress.fullName,
      pickup_address: input.shippingAddress.addressLine1,
      pickup_address_2: input.shippingAddress.addressLine2 || "",
      pickup_city: input.shippingAddress.city,
      pickup_state: input.shippingAddress.state,
      pickup_pincode: cleanCustomerPin,
      pickup_phone: cleanCustomerPhone,
      pickup_email: input.email || "customer@store4riders.com",
      shipping_customer_name: warehouse.contactPerson || warehouse.name || "Store4Riders Warehouse",
      shipping_address: warehouse.addressLine1,
      shipping_address_2: warehouse.addressLine2 || "",
      shipping_city: warehouse.city,
      shipping_state: warehouse.state,
      shipping_pincode: String(warehouse.pincode).replace(/\D/g, "").slice(0, 6),
      shipping_phone: cleanWarehousePhone,
      shipping_email: warehouse.email || "support@store4riders.com",
      consignee: {
        name: warehouse.contactPerson || warehouse.name || "Store4Riders Warehouse",
        address: [warehouse.addressLine1, warehouse.addressLine2].filter(Boolean).join(", "),
        city: warehouse.city,
        state: warehouse.state,
        pincode: String(warehouse.pincode).replace(/\D/g, "").slice(0, 6),
        phone: cleanWarehousePhone,
      },
      pickup: {
        warehouse_id: warehouse.xpressbeesWarehouseId || undefined,
        name: input.shippingAddress.fullName,
        address: [input.shippingAddress.addressLine1, input.shippingAddress.addressLine2].filter(Boolean).join(", "),
        city: input.shippingAddress.city,
        state: input.shippingAddress.state,
        pincode: cleanCustomerPin,
        phone: cleanCustomerPhone,
      },
      order_items: input.items.map((item) => ({
        name: item.name,
        sku: item.sku || "SKU-DEFAULT",
        units: item.quantity,
        selling_price: Math.max(1, Number(item.unitPrice) || 1),
      })),
      shipment: {
        length: Math.max(1, Math.round(Number(input.length) || 15)),
        breadth: Math.max(1, Math.round(Number(input.breadth) || 15)),
        height: Math.max(1, Math.round(Number(input.height) || 10)),
        weight: Math.max(100, Math.round((Number(input.weight) || 0.5) * 1000)),
        amount: 0,
      },
    };

    try {
      const response = await shippingPost(`${this.baseUrl}/shipments`, payload, { headers });
      const data = response.data?.data;

      if (!response.data?.status) {
        throw new AppError(response.data?.message || "Failed to create Xpressbees reverse pickup", 400);
      }

      return {
        success: true,
        shipmentId: data?.shipment_id ? String(data.shipment_id) : data?.awb_number,
        providerOrderId: input.orderNumber,
        awb: data?.awb_number,
        courierName: "Xpressbees Reverse",
        message: data?.awb_number
          ? `Xpressbees reverse pickup scheduled (AWB: ${data.awb_number})`
          : "Reverse pickup created in Xpressbees",
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      const errDetail = error.response?.data?.message || error.message;
      logger.error(`Xpressbees Reverse Pickup Error: ${errDetail}`);
      throw new AppError(errDetail || "Failed to create Xpressbees reverse pickup", 400);
    }
  }

  async requestPickup(shipmentId: string, providerOrderId?: string): Promise<PickupResult> {
    const headers = this.getHeaders();
    try {
      // Dummy endpoint based on standard patterns; Xpressbees typically has a /pickup endpoint
      const response = await shippingPost(`${this.baseUrl}/pickup`, {
        order_id: shipmentId
      }, { headers });
      
      return {
        success: true,
        message: response.data?.message || "Pickup requested successfully"
      };
    } catch (error: any) {
      logger.error(`Xpressbees Pickup Request Error: ${error.response?.data?.message || error.message}`);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to request pickup"
      };
    }
  }

  async generateLabel(shipmentId: string): Promise<string | null> {
    const headers = this.getHeaders();
    try {
      const response = await shippingGet(`${this.baseUrl}/shipments/label/${shipmentId}`, { headers });
      return response.data.data?.label_url || null;
    } catch (error) {
      logger.error("Xpressbees Label Generation Error", error);
      return null;
    }
  }

  async getTrackingInfo(awb: string): Promise<TrackingInfoResult> {
    const headers = this.getHeaders();
    try {
      const response = await shippingGet(`${this.baseUrl}/track/${awb}`, { headers });
      
      const trackData = response.data.data;
      if (!trackData || trackData.length === 0) {
        return { success: false, currentStatus: "UNKNOWN", events: [] };
      }

      return {
        success: true,
        currentStatus: trackData[0]?.status || "UNKNOWN",
        events: trackData.map((activity: any) => ({
          status: activity.status,
          providerStatus: activity.status,
          location: activity.location,
          timestamp: activity.timestamp,
          activity: activity.remark,
          description: activity.remark,
        })),
        estimatedDelivery: trackData[0]?.expected_delivery
      };
    } catch (error: any) {
      logger.error(`Xpressbees Tracking Error: ${error.response?.data?.message || error.message}`);
      return { success: false, currentStatus: "ERROR", events: [] };
    }
  }

  async getRates(input: GetRatesInput): Promise<ShippingRate[]> {
    const headers = this.getHeaders();
    try {
      const warehouse = input.warehouseId
        ? await WarehouseRepository.findById(input.warehouseId)
        : await WarehouseRepository.findDefault();
      if (!warehouse || !warehouse.pincode) {
        throw new AppError("Warehouse origin pincode not configured", 500);
      }
      const originPincode = warehouse.pincode;
      
      const response = await shippingGet(`${this.baseUrl}/serviceability`, {
        params: {
          destination_pincode: input.deliveryPincode,
          source_pincode: originPincode,
          weight: input.weightKg * 1000,
          payment_type: input.isCod ? "COD" : "Prepaid",
          length: input.length,
          breadth: input.breadth,
          height: input.height
        },
        headers,
      });

      const data = response.data.data;
      if (!data?.serviceable) return [];
      
      if (!data.estimated_charges) {
        return []; // Strictly rely on API, no hardcoded fallbacks
      }

      return [
        {
          courierName: "Xpressbees Express",
          courierId: "xpressbees_express",
          rate: data.estimated_charges,
          estimatedDeliveryDays: data.estimated_delivery_days ? String(data.estimated_delivery_days) : "",
          isCodAvailable: Boolean(data.cod_available)
        }
      ];
    } catch (error: any) {
      logger.error(`Xpressbees Rates Error: ${error.response?.data?.message || error.message}`);
      return [];
    }
  }

  async cancelShipment(shipmentId: string, awb: string): Promise<boolean> {
    const headers = this.getHeaders();
    try {
      await shippingPost(`${this.baseUrl}/shipments/cancel`, { awb_number: awb }, { headers });
      return true;
    } catch (error: any) {
      logger.error(`Xpressbees Cancel Error: ${error.response?.data?.message || error.message}`);
      throw new AppError("Failed to cancel Xpressbees shipment", 500);
    }
  }

  async checkServiceability(deliveryPincode: string, weightKg: number, isCod: boolean): Promise<import("./ShippingProvider").ServiceabilityResult> {
    const rates = await this.getRates({ deliveryPincode, weightKg, isCod });
    if (rates.length === 0) {
      return { serviceable: false, codAvailable: false, provider: "xpressbees" };
    }
    
    return {
      serviceable: true,
      codAvailable: rates[0].isCodAvailable,
      estimatedDays: parseInt(rates[0].estimatedDeliveryDays, 10) || undefined,
      provider: "xpressbees"
    };
  }

  verifyWebhookSignature(payload: any, headers: Record<string, string>): boolean {
    if (!ENV.XPRESSBEES_WEBHOOK_TOKEN) {
      logger.warn("XPRESSBEES_WEBHOOK_TOKEN not configured. Bypassing Xpressbees webhook verification (NOT SECURE).");
      return true;
    }

    // Xpressbees can use a custom header or Bearer token for their webhooks
    const token = headers["authorization"]?.replace("Bearer ", "") || headers["x-xpressbees-token"] || headers["x-api-key"];
    
    if (!token || token !== ENV.XPRESSBEES_WEBHOOK_TOKEN) {
      logger.warn("Xpressbees webhook unauthorized (invalid or missing token)");
      return false;
    }

    return true;
  }
}
