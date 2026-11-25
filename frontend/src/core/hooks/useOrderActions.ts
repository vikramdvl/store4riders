import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { toast } from "sonner";
import { submitGatewayPaymentForm } from "../utils/paymentSubmit";

export interface ExchangeRequestItemPayload {
  orderItemId?: string;
  productId: string;
  variantId?: string;
  sku?: string;
  name?: string;
  quantity?: number;
  desiredReplacement?: string;
}

export function useRequestReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      reason,
      images,
      items,
    }: {
      orderId: string;
      reason: string;
      images?: string[];
      items?: ExchangeRequestItemPayload[];
    }) => {
      const response = await apiClient.post(`/orders/${orderId}/return`, { reason, images, items });
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", variables.orderId] });
      toast.success("Exchange request submitted successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to submit exchange request");
    }
  });
}

export function useGenerateInvoice() {
  return useMutation({
    mutationFn: async (orderId: string) => {
      // Send admin=true just in case this is called from admin panel. API ignores it if not admin.
      const response = await apiClient.get(`/orders/${orderId}/invoice?admin=true`);
      return response.data.data.invoiceUrl as string;
    },
    onSuccess: (url) => {
      if (url) {
        window.open(url, "_blank");
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to generate invoice");
    }
  });
}

export function usePayExchangeFee() {
  return useMutation({
    mutationFn: async ({
      orderId,
      paymentMethod,
      exchangeId,
    }: {
      orderId: string;
      paymentMethod: "payu" | "ccavenue" | "upi";
      exchangeId?: string;
    }) => {
      const response = await apiClient.post(`/orders/${orderId}/exchange/fee-pay`, {
        paymentMethod,
        ...(exchangeId ? { exchangeId } : {}),
      });
      return response.data.data;
    },
    onSuccess: (data: any) => {
      const method = String(data?.paymentMethod || "").toLowerCase();
      if ((method === "payu" || method === "ccavenue") && data?.gatewayResponse) {
        submitGatewayPaymentForm(method, data.gatewayResponse);
      }
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Failed to initialize exchange shipping fee payment"
      );
    },
  });
}
