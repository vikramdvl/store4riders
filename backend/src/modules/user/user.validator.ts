import { NextRequest } from "next/server";
import { updateProfileSchema, addressSchema, changePasswordSchema } from "@store4riders/shared-validation";
import { extractUserFromAuth } from "../../core/middlewares/auth";
import { IUser, IUserAddress } from "@store4riders/shared-types";
import { ValidationError } from "../../core/errors/AppError";

/**
 * @class UserValidator
 * @description Extracts and validates user context and payloads for User operations.
 */
export class UserValidator {
  private static async getBody(req: NextRequest): Promise<any> {
    let body = (req as any).parsedBody;
    if (!body) {
      if (typeof req.json === "function") {
        try {
          body = await req.json();
        } catch {
          throw new ValidationError("Invalid JSON payload in request body");
        }
      } else {
        body = (req as any).body;
      }
      (req as any).parsedBody = body;
    }
    return body;
  }
  
  static async validateUpdateProfile(req: NextRequest): Promise<{ userId: string; data: Partial<IUser> }> {
    const userId = extractUserFromAuth(req);
    const body = await this.getBody(req);
    const result = updateProfileSchema.safeParse(body);
    if (!result.success) {
      throw new ValidationError(result.error.errors[0]?.message || "Invalid profile data");
    }
    return { userId, data: result.data as Partial<IUser> };
  }

  static async validateAddAddress(req: NextRequest): Promise<{ userId: string; data: Omit<IUserAddress, 'id'> }> {
    const userId = extractUserFromAuth(req);
    const body = await this.getBody(req);
    const result = addressSchema.safeParse(body);
    if (!result.success) {
      throw new ValidationError(result.error.errors[0]?.message || "Invalid address data");
    }
    return { userId, data: result.data as Omit<IUserAddress, 'id'> };
  }

  static async validateUpdateAddress(req: NextRequest): Promise<{ userId: string; data: Partial<IUserAddress> }> {
    const userId = extractUserFromAuth(req);
    const body = await this.getBody(req);
    const result = addressSchema.partial().safeParse(body);
    if (!result.success) {
      throw new ValidationError(result.error.errors[0]?.message || "Invalid address data");
    }
    return { userId, data: result.data as Partial<IUserAddress> };
  }

  static async validateChangePassword(req: NextRequest): Promise<{ userId: string; currentPassword: string; newPassword: string }> {
    const userId = extractUserFromAuth(req);
    const body = await this.getBody(req);
    const result = changePasswordSchema.safeParse(body);
    if (!result.success) {
      throw new ValidationError(result.error.errors[0]?.message || "Invalid password data");
    }
    return { userId, currentPassword: result.data.currentPassword, newPassword: result.data.newPassword };
  }

  static extractUserId(req: NextRequest): string {
    return extractUserFromAuth(req);
  }
}
