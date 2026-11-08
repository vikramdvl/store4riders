import { Queue } from "bullmq";
import { logger } from "../utils/logger";
import { getQueueRedisConnection } from "./redis-connection";

export const emailQueue = new Queue("emailQueue", {
  connection: getQueueRedisConnection(),
});

export async function addEmailJob(to: string, subject: string, html: string) {
  try {
    await emailQueue.add(
      "sendEmail",
      { to, subject, html },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      }
    );
    logger.info(`Email job added to queue for ${to}`);
  } catch (error) {
    logger.error("Failed to add email job to queue", error);
  }
}
