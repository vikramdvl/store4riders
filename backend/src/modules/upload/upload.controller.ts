import { NextRequest, NextResponse } from "next/server";
import { UploadService } from "./upload.service";
import { UploadValidator } from "./upload.validator";
import { ApiResponse } from "../../core/response/ApiResponse";
import { extractAdminFromAuth } from "../../core/middlewares/auth";
import { checkPermission } from "../../core/middlewares/permission";
import { PermissionAction } from "../../core/config/permissions";
import { UserService } from "../user/user.service";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * SSRF Host Protection: Blocks access to internal IPs, metadata endpoints, and localhost
 */
const isSafeExternalHost = (hostname: string): boolean => {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "::1" ||
    lower === "0.0.0.0" ||
    lower === "169.254.169.254" || // AWS / Cloud metadata endpoint
    lower.endsWith(".internal") ||
    lower.endsWith(".local") ||
    lower.startsWith("10.") ||
    lower.startsWith("192.168.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower)
  ) {
    return false;
  }
  return true;
};

/**
 * @class UploadController
 * @description Minimal HTTP controller for File Uploads, URL Scraping, and Preview Proxying.
 */
export class UploadController {
  static async getPresignedUrl(req: NextRequest) {
    const userId = extractAdminFromAuth(req);
    await checkPermission(userId, PermissionAction.VIEW_DASHBOARD, UserService.getRole);
    const { fileName, fileType } = await UploadValidator.validatePresignedUrl(req);
    const url = await UploadService.generatePresignedUrl(fileName, fileType);
    return ApiResponse.success({ url }, "Presigned URL generated successfully");
  }

  static async directUpload(req: NextRequest) {
    const userId = extractAdminFromAuth(req);
    await checkPermission(userId, PermissionAction.VIEW_DASHBOARD, UserService.getRole);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return ApiResponse.error("No file provided in form data", 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const url = await UploadService.directUpload(buffer, file.name, file.type || "image/webp");
    return ApiResponse.success({ url }, "File uploaded successfully");
  }

  static async scrapeUrl(req: NextRequest) {
    const userId = extractAdminFromAuth(req);
    await checkPermission(userId, PermissionAction.VIEW_DASHBOARD, UserService.getRole);
    const { url } = await UploadValidator.validateScrapeUrl(req);
    const parsed = new URL(url);
    if (!isSafeExternalHost(parsed.hostname)) {
      return ApiResponse.error("Access to internal or private hosts is prohibited", 403);
    }

    const result = await UploadService.scrapeImagesFromUrl(url);
    return ApiResponse.success(result, `Discovered ${result.images.length} images from URL`);
  }

  static async importFromUrl(req: NextRequest) {
    const userId = extractAdminFromAuth(req);
    await checkPermission(userId, PermissionAction.VIEW_DASHBOARD, UserService.getRole);
    const { items, maxDimension, quality } = await UploadValidator.validateImportFromUrl(req);
    
    // Validate each URL is safe external host
    for (const item of items) {
      const parsed = new URL(item.url);
      if (!isSafeExternalHost(parsed.hostname)) {
        return ApiResponse.error(`Access to internal or private host (${parsed.hostname}) is prohibited`, 403);
      }
    }

    const result = await UploadService.importAndUploadImages(items, maxDimension, quality);
    return ApiResponse.success(
      result,
      `Successfully processed ${result.imported.length} image(s) to Store4Riders${
        result.errors.length ? ` (${result.errors.length} failed)` : ""
      }`
    );
  }

  /**
   * Safe preview proxy: fetches external images with proper User-Agent and Referer headers
   * so thumbnails always preview cleanly in the admin modal, even when hotlink-protected by external hosts.
   * Hardened against SSRF attacks.
   */
  static async proxyPreview(req: NextRequest): Promise<NextResponse> {
    const userId = extractAdminFromAuth(req);
    await checkPermission(userId, PermissionAction.VIEW_DASHBOARD, UserService.getRole);

    const targetUrl = req.nextUrl.searchParams.get("url");
    if (!targetUrl) {
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return new NextResponse("Invalid protocol", { status: 400 });
      }

      if (!isSafeExternalHost(parsed.hostname)) {
        return new NextResponse("Forbidden: Target host is blocked", { status: 403 });
      }

      let res = await fetch(targetUrl, {
        headers: {
          "User-Agent": BROWSER_USER_AGENT,
          Referer: parsed.origin,
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(8000), // 8s timeout
      });

      // If rejected (some CDNs block when Referer is sent or mismatched), retry with clean headers without Referer
      if (!res.ok) {
        res = await fetch(targetUrl, {
          headers: {
            "User-Agent": BROWSER_USER_AGENT,
            Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(8000),
        });
      }

      if (!res.ok) {
        return new NextResponse(`Target returned HTTP ${res.status}`, { status: res.status });
      }

      const contentType = res.headers.get("content-type") || "image/jpeg";
      const buffer = await res.arrayBuffer();

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch (err: any) {
      return new NextResponse("Preview proxy error", { status: 502 });
    }
  }
}
