/**
 * @file transaction.ts
 * @description Safe transaction runner with automatic standalone MongoDB fallback.
 * 
 * MongoDB transactions require a Replica Set (e.g. MongoDB Atlas) or a Sharded Cluster (mongos).
 * On standalone MongoDB instances (e.g. standard VPS / single-node mongod), starting a
 * transaction throws:
 * "MongoServerError: Transaction numbers are only allowed on a replica set member or mongos"
 * 
 * withTransactionSafe seamlessly executes inside a transaction on Replica Sets, while
 * gracefully falling back to non-transactional execution on standalone instances.
 */

import mongoose, { ClientSession } from "mongoose";
import { logger } from "../utils/logger";

let cachedTransactionSupport: boolean | null = null;

/**
 * Checks whether the active MongoDB connection supports multi-document transactions.
 */
export async function supportsTransactions(): Promise<boolean> {
  // Mocked mongoose in test suite always supports transactions
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return true;
  }

  if (cachedTransactionSupport !== null) {
    return cachedTransactionSupport;
  }

  try {
    const client = (mongoose.connection as any)?.client || (mongoose.connection?.getClient ? mongoose.connection.getClient() : null);
    const topology = client?.topology?.description;

    // Explicit standalone topology
    if (topology?.type === "Single" && !topology?.setName) {
      cachedTransactionSupport = false;
      return false;
    }

    // Explicit replica set or mongos
    if (topology?.setName || topology?.type === "ReplicaSetWithPrimary" || topology?.type === "Sharded") {
      cachedTransactionSupport = true;
      return true;
    }

    // If topology type is undetermined, probe with admin command
    if (mongoose.connection?.db) {
      const helloResult = await mongoose.connection.db.admin().command({ hello: 1 }).catch(() => null);
      if (helloResult) {
        const hasReplicaSet = Boolean(helloResult.setName || helloResult.hosts || helloResult.msg === "isdbgrid");
        cachedTransactionSupport = hasReplicaSet;
        return hasReplicaSet;
      }
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Safely executes a callback within a MongoDB transaction if replica set transactions are supported.
 * If running on a standalone MongoDB instance (where transactions throw "Transaction numbers are only
 * allowed on a replica set member or mongos"), gracefully executes the callback without a session.
 */
export async function withTransactionSafe<T>(
  operation: (session?: ClientSession) => Promise<T>
): Promise<T> {
  const canUseTransactions = await supportsTransactions();

  if (!canUseTransactions) {
    return operation(undefined);
  }

  let session: ClientSession | null = null;
  try {
    session = await mongoose.startSession();
  } catch (startErr: any) {
    logger.warn(`Could not start MongoDB session: ${startErr?.message}. Proceeding without transaction.`);
    return operation(undefined);
  }

  try {
    let result: T | undefined;
    await session.withTransaction(
      async () => {
        result = undefined;
        result = await operation(session!);
      },
      { maxCommitTimeMS: 10000 }
    );
    return result as T;
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (
      msg.includes("replica set member or mongos") ||
      msg.includes("Transaction numbers are only allowed") ||
      msg.includes("does not support retryable writes") ||
      msg.includes("enableMajorityReadConcern")
    ) {
      cachedTransactionSupport = false;
      logger.warn(`MongoDB reported transactions unsupported: "${msg}". Executing operation directly without transaction session.`);
      return operation(undefined);
    }
    throw err;
  } finally {
    try {
      await session.endSession();
    } catch {}
  }
}
