import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";
import type { AuthScope } from "@store4riders/shared-types";

export type { AuthScope };
export type TokenType = "access" | "refresh";

export interface AuthTokenPayload {
  userId: string;
  scope?: AuthScope;
  tokenType?: TokenType;
  tokenVersion?: number;
  jti?: string;
  iat?: number;
  exp?: number;
}

const ACCESS_SECRET = ENV.JWT_ACCESS_SECRET;
const REFRESH_SECRET = ENV.JWT_REFRESH_SECRET;

export const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
export const CUSTOMER_REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const ADMIN_REFRESH_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Resolves refresh token expiry and cookie maxAge based on user role.
 * Customers stay signed in for 7 days of inactivity; staff/admin expire after 24 hours.
 */
export const resolveAuthScope = (role?: string): AuthScope =>
  role && role !== "customer" ? "admin" : "customer";

export const getSessionConfigForRole = (role?: string) => {
  const scope = resolveAuthScope(role);
  return scope === "admin"
    ? { scope, refreshExpiresIn: "24h" as const, refreshMaxAgeSeconds: ADMIN_REFRESH_TTL_SECONDS }
    : { scope, refreshExpiresIn: "7d" as const, refreshMaxAgeSeconds: CUSTOMER_REFRESH_TTL_SECONDS };
};

/**
 * Generates an access token (15m) and a role-aware refresh token (7d customer / 24h admin).
 */
export const generateTokens = (userId: string, role?: string, tokenVersion = 0) => {
  const { scope, refreshExpiresIn } = getSessionConfigForRole(role);
  const accessToken = jwt.sign(
    { userId, scope, tokenType: "access" as const, tokenVersion, jti: randomUUID() },
    ACCESS_SECRET,
    { expiresIn: "15m" }
  );
  const refreshToken = jwt.sign(
    { userId, scope, tokenType: "refresh" as const, tokenVersion, jti: randomUUID() },
    REFRESH_SECRET,
    { expiresIn: refreshExpiresIn }
  );

  return { accessToken, refreshToken };
};

/**
 * Verifies a JWT token.
 * @param token - The token to verify
 * @param isRefresh - Whether to check against the refresh secret
 */
export const verifyToken = (token: string, isRefresh = false): AuthTokenPayload => {
  const secret = isRefresh ? REFRESH_SECRET : ACCESS_SECRET;
  const decoded = jwt.verify(token, secret) as AuthTokenPayload;
  if (!decoded || typeof decoded !== "object" || typeof decoded.userId !== "string" || !decoded.userId) {
    throw new Error("Invalid token payload");
  }
  const expectedType: TokenType = isRefresh ? "refresh" : "access";
  if (!decoded.tokenType || decoded.tokenType !== expectedType) {
    throw new Error("Token type mismatch");
  }
  return decoded;
};
