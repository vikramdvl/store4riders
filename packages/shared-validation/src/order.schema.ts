import { z } from "zod";

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const createOrderSchema = z.object({
  shippingAddressId: z.string().optional(),
  shippingAddress: z.object({
    fullName: z.string().min(1, "Full name is required"),
    phone: z
      .string()
      .min(10, "Phone number is required")
      .refine((val) => {
        const clean = val.replace(/\D/g, "").slice(-10);
        if (clean.length !== 10) return false;
        if (!/^[6-9]\d{9}$/.test(clean)) return false;
        if (/^(\d)\1{9}$/.test(clean) || clean === "1234567890" || clean === "0123456789") return false;
        return true;
      }, "Please enter a valid 10-digit Indian mobile number (dummy or repeating numbers like 7777777777 are not accepted)"),
    street: z.string().min(1, "Street is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    pincode: z.string().min(1, "Pincode is required"),
    country: z.string().min(1, "Country is required"),
    email: z.string().email().optional(),
  }).optional(),
  guestEmail: z.string().email("Invalid email format").optional(),
  paymentMethod: z.enum(["cod", "payu", "ccavenue", "snapmint", "upi"]),
  couponCode: z.string().nullable().optional(),
  phone: z
    .string()
    .nullable()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const clean = val.replace(/\D/g, "").slice(-10);
      if (clean.length !== 10) return false;
      if (!/^[6-9]\d{9}$/.test(clean)) return false;
      if (/^(\d)\1{9}$/.test(clean) || clean === "1234567890" || clean === "0123456789") return false;
      return true;
    }, "Please enter a valid 10-digit Indian mobile number"),
  fullName: z.string().nullable().optional(),
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().nullable().optional(),
    quantity: z.number().int("Quantity must be an integer").min(1, "Quantity must be at least 1").max(99, "Quantity cannot exceed 99 units"),
  })).optional(),
  idempotencyKey: z.string().nullable().optional(),
  customerGstin: z
    .string()
    .nullable()
    .optional()
    .refine(
      (val) => !val || val.trim() === "" || GSTIN_REGEX.test(val.trim().toUpperCase()),
      { message: "Invalid 15-digit GSTIN format (e.g. 27AAPCS1234F1Z5)" }
    ),
  businessName: z.string().nullable().optional(),
}).refine(data => data.shippingAddressId || data.shippingAddress, {
  message: "Either shippingAddressId or shippingAddress is required",
  path: ["shippingAddressId"]
}).refine(data => {
  if (data.customerGstin && data.customerGstin.trim() !== "") {
    return Boolean(data.businessName && data.businessName.trim() !== "");
  }
  return true;
}, {
  message: "Company / Business Name is required when providing a GSTIN",
  path: ["businessName"]
});

export const verifyPaymentSchema = z.object({
  gatewayOrderId: z.string(),
  paymentId: z.string().optional().default(""),
  signature: z.string().optional().default(""),
  paymentData: z.any().optional(),
  tezResponse: z.any().optional(),
  utr: z.string().optional(),
});

export const exchangeRequestItemSchema = z.object({
  orderItemId: z.string().max(100).optional(),
  productId: z.string().min(1).max(100),
  variantId: z.string().max(150).optional(),
  sku: z.string().max(150).optional(),
  name: z.string().max(300).optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  desiredReplacement: z.string().max(150).optional(),
});

export const adminHandleReturnSchema = z.object({
  exchangeId: z.string().max(100).optional(),
  action: z.enum(["approve", "reject"]),
  adminNote: z.string().max(1000).optional(),
  shippingFee: z.number().min(0).max(10000).optional(),
  reverseCourier: z.string().max(100).optional(),
  reverseAwb: z.string().max(100).optional(),
  reverseTrackingUrl: z.string().max(500).optional(),
  warehouseId: z.string().optional(),
  triggerCourier: z.enum(["none", "shiprocket", "delhivery", "xpressbees", "manual"]).optional(),
});

export const exchangePickupSchema = z.object({
  exchangeId: z.string().max(100).optional(),
  action: z.enum(["schedule_reverse", "mark_picked_up", "update_tracking"]),
  provider: z.enum(["shiprocket", "delhivery", "xpressbees", "manual"]).optional(),
  reverseCourier: z.string().max(100).optional(),
  reverseAwb: z.string().max(100).optional(),
  reverseTrackingUrl: z.string().max(500).optional(),
  warehouseId: z.string().optional(),
  weightKg: z.number().positive().optional(),
  length: z.number().positive().optional(),
  breadth: z.number().positive().optional(),
  height: z.number().positive().optional(),
});

export const exchangeQcSchema = z.object({
  exchangeId: z.string().max(100).optional(),
  result: z.enum(["passed", "failed"]),
  tagsIntact: z.boolean(),
  unusedCondition: z.boolean(),
  packagingIntact: z.boolean(),
  qcNotes: z.string().trim().min(2, "QC inspection notes are required").max(1000),
  shippingFee: z.number().min(0).max(10000).optional(),
  feeCollectionMode: z.enum(["online", "cod", "waived"]).optional(),
});

export const exchangeFeeStatusSchema = z.object({
  exchangeId: z.string().max(100).optional(),
  settlementMode: z.enum(["online_pending", "paid_manual", "cod_on_replacement", "waived"]),
  paymentRef: z.string().max(150).optional(),
  shippingFee: z.number().min(0).max(10000).optional(),
  note: z.string().max(500).optional(),
});

export const exchangeFeePaySchema = z.object({
  exchangeId: z.string().max(100).optional(),
  paymentMethod: z.enum(["payu", "ccavenue", "upi"]),
});

export const exchangeDispatchSchema = z.object({
  exchangeId: z.string().max(100).optional(),
  provider: z.enum(["shiprocket", "delhivery", "xpressbees", "manual"]),
  warehouseId: z.string().optional(),
  courierName: z.string().max(100).optional(),
  awb: z.string().max(100).optional(),
  trackingUrl: z.string().max(500).optional(),
  replacementVariant: z.string().max(200).optional(),
  weightKg: z.number().positive().optional(),
  length: z.number().positive().optional(),
  breadth: z.number().positive().optional(),
  height: z.number().positive().optional(),
  autoAssignAwb: z.boolean().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type AdminHandleReturnInput = z.infer<typeof adminHandleReturnSchema>;
export type ExchangePickupInput = z.infer<typeof exchangePickupSchema>;
export type ExchangeQcInput = z.infer<typeof exchangeQcSchema>;
export type ExchangeFeeStatusInput = z.infer<typeof exchangeFeeStatusSchema>;
export type ExchangeFeePayInput = z.infer<typeof exchangeFeePaySchema>;
export type ExchangeDispatchInput = z.infer<typeof exchangeDispatchSchema>;
