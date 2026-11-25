import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/core/api/client";
import {
  AuditLogCategory,
  AuditLogSeverity,
  AuditLogStatus,
  IAuditLog,
  IAuditLogStats,
  IPaginatedResponse,
} from "@store4riders/shared-types";

export interface UseAuditLogsParams {
  page?: number;
  limit?: number;
  category?: AuditLogCategory;
  severity?: AuditLogSeverity;
  status?: AuditLogStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
}

export function useAuditLogs(params: UseAuditLogsParams = {}) {
  const {
    page = 1,
    limit = 25,
    category,
    severity,
    status,
    search,
    startDate,
    endDate,
    enabled = true,
  } = params;

  return useQuery<IPaginatedResponse<IAuditLog>>({
    queryKey: ["admin", "audit-logs", { page, limit, category, severity, status, search, startDate, endDate }],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("limit", String(limit));
      if (category) sp.set("category", category);
      if (severity) sp.set("severity", severity);
      if (status) sp.set("status", status);
      if (search?.trim()) sp.set("search", search.trim());
      if (startDate) sp.set("startDate", startDate);
      if (endDate) sp.set("endDate", endDate);

      const response = await apiClient.get(`/admin/audit-logs?${sp.toString()}`);
      return response.data.data;
    },
    enabled,
    placeholderData: (prev) => prev,
    staleTime: 15000,
    refetchOnWindowFocus: false,
  });
}

export function useAuditLogStats(enabled = true) {
  return useQuery<IAuditLogStats>({
    queryKey: ["admin", "audit-logs", "stats"],
    queryFn: async () => {
      const response = await apiClient.get("/admin/audit-logs/stats");
      return response.data.data;
    },
    enabled,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}
