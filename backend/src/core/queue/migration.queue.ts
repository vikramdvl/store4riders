import { Queue } from "bullmq";
import { logger } from "../utils/logger";
import { getQueueRedisConnection } from "./redis-connection";

export const migrationQueue = new Queue("migrationQueue", {
  connection: getQueueRedisConnection(),
});

export async function addMigrationJob(filePath: string, adminId: string) {
  try {
    const job = await migrationQueue.add("migrateCSV", { filePath, adminId }, {
      attempts: 1, // We don't want to auto-retry massive imports on failure without user intervention
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
