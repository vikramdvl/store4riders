import jwt from "jsonwebtoken";
import { ENV } from "../config/env";

const ACCESS_SECRET = ENV.JWT_ACCESS_SECRET;
const REFRESH_SECRET = ENV.JWT_REFRESH_SECRET;

export const CUSTOMER_REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const ADMIN_REFRESH_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Resolves refresh token expiry and cookie maxAge based on user role.
 * Customers stay signed in for 7 days of inactivity; staff/admin expire after 24 hours.
 */
export const getSessionConfigForRole = (role?: string) => {
  const isAdminOrStaff = Boolean(role && role !== "customer");
  return isAdminOrStaff
    ? { refreshExpiresIn: "24h" as const, refreshMaxAgeSeconds: ADMIN_REFRESH_TTL_SECONDS }
    : { refreshExpiresIn: "7d" as const, refreshMaxAgeSeconds: CUSTOMER_REFRESH_TTL_SECONDS };
};

/**
 * Generates an access token (15m) and a role-aware refresh token (7d customer / 24h admin).
 */
export const generateTokens = (userId: string, role?: string) => {
  const { refreshExpiresIn } = getSessionConfigForRole(role);
  const accessToken = jwt.sign({ userId }, ACCESS_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ userId }, REFRESH_SECRET, { expiresIn: refreshExpiresIn });

  return { accessToken, refreshToken };
};

/**
 * Verifies a JWT token.
 * @param token - The token to verify
 * @param isRefresh - Whether to check against the refresh secret
 */
export const verifyToken = (token: string, isRefresh = false) => {
  const secret = isRefresh ? REFRESH_SECRET : ACCESS_SECRET;
  return jwt.verify(token, secret) as { userId: string; iat?: number; exp?: number };
};
