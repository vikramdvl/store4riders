import IORedis from "ioredis";
import { ENV } from "../config/env";
import { logger } from "../utils/logger";

let sharedQueueConnection: IORedis | null = null;

/**
 * Returns a shared, resilient Redis connection for BullMQ Queues (producers).
 * Follows BullMQ and Redis industry best practices:
 * - maxRetriesPerRequest: null (BullMQ strict requirement)
 * - enableReadyCheck: false
 * - Reconnect backoff strategy to prevent hammering server
 * - Attached error handler to prevent crashing the server on transient drops
 */
export function getQueueRedisConnection(): IORedis {
  if (sharedQueueConnection) {
    return sharedQueueConnection;
  }

  const redisUrl = ENV.REDIS_URL;

  const redisOptions = {
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
    retryStrategy(times: number) {
      // Exponential backoff capped at 5 seconds
      return Math.min(times * 200, 5000);
    },
  };

  sharedQueueConnection = redisUrl
    ? new IORedis(redisUrl, redisOptions)
    : new IORedis(redisOptions);

  sharedQueueConnection.on("error", (err) => {
    // Log gracefully without crashing Next.js or worker threads
    logger.warn(`BullMQ Queue Redis connection warning: ${err.message || "Disconnected"}`);
  });

  sharedQueueConnection.on("connect", () => {
    logger.info("BullMQ Queue shared Redis connection established");
  });

  return sharedQueueConnection;
}

/**
 * Creates a dedicated Redis connection for BullMQ Workers (consumers).
 * BullMQ workers perform blocking operations (BRPOPLPUSH / BRPOP),
 * so each worker requires its own dedicated connection per industry standards.
 */
export function createWorkerRedisConnection(workerName: string): IORedis {
  const redisUrl = ENV.REDIS_URL;

  const redisOptions = {
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
    retryStrategy(times: number) {
      return Math.min(times * 200, 5000);
    },
  };

  const workerConnection = redisUrl
    ? new IORedis(redisUrl, redisOptions)
    : new IORedis(redisOptions);

  workerConnection.on("error", (err) => {
    logger.warn(`BullMQ Worker (${workerName}) Redis connection warning: ${err.message || "Disconnected"}`);
  });

  workerConnection.on("connect", () => {
    logger.info(`BullMQ Worker (${workerName}) Redis connection established`);
  });

  return workerConnection;
}
