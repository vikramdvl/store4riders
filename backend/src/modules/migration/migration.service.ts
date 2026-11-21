import { addMigrationJob, MigrationJobData } from "../../core/queue/migration.queue";
import { getMigrationPresignedUrl } from "../../core/storage/s3";
import { AppError } from "../../core/errors/AppError";

export class MigrationService {
  /**
   * Generates a pre-signed S3 upload URL for direct browser CSV upload
   */
  static async getPresignedUploadUrl(fileName: string, fileType = "text/csv") {
    if (!fileName) {
      throw new AppError("File name is required", 400);
    }
    if (!fileName.toLowerCase().endsWith(".csv")) {
      throw new AppError("Only CSV files are allowed", 400);
    }
    return await getMigrationPresignedUrl(fileName, fileType);
  }

  /**
   * Starts a background migration job for a given CSV file (via S3 or local path)
   */
  static async startCsvMigration(
    pathOrData: string | MigrationJobData,
    adminId?: string
  ) {
    let jobData: MigrationJobData;

    if (typeof pathOrData === "string") {
      jobData = { filePath: pathOrData, adminId: adminId || "admin" };
    } else {
      jobData = pathOrData;
    }

    if (!jobData.filePath && !jobData.s3Key) {
      throw new AppError("Either filePath or s3Key must be provided", 400);
    }

    // Add job to BullMQ
    const job = await addMigrationJob(jobData);

    return {
      jobId: job.id,
      message: "Migration job added successfully. Processing in background.",
    };
  }

  static async getJobStatus(jobId: string) {
    const { getMigrationJob } = await import("../../core/queue/migration.queue");
    const job = await getMigrationJob(jobId);
    
    if (!job) {
      throw new AppError("Job not found", 404);
    }
    
    const state = await job.getState();
    const progress = job.progress;
    
    return {
      jobId: job.id,
      state,
      progress,
      result: job.returnvalue || null,
      failedReason: job.failedReason || null
    };
  }
}
