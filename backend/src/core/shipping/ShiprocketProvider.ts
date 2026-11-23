import axios from "axios";
import { shippingGet, shippingPost } from "./shippingApiClient";
import { 
  ShippingProvider, 
  CreateShipmentInput, 
  CreateShipmentResult, 
  ShippingRate, 
  TrackingInfoResult,
  GetRatesInput,
  PickupResult,
  ShiprocketPickupLocation
} from "./ShippingProvider";
import { AppError } from "../errors/AppError";
import { ENV } from "../config/env";
import { logger } from "../utils/logger";
import { getCache, setCache } from "../cache/redis";
import { WarehouseRepository } from "../../modules/warehouse/warehouse.repository";

export class ShiprocketProvider implements ShippingProvider {
  private baseUrl = "https://apiv2.shiprocket.in/v1/external";

  private async getAuthToken(): Promise<string> {
    const cachedToken = await getCache("shiprocket:auth_token");
    if (cachedToken) {
      return cachedToken as string;
    }

    let email = process.env.SHIPROCKET_EMAIL || ENV.SHIPROCKET_EMAIL;
    let password = process.env.SHIPROCKET_PASSWORD || ENV.SHIPROCKET_PASSWORD;

    if (!email || !password) {
      try {
        const fs = require("fs");
        const path = require("path");
        const dotenv = require("dotenv");
        const envPath = path.resolve(process.cwd(), ".env");
        if (fs.existsSync(envPath)) {
          const parsed = dotenv.parse(fs.readFileSync(envPath));
          email = email || parsed.SHIPROCKET_EMAIL;
          password = password || parsed.SHIPROCKET_PASSWORD;
        }
      } catch {
        // Fallback silently if fs/path not accessible
      }
    }

    if (!email || !password) {
      throw new AppError("Shiprocket credentials are not configured in backend/.env", 400);
    }

    try {
      const response = await axios.post(`${this.baseUrl}/auth/login`, {
        email,
        password
      }, { timeout: 15000 });
      
      const token = response.data.token;
      // Shiprocket tokens are valid for 10 days. We'll cache for 9 days (9 * 24 * 60 * 60 = 777600 seconds)
      await setCache("shiprocket:auth_token", token, 777600);
      return token;
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || "Failed to authenticate with Shiprocket";
      logger.error(`Shiprocket Auth Error: ${errorMsg}`);
      throw new AppError(`Shiprocket Authentication Failed: ${errorMsg}`, 500);
    }
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const token = await this.getAuthToken();
    const warehouse = input.warehouseId 
      ? await WarehouseRepository.findById(input.warehouseId)
      : await WarehouseRepository.findDefault();

    const fallbackWarehouse = (!warehouse?.shiprocketLocationId) ? await WarehouseRepository.findDefault() : warehouse;
    const pickupLocation = fallbackWarehouse?.shiprocketLocationId?.trim();
    if (!pickupLocation) {
      throw new AppError("Selected warehouse has no Shiprocket Location Nickname. Please select a warehouse with a valid Shiprocket location or sync from Shiprocket.", 400);
    }

    const cleanPhone = (input.shippingAddress.phone || "").replace(/\D/g, "").slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      throw new AppError("Customer phone number must contain a valid 10-digit mobile number for Shiprocket courier dispatch.", 400);
    }
    if (/^(\d)\1{9}$/.test(cleanPhone) || cleanPhone === "1234567890" || cleanPhone === "0123456789") {
      throw new AppError(`Customer phone number '${cleanPhone}' is an invalid test number. Shiprocket rejects dummy numbers (like ${cleanPhone}). Please update the recipient phone to a valid 10-digit mobile number.`, 400);
    }

    const cleanPincode = (input.shippingAddress.pincode || "").replace(/\D/g, "").slice(0, 6);
    if (!cleanPincode || cleanPincode.length !== 6) {
      throw new AppError("Customer shipping pincode must be a 6-digit postal code.", 400);
    }

    const rawFullName = (input.shippingAddress.fullName || "Customer").trim();
    const nameParts = rawFullName.split(/\s+/);
    const firstName = nameParts[0] || "Customer";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

    const streetLine = input.shippingAddress.addressLine1 || (input.shippingAddress as any)?.street || "";
    const line2 = input.shippingAddress.addressLine2 || "";
    let fullBillingAddress = [streetLine, line2].filter(Boolean).join(", ").trim();
    if (fullBillingAddress.length < 10) {
      fullBillingAddress = `${fullBillingAddress}, ${input.shippingAddress.city}, ${input.shippingAddress.state} - ${cleanPincode}`;
    }
    
