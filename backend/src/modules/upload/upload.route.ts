import { NextRequest, NextResponse } from "next/server";
import { UploadController } from "./upload.controller";
import { checkOrderRateLimit } from "../../core/middlewares/rateLimiter";
import { getClientIp } from "../../core/utils/clientIp";
import { extractAdminFromAuth } from "../../core/middlewares/auth";
import { checkPermission } from "../../core/middlewares/permission";
import { PermissionAction } from "../../core/config/permissions";
import { UserService } from "../user/user.service";

export async function uploadRouter(req: NextRequest, routePath: string[]): Promise<NextResponse | null> {
  const ip = getClientIp(req);
  const userId = extractAdminFromAuth(req);
  await checkPermission(userId, PermissionAction.VIEW_DASHBOARD, UserService.getRole);

  if (req.method === "POST" && routePath.length === 1 && routePath[0] === "presigned-url") {
    await checkOrderRateLimit(ip);
    return await UploadController.getPresignedUrl(req);
  }

  if (req.method === "POST" && routePath.length === 1 && routePath[0] === "direct") {
    await checkOrderRateLimit(ip);
    return await UploadController.directUpload(req);
  }

  if (req.method === "POST" && routePath.length === 1 && routePath[0] === "scrape-url") {
    await checkOrderRateLimit(ip);
    return await UploadController.scrapeUrl(req);
  }

  if (req.method === "POST" && routePath.length === 1 && routePath[0] === "import-from-url") {
    await checkOrderRateLimit(ip);
    return await UploadController.importFromUrl(req);
  }

  if (req.method === "GET" && routePath.length === 1 && routePath[0] === "preview-proxy") {
    return await UploadController.proxyPreview(req);
  }

  return null;
}
