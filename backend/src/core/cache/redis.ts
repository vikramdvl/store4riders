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

    redisClient.on("connect", () => {
      isRedisConnected = true;
      (globalThis as any).__hasLoggedRedisOffline = false;
      logger.info("Connected to Redis Cache Engine");
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
  // Always update memory cache for instant local speed
  setMemoryCache(key, value, ttlSeconds);

  if (redisClient && isRedisConnected) {
    try {
      await redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      // Ignore background redis error
    }
  }
};

/**
 * Gets a value from cache (Instant 0.1ms memory check first, then Redis).
 */
export const getCache = async (key: string): Promise<any | null> => {
  // 1. Fast Memory Cache lookup (0.1ms)
  const mem = memoryCache.get(key);
  if (mem) {
    if (Date.now() < mem.expiry) {
      return mem.value;
    }
    memoryCache.delete(key);
  }

  // 2. Redis lookup
  if (redisClient && isRedisConnected) {
    try {
      const data = await redisClient.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        // Save to memory for subsequent instant lookups
        setMemoryCache(key, parsed, 60);
        return parsed;
      }
    } catch {
      return null;
    }
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
