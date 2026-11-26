import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import {
  IHomepageConfig,
  IHeroSectionConfig,
  IHomepageSeoConfig,
  IHomepageSectionsConfig,
} from "@store4riders/shared-types";
import { toast } from "sonner";
import { revalidateStorefrontPaths } from "../utils/revalidateStorefront";

export function useHomepageConfig() {
  return useQuery<IHomepageConfig>({
    queryKey: ["homepage", "config"],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IHomepageConfig }>("/homepage");
      return res.data.data;
    },
    staleTime: 60 * 1000,
  });
}

export function usePublicHomepageConfig(initialData?: IHomepageConfig) {
  return useQuery<IHomepageConfig>({
    queryKey: ["homepage", "public"],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: IHomepageConfig }>("/homepage/public");
      return res.data.data;
    },
    initialData,
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdateHeroAndSeo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { hero: IHeroSectionConfig; seo: IHomepageSeoConfig }) => {
      const res = await apiClient.put("/homepage/hero-seo", payload);
      return res.data.data;
    },
    onSuccess: (updatedData) => {
      if (updatedData) {
        queryClient.setQueryData(["homepage", "config"], updatedData);
        queryClient.setQueryData(["homepage", "public"], updatedData);
      }
      queryClient.invalidateQueries({ queryKey: ["homepage"] });
      revalidateStorefrontPaths(["/"]);
      toast.success("Hero & SEO settings saved successfully!");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || "Failed to update Hero & SEO");
    },
  });
}

export function useUpdateHomepageSections() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { sections: IHomepageSectionsConfig }) => {
      const res = await apiClient.put("/homepage/sections", payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homepage"] });
      revalidateStorefrontPaths(["/"]);
      toast.success("Homepage sections saved successfully!");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || "Failed to update homepage sections");
    },
  });
}

export { useSyncInstagramFeed } from "./useInstagramSync";


