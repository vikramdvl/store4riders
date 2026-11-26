import { CategoryRepository } from "./category.repository";
import { ICategory } from "@store4riders/shared-types";
import { ValidationError, NotFoundError, ConflictError } from "../../core/errors/AppError";
import { getCache, setCache, deleteCache } from "../../core/cache/redis";
import { CATEGORY_ALIAS_MAP } from "../product/product.category-constants";

const CACHE_KEY = "category_tree_v2";

/**
 * @class CategoryService
 * @description Pure business logic for Category management.
 * Highlights:
 * - Operates completely independent of HTTP context.
 * - Auto-caches the category tree in Redis for 1 hour.
 * - Auto-invalidates the cache whenever a category is created, updated or deleted.
 */
export class CategoryService {
  
  static async getCategoryTree() {
    const cached = await getCache(CACHE_KEY);
    if (cached) return cached;

    const categories = await CategoryRepository.findAll();
    const tree = this.buildTree(categories);
    
    await setCache(CACHE_KEY, tree, 3600); // Cache for 1 hour
    return tree;
  }

  static async createCategory(data: Partial<ICategory>): Promise<ICategory> {
    let slug = (data.slug || data.name || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (slug) {
      const existing = await CategoryRepository.findBySlug(slug);
      if (existing) {
        throw new ConflictError(
          `Category with slug '${slug}' already exists ("${existing.name}"). Please choose a unique name or slug.`
        );
      }
    }

    const category = await CategoryRepository.create({ ...data, slug });
    await this.invalidateCache();
    return category;
  }

  static async updateCategory(id: string, data: Partial<ICategory>): Promise<ICategory> {
    if (data.parentId === "" || data.parentId === "null") {
      data.parentId = undefined;
    }
    if (data.parentId && String(data.parentId) === String(id)) {
      throw new ValidationError("A category cannot be its own parent");
    }
    if (data.parentId) {
      const allCategories = await CategoryRepository.findAll();
      const isDescendant = (parentId: string, targetChildId: string): boolean => {
        const parent = allCategories.find(c => String(c._id) === String(parentId));
        if (!parent || !parent.parentId) return false;
        if (String(parent.parentId) === String(targetChildId)) return true;
        return isDescendant(String(parent.parentId), targetChildId);
      };
      if (isDescendant(String(data.parentId), String(id))) {
        throw new ValidationError("Cannot set a descendant category as parent (circular hierarchy)");
      }
    }
    if (data.name && !data.slug) {
      data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    }
    if (data.slug) {
      const existing = await CategoryRepository.findBySlug(data.slug);
      if (existing && String(existing._id) !== String(id)) {
        throw new ConflictError(
          `Category with slug '${data.slug}' already exists ("${existing.name}"). Please choose a unique slug.`
        );
      }
    }
    // Safety guard: Never wipe an existing category image/banner with empty string during text/FAQ updates
    if (data.image === "" || data.image === null) {
      delete data.image;
    }
    if (data.bannerImage === "" || data.bannerImage === null) {
      delete data.bannerImage;
    }
    const previousCategory = data.slug
      ? await Promise.resolve(CategoryRepository.findById(id)).catch(() => null)
      : null;
    const category = await CategoryRepository.update(id, data);
    if (!category) throw new NotFoundError("Category not found");
    await this.invalidateCache();
    if (previousCategory?.slug && category.slug && previousCategory.slug !== category.slug) {
      const { UrlRedirectService } = await import("../url-redirect/url-redirect.service");
      await UrlRedirectService.recordSlugChange(
        `/${previousCategory.slug}`,
        `/${category.slug}`,
        "auto_category",
        `Category "${category.name}" slug updated`
      );
    }
    return category;
  }

  static async deleteCategory(id: string): Promise<void> {
    const category = await CategoryRepository.findById(id);
    if (!category) {
      // Idempotent: category already does not exist in DB. Evict cache and return cleanly.
      await this.invalidateCache();
      return;
    }
    
    // Promote direct children to this category's parent (or root) to prevent orphan categories
    const newParentId = category.parentId || undefined;
    const catIdStr = String(category._id);
    await CategoryRepository.updateMany({ parentId: catIdStr }, { parentId: newParentId });
    if (category.slug) {
      await CategoryRepository.updateMany({ parentId: category.slug }, { parentId: newParentId });
    }

    await CategoryRepository.delete(catIdStr);
    await this.invalidateCache();
  }

  static async getCategoryBySlug(slug: string): Promise<ICategory | null> {
    const cleanSlug = slug.replace(/\.html$/i, "");
    const cacheKey = `cat_slug_v2_${cleanSlug}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached as ICategory;

    let cat = await CategoryRepository.findBySlug(cleanSlug);
    if (!cat && cleanSlug.endsWith("s")) {
      cat = await CategoryRepository.findBySlug(cleanSlug.slice(0, -1));
    } else if (!cat && !cleanSlug.endsWith("s")) {
      cat = await CategoryRepository.findBySlug(`${cleanSlug}s`);
    }
    if (!cat) {
      // Use shared alias map (single source of truth from product.category-constants.ts)
      const aliases = CATEGORY_ALIAS_MAP[cleanSlug] || [];
      for (const alias of aliases) {
        cat = await CategoryRepository.findBySlug(alias);
        if (cat) break;
      }
    }

    if (cat) {
      const heroCategoryIds = (cat as any).heroCategoryIds;
      if (Array.isArray(heroCategoryIds) && heroCategoryIds.length > 0) {
        const all = await CategoryRepository.findAll();
        const idMap = new Map<string, any>();
        all.forEach(c => {
          idMap.set(String(c._id || (c as any).id), c);
          if (c.slug) idMap.set(c.slug, c);
        });
        (cat as any).heroCategories = heroCategoryIds
          .map((targetId: string) => idMap.get(targetId))
          .filter(Boolean);
      } else {
        (cat as any).heroCategories = [];
      }

      await setCache(cacheKey, cat, 3600);
    }

    return cat;
  }

  static async invalidateCache() {
    await deleteCache(CACHE_KEY);
    await deleteCache("search_trending_v1");
    try {
      const { clearProductCaches } = await import("../../core/cache/redis");
      await clearProductCaches();
    } catch {
      // Non-blocking cache clear
    }
  }

  private static buildTree(categories: any[], parentId?: string, visited = new Set<string>()): any[] {
    const idMap = new Map<string, any>();
    categories.forEach(c => {
      const id = String(c._id || c.id);
      idMap.set(id, c);
      if (c.slug) idMap.set(c.slug, c);
    });

    const buildChildren = (pId?: string, curVisited = new Set<string>()): any[] => {
      return categories
        .filter(c => {
          const itemPid = c.parentId ? String(c.parentId) : undefined;
          return itemPid === pId;
        })
        .map(c => {
          const id = String(c._id || c.id);
          if (curVisited.has(id)) return { ...c, children: [] };
          curVisited.add(id);

          const children = buildChildren(id, new Set(curVisited));

          // Resolve hero section category cards (strictly admin-assigned only, zero automatic fallback)
          let heroCategories: any[] = [];
          if (Array.isArray(c.heroCategoryIds) && c.heroCategoryIds.length > 0) {
            heroCategories = c.heroCategoryIds
              .map((targetId: string) => idMap.get(targetId))
              .filter(Boolean);
          }

          return {
            ...c,
            children,
            heroCategories,
          };
        });
    };

    return buildChildren(parentId, visited);
  }
}
