import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { IOrder } from "@store4riders/shared-types";
import { toast } from "sonner";

export interface IOrderCounts {
  activeCount: number;
  failedCount: number;
  exchangeCount: number;
  prepaidCount: number;
  codCount: number;
}

export function useAdminOrders(params: { page: number; limit: number; status?: string; paymentMethod?: string; search?: string }) {
  return useQuery({
    queryKey: ["admin-orders", params],
    queryFn: async () => {
      const response = await apiClient.get("/orders/admin", { params });
      return response.data.data; // { items: IOrder[], totalCount, page, limit }
    },
    placeholderData: (prev) => prev,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}

export function useAdminOrderSuggest(query: string) {
  const clean = query.trim();
  return useQuery({
    queryKey: ["admin-orders-suggest", clean],
    queryFn: async () => {
      if (!clean || clean.length < 2) return [];
      const response = await apiClient.get("/orders/admin/suggest", {
        params: { q: clean },
      });
      return response.data?.data || [];
    },
    enabled: clean.length >= 2,
    staleTime: 15000,
    refetchOnWindowFocus: false,
  });
}

export function useAdminOrderCounts() {
  return useQuery<IOrderCounts>({
    queryKey: ["admin-orders-counts"],
    queryFn: async () => {
      const response = await apiClient.get("/orders/admin/counts");
      return response.data.data;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

export function useAdminUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const response = await apiClient.put(`/orders/admin/${orderId}/status`, { status });
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order", variables.orderId] });
      toast.success("Order status updated successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to update order status");
    }
  });
}

export function useAdminAddOrderNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, text }: { orderId: string; text: string }) => {
      const response = await apiClient.post(`/orders/admin/${orderId}/notes`, { text });
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-order", variables.orderId] });
      toast.success("Note added successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to add note");
    }
  });
}

export function useAdminHandleReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      exchangeId,
      action,
      adminNote,
      shippingFee,
      reverseCourier,
      reverseAwb,
      reverseTrackingUrl,
      warehouseId,
      triggerCourier,
    }: {
      orderId: string;
      exchangeId?: string;
      action: "approve" | "reject";
      adminNote?: string;
      shippingFee?: number;
      reverseCourier?: string;
      reverseAwb?: string;
      reverseTrackingUrl?: string;
      warehouseId?: string;
      triggerCourier?: "none" | "shiprocket" | "delhivery" | "xpressbees" | "manual";
    }) => {
      const response = await apiClient.put(`/orders/admin/${orderId}/return`, {
        ...(exchangeId ? { exchangeId } : {}),
        action,
        adminNote,
        shippingFee,
        reverseCourier,
        reverseAwb,
        reverseTrackingUrl,
        warehouseId,
        triggerCourier,
      });
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order", variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-counts"] });
      toast.success(`Exchange ${variables.action}d successfully`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error?.response?.data?.message || `Failed to process exchange`);
    }
  });
}

export function useAdminExchangePickup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      ...payload
    }: {
      orderId: string;
      exchangeId?: string;
      action: "schedule_reverse" | "mark_picked_up" | "update_tracking";
      provider?: "shiprocket" | "delhivery" | "xpressbees" | "manual";
      reverseCourier?: string;
      reverseAwb?: string;
      reverseTrackingUrl?: string;
      warehouseId?: string;
    }) => {
      const response = await apiClient.put(`/orders/admin/${orderId}/exchange/pickup`, payload);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order", variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-counts"] });
      queryClient.invalidateQueries({ queryKey: ["shipments", "order", variables.orderId] });
      toast.success("Reverse pickup details updated");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error?.response?.data?.message || "Failed to update reverse pickup");
    },
  });
}

export function useAdminExchangeQc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      ...payload
    }: {
      orderId: string;
      exchangeId?: string;
      result: "passed" | "failed";
      tagsIntact: boolean;
      unusedCondition: boolean;
      packagingIntact: boolean;
      qcNotes: string;
      shippingFee?: number;
      feeCollectionMode?: "online" | "cod" | "waived";
    }) => {
      const response = await apiClient.post(`/orders/admin/${orderId}/exchange/qc`, payload);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order", variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-counts"] });
      toast.success(`Warehouse QC marked as ${variables.result.toUpperCase()}`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error?.response?.data?.message || "Failed to submit QC inspection");
    },
  });
}

export function useAdminSettleExchangeFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      ...payload
    }: {
      orderId: string;
      exchangeId?: string;
      settlementMode: "online_pending" | "paid_manual" | "cod_on_replacement" | "waived";
      paymentRef?: string;
      shippingFee?: number;
      note?: string;
    }) => {
      const response = await apiClient.put(`/orders/admin/${orderId}/exchange/fee`, payload);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order", variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-counts"] });
      toast.success("Exchange shipping fee status updated");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error?.response?.data?.message || "Failed to update fee status");
    },
  });
}

export function useAdminDispatchReplacement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      ...payload
    }: {
      orderId: string;
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
    }) => {
      const response = await apiClient.post(`/orders/admin/${orderId}/exchange/dispatch`, payload);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order", variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-counts"] });
      queryClient.invalidateQueries({ queryKey: ["shipments", "order", variables.orderId] });
      toast.success("Replacement shipment dispatched successfully!");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error?.response?.data?.message || "Failed to dispatch replacement");
    },
  });
}

export function useAdminCompleteExchange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: string | { orderId: string; exchangeId?: string }) => {
      const orderId = typeof input === "string" ? input : input.orderId;
      const exchangeId = typeof input === "string" ? undefined : input.exchangeId;
      const response = await apiClient.put(`/orders/admin/${orderId}/exchange/complete`, {
        ...(exchangeId ? { exchangeId } : {}),
      });
      return response.data.data;
    },
    onSuccess: (_, input) => {
      const orderId = typeof input === "string" ? input : input.orderId;
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-counts"] });
      toast.success("Exchange marked as completed!");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error?.response?.data?.message || "Failed to complete exchange");
    },
  });
}

export function useAdminDeleteOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiClient.delete(`/orders/admin/${orderId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Order deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to delete order");
    }
  });
}

export function useAdminResendInvoiceEmail() {
  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiClient.post(`/orders/admin/${orderId}/resend-invoice-email`);
      return response.data.data;
    },
    onSuccess: (data) => {
      toast.success(`Tax invoice emailed to ${data?.recipientEmail || "customer"}`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to send invoice email");
    }
  });
}

export function useAdminAssignWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, warehouseId }: { orderId: string; warehouseId: string }) => {
      const response = await apiClient.put(`/orders/admin/${orderId}/warehouse`, { warehouseId });
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-order", variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Dispatch warehouse updated successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to update warehouse");
    }
  });
}
