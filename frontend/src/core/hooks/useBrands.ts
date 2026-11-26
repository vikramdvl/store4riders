import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { IBrand, IBrandsPageConfig } from "@store4riders/shared-types";
import { toast } from "sonner";
import { revalidateStorefrontPaths } from "../utils/revalidateStorefront";

export interface UseBrandsOptions {
  staleTime?: number;
  refetchOnMount?: boolean | "always";
}

export interface BrandListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "all" | "active" | "inactive";
  submenu?: "all" | "in_submenu" | "hidden";
  section?: string;
  includeInactive?: boolean;
}

export interface PaginatedBrandsResponse {
  items: IBrand[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function usePaginatedBrands(params: BrandListParams, options?: UseBrandsOptions) {
  const {
    page = 1,
    limit = 20,
    search = "",
    status = "all",
    submenu = "all",
    section = "all",
    includeInactive = true,
  } = params;

  return useQuery({
    queryKey: ["brands", "paginated", { page, limit, search, status, submenu, section, includeInactive }],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("limit", String(limit));
      if (includeInactive) sp.set("includeInactive", "true");
      if (search) sp.set("search", search);
      if (status && status !== "all") sp.set("status", status);
      if (submenu && submenu !== "all") sp.set("submenu", submenu);
      if (section && section !== "all") sp.set("section", section);

      const response = await apiClient.get(`/brands?${sp.toString()}`);
      return response.data.data as PaginatedBrandsResponse;
    },
    staleTime: options?.staleTime !== undefined ? options.staleTime : 30 * 1000,
    refetchOnMount: options?.refetchOnMount,
  });
}

export function useBrands(includeInactive?: boolean, initialData?: IBrand[], options?: UseBrandsOptions) {
  return useQuery({
    queryKey: ["brands", Boolean(includeInactive)],
    queryFn: async () => {
      const url = includeInactive ? "/brands?includeInactive=true" : "/brands";
      const response = await apiClient.get(url);
      return response.data.data as IBrand[];
    },
    initialData,
    staleTime: options?.staleTime !== undefined ? options.staleTime : 30 * 1000,
    refetchOnMount: options?.refetchOnMount,
  });
}

export function useBrand(slug: string) {
  return useQuery({
    queryKey: ["brand", slug],
    queryFn: async () => {
      const response = await apiClient.get(`/brands/${encodeURIComponent(slug)}`);
      return response.data.data as IBrand;
    },
    enabled: Boolean(slug),
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<IBrand>) => {
      const response = await apiClient.post("/brands", data);
      return response.data.data;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      queryClient.invalidateQueries({ queryKey: ["brand"] });
      revalidateStorefrontPaths([
        "/brands",
        created?.slug ? `/brands/${created.slug}` : undefined,
      ]);
      toast.success("Brand created successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to create brand");
    },
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<IBrand> }) => {
      const response = await apiClient.put(`/brands/${id}`, data);
      return response.data.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      queryClient.invalidateQueries({ queryKey: ["brand"] });
      revalidateStorefrontPaths([
        "/brands",
        updated?.slug ? `/brands/${updated.slug}` : undefined,
      ]);
      toast.success("Brand updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to update brand");
    },
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/brands/${id}`);
      return response.data.data;
    },
    onSuccess: (deleted) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      queryClient.invalidateQueries({ queryKey: ["brand"] });
      revalidateStorefrontPaths([
        "/brands",
        deleted?.slug ? `/brands/${deleted.slug}` : undefined,
      ]);
      toast.success("Brand deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to delete brand");
    },
  });
}

export function useBrandsPageConfig(initialData?: IBrandsPageConfig) {
  return useQuery({
    queryKey: ["brands-page-config"],
    queryFn: async () => {
      const response = await apiClient.get("/brands/page-seo");
      return response.data.data as IBrandsPageConfig;
    },
    initialData,
    staleTime: 15 * 60 * 1000,
  });
}

export function useUpdateBrandsPageConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: IBrandsPageConfig) => {
      const response = await apiClient.put("/brands/page-seo", data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands-page-config"] });
      revalidateStorefrontPaths(["/brands"]);
      toast.success("Brand directory page settings saved successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to save brand directory page settings");
    },
  });
}
