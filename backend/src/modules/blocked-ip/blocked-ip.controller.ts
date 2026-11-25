import { NextRequest } from "next/server";
import { ApiResponse } from "../../core/response/ApiResponse";
import { BlockedIpService } from "./blocked-ip.service";
import { BlockedIpValidator } from "./blocked-ip.validator";

export class BlockedIpController {
  static async list() {
    const items = await BlockedIpService.listBlockedIps();
    return ApiResponse.success(items, "Blocked IPs fetched successfully");
  }

  static async block(req: NextRequest, actorUserId: string) {
    const input = await BlockedIpValidator.validateBlock(req);
    const record = await BlockedIpService.blockIp(input, actorUserId, req);
    return ApiResponse.success(record, `IP ${record.ip} blocked successfully`, 201);
  }

  static async unblock(req: NextRequest, ipOrId: string, actorUserId: string) {
    const target = BlockedIpValidator.validateTarget(ipOrId);
    const result = await BlockedIpService.unblockIp(target, actorUserId, req);
    return ApiResponse.success(result, `IP ${result.ip} unblocked successfully`);
  }
}
