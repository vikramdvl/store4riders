import { z } from "zod";
import { ValidationError } from "../../core/errors/AppError";

const pincodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Valid 6-digit Indian pincode is required");

export class PincodeValidator {
  static validatePincode(rawPincode: string): string {
    const parsed = pincodeSchema.safeParse(rawPincode);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || "Invalid pincode format");
    }
    return parsed.data;
  }
}
