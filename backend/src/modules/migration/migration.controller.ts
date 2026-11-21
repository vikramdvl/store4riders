import { NextRequest } from "next/server";
import { ApiResponse } from "../../core/response/ApiResponse";
import { MigrationService } from "./migration.service";
import { AppError } from "../../core/errors/AppError";
import fs from "fs";
import path from "path";
import os from "os";

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

    const adminId = req.headers.get("x-user-id") || "admin";
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
    const adminId = req.headers.get("x-user-id") || "admin";

    // Call service to add to queue
    const result = await MigrationService.startCsvMigration(filePath, adminId);

    return ApiResponse.success(result, "Migration started", 202);
  }

  static async getStatus(req: NextRequest, jobId: string) {
    if (!jobId) {
      throw new AppError("Job ID is required", 400);
    }
    const result = await MigrationService.getJobStatus(jobId);
    return ApiResponse.success(result, "Job status fetched");
  }
}
