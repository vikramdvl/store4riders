import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/core/api/client";
import { IBlockedIp } from "@store4riders/shared-types";
import { BlockIpInput } from "@store4riders/shared-validation";
import { toast } from "sonner";

export function useBlockedIps(enabled = true) {
  return useQuery<IBlockedIp[]>({
    queryKey: ["admin", "blocked-ips"],
    queryFn: async () => {
      const response = await apiClient.get("/admin/blocked-ips");
      return response.data.data || [];
    },
    enabled,
    staleTime: 15000,
    refetchOnWindowFocus: false,
  });
}

export function useBlockIp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BlockIpInput) => {
      const response = await apiClient.post("/admin/blocked-ips", payload);
      return response.data.data as IBlockedIp;
    },
    onSuccess: (record) => {
      toast.success(`Blocked IP ${record.ip}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "blocked-ips"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to block IP address");
    },
  });
}

export function useUnblockIp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ipOrId: string) => {
      const response = await apiClient.delete(`/admin/blocked-ips/${encodeURIComponent(ipOrId)}`);
      return response.data.data as { ip: string };
    },
    onSuccess: (res) => {
      toast.success(`Unblocked IP ${res.ip}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "blocked-ips"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to unblock IP address");
    },
  });
}
