import { NextRequest } from "next/server";
import {
  sendRegisterOtpSchema,
  checkEmailSchema,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@store4riders/shared-validation";
import { ValidationError } from "../../core/errors/AppError";

async function parseJsonBody(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ValidationError("Invalid JSON payload");
  }
}

/**
 * AuthValidator
 * 
 * Handles extracting JSON payloads from incoming authentication requests
 * and strictly validating them against Zod schemas.
 */
export class AuthValidator {
  
  /**
   * Validates the send registration OTP payload.
   */
  static async validateSendRegisterOtp(req: NextRequest) {
    const body = await parseJsonBody(req);
    return sendRegisterOtpSchema.parse(body);
  }

  /**
   * Validates the check email payload.
   */
  static async validateCheckEmail(req: NextRequest) {
    const body = await parseJsonBody(req);
    return checkEmailSchema.parse(body);
  }

  /**
   * Validates the registration payload.
   * 
   * @param {NextRequest} req - The incoming HTTP request.
   * @returns {Promise<any>} The parsed and validated registration data.
   * @throws Will throw if data is invalid.
   */
  static async validateRegister(req: NextRequest) {
    const body = await parseJsonBody(req);
    return registerSchema.parse(body);
  }

  /**
   * Validates the login payload.
   * 
   * @param {NextRequest} req - The incoming HTTP request.
   * @returns {Promise<any>} The parsed and validated login data.
   * @throws Will throw if data is invalid.
   */
  static async validateLogin(req: NextRequest) {
    const body = await parseJsonBody(req);
    return loginSchema.parse(body);
  }

  static async validateForgotPassword(req: NextRequest) {
    const body = await parseJsonBody(req);
    return forgotPasswordSchema.parse(body);
  }

  static async validateResetPassword(req: NextRequest) {
    const body = await parseJsonBody(req);
    return resetPasswordSchema.parse(body);
  }
}
