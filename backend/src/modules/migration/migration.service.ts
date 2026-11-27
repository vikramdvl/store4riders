import { addMigrationJob, MigrationJobData } from "../../core/queue/migration.queue";
import { getMigrationPresignedUrl, getS3Stream } from "../../core/storage/s3";
import { AppError } from "../../core/errors/AppError";
import csv from "csv-parser";
import { Readable } from "stream";
import { ProductRepository } from "../product/product.repository";
import {
  buildCsvMigrationPreview,
  createCsvImageUrlFormatter,
  getCsvColumnValue,
  ICsvMigrationPreviewReport,
} from "../../core/utils/csvMigrationHelper";

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

  private static clearedCompletedJobs = new Set<string>();

  static async getJobStatus(jobId: string) {
    const { getMigrationJob } = await import("../../core/queue/migration.queue");
    const job = await getMigrationJob(jobId);
    
    if (!job) {
      throw new AppError("Job not found", 404);
    }
    
    const state = await job.getState();
    const progress = job.progress;

    if (state === "completed" && !MigrationService.clearedCompletedJobs.has(String(job.id))) {
      MigrationService.clearedCompletedJobs.add(String(job.id));
      try {
        const { clearProductCaches } = await import("../../core/cache/redis");
        await clearProductCaches();
      } catch {
        // Non-blocking cache eviction in API process
      }
    }
    
    return {
      jobId: job.id,
      state,
      progress,
      result: job.returnvalue || null,
      failedReason: job.failedReason || null
    };
  }

  /**
   * Parses and validates a CSV file in dry-run mode against existing MongoDB products
   * without mutating any data, returning exact creations, updates, variant patches, and skips.
   */
  static async previewCsvMigration(source: {
    buffer?: Buffer;
    s3Key?: string;
  }): Promise<ICsvMigrationPreviewReport> {
    let stream: NodeJS.ReadableStream;

    if (source.buffer) {
      if (source.buffer.length === 0) {
        throw new AppError("Uploaded CSV file is empty", 400);
      }
      stream = Readable.from(source.buffer);
    } else if (source.s3Key) {
      if (!source.s3Key.startsWith("migrations/") || source.s3Key.includes("..")) {
        throw new AppError("Invalid migration S3 key", 400);
      }
      stream = await getS3Stream(source.s3Key);
    } else {
      throw new AppError("Either CSV file or s3Key must be provided", 400);
    }

    let detectedHeaders: string[] = [];
    const allRows: Record<string, any>[] = [];

    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(
          csv({
            mapHeaders: ({ header }) => header.trim().replace(/^\ufeff/, ""),
          })
        )
        .on("headers", (headers: string[]) => {
          detectedHeaders = headers.filter((h) => Boolean(h && h.trim().length > 0));
        })
        .on("data", (row: Record<string, any>) => {
          const hasAnyValue = Object.values(row).some(
            (v) => v !== undefined && v !== null && String(v).trim() !== ""
          );
          if (hasAnyValue) {
            allRows.push(row);
          }
        })
        .on("end", resolve)
        .on("error", reject);
    });

    if (detectedHeaders.length === 0 && allRows.length > 0) {
      detectedHeaders = Object.keys(allRows[0]).filter((h) => Boolean(h && h.trim().length > 0));
    }

    if (allRows.length === 0) {
      throw new AppError("CSV file contains no data rows", 400);
    }

    const candidateSkus = new Set<string>();
    for (const row of allRows) {
      const sku = getCsvColumnValue(row, ["sku", "\ufeffsku"]);
      if (sku && sku.toLowerCase() !== "sku") candidateSkus.add(sku);
      const oldSku = getCsvColumnValue(row, ["old_sku", "oldsku"]);
      if (oldSku) candidateSkus.add(oldSku);
      const parentSku = getCsvColumnValue(row, ["parent_sku", "parentsku"]);
      if (parentSku) candidateSkus.add(parentSku);
      const variationsStr = getCsvColumnValue(row, ["configurable_variations"]);
      if (variationsStr) {
        if (variationsStr.includes("sku=")) {
          const matches = variationsStr.match(/sku=([^,|]+)/g);
          matches?.forEach((m) => {
            const childSku = m.split("=")[1]?.trim();
            if (childSku) candidateSkus.add(childSku);
          });
        } else {
          variationsStr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((childSku) => candidateSkus.add(childSku));
        }
      }
    }

    const { existingRoots, existingVariantParents } =
      await ProductRepository.findMigrationPreviewCandidates(Array.from(candidateSkus));

    return buildCsvMigrationPreview({
      allRows,
      headers: detectedHeaders,
      existingRoots,
      existingVariantParents,
      formatImageUrl: createCsvImageUrlFormatter(),
    });
  }
}
