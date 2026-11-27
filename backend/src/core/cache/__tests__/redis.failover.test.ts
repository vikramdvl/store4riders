import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Redis Cache Failover When Redis Throws Mid-Request", () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    vi.resetModules();
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
  });

  afterEach(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
    vi.clearAllMocks();
  });

  it("falls back cleanly across setCache, getCache, setCacheIfAbsent, incrementCacheCounter, and consumeCacheOnce when Redis commands fail", async () => {
    const handlers: Record<string, (...args: any[]) => void> = {};

    vi.doMock("ioredis", () => ({
      default: vi.fn().mockImplementation(() => ({
        status: "ready",
        on: vi.fn((event: string, cb: (...args: any[]) => void) => {
          handlers[event] = cb;
        }),
        set: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
        get: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
        del: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
        incr: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
        multi: vi.fn(() => ({
          get: vi.fn().mockReturnThis(),
          del: vi.fn().mockReturnThis(),
          exec: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
        })),
      })),
    }));

    const redisMod = await import("../redis");

    // Simulate Redis initially marked ready, then dropping on command execution
    handlers.ready?.();

    await redisMod.setCache("reg_otp:test@example.com", { otpHash: "hash1" }, 600);
    expect(await redisMod.getCache("reg_otp:test@example.com")).toEqual({ otpHash: "hash1" });

    expect(await redisMod.setCacheIfAbsent("reg_otp_cd:test@example.com", { ok: true }, 60)).toBe(true);
    expect(await redisMod.setCacheIfAbsent("reg_otp_cd:test@example.com", { ok: true }, 60)).toBe(false);

    expect(await redisMod.incrementCacheCounter("reg_otp_att:test@example.com", 600)).toBe(1);
    expect(await redisMod.incrementCacheCounter("reg_otp_att:test@example.com", 600)).toBe(2);

    expect(await redisMod.consumeCacheOnce("reg_otp:test@example.com")).toEqual({ otpHash: "hash1" });
    expect(await redisMod.consumeCacheOnce("reg_otp:test@example.com")).toBeNull();
  });
});
