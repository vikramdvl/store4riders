/**
 * @file env.ts
 * @description Validates all required environment variables strictly at runtime.
 * Strict zero-mock enforcement: reads exclusively from process.env with zero hardcoded fallbacks.
 */
import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

// Ensure environment variables from .env and backend/.env are loaded reliably
const rootDir = process.cwd();
dotenv.config({ path: path.resolve(rootDir, ".env") });
dotenv.config({ path: path.resolve(rootDir, "backend", ".env") });
dotenv.config({ path: path.resolve(rootDir, "..", ".env") });
dotenv.config({ path: path.resolve(rootDir, "..", "backend", ".env") });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().optional(),
  FRONTEND_URL: z.string().min(1, "FRONTEND_URL is required"),
  API_URL: z.string().optional(),
  NEXT_PUBLIC_API_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PAYU_MERCHANT_KEY: z.string().optional(),
  PAYU_SALT: z.string().optional(),
  PAYU_MODE: z.enum(["test", "live"]).optional(),
  PAYU_WEBHOOK_ALLOWED_IPS: z.string().optional(),
  CCAVENUE_MERCHANT_ID: z.string().optional(),
  CCAVENUE_ACCESS_CODE: z.string().optional(),
  CCAVENUE_WORKING_KEY: z.string().optional(),
  CCAVENUE_MODE: z.enum(["test", "live"]).optional(),
  CCAVENUE_REDIRECT_URL: z.string().optional(),
  CCAVENUE_CANCEL_URL: z.string().optional(),
  CCAVENUE_WEBHOOK_ALLOWED_IPS: z.string().optional(),
  SNAPMINT_MERCHANT_ID: z.string().optional(),
  SNAPMINT_SECRET: z.string().optional(),
  SNAPMINT_MID: z.string().optional(),
  SNAPMINT_MODE: z.enum(["test", "live"]).optional(),
  SNAPMINT_MIN_ORDER_VALUE: z.string().optional(),
  SNAPMINT_WEBHOOK_ALLOWED_IPS: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  SES_ACCESS_KEY_ID: z.string().optional(),
  SES_SECRET_ACCESS_KEY: z.string().optional(),
  SES_REGION: z.string().optional(),
  SES_FROM_EMAIL: z.string().optional(),
  SHIPROCKET_EMAIL: z.string().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  SHIPROCKET_WEBHOOK_SECRET: z.string().optional(),
  DELHIVERY_API_KEY: z.string().optional(),
  DELHIVERY_WEBHOOK_TOKEN: z.string().optional(),
  XPRESSBEES_API_KEY: z.string().optional(),
  XPRESSBEES_WEBHOOK_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  SERPAPI_KEY: z.string().optional(),
  INSTAGRAM_ACCESS_TOKEN: z.string().optional(),
  INSTAGRAM_ACCOUNT_ID: z.string().optional(),
  GOOGLE_PAY_MERCHANT_VPA: z.string().optional(),
  GOOGLE_PAY_MERCHANT_NAME: z.string().optional(),
  GOOGLE_PAY_MCC: z.string().optional(),
  GOOGLE_PAY_MERCHANT_ID: z.string().optional(),
  GOOGLE_PAY_ENVIRONMENT: z.enum(["TEST", "PRODUCTION"]).optional(),
});

const apiUrl = 
  process.env.API_URL || 
  process.env.NEXT_PUBLIC_API_URL || 
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

export const ENV = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL || process.env.MONGODB_URI,
  REDIS_URL: process.env.REDIS_URL,
  FRONTEND_URL: process.env.FRONTEND_URL,
  API_URL: apiUrl,
  NEXT_PUBLIC_API_URL: apiUrl,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  PAYU_MERCHANT_KEY: process.env.PAYU_MERCHANT_KEY,
  PAYU_SALT: process.env.PAYU_SALT,
  PAYU_MODE: process.env.PAYU_MODE,
  PAYU_WEBHOOK_ALLOWED_IPS: process.env.PAYU_WEBHOOK_ALLOWED_IPS,
  CCAVENUE_MERCHANT_ID: process.env.CCAVENUE_MERCHANT_ID,
  CCAVENUE_ACCESS_CODE: process.env.CCAVENUE_ACCESS_CODE,
  CCAVENUE_WORKING_KEY: process.env.CCAVENUE_WORKING_KEY,
  CCAVENUE_MODE: process.env.CCAVENUE_MODE,
  CCAVENUE_REDIRECT_URL: process.env.CCAVENUE_REDIRECT_URL,
  CCAVENUE_CANCEL_URL: process.env.CCAVENUE_CANCEL_URL,
  CCAVENUE_WEBHOOK_ALLOWED_IPS: process.env.CCAVENUE_WEBHOOK_ALLOWED_IPS,
  SNAPMINT_MERCHANT_ID: process.env.SNAPMINT_MERCHANT_ID,
  SNAPMINT_SECRET: process.env.SNAPMINT_SECRET,
  SNAPMINT_MID: process.env.SNAPMINT_MID,
  SNAPMINT_MODE: process.env.SNAPMINT_MODE,
  SNAPMINT_MIN_ORDER_VALUE: process.env.SNAPMINT_MIN_ORDER_VALUE,
  SNAPMINT_WEBHOOK_ALLOWED_IPS: process.env.SNAPMINT_WEBHOOK_ALLOWED_IPS,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION || process.env.S3_REGION,
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || process.env.S3_BUCKET,
  SES_ACCESS_KEY_ID: process.env.SES_ACCESS_KEY_ID,
  SES_SECRET_ACCESS_KEY: process.env.SES_SECRET_ACCESS_KEY,
  SES_REGION: process.env.SES_REGION,
  SES_FROM_EMAIL: process.env.SES_FROM_EMAIL,
  SHIPROCKET_EMAIL: process.env.SHIPROCKET_EMAIL,
  SHIPROCKET_PASSWORD: process.env.SHIPROCKET_PASSWORD,
  SHIPROCKET_WEBHOOK_SECRET: process.env.SHIPROCKET_WEBHOOK_SECRET,
  DELHIVERY_API_KEY: process.env.DELHIVERY_API_KEY,
  DELHIVERY_WEBHOOK_TOKEN: process.env.DELHIVERY_WEBHOOK_TOKEN,
  XPRESSBEES_API_KEY: process.env.XPRESSBEES_API_KEY,
  XPRESSBEES_WEBHOOK_TOKEN: process.env.XPRESSBEES_WEBHOOK_TOKEN,
  CRON_SECRET: process.env.CRON_SECRET,
  SERPAPI_KEY: process.env.SERPAPI_KEY,
  INSTAGRAM_ACCESS_TOKEN: process.env.INSTAGRAM_ACCESS_TOKEN,
  INSTAGRAM_ACCOUNT_ID: process.env.INSTAGRAM_ACCOUNT_ID,
  GOOGLE_PAY_MERCHANT_VPA: process.env.GOOGLE_PAY_MERCHANT_VPA,
  GOOGLE_PAY_MERCHANT_NAME: process.env.GOOGLE_PAY_MERCHANT_NAME,
  GOOGLE_PAY_MCC: process.env.GOOGLE_PAY_MCC,
  GOOGLE_PAY_MERCHANT_ID: process.env.GOOGLE_PAY_MERCHANT_ID,
  GOOGLE_PAY_ENVIRONMENT: process.env.GOOGLE_PAY_ENVIRONMENT,
});

export type EnvConfig = z.infer<typeof envSchema>;
