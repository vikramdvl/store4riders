import { NextRequest } from "next/server";
import { blockIpSchema, BlockIpInput } from "@store4riders/shared-validation";
import { ValidationError } from "../../core/errors/AppError";

export class BlockedIpValidator {
  static async validateBlock(req: NextRequest): Promise<BlockIpInput> {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Invalid JSON request body");
    }

    const parsed = blockIpSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      throw new ValidationError(msg || "Invalid IP block payload");
    }
    return parsed.data;
  }

  static validateTarget(ipOrId: string): string {
    const trimmed = decodeURIComponent(ipOrId || "").trim();
    if (!trimmed || trimmed.length > 64) {
      throw new ValidationError("Invalid IP address or block ID");
    }
    return trimmed;
  }
}
