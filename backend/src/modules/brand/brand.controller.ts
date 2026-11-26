import { NextRequest } from "next/server";
import { BrandService } from "./brand.service";
import { BrandValidator } from "./brand.validator";
import { SettingService } from "../settings/setting.service";
import { ApiResponse } from "../../core/response/ApiResponse";

export class BrandController {
  static async getAll(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const includeInactive = searchParams.get("includeInactive") === "true";

    // Paginated response if `page` or `limit` parameter is present
    if (searchParams.has("page") || searchParams.has("limit")) {
      const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
      const search = searchParams.get("search") || undefined;
      const status = searchParams.get("status") as "all" | "active" | "inactive" | null;
      const submenu = searchParams.get("submenu") as "all" | "in_submenu" | "hidden" | null;
      const section = searchParams.get("section") || undefined;

      const { items, totalCount } = await BrandService.getPaginatedBrands({
        page,
        limit,
        includeInactive,
        search,
        status: status || "all",
        submenu: submenu || "all",
        section: section || "all",
      });

      return ApiResponse.paginated(items, totalCount, page, limit);
    }

    const brands = await BrandService.getAllBrands(includeInactive);
    return ApiResponse.success(brands, "Brands fetched successfully");
  }

  static async getPageSeo(req: NextRequest) {
    const seo = await SettingService.getBrandsPageSeo();
    return ApiResponse.success(seo, "Brands directory page SEO fetched successfully");
  }

  static async updatePageSeo(req: NextRequest) {
    const body = await req.json();
    const updated = await SettingService.updateBrandsPageSeo(body);
    return ApiResponse.success(updated, "Brands directory page SEO updated successfully");
  }

  static async getById(req: NextRequest, id: string) {
    const brand = await BrandService.getBrandById(id);
    return ApiResponse.success(brand, "Brand fetched successfully");
  }

  static async create(req: NextRequest) {
    const validatedData = await BrandValidator.validateCreate(req);
    const brand = await BrandService.createBrand(validatedData);
    return ApiResponse.success(brand, "Brand created successfully", 201);
  }

  static async update(req: NextRequest, id: string) {
    const validatedData = await BrandValidator.validateUpdate(req);
    const brand = await BrandService.updateBrand(id, validatedData);
    return ApiResponse.success(brand, "Brand updated successfully");
  }

  static async delete(req: NextRequest, id: string) {
    const brand = await BrandService.deleteBrand(id);
    return ApiResponse.success(brand, "Brand deleted successfully");
  }
}
