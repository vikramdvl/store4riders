import Redis from "ioredis";
import { logger } from "../utils/logger";

const REDIS_URL = process.env.REDIS_URL;

let redisClient: Redis | null = null;
let isRedisConnected = false;

// Ultra-fast in-memory fallback cache with bounded TTL store
const MAX_MEMORY_CACHE_SIZE = 5000;
const memoryCache = new Map<string, { value: any; expiry: number }>();

const setMemoryCache = (key: string, value: any, ttlSeconds: number) => {
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
  } else if (memoryCache.size >= MAX_MEMORY_CACHE_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey !== undefined) {
      memoryCache.delete(oldestKey);
    }
  }
  memoryCache.set(key, {
    value,
    expiry: Date.now() + ttlSeconds * 1000,
  });
};

if (REDIS_URL) {
  try {
    redisClient = new Redis(REDIS_URL, {
      connectTimeout: 5000,       // 5s for reliable remote WAN connections
      commandTimeout: 2000,       // 2s per query over internet
      maxRetriesPerRequest: 1,    // Do not hang on failure
      enableOfflineQueue: false,  // CRITICAL: Do NOT hang API requests when Redis is disconnected!
      retryStrategy: (times) => Math.min(times * 1000, 5000), // Progressive reconnect attempt
    });

    redisClient.on("ready", () => {
      isRedisConnected = true;
      (globalThis as any).__hasLoggedRedisOffline = false;
      logger.info("Connected to Redis Cache Engine");
    });

    redisClient.on("close", () => {
      isRedisConnected = false;
    });

    redisClient.on("end", () => {
      isRedisConnected = false;
    });

    redisClient.on("error", (err) => {
      isRedisConnected = false;
      if (!(globalThis as any).__hasLoggedRedisOffline) {
        (globalThis as any).__hasLoggedRedisOffline = true;
        logger.warn(`Redis Offline / Unreachable (${err.message || "Connection refused"}). Using instant Memory Cache fallback.`);
      }
    });
  } catch (err) {
    isRedisConnected = false;
  }
} else {
  logger.info("No REDIS_URL provided. Using ultra-fast in-memory cache engine.");
}

/**
 * Sets a value in cache (Redis if available, otherwise memory).
 */
export const setCache = async (key: string, value: any, ttlSeconds: number = 3600) => {
  if (redisClient && isRedisConnected) {
    try {
      await redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
      return;
    } catch {
      isRedisConnected = false;
      // Fall back to in-memory cache only if Redis command fails
    }
  }
  setMemoryCache(key, value, ttlSeconds);
};

/**
 * Gets a value from cache (Redis first when connected so multi-process invalidations are instant;
 * in-memory fallback when Redis is unavailable).
 */
export const getCache = async <T = any>(key: string): Promise<T | null> => {
  if (redisClient && isRedisConnected) {
    try {
      const data = await redisClient.get(key);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch {
      isRedisConnected = false;
      // Fall back to in-memory cache if Redis command fails
    }
  }

  const mem = memoryCache.get(key);
  if (mem) {
    if (Date.now() < mem.expiry) {
      return mem.value;
    }
    memoryCache.delete(key);
  }

  return null;
};

/**
 * Deletes a key from cache.
 */
export const deleteCache = async (key: string) => {
  memoryCache.delete(key);
  if (redisClient && isRedisConnected) {
    try {
      await redisClient.del(key);
    } catch {
      // Ignore
    }
  }
};

/**
 * Atomically sets a cache key only if it does not already exist (NX).
 * Returns true if the lock/key was acquired, false if it already existed.
 */
export const setCacheIfAbsent = async (key: string, value: any, ttlSeconds: number = 60): Promise<boolean> => {
  if (redisClient && isRedisConnected) {
    try {
      const result = await redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds, "NX");
      return result === "OK";
    } catch {
      isRedisConnected = false;
      // Fall back to in-memory store if Redis command fails
    }
  }

  const existing = memoryCache.get(key);
  if (existing && Date.now() < existing.expiry) {
    return false;
  }
  setMemoryCache(key, value, ttlSeconds);
  return true;
};

/**
 * Atomically increments a counter in cache and ensures a TTL is applied.
 */
