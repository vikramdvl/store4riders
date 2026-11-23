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

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
