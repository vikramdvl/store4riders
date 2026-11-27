import bcrypt from "bcryptjs";
import crypto from "crypto";
import { UserRepository } from "../user/user.repository";
import { UserModel } from "../user/user.model";
import { generateTokens, verifyToken, getSessionConfigForRole, resolveAuthScope, type AuthScope } from "../../core/utils/jwt";
import { UnauthorizedError, ForbiddenError, ConflictError, ValidationError, AppError } from "../../core/errors/AppError";
import {
  getCache,
  setCache,
  deleteCache,
  setCacheIfAbsent,
  incrementCacheCounter,
  consumeCacheOnce,
} from "../../core/cache/redis";
import { SendRegisterOtpInput, RegisterInput, LoginInput, ForgotPasswordInput, ResetPasswordInput } from "@store4riders/shared-validation";
import { sendSmtpEmail } from "../../core/email/smtp";
import { logger } from "../../core/utils/logger";

const REGISTER_OTP_TTL_SECONDS = 10 * 60; // 10 minutes
const REGISTER_OTP_COOLDOWN_SECONDS = 60; // 1 minute resend cooldown
const REGISTER_OTP_MAX_ATTEMPTS = 5;
const REGISTER_OTP_MAX_SENDS_PER_WINDOW = 5;
const REGISTER_OTP_SEND_WINDOW_SECONDS = 15 * 60;

interface RegisterOtpRecord {
  otpHash: string;
  salt: string;
  maxAttempts: number;
  expiresAt: number;
}

const getRegisterOtpKey = (email: string) => `reg_otp:${email}`;
const getRegisterOtpAttemptsKey = (email: string) => `reg_otp_att:${email}`;
const getRegisterOtpCooldownKey = (email: string) => `reg_otp_cd:${email}`;
const getRegisterOtpCountKey = (email: string) => `reg_otp_count:${email}`;

const escapeHtml = (value: string): string =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const hashRegistrationOtp = (salt: string, email: string, otp: string): string => {
  return crypto
    .createHash("sha256")
    .update(`${salt}:${email}:${otp}`)
    .digest("hex");
};

