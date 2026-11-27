import { NextRequest } from "next/server";
import { ApiResponse } from "../../core/response/ApiResponse";
import { MigrationService } from "./migration.service";
import { AppError } from "../../core/errors/AppError";
import { z } from "zod";
import fs from "fs";
import path from "path";
import os from "os";

const previewS3Schema = z.object({
  s3Key: z.string().trim().min(1, "s3Key is required").max(500),
  fileName: z.string().trim().max(260).optional(),
});

export class MigrationController {
  /**
   * Generates direct S3 pre-signed upload URL for large CSV files
   */
  static async getPresignedUrl(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const { fileName, fileType } = body;

    if (!fileName) {
      throw new AppError("fileName is required", 400);
    }

    const result = await MigrationService.getPresignedUploadUrl(fileName, fileType);
    return ApiResponse.success(result, "Presigned URL generated successfully", 200);
  }

  /**
   * Starts a background migration job from an S3 key
   */
  static async startMigration(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const { s3Key, fileName } = body;

    if (!s3Key) {
      throw new AppError("s3Key is required", 400);
    }

    const { extractAdminFromAuth } = await import("../../core/middlewares/auth");
    const adminId = extractAdminFromAuth(req);
    const result = await MigrationService.startCsvMigration({
      s3Key,
      fileName,
      adminId,
    });

    return ApiResponse.success(result, "Migration started in background", 202);
  }

  static async uploadCsv(req: NextRequest) {
    // We expect a multipart/form-data with a 'file' field
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      throw new AppError("No file uploaded", 400);
    }

    if (!file.name.endsWith(".csv")) {
      throw new AppError("Only CSV files are allowed", 400);
    }

    // Convert Web File to Node.js Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to a temporary file for the worker to read
    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, `migration-${Date.now()}-${file.name}`);
    fs.writeFileSync(filePath, buffer);

    // Extract user ID (Assuming extractUserFromAuth middleware sets headers or it's passed)
    const { extractAdminFromAuth } = await import("../../core/middlewares/auth");
    const adminId = extractAdminFromAuth(req);

    // Call service to add to queue
    const result = await MigrationService.startCsvMigration(filePath, adminId);

    return ApiResponse.success(result, "Migration started", 202);
  }

  static async previewCsv(req: NextRequest) {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        throw new AppError("No CSV file uploaded", 400);
      }
      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new AppError("Only CSV files are allowed", 400);
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const report = await MigrationService.previewCsvMigration({ buffer });
      return ApiResponse.success(report, "CSV preview generated successfully");
    }

    const rawBody = await req.json().catch(() => ({}));
    const { s3Key, fileName } = previewS3Schema.parse(rawBody);

    if (fileName && !fileName.toLowerCase().endsWith(".csv")) {
      throw new AppError("Only CSV files are allowed", 400);
    }

    const report = await MigrationService.previewCsvMigration({ s3Key });
    return ApiResponse.success(report, "CSV preview generated successfully");
  }

  static async getStatus(req: NextRequest, jobId: string) {
    if (!jobId) {
      throw new AppError("Job ID is required", 400);
    }
    const result = await MigrationService.getJobStatus(jobId);
    return ApiResponse.success(result, "Job status fetched");
  }
}
