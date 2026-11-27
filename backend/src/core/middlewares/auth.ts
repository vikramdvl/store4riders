import { NextRequest } from "next/server";
import { verifyToken, type AuthScope, type AuthTokenPayload } from "../utils/jwt";
import { ForbiddenError, UnauthorizedError } from "../errors/AppError";
import { getCache, setCache } from "../cache/redis";

export const CUSTOMER_ACCESS_COOKIE = "accessToken";
export const CUSTOMER_REFRESH_COOKIE = "refreshToken";
export const ADMIN_ACCESS_COOKIE = "adminAccessToken";
export const ADMIN_REFRESH_COOKIE = "adminRefreshToken";

const AUTH_STATE_CACHE_TTL_SECONDS = 60;

export interface ExtractAuthOptions {
  requiredScope?: AuthScope;
}

export const resolveRequestAuthScope = (req: NextRequest): AuthScope => {
  const headerScope = req.headers.get("x-auth-scope");
  const queryScope = req.nextUrl.searchParams.get("scope");
  if (headerScope === "admin" || queryScope === "admin") {
    return "admin";
  }
  return "customer";
};

export const extractTokenFromAuthRequest = (
  req: NextRequest,
  preferredScope?: AuthScope
): string | null => {
  // First, check the Authorization header (used by Mobile Apps, Swagger UI & client store)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearer = authHeader.split(" ")[1]?.trim();
    if (bearer) return bearer;
  }

  const effectiveScope = preferredScope || resolveRequestAuthScope(req);
  if (effectiveScope === "admin") {
    return (
      req.cookies.get(ADMIN_ACCESS_COOKIE)?.value ||
      req.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value ||
      null
    );
  }

  return req.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value || null;
};

/**
 * Extracts and cryptographically validates an access JWT from Authorization header
 * or scope-appropriate HttpOnly cookie, enforcing portal scope isolation when present.
 */
export const extractAuthContext = (
  req: NextRequest,
  options?: ExtractAuthOptions
): AuthTokenPayload => {
  const token = extractTokenFromAuthRequest(req, options?.requiredScope);

  if (!token) {
    throw new UnauthorizedError("No access token provided");
  }

  let decoded: AuthTokenPayload;
  try {
    decoded = verifyToken(token, false);
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }

  if (options?.requiredScope) {
    // Reject tokens explicitly minted for the opposite portal (or all typed tokens with wrong scope)
    if (decoded.scope && decoded.scope !== options.requiredScope) {
      throw new ForbiddenError(
        options.requiredScope === "admin"
          ? "Admin portal session required"
          : "Customer storefront session required"
      );
    }
    if (decoded.tokenType && !decoded.scope) {
      throw new ForbiddenError("Token is missing required portal scope");
    }
  }

  return decoded;
};

/**
 * Authentication middleware.
 * Extracts JWT from Authorization header or HttpOnly cookie, verifies it, and returns the userId.
 * Throws UnauthorizedError if invalid or missing.
 */
export const extractUserFromAuth = (
  req: NextRequest,
  options?: ExtractAuthOptions
): string => {
  return extractAuthContext(req, options).userId;
};

/**
 * Strict Admin Portal authentication extractor.
 * Rejects customer-scoped tokens even if role checks are mocked or delayed.
 */
export const extractAdminFromAuth = (req: NextRequest): string => {
  return extractAuthContext(req, { requiredScope: "admin" }).userId;
};

/**
 * Verifies revocation status, tokenVersion, and active user status against cache/DB.
 */
export const verifySessionState = async (
  decoded: AuthTokenPayload,
  options?: ExtractAuthOptions
): Promise<{ userId: string; role: string; tokenVersion: number }> => {
  const userId = decoded.userId;

  // 1. Check user-level logout blacklist & per-token jti revocation
  try {
    const [userBlacklistVal, jtiBlacklisted] = await Promise.all([
      getCache(`blacklist:${userId}`),
      decoded.jti ? getCache(`bl_access_${decoded.jti}`) : Promise.resolve(null),
    ]);

    if (jtiBlacklisted) {
      throw new UnauthorizedError("Session has been revoked");
    }
    if (userBlacklistVal) {
      if (userBlacklistVal === "true") {
        throw new UnauthorizedError("Session has expired or was logged out");
      }
      const logoutTimestampMs = Number(userBlacklistVal);
      const tokenIssuedAtMs = (decoded.iat || 0) * 1000;
      if (!Number.isNaN(logoutTimestampMs) && tokenIssuedAtMs <= Math.floor(logoutTimestampMs / 1000) * 1000) {
        throw new UnauthorizedError("Session has expired or was logged out");
      }
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
  }

  // 2. Check active account state and tokenVersion (cached briefly, invalidated on mutation/logout)
  const cacheKey = `auth_user_state:${userId}`;
  let state: { isActive: boolean; role: string; tokenVersion: number } | null = null;
  try {
    state = await getCache<{ isActive: boolean; role: string; tokenVersion: number }>(cacheKey);
  } catch {}

  if (!state) {
    const { UserRepository } = await import("../../modules/user/user.repository");
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError("Account no longer exists");
    }
    state = {
      isActive: user.isActive !== false,
      role: user.role || "customer",
      tokenVersion: typeof user.tokenVersion === "number" ? user.tokenVersion : 0,
    };
    try {
      await setCache(cacheKey, state, AUTH_STATE_CACHE_TTL_SECONDS);
    } catch {}
  }

  if (!state.isActive) {
    throw new UnauthorizedError("Account has been disabled");
  }

  if (typeof decoded.tokenVersion === "number" && decoded.tokenVersion !== state.tokenVersion) {
    throw new UnauthorizedError("Session is no longer valid. Please sign in again.");
  }

  if (options?.requiredScope === "admin" && state.role === "customer") {
    throw new ForbiddenError("Admin/staff access required");
  }
  if (options?.requiredScope === "customer" && state.role !== "customer") {
    throw new ForbiddenError("Staff accounts cannot use customer storefront sessions");
  }

  return {
    userId,
    role: state.role,
    tokenVersion: state.tokenVersion,
  };
};

/**
 * Full verified authentication (JWT signature + scope + revocation + DB active/tokenVersion check).
 */
export const extractVerifiedAuth = async (
  req: NextRequest,
  options?: ExtractAuthOptions
): Promise<{ userId: string; role: string; tokenVersion: number; decoded: AuthTokenPayload }> => {
  const decoded = extractAuthContext(req, options);
  const state = await verifySessionState(decoded, options);
  return { ...state, decoded };
};
