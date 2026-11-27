/**
 * @file rateLimit.config.ts
 * @description Centralized Rate Limiting Configuration for Store4Riders Backend.
 * 
 * 💡 For Future Developers:
 * To adjust limits or add new rate limit tiers, simply modify or add to this configuration object.
 * No need to modify route or middleware boilerplate code!
 */

export interface RateLimitRule {
  /** Unique key prefix in Redis */
  keyPrefix: string;
  /** Number of requests allowed within duration */
  points: number;
  /** Time window in seconds */
  duration: number;
  /** Optional cooldown duration if limit is exceeded (in seconds) */
  blockDuration?: number;
  /** User-friendly error message returned with HTTP 429 */
  errorMessage: string;
}

export const RATE_LIMIT_CONFIG = {
  /**
   * 1. Customer Authentication Limiter (OWASP Standard)
   * Protects: /api/v1/auth/login, /api/v1/auth/register, /api/v1/auth/forgot-password
   * Purpose: Prevents credential stuffing, dictionary brute-force, and account enumeration.
   */
  AUTH: {
    keyPrefix: process.env.NODE_ENV === "development" ? "rl_auth_dev" : "rl_auth",
    points: process.env.NODE_ENV === "development" ? 100 : 5,  // 5 attempts in prod (Strict OWASP standard), 100 in dev
    duration: 15 * 60,       // per 15 minutes
    blockDuration: 15 * 60,  // Block IP for 15 minutes if exceeded
    errorMessage: "Too many login/registration attempts from this IP. Please try again after 15 minutes.",
  },

  /**
   * 1.1 Dedicated Admin Authentication Limiter
   * Protects: /api/v1/auth/login?scope=admin
   * Purpose: Prevents brute-force while allowing admin safe margin (8 attempts per 15 mins)
   */
  ADMIN_AUTH: {
    keyPrefix: process.env.NODE_ENV === "development" ? "rl_admin_auth_dev" : "rl_admin_auth",
    points: process.env.NODE_ENV === "development" ? 100 : 8,  // 8 attempts for staff/admin in prod
    duration: 15 * 60,       // per 15 minutes
    blockDuration: 15 * 60,  // Block IP for 15 minutes if exceeded
    errorMessage: "Too many admin login attempts from this IP. Please try again after 15 minutes.",
  },

  /**
   * 1.2 Registration Email OTP Limiter
   * Protects: /api/v1/auth/send-register-otp
   * Purpose: Prevents email bombing while allowing legitimate users retries/resends.
   */
  REGISTER_OTP: {
    keyPrefix: process.env.NODE_ENV === "development" ? "rl_reg_otp_dev" : "rl_reg_otp",
    points: process.env.NODE_ENV === "development" ? 100 : 10, // 10 OTP sends per 15 mins per IP in prod
    duration: 15 * 60,       // per 15 minutes
    blockDuration: 15 * 60,  // Block IP for 15 minutes if exceeded
    errorMessage: "Too many verification code requests from this IP. Please try again after 15 minutes.",
  },

  /**
   * 1.3 Checkout Email Lookup Limiter
   * Protects: /api/v1/auth/check-email
   * Purpose: Prevents mass email enumeration/scraping while allowing normal checkout flow.
   */
  CHECK_EMAIL: {
    keyPrefix: process.env.NODE_ENV === "development" ? "rl_check_email_dev" : "rl_check_email",
    points: process.env.NODE_ENV === "development" ? 100 : 20, // 20 checks per 15 mins per IP in prod
    duration: 15 * 60,       // per 15 minutes
    blockDuration: 15 * 60,
    errorMessage: "Too many email verification checks from this IP. Please try again later.",
  },

  /**
   * 2. Checkout & Order Creation Limiter
   * Protects: /api/v1/order (POST)
   * Purpose: Prevents card-testing attacks, coupon spamming, and inventory exhaustion bots.
   */
  ORDER: {
    keyPrefix: "rl_order",
    points: 10,              // 10 order creation requests
    duration: 60,            // per 1 minute (60 seconds)
    errorMessage: "Too many checkout attempts. Please wait a moment before trying again.",
  },

  /**
   * 3. S3 Media Upload Limiter
   * Protects: /api/v1/upload/presigned-url (POST)
   * Purpose: Prevents malicious storage flooding and excessive S3 presigned URL generation.
   */
  UPLOAD: {
    keyPrefix: "rl_upload",
    points: 10,              // 10 image uploads
    duration: 60,            // per 1 minute (60 seconds)
    errorMessage: "Upload rate limit exceeded. Please wait a moment before uploading more images.",
  },

  /**
   * 4. Global Baseline API Limiter
   * Protects: ALL endpoints (/api/v1/products, /api/v1/categories, /api/v1/reviews, /api/v1/search)
   * Purpose: Prevents web scrapers, bot storms, and Layer-7 DDoS attacks while allowing real users fast browsing.
   */
  GENERAL_API: {
    keyPrefix: "rl_general",
    points: 120,             // 120 requests
    duration: 60,            // per 1 minute (60 seconds)
    errorMessage: "Rate limit exceeded. Please slow down your requests.",
  },

  /**
   * 5. Shipping Serviceability Limiter
   * Protects: POST /api/v1/shipments/serviceability
   * Purpose: Prevents abuse of third-party courier serviceability APIs.
   */
  SHIPPING_SERVICEABILITY: {
    keyPrefix: "rl_ship_svc",
    points: 10,              // 10 requests
    duration: 60,            // per 1 minute (60 seconds)
    errorMessage: "Too many serviceability checks. Please wait a moment before trying again.",
  },

  /**
   * 6. Shipping Rates Limiter
   * Protects: POST /api/v1/shipments/rates
   * Purpose: Prevents excessive rate comparison calls hitting all 3 courier APIs.
   */
  SHIPPING_RATES: {
    keyPrefix: "rl_ship_rates",
    points: 5,               // 5 requests
    duration: 60,            // per 1 minute (60 seconds)
    errorMessage: "Too many rate comparison requests. Please wait a moment before trying again.",
  },

  /**
   * 7. Product Review Limiter
   * Protects: POST /api/v1/reviews
   * Purpose: Prevents automated bot spamming, fake review flooding, and Layer-7 DDoS on reviews.
   */
  REVIEW: {
    keyPrefix: "rl_review",
    points: 5,               // 5 reviews allowed
    duration: 15 * 60,       // per 15 minutes
    blockDuration: 30 * 60,  // Cooldown block for 30 minutes if exceeded
    errorMessage: "Too many review submissions from your IP. Please try again after 15 minutes.",
  },

  /**
   * 8. Payment Verification / S2S Sync Limiter
   * Protects: POST /api/v1/orders/sync-payment & POST /api/v1/orders/verify
   * Purpose: Allows genuine progressive polling + manual re-checks while preventing enumeration flooding.
   */
  PAYMENT_SYNC: {
    keyPrefix: "rl_pay_sync",
    points: 45,              // generous enough for multi-attempt polling + reconnect retries
    duration: 60,            // per 1 minute
    errorMessage: "Too many payment status checks. Please wait a few seconds before trying again.",
  },
} as const;

export type RateLimitTier = keyof typeof RATE_LIMIT_CONFIG;
