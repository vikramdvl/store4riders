/**
 * @file rateLimiter.ts
 * @description Rate limiting middleware powered by Redis and rate-limiter-flexible.
 * Uses centralized configuration from rateLimit.config.ts.
 */

import { RateLimiterRedis, RateLimiterMemory } from "rate-limiter-flexible";
import { redisClient } from "../cache/redis";
import { AppError } from "../errors/AppError";
import { RATE_LIMIT_CONFIG, RateLimitTier, RateLimitRule } from "../config/rateLimit.config";
import { logger } from "../utils/logger";

// Store instances of RateLimiterRedis keyed by tier name
const limiterInstances = new Map<string, RateLimiterRedis>();
const memoryLimiterInstances = new Map<string, RateLimiterMemory>();

/**
 * Helper to initialize or retrieve a RateLimiterRedis instance for a given rule
 */
function getLimiter(rule: RateLimitRule): RateLimiterRedis | null {
  if (!redisClient || redisClient.status !== "ready") return null;

  if (!limiterInstances.has(rule.keyPrefix)) {
    limiterInstances.set(
      rule.keyPrefix,
      new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: rule.keyPrefix,
        points: rule.points,
        duration: rule.duration,
        blockDuration: rule.blockDuration,
      })
    );
  }

  return limiterInstances.get(rule.keyPrefix) || null;
}

/**
 * Helper to initialize or retrieve a RateLimiterMemory instance for fallback
 */
function getMemoryLimiter(rule: RateLimitRule): RateLimiterMemory {
  if (!memoryLimiterInstances.has(rule.keyPrefix)) {
    memoryLimiterInstances.set(
      rule.keyPrefix,
      new RateLimiterMemory({
        keyPrefix: rule.keyPrefix,
        points: rule.points,
        duration: rule.duration,
        blockDuration: rule.blockDuration,
      })
    );
  }
  return memoryLimiterInstances.get(rule.keyPrefix)!;
}

/**
 * Generic Rate Limit Consumer
 * Consumes points for an IP and throws AppError (HTTP 429) if exceeded.
 */
export async function consumeRateLimit(rule: RateLimitRule, ip: string): Promise<void> {
  const limiter = getLimiter(rule);

  try {
    if (limiter) {
      await limiter.consume(ip);
    } else {
      await getMemoryLimiter(rule).consume(ip);
    }
  } catch (rejRes) {
    if (rejRes instanceof Error) {
      logger.warn(`Rate limiter Redis error: ${rejRes.message}. Falling back to memory limiter for IP ${ip}.`);
      try {
        await getMemoryLimiter(rule).consume(ip);
      } catch (memRej) {
        throw new AppError(rule.errorMessage, 429);
      }
      return;
    }
    throw new AppError(rule.errorMessage, 429);
  }
}

// =============================================================================
// Exported Tiered Helpers for Easy Import Across Routes
// =============================================================================

/**
 * 🔐 Customer Auth Rate Limiter (OWASP Standard)
 * 5 attempts per 15 minutes. Use on /auth/login, /auth/register
 */
export const checkAuthRateLimit = async (ip: string) => {
  await consumeRateLimit(RATE_LIMIT_CONFIG.AUTH, ip);
};

// Backward compatibility alias
export const checkRateLimit = checkAuthRateLimit;

/**
 * 👑 Admin Auth Rate Limiter
 * 8 attempts per 15 minutes. Use on Admin Portal Login
 */
export const checkAdminAuthRateLimit = async (ip: string) => {
  await consumeRateLimit(RATE_LIMIT_CONFIG.ADMIN_AUTH, ip);
};

/**
 * 📧 Registration Email OTP Rate Limiter
 * 10 requests per 15 minutes per IP in production.
 */
export const checkRegisterOtpRateLimit = async (ip: string) => {
  await consumeRateLimit(RATE_LIMIT_CONFIG.REGISTER_OTP, ip);
};

/**
 * 🔍 Checkout Email Lookup Rate Limiter
 * 20 requests per 15 minutes per IP in production.
 */
export const checkEmailRateLimit = async (ip: string) => {
  await consumeRateLimit(RATE_LIMIT_CONFIG.CHECK_EMAIL, ip);
};

/**
 * 💳 Order & Checkout Rate Limiter
 * 10 requests per minute. Use on /order (POST)
 */
export const checkOrderRateLimit = async (ip: string) => {
  await consumeRateLimit(RATE_LIMIT_CONFIG.ORDER, ip);
};

/**
 * ☁️ Media Upload Rate Limiter
 * 10 uploads per minute. Use on /upload/presigned-url (POST)
 */
export const checkUploadRateLimit = async (ip: string) => {
  await consumeRateLimit(RATE_LIMIT_CONFIG.UPLOAD, ip);
};

/**
 * 🌐 Global Baseline API Rate Limiter
 * 120 requests per minute. Applied globally to all API routes.
 */
export const checkGeneralApiRateLimit = async (ip: string) => {
  await consumeRateLimit(RATE_LIMIT_CONFIG.GENERAL_API, ip);
};

/**
 * ⭐️ Product Review Limiter
 * 5 reviews per 15 minutes. Use on /reviews (POST)
 */
export const checkReviewRateLimit = async (ip: string) => {
  await consumeRateLimit(RATE_LIMIT_CONFIG.REVIEW, ip);
};

/**
 * 💳 Payment Verification / S2S Sync Rate Limiter
 * 45 requests per minute per IP. Use on /orders/sync-payment and /orders/verify
 */
export const checkPaymentSyncRateLimit = async (ip: string) => {
  await consumeRateLimit(RATE_LIMIT_CONFIG.PAYMENT_SYNC, ip);
};

/**
 * 🛠️ Dynamic Rate Limit Checker by Tier Name
 * Allows checking any tier dynamically: e.g. checkTierRateLimit("AUTH", ip)
 */
export const checkTierRateLimit = async (tier: RateLimitTier, ip: string) => {
  const rule = RATE_LIMIT_CONFIG[tier];
  if (rule) {
    await consumeRateLimit(rule, ip);
  }
};
