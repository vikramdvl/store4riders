import { useMutation } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PaymentMethodType } from "@store4riders/shared-types";
import { submitGatewayPaymentForm, savePendingPaymentOrder, loadPendingPaymentOrder } from "../utils/paymentSubmit";

export interface SyncPaymentStatusResponse {
  status: string;
  orderNumber: string;
  paymentMethod?: string;
  isConfirmed: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
  gatewayStatus?: "confirmed" | "pending" | "cancelled" | "failed";
  isExchangeFee?: boolean;
  reconciled?: boolean;
  failureReason?: string;
  message: string;
}

/**
 * Reconciles live payment status with the backend/gateway using an order number, ID, or gateway txnid.
 */
export async function syncOrderPaymentStatus(
  orderId: string,
  guestToken?: string
): Promise<SyncPaymentStatusResponse | null> {
  const urlGuestToken =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("guestToken") || undefined
      : undefined;
  const effectiveGuestToken = guestToken || urlGuestToken || loadPendingPaymentOrder()?.guestOrderToken;
  const res = await apiClient.post(
    "/orders/sync-payment",
    {
      orderId,
      ...(effectiveGuestToken ? { guestToken: effectiveGuestToken } : {}),
    },
    { timeout: 12000 }
  );
  return res.data?.data ?? null;
}

declare global {
  interface Window {}
}
import { useCartStore } from "@/stores/useCartStore";

export function useCheckout() {
  const { isAuthenticated } = useAuthStore();
  const { items: cartItems } = useCartStore();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ 
      shippingAddressId, 
      shippingAddress, 
      guestEmail, 
      paymentMethod, 
      couponCode, 
      phone, 
      fullName,
      customerGstin,
      businessName
    }: { 
      shippingAddressId?: string; 
      shippingAddress?: any; 
      guestEmail?: string; 
      paymentMethod: PaymentMethodType; 
      couponCode?: string; 
      phone?: string; 
      fullName?: string;
      customerGstin?: string;
      businessName?: string;
    }) => {
      
      const payloadItems = cartItems.map(item => ({
        productId: item.productId,
        variantId: item.variantId || undefined,
        quantity: item.quantity
      }));
      
      // Generate a unique idempotency key for this checkout attempt
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const response = await apiClient.post("/orders", { 
        shippingAddressId, 
        shippingAddress,
        guestEmail,
        paymentMethod, 
        couponCode: couponCode || undefined,
        phone: phone || undefined,
        fullName: fullName || undefined,
        customerGstin: customerGstin || undefined,
        businessName: businessName || undefined,
        items: payloadItems,
        idempotencyKey,
      }, { timeout: 25000 });
      return { ...response.data, paymentMethod };
    },
    onSuccess: (data) => {
      const resData = data?.data || data || {};
      const method = (resData.paymentMethod || data?.paymentMethod || "").toLowerCase();
      const gatewayOrderId = resData.gatewayOrderId;
      const gatewayResponse = resData.gatewayResponse;

      // Handle COD without partial payment (handled in CheckoutPageModule onSuccess)
      if (method === "cod" && !gatewayOrderId) {
        toast.success("Order Confirmed Successfully!");
        return;
      }

      // Handle Direct UPI / Google Pay (modal handled in CheckoutPageModule)
      if ((method === "upi" || method === "gpay") && gatewayResponse) {
        return;
      }

      // Handle PayU, CCAvenue, Snapmint, and COD partial payment with PayU
      if ((method === "payu" || method === "ccavenue" || method === "snapmint" || (method === "cod" && gatewayOrderId)) && gatewayResponse) {
        savePendingPaymentOrder({
          orderNumber: resData.orderNumber || resData.orderId,
          gatewayOrderId: gatewayOrderId ? String(gatewayOrderId) : undefined,
          guestOrderToken: resData.guestOrderToken ? String(resData.guestOrderToken) : undefined,
          paymentMethod: method,
        });
        submitGatewayPaymentForm(method, gatewayResponse);
        return;
      }
    },
    onError: (error: any) => {
      if (error.message === "You must be logged in to checkout") {
        toast.error("Please login first to complete your order");
        router.push("/login?redirect=/checkout");
        return;
      }

      const resData = error.response?.data;
      let errorMsg = "Failed to initialize checkout";

      if (typeof resData?.error === "string") {
        errorMsg = resData.error;
      } else if (Array.isArray(resData?.error) && resData.error[0]?.message) {
        errorMsg = resData.error[0].message;
      } else if (typeof resData?.message === "string") {
        errorMsg = resData.message;
      } else if (error.message) {
        errorMsg = error.message;
      }

      toast.error(errorMsg);
    },
  });
}
