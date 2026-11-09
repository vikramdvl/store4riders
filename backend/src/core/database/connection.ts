import mongoose from "mongoose";
import dns from "node:dns";
import { logger } from "../utils/logger";

// Export transaction helpers
export { supportsTransactions, withTransactionSafe } from "./transaction";

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

// Ensure IPv4 is prioritized in dual-stack environments
try {
  if (typeof (dns as any).setDefaultResultOrder === "function") {
    (dns as any).setDefaultResultOrder("ipv4first");
  }
} catch {
  // Ignore
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

/**
 * Connects to MongoDB using a cached connection if available.
 * This prevents creating multiple connections during Next.js hot reloads.
 * Strictly connects to the URI defined in process.env.MONGODB_URI or process.env.DATABASE_URL.
 */
export async function connectToDatabase() {
  const uri = (process.env.MONGODB_URI || process.env.DATABASE_URL || "").trim();
  if (!uri) {
    if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") {
      logger.warn("MONGODB_URI is not defined. Skipping DB connection for static build phase.");
      return null;
    }
    throw new Error("Please define the MONGODB_URI environment variable inside .env");
  }

  // Only apply public DNS servers for mongodb+srv:// if in local development, NEVER in serverless
  if (!isServerless && uri.startsWith("mongodb+srv://")) {
    try {
      dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
    } catch {
      // Ignore if restricted
    }
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 20,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    logger.info("Connecting to MongoDB...");
    cached.promise = mongoose.connect(uri, opts).then(async (mongooseInstance) => {
      logger.info("Successfully connected to MongoDB");
      
      // Initialize Background Workers and Cron Jobs ONLY on dedicated Node.js server (VPS / Docker / PM2),
      // NEVER inside Serverless environments (like Vercel functions) or test suites.
      if (process.env.NODE_ENV !== "test" && !isServerless) {
        try {
          const { initCronJobs } = await import("../cron/order.cron");
          await import("../queue/email.worker");
          await import("../queue/migration.worker");
          initCronJobs();
          logger.info("Enterprise Background Workers and Cron Jobs successfully initialized!");
        } catch (workerErr) {
          logger.error(workerErr, "Failed to initialize background workers");
        }
      }

      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e: any) {
    cached.promise = null;
    logger.error(e, "Error connecting to MongoDB");
    throw e;
  }

  return cached.conn;
}
