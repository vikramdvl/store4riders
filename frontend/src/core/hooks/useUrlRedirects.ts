import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { IUrlRedirect } from "@store4riders/shared-types";

export interface PaginatedUrlRedirectsResponse {
  items: IUrlRedirect[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useUrlRedirects(
  page = 1,
  limit = 20,
  search?: string,
  source: string = "all"
) {
  return useQuery({
    queryKey: ["admin-url-redirects", page, limit, search || "", source],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search && search.trim()) params.append("search", search.trim());
      if (source && source !== "all") params.append("source", source);

      const response = await apiClient.get<{ data: PaginatedUrlRedirectsResponse }>(
        `/url-redirects?${params.toString()}`
      );
      return response.data.data;
    },
  });
}

export function useCreateUrlRedirect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<IUrlRedirect>) => {
      const response = await apiClient.post<{ data: IUrlRedirect }>("/url-redirects", data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-url-redirects"] });
    },
  });
}

export function useUpdateUrlRedirect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<IUrlRedirect> }) => {
      const response = await apiClient.put<{ data: IUrlRedirect }>(
        `/url-redirects/${id}`,
        data
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-url-redirects"] });
    },
  });
}

export function useDeleteUrlRedirect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/url-redirects/${id}`);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-url-redirects"] });
    },
  });
}
