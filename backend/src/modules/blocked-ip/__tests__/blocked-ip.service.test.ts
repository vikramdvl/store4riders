import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { BlockedIpService } from "../blocked-ip.service";
import { BlockedIpRepository } from "../blocked-ip.repository";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { UserRepository } from "../../user/user.repository";

const cacheStore = new Map<string, string>();

vi.mock("../../../core/cache/redis", () => ({
  getCache: vi.fn(async (key: string) => cacheStore.get(key) ?? null),
  setCache: vi.fn(async (key: string, val: string) => {
    cacheStore.set(key, val);
  }),
  deleteCache: vi.fn(async (key: string) => {
    cacheStore.delete(key);
  }),
}));

vi.mock("../blocked-ip.repository", () => ({
  BlockedIpRepository: {
    findActiveByIp: vi.fn(),
    findAllActive: vi.fn(),
    upsertBlock: vi.fn(),
    deleteByIpOrId: vi.fn(),
  },
}));

vi.mock("../../audit-log/audit-log.service", () => ({
  AuditLogService: {
    record: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../user/user.repository", () => ({
  UserRepository: {
    findById: vi.fn(),
  },
}));

describe("BlockedIpService", () => {
  beforeEach(() => {
    cacheStore.clear();
    vi.clearAllMocks();
  });

  it("never queries DB for loopback IPs", async () => {
    expect(await BlockedIpService.isIpBlocked("127.0.0.1")).toBe(false);
    expect(await BlockedIpService.isIpBlocked("::1")).toBe(false);
    expect(BlockedIpRepository.findActiveByIp).not.toHaveBeenCalled();
  });

  it("prevents blocking loopback or the admin's own current IP", async () => {
    const req = new NextRequest("http://localhost:4000/api/v1/admin/blocked-ips", {
      headers: { "x-forwarded-for": "203.0.113.42" },
    });

    await expect(
      BlockedIpService.blockIp({ ip: "127.0.0.1", reason: "test", durationHours: 24 }, "admin_1", req)
    ).rejects.toThrow("Loopback IP addresses cannot be blocked");

    await expect(
      BlockedIpService.blockIp({ ip: "203.0.113.42", reason: "test", durationHours: 24 }, "admin_1", req)
    ).rejects.toThrow("You cannot block your own current IP address");
  });

  it("blocks an attacking IP, updates cache immediately, and unblocks cleanly", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue({
      _id: "admin_1",
      email: "owner@store4riders.com",
      firstName: "Vikram",
      lastName: "Admin",
    } as any);

    vi.mocked(BlockedIpRepository.upsertBlock).mockResolvedValue({
      ip: "198.51.100.77",
      reason: "Brute force",
      blockedBy: { userId: "admin_1", email: "owner@store4riders.com" },
      expiresAt: null,
      createdAt: new Date(),
    } as any);

    const req = new NextRequest("http://localhost:4000/api/v1/admin/blocked-ips", {
      headers: { "x-forwarded-for": "203.0.113.42" },
    });

    await BlockedIpService.blockIp(
      { ip: "198.51.100.77", reason: "Brute force", durationHours: null },
      "admin_1",
      req
    );

    expect(await BlockedIpService.isIpBlocked("198.51.100.77")).toBe(true);
    expect(BlockedIpRepository.findActiveByIp).not.toHaveBeenCalled();
    expect(AuditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "IP_BLOCKED" })
    );

    vi.mocked(BlockedIpRepository.deleteByIpOrId).mockResolvedValue({
      ip: "198.51.100.77",
      reason: "Brute force",
    } as any);

    await BlockedIpService.unblockIp("198.51.100.77", "admin_1", req);
    expect(await BlockedIpService.isIpBlocked("198.51.100.77")).toBe(false);
    expect(AuditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "IP_UNBLOCKED" })
    );
  });
});
