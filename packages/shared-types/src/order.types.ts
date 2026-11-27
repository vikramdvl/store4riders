import { PaymentMethodType } from "./payment.types";

export type IOrderStatus =
  | "pending_payment"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "failed"
  | "refunded"
  | "return_requested"
  | "return_approved"
  | "returned"
  | "packed"
  | "return_picked";

export type IExchangeStage =
  | "requested"
  | "approved"
  | "picked_up"
  | "qc_passed"
  | "qc_failed"
  | "fee_settled"
  | "replacement_dispatched"
  | "completed"
  | "rejected";

export type IExchangeFeeStatus =
  | "pending"
  | "paid_online"
  | "paid_manual"
  | "cod_on_replacement"
  | "waived";

export interface IExchangeQcChecklist {
  tagsIntact: boolean;
  unusedCondition: boolean;
  packagingIntact: boolean;
}

export interface IExchangeItem {
  orderItemId?: string;
  productId: string;
  variantId?: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  image?: string;
  desiredReplacement?: string;
}

export interface IExchangeDetails {
  exchangeId?: string;
  items?: IExchangeItem[];
  stage: IExchangeStage;
  reasonType: string;
  desiredReplacement: string;
  customerNote: string;
  requestedItemNames?: string;
  requestedAt?: Date | string;
  approvedAt?: Date | string;
  reverseCourier?: string;
  reverseAwb?: string;
  reverseTrackingUrl?: string;
  reverseShipmentId?: string;
  reverseStatus?: string;
  pickedUpAt?: Date | string;
  qcStatus?: "pending" | "passed" | "failed";
  qcChecklist?: IExchangeQcChecklist;
  qcNotes?: string;
  qcInspectedAt?: Date | string;
  qcInspectedBy?: string;
  shippingFee: number;
  shippingFeeStatus: IExchangeFeeStatus;
  shippingFeeCollectionMode?: "online" | "cod" | "waived";
  shippingFeePaymentMethod?: string;
  shippingFeePaymentRef?: string;
  shippingFeeGatewayOrderId?: string;
  shippingFeePaidAt?: Date | string;
  replacementCourier?: string;
  replacementAwb?: string;
  replacementTrackingUrl?: string;
  replacementShipmentId?: string;
  replacementDispatchedAt?: Date | string;
  replacementCompletedAt?: Date | string;
  rejectionReason?: string;
}

export interface IOrderItem {
  id?: string;
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  hsnCode?: string;
  image?: string;
  slug?: string;
  weight?: number;
  weightUnit?: string;
  length?: number;
  breadth?: number;
  height?: number;
  dimensionUnit?: string;
}

export interface IOrderPricing {
  subtotal: number;
  discount: number;
  couponCode?: string;
  couponDiscount: number;
  tax: number;
  taxRate: number;
  shipping: number;
  total: number;
  codHandlingFee?: number;
  codAmountToCollect?: number;
  codPartialPaymentAmount?: number;
}

export interface IOrderAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  street?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  email?: string;
}

export interface IOrderNote {
  text: string;
  author: string;
  timestamp: Date;
}

export interface IOrder {
  id?: string;
  orderNumber: string;
  userId?: string;
  guestEmail?: string;
  customerEmail?: string;
  failureReason?: string;
  status: IOrderStatus;
  items: IOrderItem[];
  pricing: IOrderPricing;
  shippingAddress: IOrderAddress;
  paymentMethod: PaymentMethodType;
  customerGstin?: string;
  businessName?: string;
  warehouseId?: string;
  invoiceUrl?: string;
  gatewayOrderId?: string;
  paymentId?: string;
  paymentSignature?: string;
  idempotencyKey?: string;
  notes?: IOrderNote[];
  deliveredAt?: Date | string;
  exchangeDetails?: IExchangeDetails;
  exchanges?: IExchangeDetails[];
  createdAt: Date;
  updatedAt: Date;
}