const buildRegistrationOtpEmailHtml = (email: string, otp: string, expiryMinutes: number): string => {
  const safeEmail = escapeHtml(email);
  const safeOtp = escapeHtml(otp);
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; color: #1f2937;">
    <div style="background-color: #111827; padding: 20px 24px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 1px; margin: 0; text-transform: uppercase;">
        Store4Riders
      </h1>
      <p style="color: #9ca3af; font-size: 11px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">
        Premium Motorcycle Riding Gear
      </p>
    </div>

    <div style="padding: 32px 28px;">
      <h2 style="color: #111827; font-size: 18px; font-weight: 700; margin: 0 0 12px 0;">
        Verify your email address
      </h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 22px 0;">
        Use the 6-digit verification code below to finish creating your Store4Riders account for <strong>${safeEmail}</strong>:
      </p>

      <div style="text-align: center; margin: 24px 0; padding: 18px 20px; background-color: #f9fafb; border: 1px dashed #d1d5db; border-radius: 6px;">
        <span style="display: inline-block; font-family: 'Courier New', Courier, monospace; font-size: 30px; font-weight: 800; letter-spacing: 8px; color: #111827;">
          ${safeOtp}
        </span>
      </div>

      <p style="color: #4b5563; font-size: 13px; line-height: 1.5; margin: 0 0 12px 0;">
        This code expires in <strong>${expiryMinutes} minutes</strong> and can only be used once.
      </p>

      <div style="border-top: 1px solid #f3f4f6; padding-top: 16px; margin-top: 24px;">
        <p style="color: #9ca3af; font-size: 11px; line-height: 1.5; margin: 0;">
          <strong>Security Note:</strong> Never share this code with anyone. Store4Riders will never call or message you asking for your OTP. If you did not request this, you can safely ignore this email.
        </p>
      </div>
    </div>

    <div style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 11px; margin: 0;">
        Need help? Contact our rider support team at <a href="mailto:support@store4riders.com" style="color: #FF5429; text-decoration: none;">support@store4riders.com</a>
      </p>
    </div>
  </div>
`;
};

/**
 * @class AuthService
 * @description Core business logic for user authentication.
 * Handles bcrypt password hashing, credential verification, JWT generation, 
 * email OTP verification, and secure token refresh flows. Interacts with UserRepository.
 */
export class AuthService {

  static async sendRegisterOtp(data: SendRegisterOtpInput) {
    const normalizedEmail = data.email.trim().toLowerCase();

    const existing = await UserRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictError("Email already in use");
    }

    const cooldownKey = getRegisterOtpCooldownKey(normalizedEmail);
    const cooldownUntil = Date.now() + REGISTER_OTP_COOLDOWN_SECONDS * 1000;
    const lockAcquired = await setCacheIfAbsent(
      cooldownKey,
      { cooldownUntil },
      REGISTER_OTP_COOLDOWN_SECONDS
    );
    if (!lockAcquired) {
      const activeCooldown = await getCache(cooldownKey);
      const waitSeconds = activeCooldown?.cooldownUntil
        ? Math.max(1, Math.ceil((Number(activeCooldown.cooldownUntil) - Date.now()) / 1000))
        : REGISTER_OTP_COOLDOWN_SECONDS;
      throw new AppError(`Please wait ${waitSeconds} seconds before requesting a new verification code`, 429);
    }

    const countKey = getRegisterOtpCountKey(normalizedEmail);
    const sendCount = await incrementCacheCounter(countKey, REGISTER_OTP_SEND_WINDOW_SECONDS);
    if (sendCount > REGISTER_OTP_MAX_SENDS_PER_WINDOW) {
      await deleteCache(cooldownKey);
      throw new AppError("Too many verification codes requested for this email. Please try again after 15 minutes.", 429);
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const salt = crypto.randomBytes(16).toString("hex");
    const otpHash = hashRegistrationOtp(salt, normalizedEmail, otp);
    const expiresAt = Date.now() + REGISTER_OTP_TTL_SECONDS * 1000;

    const otpKey = getRegisterOtpKey(normalizedEmail);
    const attemptsKey = getRegisterOtpAttemptsKey(normalizedEmail);
    const record: RegisterOtpRecord = {
      otpHash,
      salt,
      maxAttempts: REGISTER_OTP_MAX_ATTEMPTS,
      expiresAt,
    };

    await deleteCache(attemptsKey);
    await setCache(otpKey, record, REGISTER_OTP_TTL_SECONDS);

    try {
      const html = buildRegistrationOtpEmailHtml(normalizedEmail, otp, Math.floor(REGISTER_OTP_TTL_SECONDS / 60));
      await sendSmtpEmail(normalizedEmail, "Verify Your Email - Store4Riders", html);
    } catch (err) {
      await deleteCache(otpKey);
      await deleteCache(attemptsKey);
      await deleteCache(cooldownKey);
      logger.error(`Failed to send registration OTP to ${normalizedEmail}`, err);
      throw new AppError("Verification email could not be sent. Please try again.", 500);
    }

    return {
      email: normalizedEmail,
      expiresInSeconds: REGISTER_OTP_TTL_SECONDS,
      cooldownSeconds: REGISTER_OTP_COOLDOWN_SECONDS,
    };
  }

  private static async verifyRegistrationOtp(normalizedEmail: string, rawOtp: string): Promise<void> {
    const otpKey = getRegisterOtpKey(normalizedEmail);
    const attemptsKey = getRegisterOtpAttemptsKey(normalizedEmail);
    const record = (await getCache(otpKey)) as RegisterOtpRecord | null;

    if (!record || !record.otpHash || !record.salt || Date.now() > Number(record.expiresAt)) {
      await deleteCache(otpKey);
      await deleteCache(attemptsKey);
      throw new ValidationError("Verification code expired or not found. Please request a new code.");
    }

    const maxAttempts = Number(record.maxAttempts || REGISTER_OTP_MAX_ATTEMPTS);
    const remainingTtl = Math.max(1, Math.ceil((Number(record.expiresAt) - Date.now()) / 1000));
    const attemptNumber = await incrementCacheCounter(attemptsKey, remainingTtl);

    if (attemptNumber > maxAttempts) {
      await deleteCache(otpKey);
      await deleteCache(attemptsKey);
      throw new ValidationError("Too many incorrect verification attempts. Please request a new code.");
    }

    const cleanOtp = String(rawOtp || "").trim();
    const expectedHash = hashRegistrationOtp(record.salt, normalizedEmail, cleanOtp);
    const expectedBuf = Buffer.from(expectedHash, "hex");
    const storedBuf = Buffer.from(record.otpHash, "hex");
    const isValid = expectedBuf.length === storedBuf.length && crypto.timingSafeEqual(expectedBuf, storedBuf);

    if (!isValid) {
      if (attemptNumber >= maxAttempts) {
        await deleteCache(otpKey);
        await deleteCache(attemptsKey);
        throw new ValidationError("Too many incorrect verification attempts. Please request a new code.");
      }

      const remainingAttempts = maxAttempts - attemptNumber;
      throw new ValidationError(
        `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`
      );
    }

    // Consume OTP atomically so concurrent requests with the same code cannot register twice
    const consumed = await consumeCacheOnce<RegisterOtpRecord>(otpKey);
    if (!consumed) {
      throw new ValidationError("Verification code expired or not found. Please request a new code.");
    }

    await deleteCache(attemptsKey);
    await deleteCache(getRegisterOtpCooldownKey(normalizedEmail));
    await deleteCache(getRegisterOtpCountKey(normalizedEmail));
  }
  
  static async register(data: RegisterInput) {
    const normalizedEmail = data.email.trim().toLowerCase();
    const existing = await UserRepository.findByEmail(normalizedEmail);
    if (existing) throw new ConflictError("Email already in use");

    await AuthService.verifyRegistrationOtp(normalizedEmail, data.otp);

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const { otp: _otp, ...userData } = data;
    const user = await UserRepository.create({
      ...userData,
      email: normalizedEmail,
      password: hashedPassword,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    });
    const userId = (user as any)._id?.toString() || user.id;
    const role = user.role || "customer";
    try {
      await deleteCache(`blacklist:${userId}`);
    } catch {
      // Cache unavailability should not block registration
    }
    const tokens = generateTokens(userId, role, typeof (user as any).tokenVersion === "number" ? (user as any).tokenVersion : 0);
    const { refreshMaxAgeSeconds } = getSessionConfigForRole(role);
    
    // Auto-link any past guest orders made with this verified email
    try {
      const { OrderRepository } = await import("../order/order.repository");
      await OrderRepository.linkGuestOrders(user.email, userId);
      await AuthService.syncUserFromLinkedOrders(userId, user);
    } catch (e) {
      logger.error("Failed to link guest orders on register:", e);
    }

    return {
      tokens,
      sessionMaxAgeSeconds: refreshMaxAgeSeconds,
      user: {
        id: userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        role,
        isEmailVerified: true,
        phone: user.phone || "",
        addresses: user.addresses || [],
      }
    };
  }

  static async login(data: LoginInput, requestScope?: AuthScope) {
    const user = await UserRepository.findByEmailWithPassword(data.email.trim());
    if (!user) throw new UnauthorizedError("Invalid credentials");

    if (user.isActive === false) {
      throw new UnauthorizedError("Your account has been disabled. Please contact administrator.");
    }

    const isMatch = await bcrypt.compare(data.password, user.password);
    if (!isMatch) throw new UnauthorizedError("Invalid credentials");

    const userId = (user as any)._id?.toString() || user.id;
    const role = user.role || "customer";
    const requestedScope: AuthScope = data.scope || requestScope || "customer";
    const userScope = resolveAuthScope(role);

    if (requestedScope === "customer" && userScope !== "customer") {
      throw new ForbiddenError("Staff and admin accounts must sign in through the Admin Portal");
    }
    if (requestedScope === "admin" && userScope !== "admin") {
      throw new ForbiddenError("Customer accounts cannot access the Admin Portal");
    }

    try {
      await deleteCache(`blacklist:${userId}`);
    } catch {
      // Cache unavailability should not block login
    }
    const tokenVersion = typeof (user as any).tokenVersion === "number" ? (user as any).tokenVersion : 0;
    const tokens = generateTokens(userId, role, tokenVersion);
    const { refreshMaxAgeSeconds } = getSessionConfigForRole(role);

    // Auto-link any past guest orders only when email is verified (or legacy pre-OTP user)
    if (user.isEmailVerified !== false) {
      try {
        const { OrderRepository } = await import("../order/order.repository");
        await OrderRepository.linkGuestOrders(user.email, userId);
        await AuthService.syncUserFromLinkedOrders(userId, user);
      } catch (e) {
        logger.error("Failed to link guest orders on login:", e);
      }
    }

    return {
      tokens,
      scope: userScope,
      sessionMaxAgeSeconds: refreshMaxAgeSeconds,
      user: {
        id: userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        role,
        isEmailVerified: user.isEmailVerified !== false,
        phone: user.phone || "",
        addresses: user.addresses || [],
      }
    };
  }

  static async refreshToken(oldToken: string, expectedScope?: AuthScope) {
    try {
      const decoded = verifyToken(oldToken, true);

      if (expectedScope && decoded.scope && decoded.scope !== expectedScope) {
        throw new ForbiddenError(
          expectedScope === "admin"
            ? "Admin portal session required"
            : "Customer storefront session required"
        );
      }

      const tokenHash = crypto.createHash("sha256").update(oldToken).digest("hex");

      // Verify blacklisting & rotation replay protection from Redis/cache
      try {
        const { getCache } = await import("../../core/cache/redis");
        const [userBlacklistVal, isTokenBlacklisted, usedRefreshMarker, gracePayload] = await Promise.all([
          getCache(`blacklist:${decoded.userId}`),
          getCache(`bl_token_${oldToken}`),
          getCache<string>(`bl_rt_used_${tokenHash}`),
          getCache<{ accessToken: string; refreshToken: string; sessionMaxAgeSeconds: number; scope: AuthScope }>(
            `grace_rt_${tokenHash}`
          ),
        ]);

        if (isTokenBlacklisted) {
          throw new UnauthorizedError("Session has expired or was logged out");
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
        if (usedRefreshMarker) {
          if (gracePayload && gracePayload.accessToken && gracePayload.refreshToken) {
            return gracePayload;
          }
          throw new UnauthorizedError("Refresh token has already been used");
        }
      } catch (e: any) {
        if (e instanceof UnauthorizedError || e instanceof ForbiddenError) throw e;
      }

      const user = await UserRepository.findById(decoded.userId);
      if (!user || user.isActive === false) {
        throw new UnauthorizedError("Account has been disabled");
      }

      const currentTokenVersion = typeof (user as any).tokenVersion === "number" ? (user as any).tokenVersion : 0;
      if (typeof decoded.tokenVersion === "number" && decoded.tokenVersion !== currentTokenVersion) {
        throw new UnauthorizedError("Session has expired or was logged out");
      }

      const role = user.role || "customer";
      const userScope = resolveAuthScope(role);
      if (expectedScope && userScope !== expectedScope) {
        throw new ForbiddenError(
          expectedScope === "admin"
            ? "Admin portal session required"
            : "Customer storefront session required"
        );
      }

      const tokens = generateTokens(decoded.userId, role, currentTokenVersion);
      const { refreshMaxAgeSeconds } = getSessionConfigForRole(role);
      const result = { ...tokens, scope: userScope, sessionMaxAgeSeconds: refreshMaxAgeSeconds };

      try {
        await Promise.all([
          setCache(`grace_rt_${tokenHash}`, result, 15),
          setCache(`bl_rt_used_${tokenHash}`, String(Date.now()), refreshMaxAgeSeconds),
        ]);
      } catch {
        // Cache unavailability should not break token refresh
      }

      return result;
    } catch (err: any) {
      if (err instanceof UnauthorizedError || err instanceof ForbiddenError) throw err;
      throw new UnauthorizedError("Invalid refresh token");
    }
  }

  static async logout(userId: string) {
    // Store logout timestamp and advance tokenVersion so prior access/refresh tokens become invalid across instances
    await setCache(`blacklist:${userId}`, String(Date.now()), 7 * 24 * 60 * 60);
    try {
      if (typeof UserRepository.incrementTokenVersion === "function") {
        await UserRepository.incrementTokenVersion(userId);
      }
    } catch {
      // Cache revocation remains in place if tokenVersion update fails
    }
  }

  static async syncUserFromLinkedOrders(userId: string, user?: any) {
    try {
      const { OrderModel } = await import("../order/order.model");
      const linkedOrders = await OrderModel.find({ userId }).sort({ createdAt: -1 }).lean().exec();
      if (!linkedOrders || linkedOrders.length === 0) return;

      const userDoc = user?._id ? user : await UserModel.findById(userId);
      if (!userDoc) return;

      let shouldUpdate = false;
      const updates: any = {};

      // 1. Sync / clean up legacy dummy name (e.g. "User" as lastName or "Guest" as firstName)
      const latestWithFullName = linkedOrders.find((o: any) => o.shippingAddress?.fullName && String(o.shippingAddress.fullName).trim().length > 1);
      if (latestWithFullName) {
        const orderFullName = String(latestWithFullName.shippingAddress.fullName).trim();
        const parts = orderFullName.split(/\s+/);
        const orderFirstName = parts[0] || "";
        const orderLastName = parts.length > 1 ? parts.slice(1).join(" ") : "";

        const isLegacyDummyLastName = userDoc.lastName === "User";
        const isLegacyDummyFirstName = userDoc.firstName === "Guest";
        
        if (isLegacyDummyLastName || isLegacyDummyFirstName || (!userDoc.lastName && orderLastName)) {
          const finalFirst = (isLegacyDummyFirstName || !userDoc.firstName) ? (orderFirstName || userDoc.firstName) : (orderFirstName || userDoc.firstName);
          const finalLast = isLegacyDummyLastName ? orderLastName : (userDoc.lastName || orderLastName);
          
          if (finalFirst !== userDoc.firstName || finalLast !== userDoc.lastName) {
            updates.firstName = finalFirst;
            updates.lastName = finalLast;
            userDoc.firstName = finalFirst;
            userDoc.lastName = finalLast;
            if (user) {
              user.firstName = finalFirst;
              user.lastName = finalLast;
            }
            shouldUpdate = true;
          }
        }
      }

      // 2. Sync phone if missing on user
      const latestWithPhone = linkedOrders.find((o: any) => o.shippingAddress?.phone);
      if ((!userDoc.phone || String(userDoc.phone).trim() === "") && latestWithPhone?.shippingAddress?.phone) {
        updates.phone = latestWithPhone.shippingAddress.phone;
        userDoc.phone = updates.phone;
        if (user) user.phone = updates.phone;
        shouldUpdate = true;
      }

      // 3. Sync delivery address if missing on user
      const latestWithAddr = linkedOrders.find((o: any) => o.shippingAddress?.street);
      if ((!userDoc.addresses || userDoc.addresses.length === 0) && latestWithAddr?.shippingAddress) {
        const sa = latestWithAddr.shippingAddress;
        const newAddress = {
          id: crypto.randomUUID(),
          street: sa.street || sa.addressLine1 || "",
          city: sa.city || "",
          state: sa.state || "",
          pincode: sa.pincode || "",
          country: sa.country || "India",
          isDefault: true,
        };
        updates.addresses = [newAddress];
        userDoc.addresses = [newAddress];
        if (user) user.addresses = [newAddress];
        shouldUpdate = true;
      }

      if (shouldUpdate) {
        await UserModel.findByIdAndUpdate(userId, { $set: updates }).exec();
      }
    } catch (e) {
      console.error("Failed to sync user from linked orders:", e);
    }
  }

  static async forgotPassword(data: ForgotPasswordInput) {
    const cleanEmail = data.email.trim();
    const normalizedEmail = cleanEmail.toLowerCase();
    const escaped = cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const user =
      (await UserModel.findOne({ email: normalizedEmail })) ||
      (await UserModel.findOne({ email: new RegExp(`^${escaped}$`, "i") }));
    if (!user) {
      // Return successfully to prevent email enumeration attacks
      return;
    }

    const cooldownKey = `fp_cd:${normalizedEmail}`;
    const canSend = await setCacheIfAbsent(cooldownKey, { at: Date.now() }, 60);
    if (!canSend) {
      // Silently ignore bursts within 60s without leaking email existence
      return;
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    // Token expires in 1 hour
    (user as any).resetPasswordToken = hashedToken;
    (user as any).resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const frontendBaseUrl = (
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000"
    ).replace(/\/+$/, "");
    const resetUrl = `${frontendBaseUrl}/reset-password/${resetToken}`;
    const safeRecipientName = escapeHtml((user as any).firstName || "Rider");
    const safeUserEmail = escapeHtml(user.email);

    const message = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; color: #1f2937;">
        <div style="background-color: #111827; padding: 20px 24px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 1px; margin: 0; text-transform: uppercase;">
            Store4Riders
          </h1>
          <p style="color: #9ca3af; font-size: 11px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">
            Premium Motorcycle Riding Gear
          </p>
        </div>

        <div style="padding: 32px 28px;">
          <h2 style="color: #111827; font-size: 18px; font-weight: 700; margin: 0 0 16px 0;">
            Hi ${safeRecipientName},
          </h2>
          <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
            We received a request to reset the password for your Store4Riders account (<strong>${safeUserEmail}</strong>). Click the button below to set a new password:
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" style="display: inline-block; background-color: #FF5429; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase; box-shadow: 0 2px 4px rgba(255, 84, 41, 0.2);">
              Set New Password
            </a>
          </div>

          <p style="color: #6b7280; font-size: 12px; line-height: 1.5; margin: 0 0 12px 0;">
            Button not working? You can also copy and paste this link into your browser:
          </p>
          <p style="word-break: break-all; font-size: 11px; color: #AB1509; background-color: #f9fafb; padding: 10px; border-radius: 4px; border: 1px solid #f3f4f6; margin: 0 0 24px 0;">
            <a href="${resetUrl}" style="color: #AB1509; text-decoration: underline;">${resetUrl}</a>
          </p>

          <div style="border-top: 1px solid #f3f4f6; padding-top: 16px; margin-top: 24px;">
            <p style="color: #9ca3af; font-size: 11px; line-height: 1.5; margin: 0;">
              <strong>Note:</strong> This link is secure and will expire in <strong>60 minutes</strong>. If you did not make this request, you can safely ignore this email — your account remains completely safe.
            </p>
          </div>
        </div>

        <div style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 11px; margin: 0;">
            Need help? Contact our rider support team at <a href="mailto:support@store4riders.com" style="color: #FF5429; text-decoration: none;">support@store4riders.com</a>
          </p>
        </div>
      </div>
    `;

    try {
      await sendSmtpEmail(user.email, "Password Reset - Store4Riders", message);
    } catch (err) {
      await deleteCache(cooldownKey);
      (user as any).resetPasswordToken = undefined;
      (user as any).resetPasswordExpire = undefined;
      await user.save();
      throw new AppError("Email could not be sent", 500);
    }
  }

  static async resetPassword(data: ResetPasswordInput) {
    const hashedToken = crypto.createHash("sha256").update(data.token).digest("hex");

    const user = await UserModel.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) throw new AppError("Invalid or expired reset token", 400);

    const hashedPassword = await bcrypt.hash(data.password, 12);
    
    (user as any).password = hashedPassword;
    (user as any).resetPasswordToken = undefined;
    (user as any).resetPasswordExpire = undefined;
    (user as any).tokenVersion = (typeof (user as any).tokenVersion === "number" ? (user as any).tokenVersion : 0) + 1;
    
    await user.save();

    const resetUserId = (user as any)._id?.toString() || user.id;
    if (resetUserId) {
      try {
        await deleteCache(`auth_user_state:${resetUserId}`);
      } catch {}
    }
    if (resetUserId) {
      try {
        await setCache(`blacklist:${resetUserId}`, String(Date.now()), 7 * 24 * 60 * 60);
      } catch {
        // Cache unavailability should not block password reset
      }
      try {
        const { AuditLogService } = await import("../audit-log/audit-log.service");
        await AuditLogService.record({
          category: "AUTH",
          action: "PASSWORD_RESET",
          severity: "warning",
          actor: { userId: resetUserId, email: user.email, role: user.role || "customer" },
          resource: { type: "User", id: resetUserId, label: user.email },
          message: `Password was reset for ${user.email} and prior sessions were revoked`,
        });
      } catch {}
    }
  }
}
