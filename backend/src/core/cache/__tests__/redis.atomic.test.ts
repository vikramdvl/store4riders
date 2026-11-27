import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setCache,
  getCache,
  deleteCache,
  setCacheIfAbsent,
  incrementCacheCounter,
  consumeCacheOnce,
} from "../redis";

describe("Redis Cache Atomic Primitives (In-Memory Fallback)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T12:00:00Z"));
  });

  afterEach(async () => {
    await deleteCache("test_nx_key");
    await deleteCache("test_incr_key");
    await deleteCache("test_consume_key");
    vi.useRealTimers();
  });

  it("setCacheIfAbsent grants lock to only one concurrent caller and releases after TTL", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, idx) => setCacheIfAbsent("test_nx_key", { idx }, 60))
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((r) => !r)).toHaveLength(11);

    // Still locked before TTL expires
    vi.advanceTimersByTime(59_000);
    expect(await setCacheIfAbsent("test_nx_key", { retry: true }, 60)).toBe(false);

    // Releases cleanly after TTL expires
    vi.advanceTimersByTime(2_000);
    expect(await setCacheIfAbsent("test_nx_key", { retry: true }, 60)).toBe(true);
  });

  it("incrementCacheCounter counts strictly monotonically under concurrent calls and resets after TTL", async () => {
    const counts = await Promise.all(
      Array.from({ length: 20 }, () => incrementCacheCounter("test_incr_key", 30))
    );

    const sorted = [...counts].sort((a, b) => a - b);
    expect(sorted).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));

    vi.advanceTimersByTime(31_000);
    expect(await incrementCacheCounter("test_incr_key", 30)).toBe(1);
  });

  it("consumeCacheOnce yields stored value strictly once under concurrent calls and ignores expired keys", async () => {
    await setCache("test_consume_key", { otpHash: "abc123" }, 60);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => consumeCacheOnce("test_consume_key"))
    );

    const hits = results.filter((r) => r !== null);
    expect(hits).toEqual([{ otpHash: "abc123" }]);
    expect(await getCache("test_consume_key")).toBeNull();

    // Expired key should return null on consume
    await setCache("test_consume_key", { otpHash: "expired" }, 10);
    vi.advanceTimersByTime(11_000);
    expect(await consumeCacheOnce("test_consume_key")).toBeNull();
  });
});
