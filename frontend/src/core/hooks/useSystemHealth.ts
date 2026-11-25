import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/core/api/client";
import { IPaginatedResponse, ISystemHealthReport } from "@store4riders/shared-types";

export interface IPaymentLogRecord {
  _id?: string;
  id?: string;
  orderId: string;
  status: string;
  amount: number;
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  method: string;
  gateway: string;
  paymentPurpose?: string;
  webhookEvents?: string[];
  createdAt: string;
}

export function useSystemHealth(enabled = true) {
  return useQuery<ISystemHealthReport>({
    queryKey: ["admin", "system-health"],
    queryFn: async () => {
      const response = await apiClient.get("/admin/system-health");
      return response.data.data;
    },
    enabled,
    staleTime: 10000,
    refetchOnWindowFocus: false,
  });
}

export function useAdminPaymentLogs(page = 1, limit = 20, enabled = true) {
  return useQuery<IPaginatedResponse<IPaymentLogRecord>>({
    queryKey: ["admin", "payment-logs", page, limit],
    queryFn: async () => {
      const response = await apiClient.get(`/admin/payment-logs?page=${page}&limit=${limit}`);
      return response.data.data;
    },
    enabled,
    placeholderData: (prev) => prev,
    staleTime: 15000,
    refetchOnWindowFocus: false,
  });
}