export const incrementCacheCounter = async (key: string, ttlSeconds: number): Promise<number> => {
  if (redisClient && isRedisConnected) {
    try {
      const next = await redisClient.incr(key);
      if (next === 1) {
        await redisClient.expire(key, ttlSeconds);
      } else {
        const ttl = await redisClient.ttl(key);
        if (ttl < 0) {
          await redisClient.expire(key, ttlSeconds);
        }
      }
      return next;
    } catch {
      isRedisConnected = false;
      // Fall back to in-memory store if Redis command fails
    }
  }

  const existing = memoryCache.get(key);
  if (existing && Date.now() < existing.expiry) {
    const next = Number(existing.value || 0) + 1;
    existing.value = next;
    return next;
  }
  setMemoryCache(key, 1, ttlSeconds);
  return 1;
};

/**
 * Atomically reads and deletes a cache key so it can only be consumed once.
 */
export const consumeCacheOnce = async <T = any>(key: string): Promise<T | null> => {
  if (redisClient && isRedisConnected) {
    try {
      const results = await redisClient.multi().get(key).del(key).exec();
      const raw = results?.[0]?.[1];
      if (typeof raw === "string") {
        return JSON.parse(raw) as T;
      }
      return null;
    } catch {
      isRedisConnected = false;
      // Fall back to in-memory cache if Redis command fails
    }
  }

  const mem = memoryCache.get(key);
  memoryCache.delete(key);
  if (mem && Date.now() < mem.expiry) {
    return mem.value as T;
  }
  return null;
};

export const clearProductCaches = async (preserveProductDetails: boolean = false) => {
  const keysToDelete: string[] = [];
  for (const key of memoryCache.keys()) {
    if (
      key.startsWith('products_') ||
      key.startsWith('aggs_') ||
      key.startsWith('cat_slug_') ||
      (!preserveProductDetails && key.startsWith('product_'))
    ) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(k => memoryCache.delete(k));

  if (redisClient && isRedisConnected) {
    try {
      const keys = await redisClient.keys('products_*');
      const slugKeys = preserveProductDetails ? [] : await redisClient.keys('product_*');
      const aggsKeys = await redisClient.keys('aggs_*');
      const catKeys = await redisClient.keys('cat_slug_*');
      const allKeys = [...keys, ...slugKeys, ...aggsKeys, ...catKeys];
      if (allKeys.length > 0) {
        await redisClient.del(...allKeys);
      }
    } catch {
      // Ignore
    }
  }
};

export const clearBlogCaches = async () => {
  const keysToDelete: string[] = [];
  for (const key of memoryCache.keys()) {
    if (key.startsWith("blog_")) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((k) => memoryCache.delete(k));

  if (redisClient && isRedisConnected) {
    try {
      const keys = await redisClient.keys("blog_*");
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch {
      // Ignore
    }
  }
};

export const clearBrandCaches = async () => {
  const keysToDelete: string[] = [];
  for (const key of memoryCache.keys()) {
    if (key.startsWith("brands_") || key.startsWith("brand_detail_")) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((k) => memoryCache.delete(k));

  if (redisClient && isRedisConnected) {
    try {
      const listKeys = await redisClient.keys("brands_*");
      const detailKeys = await redisClient.keys("brand_detail_*");
      const allKeys = [...listKeys, ...detailKeys];
      if (allKeys.length > 0) {
        await redisClient.del(...allKeys);
      }
    } catch {
      // Ignore
    }
  }
};

export const clearReviewCaches = async () => {
  const keysToDelete: string[] = [];
  for (const key of memoryCache.keys()) {
    if (key.startsWith("reviews_")) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((k) => memoryCache.delete(k));

  if (redisClient && isRedisConnected) {
    try {
      const keys = await redisClient.keys("reviews_*");
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch {
      // Ignore
    }
  }
};

export const clearUrlRedirectCaches = async () => {
  const keysToDelete: string[] = [];
  for (const key of memoryCache.keys()) {
    if (key.startsWith("url_redirect_")) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((k) => memoryCache.delete(k));

  if (redisClient && isRedisConnected) {
    try {
      const keys = await redisClient.keys("url_redirect_*");
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch {
      // Ignore
    }
  }
};

export { redisClient, isRedisConnected };
