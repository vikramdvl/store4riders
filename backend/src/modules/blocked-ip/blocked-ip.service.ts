import { NextRequest } from "next/server";
import { IBlockedIp, IBlockedIpActor } from "@store4riders/shared-types";
import { BlockIpInput } from "@store4riders/shared-validation";
import { BlockedIpRepository } from "./blocked-ip.repository";
import { getCache, setCache, deleteCache } from "../../core/cache/redis";
import { NotFoundError, ValidationError } from "../../core/errors/AppError";
import { UserRepository } from "../user/user.repository";
import { AuditLogService } from "../audit-log/audit-log.service";

const LOOPBACK_IPS = new Set(["127.0.0.1", "::1", "localhost", "::ffff:127.0.0.1"]);

const cacheKeyForIp = (ip: string) => `ip_block_${ip}`;

/**
 * @class BlockedIpService
 * @description Manages IP blocking/unblocking with sub-millisecond cache lookup and MongoDB persistence.
 */
export class BlockedIpService {
  static extractClientIp(req?: NextRequest): string {
    if (!req) return "127.0.0.1";
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || req.headers.get("x-real-ip")?.trim() || "127.0.0.1";
  }

  static async isIpBlocked(ip: string): Promise<boolean> {
    if (!ip || LOOPBACK_IPS.has(ip)) return false;

    const key = cacheKeyForIp(ip);
    try {
      const cached = await getCache(key);
      if (cached === "1") return true;
      if (cached === "0") return false;
    } catch {
      // Fallback to repository on cache read error
    }

    try {
      const record = await BlockedIpRepository.findActiveByIp(ip);
      if (record) {
        let ttlSeconds = 3600;
        if (record.expiresAt) {
          const remaining = Math.ceil((new Date(record.expiresAt).getTime() - Date.now()) / 1000);
          if (remaining <= 0) {
            await setCache(key, "0", 300);
            return false;
          }
          ttlSeconds = Math.min(remaining, 3600);
        }
        await setCache(key, "1", ttlSeconds);
        return true;
      }

      await setCache(key, "0", 300);
      return false;
    } catch {
      return false;
    }
  }

  static async listBlockedIps(): Promise<IBlockedIp[]> {
    return BlockedIpRepository.findAllActive();
  }

  static async blockIp(input: BlockIpInput, actorUserId: string, req?: NextRequest): Promise<IBlockedIp> {
    const targetIp = input.ip.trim();

    if (LOOPBACK_IPS.has(targetIp)) {
      throw new ValidationError("Loopback IP addresses cannot be blocked");
    }

    const callerIp = this.extractClientIp(req);
    if (req && callerIp === targetIp) {
      throw new ValidationError("You cannot block your own current IP address");
    }

    let blockedBy: IBlockedIpActor = { userId: actorUserId };
    const actor = await UserRepository.findById(actorUserId);
    if (actor) {
      blockedBy = {
        userId: actorUserId,
        email: actor.email,
        name: `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || actor.email,
      };
    }

    const durationHours = input.durationHours ?? 24;
    const expiresAt =
      durationHours === null ? null : new Date(Date.now() + durationHours * 60 * 60 * 1000);

    const record = await BlockedIpRepository.upsertBlock({
      ip: targetIp,
      reason: input.reason.trim(),
      blockedBy,
      expiresAt,
    });

    const ttlSeconds = durationHours === null ? 3600 : Math.min(durationHours * 3600, 3600);
    await setCache(cacheKeyForIp(targetIp), "1", ttlSeconds);

    await AuditLogService.record({
      category: "AUTH",
      action: "IP_BLOCKED",
      severity: "critical",
      status: "success",
      actorUserId,
      resource: { type: "BlockedIP", id: targetIp, label: targetIp },
      changes: {
        after: {
          ip: targetIp,
          reason: input.reason.trim(),
          duration: durationHours === null ? "permanent" : `${durationHours}h`,
        },
      },
      req,
      message: `Blocked IP ${targetIp} (${durationHours === null ? "Permanent" : `${durationHours}h`}): ${input.reason.trim()}`,
    });

    return record;
  }

  static async unblockIp(ipOrId: string, actorUserId: string, req?: NextRequest): Promise<{ ip: string }> {
    const cleanTarget = decodeURIComponent(ipOrId || "").trim();
    if (!cleanTarget) {
      throw new ValidationError("IP address or block ID is required");
    }

    const deleted = await BlockedIpRepository.deleteByIpOrId(cleanTarget);
    if (!deleted) {
      throw new NotFoundError("Blocked IP record");
    }

    await deleteCache(cacheKeyForIp(deleted.ip));
    await setCache(cacheKeyForIp(deleted.ip), "0", 300);

    await AuditLogService.record({
      category: "AUTH",
      action: "IP_UNBLOCKED",
      severity: "warning",
      status: "success",
      actorUserId,
      resource: { type: "BlockedIP", id: deleted.ip, label: deleted.ip },
      changes: { before: { ip: deleted.ip, reason: deleted.reason } },
      req,
      message: `Unblocked IP ${deleted.ip}`,
    });

    return { ip: deleted.ip };
  }
}
