import mongoose, { Schema } from "mongoose";
import { IOrder, IOrderItem, IOrderPricing, IOrderAddress, IExchangeDetails, IExchangeItem } from "@store4riders/shared-types";

const orderItemSchema = new Schema<IOrderItem>({
  productId: { type: String, required: true },
  variantId: { type: String },
  name: { type: String, required: true },
  sku: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  taxRate: { type: Number, required: true },
  taxAmount: { type: Number, required: true },
  hsnCode: { type: String },
  image: { type: String },
  slug: { type: String },
});

const pricingSchema = new Schema<IOrderPricing>(
  {
    subtotal: { type: Number, required: true },
    discount: { type: Number, required: true },
    couponCode: { type: String, required: false },
    couponDiscount: { type: Number, required: true, default: 0 },
    tax: { type: Number, required: true },
    taxRate: { type: Number, required: true },
    shipping: { type: Number, required: true },
    codHandlingFee: { type: Number, required: false, default: 0 },
    total: { type: Number, required: true },
    codAmountToCollect: { type: Number, required: false },
    codPartialPaymentAmount: { type: Number, required: false },
  },
  { _id: false }
);

const orderAddressSchema = new Schema<IOrderAddress>({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  addressLine1: { type: String, required: true },
  street: { type: String },
  addressLine2: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, required: true },
  email: { type: String },
});

const exchangeItemSchema = new Schema<IExchangeItem>(
  {
    orderItemId: { type: String },
    productId: { type: String, required: true },
    variantId: { type: String },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    unitPrice: { type: Number },
    image: { type: String },
    desiredReplacement: { type: String },
  },
  { _id: false }
);

const exchangeDetailsSchema = new Schema<IExchangeDetails>(
  {
    exchangeId: { type: String },
    items: { type: [exchangeItemSchema], required: false },
    stage: {
      type: String,
      enum: [
        "requested",
        "approved",
        "picked_up",
        "qc_passed",
        "qc_failed",
        "fee_settled",
        "replacement_dispatched",
        "completed",
        "rejected",
      ],
      required: true,
    },
    reasonType: { type: String, required: true },
    desiredReplacement: { type: String, default: "" },
    customerNote: { type: String, default: "" },
    requestedItemNames: { type: String },
    requestedAt: { type: Date },
    approvedAt: { type: Date },
    reverseCourier: { type: String },
    reverseAwb: { type: String },
    reverseTrackingUrl: { type: String },
    reverseShipmentId: { type: String },
    reverseStatus: { type: String },
    pickedUpAt: { type: Date },
    qcStatus: { type: String, enum: ["pending", "passed", "failed"], default: "pending" },
    qcChecklist: {
      type: {
        tagsIntact: { type: Boolean, default: false },
        unusedCondition: { type: Boolean, default: false },
        packagingIntact: { type: Boolean, default: false },
      },
      _id: false,
    },
    qcNotes: { type: String },
    qcInspectedAt: { type: Date },
    qcInspectedBy: { type: String },
    shippingFee: { type: Number, required: true, default: 0 },
    shippingFeeStatus: {
      type: String,
      enum: ["pending", "paid_online", "paid_manual", "cod_on_replacement", "waived"],
      default: "pending",
    },
    shippingFeeCollectionMode: {
      type: String,
      enum: ["online", "cod", "waived"],
    },
    shippingFeePaymentMethod: { type: String },
    shippingFeePaymentRef: { type: String },
    shippingFeeGatewayOrderId: { type: String },
    shippingFeePaidAt: { type: Date },
    replacementCourier: { type: String },
    replacementAwb: { type: String },
    replacementTrackingUrl: { type: String },
    replacementShipmentId: { type: String },
    replacementDispatchedAt: { type: Date },
    replacementCompletedAt: { type: Date },
    rejectionReason: { type: String },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    userId: { type: String, index: true },
    guestEmail: { type: String, index: true },
    customerEmail: { type: String, index: true },
    failureReason: { type: String },
    status: { type: String, required: true, default: "pending_payment" },
    items: [orderItemSchema],
    pricing: { type: pricingSchema, required: true },
    shippingAddress: { type: orderAddressSchema, required: true },
    paymentMethod: { type: String, required: true },
    customerGstin: { type: String },
    businessName: { type: String },
    warehouseId: { type: String },
    invoiceUrl: { type: String },
    gatewayOrderId: { type: String },
    paymentId: { type: String },
    paymentSignature: { type: String },
    idempotencyKey: { type: String, sparse: true },
    notes: [
      {
        text: { type: String, required: true },
        author: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    deliveredAt: { type: Date },
    exchangeDetails: { type: exchangeDetailsSchema, required: false },
    exchanges: { type: [exchangeDetailsSchema], required: false },
  },
  { timestamps: true }
);

// High-performance operational indexes for Admin Dashboard and Order querying
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "exchangeDetails.stage": 1 });
orderSchema.index({ paymentMethod: 1 });
orderSchema.index({ "shippingAddress.phone": 1 });
orderSchema.index({ "shippingAddress.fullName": 1 });
orderSchema.index({ "shippingAddress.email": 1 });

// Patch cached Mongoose model during Next.js dev hot-reloads so newly added paths aren't stripped by strict mode
const cachedOrderModel = (mongoose.models as Record<string, mongoose.Model<IOrder>> | undefined)?.Order;
if ((cachedOrderModel as any)?.schema && typeof (cachedOrderModel as any).schema.path === "function") {
  const cachedSchema = (cachedOrderModel as any).schema;
  if (!cachedSchema.path("exchangeDetails")) {
    cachedSchema.add({ exchangeDetails: { type: exchangeDetailsSchema, required: false } });
  } else {
    const exSubSchema = cachedSchema.path("exchangeDetails")?.schema;
    if (exSubSchema) {
      if (!exSubSchema.path("shippingFeeCollectionMode")) {
        exSubSchema.add({
          shippingFeeCollectionMode: { type: String, enum: ["online", "cod", "waived"] },
        });
      }
      if (!exSubSchema.path("exchangeId")) {
        exSubSchema.add({ exchangeId: { type: String } });
      }
      if (!exSubSchema.path("items")) {
        exSubSchema.add({ items: { type: [exchangeItemSchema], required: false } });
      }
    }
  }
  if (!cachedSchema.path("exchanges")) {
    cachedSchema.add({ exchanges: { type: [exchangeDetailsSchema], required: false } });
  }
  if (!cachedSchema.path("deliveredAt")) {
    cachedSchema.add({ deliveredAt: { type: Date } });
  }
}

export const OrderModel = cachedOrderModel || mongoose.model<IOrder>("Order", orderSchema);

export interface IOrderCounter {
  _id: string;
  seq: number;
}

const orderCounterSchema = new Schema<IOrderCounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 100000 },
  },
  { collection: "counters" }
);

export const OrderCounterModel =
  mongoose.models.OrderCounter ||
  mongoose.model<IOrderCounter>("OrderCounter", orderCounterSchema);
