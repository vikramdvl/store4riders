import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { IBrand, IBrandsPageConfig } from "@store4riders/shared-types";
import { toast } from "sonner";
import { revalidateStorefrontPaths } from "../utils/revalidateStorefront";

export function useBrands(includeInactive?: boolean, initialData?: IBrand[]) {
  return useQuery({
    queryKey: ["brands", Boolean(includeInactive)],
    queryFn: async () => {
      const url = includeInactive ? "/brands?includeInactive=true" : "/brands";
      const response = await apiClient.get(url);
      return response.data.data as IBrand[];
    },
    initialData,
    staleTime: 15 * 60 * 1000,
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
