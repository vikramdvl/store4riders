import crypto from "crypto";
import { ENV } from "../config/env";

const GUEST_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

const getOrderEmail = (order: {
  guestEmail?: string;
  customerEmail?: string;
  shippingAddress?: { email?: string };
}): string => {
  return String(
    order?.guestEmail || order?.shippingAddress?.email || order?.customerEmail || ""
  )
    .trim()
    .toLowerCase();
};

const getSigningSecret = (): string => {
  const secret =
    (ENV as Record<string, any>)?.JWT_ACCESS_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_SECRET;
  if (!secret || typeof secret !== "string") {
    throw new Error("JWT_ACCESS_SECRET is required to sign guest order tokens");
  }
  return secret;
};

const computeSignature = (orderRef: string, email: string, expSeconds: number, secret: string): string => {
  const payload = `${orderRef.trim().toUpperCase()}|${email}|${expSeconds}`;
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
};

/**
 * Generates an HMAC-signed token authorizing guest checkout status/verification checks
 * for a specific guest order without allowing order-number enumeration.
 */
export const signGuestOrderToken = (orderRef: string, email?: string): string => {
  const secret = getSigningSecret();
  const normalizedRef = String(orderRef || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const exp = Math.floor(Date.now() / 1000) + GUEST_TOKEN_TTL_SECONDS;
  const sig = computeSignature(normalizedRef, normalizedEmail, exp, secret);
  return `${exp}.${sig}`;
};

/**
 * Verifies an HMAC-signed guest order token against a guest order's identifiers and email.
 */
export const verifyGuestOrderToken = (
  token: string | undefined | null,
  order: {
    _id?: any;
    id?: string;
    orderNumber?: string;
    gatewayOrderId?: string;
    guestEmail?: string;
    customerEmail?: string;
    shippingAddress?: { email?: string };
  }
): boolean => {
  if (!token || typeof token !== "string" || !order) return false;
  let secret: string;
  try {
    secret = getSigningSecret();
  } catch {
    return false;
  }

  const parts = token.trim().split(".");
  if (parts.length !== 2) return false;

  const exp = Number(parts[0]);
  const providedSig = parts[1];
  if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) > exp) {
    return false;
  }
  if (!/^[a-f0-9]{64}$/i.test(providedSig)) {
    return false;
  }

  const email = getOrderEmail(order);
  const candidates = [order.orderNumber, order.gatewayOrderId, order.id, order._id ? String(order._id) : undefined]
    .filter((v): v is string => Boolean(v && String(v).trim()))
    .map((v) => String(v).trim());

  const providedBuf = Buffer.from(providedSig, "hex");
  for (const candidate of candidates) {
    const expectedSig = computeSignature(candidate, email, exp, secret);
    const expectedBuf = Buffer.from(expectedSig, "hex");
    if (expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      return true;
    }
  }
  return false;
};
