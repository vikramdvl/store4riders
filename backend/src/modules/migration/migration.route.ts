import { NextRequest } from "next/server";
import { MigrationController } from "./migration.controller";
import { checkAdmin } from "../../core/middlewares/admin";
import { extractUserFromAuth } from "../../core/middlewares/auth";

/**
 * @swagger
 * /api/v1/migration/presigned-url:
 *   post:
 *     summary: Generate direct S3 presigned URL for large CSV upload
 *     tags: [Migration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileName
 *             properties:
 *               fileName:
 *                 type: string
 *               fileType:
 *                 type: string
 *                 default: text/csv
 *     responses:
 *       200:
 *         description: Presigned URL generated successfully
 *
 * /api/v1/migration/start:
 *   post:
 *     summary: Start CSV migration job from S3 key
 *     tags: [Migration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - s3Key
 *             properties:
 *               s3Key:
 *                 type: string
 *               fileName:
 *                 type: string
 *     responses:
 *       202:
 *         description: Migration job started in background
 *
 * /api/v1/migration/upload:
 *   post:
 *     summary: Upload Magento CSV for migration (Multipart fallback)
 *     tags: [Migration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       202:
 *         description: Migration started in background
 */
import { UserService } from "../user/user.service";

export async function migrationRouter(req: NextRequest, routePath: string[]) {
  const method = req.method;
  const path = routePath.join("/");

  if (method === "POST" && path === "presigned-url") {
    const userId = extractUserFromAuth(req);
    await checkAdmin(userId, UserService.getRole);
    return MigrationController.getPresignedUrl(req);
  }

  if (method === "POST" && path === "start") {
    const userId = extractUserFromAuth(req);
    await checkAdmin(userId, UserService.getRole);
    return MigrationController.startMigration(req);
  }

  if (method === "POST" && path === "upload") {
    // Apply admin middleware
    const userId = extractUserFromAuth(req);
    await checkAdmin(userId, UserService.getRole);
    return MigrationController.uploadCsv(req);
  }

  if (method === "GET" && routePath[0] === "status" && routePath[1]) {
    const userId = extractUserFromAuth(req);
    await checkAdmin(userId, UserService.getRole);
    return MigrationController.getStatus(req, routePath[1]);
  }

  return null; // Route not found
}
