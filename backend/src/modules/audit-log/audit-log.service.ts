import { NextRequest } from "next/server";
import {
  AuditLogCategory,
  AuditLogSeverity,
  AuditLogStatus,
  IAuditLog,
  IAuditLogActor,
  IAuditLogChanges,
  IAuditLogContext,
  IAuditLogResource,
  IAuditLogStats,
} from "@store4riders/shared-types";
import { AuditLogQueryInput } from "@store4riders/shared-validation";
import { AuditLogRepository } from "./audit-log.repository";
import { UserRepository } from "../user/user.repository";
import { NotFoundError } from "../../core/errors/AppError";
import { logger } from "../../core/utils/logger";

const SENSITIVE_KEY_PATTERN =
  /(password|pass|token|secret|salt|workingkey|accesscode|apikey|api_key|authorization|cookie|privatekey|signature|hash)/i;

export interface RecordAuditLogInput {
  category: AuditLogCategory;
  action: string;
  severity?: AuditLogSeverity;
  status?: AuditLogStatus;
  actor?: IAuditLogActor;
  actorUserId?: string;
  resource: IAuditLogResource;
  changes?: IAuditLogChanges;
  context?: IAuditLogContext;
  req?: NextRequest;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Recursively masks sensitive keys so secrets, passwords, and tokens are never stored in audit logs.
 */
function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[TRUNCATED]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = sanitizeValue(val, depth + 1);
      }
    }
    return out;
  }
  if (typeof value === "string" && value.length > 2000) {
    return `${value.slice(0, 2000)}...`;
  }
  return value;
}

/**
 * @class AuditLogService
 * @description Business logic for recording and querying immutable security & operational audit logs.
 */
export class AuditLogService {
  static extractRequestContext(req?: NextRequest): IAuditLogContext {
    if (!req) return {};
    try {
      const forwardedFor = req.headers.get("x-forwarded-for");
      const ip =
        forwardedFor?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip")?.trim() ||
        "127.0.0.1";
      const userAgent = req.headers.get("user-agent") || undefined;
      const requestId = req.headers.get("x-request-id") || undefined;
      const path = req.nextUrl?.pathname || undefined;

      return {
        ip,
        userAgent,
        method: req.method,
        path,
        requestId,
      };
    } catch {
      return {};
    }
  }

  /**
   * Computes a concise shallow diff object containing only modified fields.
   */
  static computeFieldDiff(
    beforeObj: Record<string, any> | null | undefined,
    afterObj: Record<string, any> | null | undefined,
    candidateKeys?: string[]
  ): IAuditLogChanges | undefined {
    if (!beforeObj && !afterObj) return undefined;
    const before = beforeObj || {};
    const after = afterObj || {};
    const keys = candidateKeys || Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

    const diffBefore: Record<string, unknown> = {};
    const diffAfter: Record<string, unknown> = {};

    for (const key of keys) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        if (before[key] !== after[key]) {
          diffBefore[key] = "[REDACTED]";
          diffAfter[key] = "[REDACTED]";
        }
        continue;
      }

      const prevStr = JSON.stringify(before[key] ?? null);
      const nextStr = JSON.stringify(after[key] ?? null);
      if (prevStr !== nextStr) {
        diffBefore[key] = sanitizeValue(before[key]);
        diffAfter[key] = sanitizeValue(after[key]);
      }
    }

    if (Object.keys(diffBefore).length === 0 && Object.keys(diffAfter).length === 0) {
      return undefined;
    }

    return { before: diffBefore, after: diffAfter };
  }

  /**
   * Records an audit log entry safely without ever throwing or interrupting the primary request flow.
   */
  static async record(input: RecordAuditLogInput): Promise<void> {
    try {
      let resolvedActor: IAuditLogActor = { ...(input.actor || {}) };
      const lookupId = input.actorUserId || resolvedActor.userId;

      if (lookupId && (!resolvedActor.email || !resolvedActor.role)) {
        try {
          const user = await UserRepository.findById(lookupId);
          if (user) {
            resolvedActor = {
              userId: lookupId,
              email: resolvedActor.email || user.email,
              name:
                resolvedActor.name ||
                `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                user.email,
              role: resolvedActor.role || user.role || "customer",
            };
          }
        } catch {
          // Proceed with partial actor info if user lookup fails
        }
      }

      const requestContext = input.req ? this.extractRequestContext(input.req) : {};
      const mergedContext: IAuditLogContext = {
        ...requestContext,
        ...(input.context || {}),
      };

      const sanitizedChanges: IAuditLogChanges | undefined = input.changes
        ? {
            ...(input.changes.before
              ? { before: sanitizeValue(input.changes.before) as Record<string, unknown> }
              : {}),
            ...(input.changes.after
              ? { after: sanitizeValue(input.changes.after) as Record<string, unknown> }
              : {}),
          }
        : undefined;

      const sanitizedMetadata = input.metadata
        ? (sanitizeValue(input.metadata) as Record<string, unknown>)
        : undefined;

      await AuditLogRepository.create({
        category: input.category,
        action: input.action,
        severity: input.severity || "info",
        status: input.status || "success",
        actor: resolvedActor,
        resource: input.resource,
        ...(sanitizedChanges ? { changes: sanitizedChanges } : {}),
        context: mergedContext,
        message: input.message,
        ...(sanitizedMetadata ? { metadata: sanitizedMetadata } : {}),
      });
    } catch (err: any) {
      logger.error(`[AuditLogService] Failed to persist audit entry (${input.action}): ${err?.message || err}`);
    }
  }

  static async listLogs(filters: AuditLogQueryInput): Promise<{ items: IAuditLog[]; totalCount: number }> {
    return AuditLogRepository.findPaginated(filters);
  }

  static async getStats(): Promise<IAuditLogStats> {
    return AuditLogRepository.getLast24hStats();
  }

  static async getById(id: string): Promise<IAuditLog> {
    const entry = await AuditLogRepository.findById(id);
    if (!entry) {
      throw new NotFoundError("Audit log entry");
    }
    return entry;
  }
}
