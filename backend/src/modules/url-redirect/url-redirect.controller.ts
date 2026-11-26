import { ApiResponse } from "../../core/response/ApiResponse";
import { UrlRedirectService } from "./url-redirect.service";
import { UrlRedirectValidator } from "./url-redirect.validator";
import { ValidationError } from "../../core/errors/AppError";

export class UrlRedirectController {
  static async resolve(req: Request) {
    const url = new URL(req.url);
    const rawPath = url.searchParams.get("path");

    if (!rawPath || !rawPath.trim()) {
      return ApiResponse.success({ matched: false }, "No path provided", 200);
    }

    const validated = UrlRedirectValidator.resolveQuery.safeParse({ path: rawPath });
    if (!validated.success || !validated.data.path) {
      return ApiResponse.success({ matched: false }, "Invalid path", 200);
    }

    const result = await UrlRedirectService.resolvePath(validated.data.path);
    return ApiResponse.success(result, "URL redirect checked successfully", 200);
  }

  static async activeMap() {
    const map = await UrlRedirectService.getActiveRedirectMap();
    return ApiResponse.success(map, "Active URL redirect map fetched successfully", 200);
  }

  static async list(req: Request) {
    const url = new URL(req.url);
    const queryObj = {
      page: url.searchParams.get("page") || 1,
      limit: url.searchParams.get("limit") || 20,
      search: url.searchParams.get("search") || undefined,
      source: url.searchParams.get("source") || "all",
    };

    const validated = UrlRedirectValidator.listQuery.safeParse(queryObj);
    if (!validated.success) {
      throw new ValidationError(validated.error.errors[0]?.message || "Invalid query parameters");
    }

    const { page, limit, search, source } = validated.data;
    const { items, totalCount } = await UrlRedirectService.list(page, limit, search, source);
    return ApiResponse.paginated(items, totalCount, page, limit);
  }

  static async getById(id: string) {
    const item = await UrlRedirectService.getById(id);
    return ApiResponse.success(item, "URL redirect fetched successfully", 200);
  }

  static async create(req: Request) {
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Invalid JSON body");
    }

    const validated = UrlRedirectValidator.createBody.safeParse(body);
    if (!validated.success) {
      throw new ValidationError(validated.error.errors[0]?.message || "Invalid URL redirect data");
    }

    const created = await UrlRedirectService.create(validated.data);
    return ApiResponse.success(created, "URL redirect created successfully", 201);
  }

  static async update(req: Request, id: string) {
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Invalid JSON body");
    }

    const validated = UrlRedirectValidator.updateBody.safeParse(body);
    if (!validated.success) {
      throw new ValidationError(validated.error.errors[0]?.message || "Invalid URL redirect data");
    }

    const updated = await UrlRedirectService.update(id, validated.data);
    return ApiResponse.success(updated, "URL redirect updated successfully", 200);
  }

  static async delete(id: string) {
    await UrlRedirectService.delete(id);
    return ApiResponse.success({ id, deleted: true }, "URL redirect deleted successfully", 200);
  }
}
