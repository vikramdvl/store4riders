import { Queue } from "bullmq";
import { logger } from "../utils/logger";
import { getQueueRedisConnection } from "./redis-connection";

export interface MigrationJobData {
  filePath?: string;
  s3Key?: string;
  fileName?: string;
  adminId: string;
}

export const migrationQueue = new Queue("migrationQueue", {
  connection: getQueueRedisConnection(),
});

export async function addMigrationJob(dataOrFilePath: string | MigrationJobData, maybeAdminId?: string) {
  try {
    const jobData: MigrationJobData = typeof dataOrFilePath === "string"
      ? { filePath: dataOrFilePath, adminId: maybeAdminId || "admin" }
      : dataOrFilePath;

    const job = await migrationQueue.add("migrateCSV", jobData, {
      attempts: 1, // We don't want to auto-retry massive imports on failure without user intervention
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    });
    logger.info(`Migration job added to queue with ID: ${job.id}`);
    return job;
  } catch (error) {
    logger.error("Failed to add migration job to queue", error);
    throw error;
  }
}

export async function getMigrationJob(jobId: string) {
  return await migrationQueue.getJob(jobId);
}
