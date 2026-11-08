import { Worker, Job } from "bullmq";
import { sendEmail } from "../email/ses";
import { logger } from "../utils/logger";
import { createWorkerRedisConnection } from "./redis-connection";

export const emailWorker = new Worker(
  "emailQueue",
  async (job: Job) => {
    const { to, subject, html } = job.data;
    logger.info(`Processing email job for ${to}...`);
    await sendEmail(to, subject, html);
  },
  {
    connection: createWorkerRedisConnection("emailWorker"),
  }
);

emailWorker.on("completed", (job: Job) => {
  logger.info(`Email job ${job.id} has completed successfully!`);
});

emailWorker.on("failed", (job: Job | undefined, err: Error) => {
  logger.error(`Email job ${job?.id} failed with reason: ${err.message}`);
});