    try {
      const payload = {
        order_id: input.orderNumber,
        order_date: new Date().toISOString().split('T')[0],
        pickup_location: pickupLocation, // Shiprocket expects the nickname or pincode registered in their system
        billing_customer_name: firstName,
        billing_last_name: lastName,
        billing_address: fullBillingAddress,
        billing_address_2: input.shippingAddress.addressLine2 || "",
        billing_city: input.shippingAddress.city,
        billing_pincode: cleanPincode,
        billing_state: input.shippingAddress.state,
        billing_country: input.shippingAddress.country || "India",
        billing_email: input.email || "customer@store4riders.com",
        billing_phone: cleanPhone,
        shipping_is_billing: true,
        order_items: input.items.map(item => ({
          name: item.name,
          sku: item.sku || "SKU-DEFAULT",
          units: item.quantity,
          selling_price: item.unitPrice,
        })),
        payment_method: input.paymentMethod === "cod" ? "COD" : "Prepaid",
        cod_amount: input.paymentMethod === "cod" ? input.totalAmount : 0,
        sub_total: input.totalAmount,
        length: Math.max(0.5, Number(input.length) || 10),
        breadth: Math.max(0.5, Number(input.breadth) || 10),
        height: Math.max(0.5, Number(input.height) || 10),
        weight: Math.max(0.05, Number(input.weight) || 0.5)
      };

      const response = await shippingPost(`${this.baseUrl}/orders/create/adhoc`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const shipmentId = String(response.data.shipment_id);
      const providerOrderId = response.data.order_id ? String(response.data.order_id) : undefined;
      let awb = response.data.awb_code;
      let courierName = response.data.courier_name;
      let labelUrl: string | undefined;

      // Automatically assign courier partner & generate AWB via Shiprocket API only if explicitly requested
      if (input.autoAssignAwb && !awb && shipmentId) {
        try {
          const awbRes = await shippingPost(`${this.baseUrl}/courier/assign/awb`, {
            shipment_id: Number(shipmentId)
          }, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const awbData = awbRes.data?.response?.data;
          if (awbData?.awb_code) {
            awb = awbData.awb_code;
            courierName = awbData.courier_name || courierName;
          }
        } catch (awbError: any) {
          logger.warn(`Shiprocket Auto AWB Assign deferred: ${awbError.response?.data?.message || awbError.message}`);
        }
      }

      // Automatically generate shipping label PDF if AWB is assigned
      if (awb && shipmentId) {
        try {
          const labelRes = await shippingPost(`${this.baseUrl}/courier/generate/label`, {
            shipment_id: [Number(shipmentId)]
          }, {
            headers: { Authorization: `Bearer ${token}` },
          });
          labelUrl = labelRes.data?.label_url;
        } catch (labelError: any) {
          logger.warn(`Shiprocket Label Generation deferred: ${labelError.response?.data?.message || labelError.message}`);
        }
      }

      return {
        success: true,
        shipmentId,
        providerOrderId,
        awb: awb || undefined,
        courierName: courierName || (awb ? "Shiprocket" : undefined),
        labelUrl: labelUrl,
        message: awb 
          ? `AWB ${awb} generated successfully via ${courierName || "Shiprocket"}` 
          : "Order created successfully in Shiprocket Dashboard. You can select courier and place order in Shiprocket."
      };
    } catch (error: any) {
      const resData = error.response?.data;
      let errorMsg = "Failed to create Shiprocket shipment";

      if (typeof resData?.message === "string" && resData.message.trim()) {
        errorMsg = resData.message.trim();
      } else if (resData?.errors && typeof resData.errors === "object") {
        const details = Object.entries(resData.errors)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
          .join(" | ");
        errorMsg = details || "Validation error from Shiprocket";
      } else if (typeof resData?.error === "string" && resData.error.trim()) {
        errorMsg = resData.error.trim();
      } else if (error.message) {
        errorMsg = error.message;
      }
      logger.error(`Shiprocket Create Shipment Error: ${errorMsg}`);
      throw new AppError(errorMsg, 400);
    }
  }

  async requestPickup(shipmentId: string, providerOrderId?: string): Promise<PickupResult> {
    const token = await this.getAuthToken();
    try {
      const response = await shippingPost(`${this.baseUrl}/courier/generate/pickup`, {
        shipment_id: [shipmentId]
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        success: true,
        message: response.data?.message || "Pickup requested successfully"
      };
    } catch (error: any) {
      logger.error(`Shiprocket Pickup Request Error: ${error.response?.data?.message || error.message}`);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to request pickup"
      };
    }
  }

  async generateLabel(shipmentId: string): Promise<string | null> {
    const token = await this.getAuthToken();
    try {
      const response = await shippingPost(`${this.baseUrl}/courier/generate/label`, {
        shipment_id: [shipmentId]
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.label_url;
    } catch (error: any) {
      logger.error(`Shiprocket Generate Label Error: ${error.response?.data?.message || error.message}`);
      return null;
    }
  }

  async getPickupLocations(): Promise<ShiprocketPickupLocation[]> {
    const token = await this.getAuthToken();
    try {
      const response = await shippingGet(`${this.baseUrl}/settings/company/pickup`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const locations = response.data?.shipping_address || response.data?.data?.shipping_address || [];
      return locations;
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || "Failed to fetch pickup locations from Shiprocket";
      logger.error(`Shiprocket Get Pickup Locations Error: ${errorMsg}`);
      throw new AppError(`Shiprocket Error: ${errorMsg}`, 500);
    }
  }

  async getOrderDetails(orderId: string): Promise<any> {
    const token = await this.getAuthToken();
    try {
      const response = await shippingGet(`${this.baseUrl}/orders/show/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data?.data || response.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || "Failed to fetch order details from Shiprocket";
      logger.error(`Shiprocket Get Order Details Error: ${errorMsg}`);
      throw new AppError(`Shiprocket Error: ${errorMsg}`, 500);
    }
  }

  async getTrackingInfo(awb: string): Promise<TrackingInfoResult> {
    const token = await this.getAuthToken();
    try {
      const response = await shippingGet(`${this.baseUrl}/courier/track/awb/${awb}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const trackData = response.data.tracking_data;
      if (!trackData || trackData.track_status === 0) {
        return { success: false, currentStatus: "UNKNOWN", events: [] };
      }

      return {
        success: true,
        currentStatus: trackData.shipment_track_activities[0]?.sr_status_label || trackData.shipment_status,
        events: trackData.shipment_track_activities.map((activity: any) => ({
          status: activity.sr_status_label,
          providerStatus: activity.sr_status_label,
          location: activity.location,
          timestamp: activity.date,
          activity: activity.activity,
          description: activity.activity,
        })),
        estimatedDelivery: trackData.etd
      };
    } catch (error: any) {
      logger.error(`Shiprocket Tracking Error: ${error.response?.data?.message || error.message}`);
      return { success: false, currentStatus: "ERROR", events: [] };
    }
  }

  async getRates(input: GetRatesInput): Promise<ShippingRate[]> {
    try {
      const token = await this.getAuthToken();
      const warehouse = input.warehouseId 
        ? await WarehouseRepository.findById(input.warehouseId) 
        : await WarehouseRepository.findDefault();
      const originPincode = warehouse?.pincode || "411030";
      
      const response = await shippingGet(`${this.baseUrl}/courier/serviceability/`, {
        params: {
          pickup_postcode: originPincode,
          delivery_postcode: input.deliveryPincode,
          weight: input.weightKg,
          cod: input.isCod ? 1 : 0,
          length: input.length,
          breadth: input.breadth,
          height: input.height
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      const couriers = response.data.data.available_courier_companies || [];
      return couriers.map((c: any) => ({
        courierName: c.courier_name,
        courierId: String(c.courier_company_id),
        rate: c.rate,
        estimatedDeliveryDays: c.estimated_delivery_days,
        isCodAvailable: c.cod === 1
      }));
    } catch (error: any) {
      logger.error(`Shiprocket Rates Error: ${error.response?.data?.message || error.message}`);
      return [];
    }
  }

  async cancelShipment(shipmentId: string, awb: string): Promise<boolean> {
    const token = await this.getAuthToken();
    try {
      await shippingPost(`${this.baseUrl}/orders/cancel/awb`, {
        awbs: [awb]
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return true;
    } catch (error: any) {
      logger.error(`Shiprocket Cancel Error: ${error.response?.data?.message || error.message}`);
      throw new AppError("Failed to cancel Shiprocket shipment", 500);
    }
  }

  async checkServiceability(deliveryPincode: string, weightKg: number, isCod: boolean): Promise<import("./ShippingProvider").ServiceabilityResult> {
    const rates = await this.getRates({ deliveryPincode, weightKg, isCod });
    if (rates.length === 0) {
      return { serviceable: false, codAvailable: false, provider: "shiprocket" };
    }
    const fastest = [...rates].sort((a, b) => (parseInt(a.estimatedDeliveryDays, 10) || 999) - (parseInt(b.estimatedDeliveryDays, 10) || 999))[0];
    return {
      serviceable: true,
      codAvailable: rates.some(r => r.isCodAvailable),
      estimatedDays: parseInt(fastest.estimatedDeliveryDays, 10) || undefined,
      provider: "shiprocket"
    };
  }

  verifyWebhookSignature(payload: any, headers: Record<string, string>): boolean {
    if (!ENV.SHIPROCKET_WEBHOOK_SECRET) {
      logger.warn("SHIPROCKET_WEBHOOK_SECRET not configured. Bypassing webhook verification (NOT SECURE).");
      return true; // Bypass only if explicitly unconfigured
    }

    // Shiprocket sends HMAC SHA-256 signature in 'x-api-hmac-sha256' header
    // Some older docs say 'x-api-key' or 'x-shiprocket-signature', we check common ones
    const signature = headers["x-api-hmac-sha256"] || headers["x-shiprocket-signature"] || headers["x-api-key"];
    
    if (!signature) {
      logger.warn("Shiprocket webhook signature missing in headers");
      return false;
    }

    try {
      const crypto = require("crypto");
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
      
      const expectedSignature = crypto
        .createHmac("sha256", ENV.SHIPROCKET_WEBHOOK_SECRET)
        .update(payloadString)
        .digest("hex");

      if (signature === expectedSignature) {
        return true;
      }
      
      logger.warn(`Shiprocket webhook signature mismatch. Expected: ${expectedSignature}, Received: ${signature}`);
      return false;
    } catch (err) {
      logger.error(`Error verifying Shiprocket signature: ${err}`);
      return false;
    }
  }
}
