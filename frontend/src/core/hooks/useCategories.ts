import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { ICategory } from "@store4riders/shared-types";
import { toast } from "sonner";
import { revalidateStorefrontPaths, collectCategoryStorefrontPaths } from "../utils/revalidateStorefront";

export interface ICategoryTree extends ICategory {
  children?: ICategoryTree[];
}

const formatApiError = (error: any, fallback: string): string => {
  const err = error.response?.data?.error;
  if (typeof err === "string") return err;
  if (Array.isArray(err)) {
    return err
      .map((i: any) => (typeof i === "object" ? i.message || `${i.path?.join(".")}: invalid` : String(i)))
      .join(", ");
  }
  if (err && typeof err === "object") {
    return err.message || JSON.stringify(err);
  }
  return fallback;
};

export function useCategoryTree(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["categoryTree"],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: ICategoryTree[] }>("/categories/tree");
      return response.data.data;
    },
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<ICategory>) => {
      const response = await apiClient.post<{ success: boolean; data: ICategory }>("/admin/categories", data);
      return response.data.data;
    },
    onSuccess: (created) => {
      toast.success("Category created successfully");
      queryClient.invalidateQueries({ queryKey: ["categoryTree"] });
      revalidateStorefrontPaths(collectCategoryStorefrontPaths(created));
    },
    onError: (error: any) => {
      toast.error(formatApiError(error, "Failed to create category"));
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ICategory> }) => {
      const response = await apiClient.put<{ success: boolean; data: ICategory }>(`/admin/categories/${id}`, data);
      return response.data.data;
    },
    onSuccess: (updated) => {
      toast.success("Category updated successfully");
      queryClient.invalidateQueries({ queryKey: ["categoryTree"] });
      revalidateStorefrontPaths(collectCategoryStorefrontPaths(updated));
    },
    onError: (error: any) => {
      toast.error(formatApiError(error, "Failed to update category"));
    },
  });
}

export type DeleteCategoryInput =
  | string
  | {
      id: string;
      isTemplate?: boolean;
      slug?: string;
      name?: string;
    };

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeleteCategoryInput) => {
      if (typeof input === "string") {
        const response = await apiClient.delete(`/admin/categories/${input}`);
        return response.data;
      }

      const response = await apiClient.delete(`/admin/categories/${input.id}`, {
        params: input.isTemplate
          ? {
              soft: "true",
              ...(input.slug ? { slug: input.slug } : {}),
              ...(input.name ? { name: input.name } : {}),
            }
          : undefined,
      });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      toast.success("Category deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["categoryTree"] });
      const slug = typeof variables === "string" ? undefined : variables.slug;
      revalidateStorefrontPaths(collectCategoryStorefrontPaths(slug ? { slug } : null));
    },
    onError: (error: any) => {
      toast.error(formatApiError(error, "Failed to delete category"));
    },
  });
}
