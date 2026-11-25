import { NextRequest, NextResponse } from "next/server";
import { BlockedIpController } from "./blocked-ip.controller";
import { extractUserFromAuth } from "../../core/middlewares/auth";
import { checkAdmin } from "../../core/middlewares/admin";
import { UserService } from "../user/user.service";

/**
 * @swagger
 * tags:
 *   name: BlockedIPs
 *   description: Admin IP blocklist management for brute-force & abuse protection
 *
 * /api/v1/admin/blocked-ips:
 *   get:
 *     summary: List all currently active blocked IPs
 *     tags: [BlockedIPs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Active blocked IPs fetched
 *   post:
 *     summary: Block an IP address temporarily or permanently
 *     tags: [BlockedIPs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ip, reason]
 *             properties:
 *               ip: { type: string }
 *               reason: { type: string }
 *               durationHours: { type: number, nullable: true, enum: [1, 24, 168] }
 *     responses:
 *       201:
 *         description: IP blocked successfully
 *
 * /api/v1/admin/blocked-ips/{ipOrId}:
 *   delete:
 *     summary: Unblock an IP address by IP string or record ID
 *     tags: [BlockedIPs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: ipOrId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: IP unblocked successfully
 */
export async function blockedIpRouter(req: NextRequest, routePath: string[]): Promise<NextResponse | null> {
  const method = req.method;
  const pathLen = routePath.length;

  const userId = extractUserFromAuth(req);
  await checkAdmin(userId, UserService.getRole);

  if (pathLen === 0) {
    if (method === "GET") return await BlockedIpController.list();
    if (method === "POST") return await BlockedIpController.block(req, userId);
  }

  if (pathLen === 1 && method === "DELETE") {
    return await BlockedIpController.unblock(req, routePath[0], userId);
  }

  return null;
}
