import { NextRequest, NextResponse } from "next/server";
import { ReviewController } from "./review.controller";
import { checkReviewRateLimit } from "../../core/middlewares/rateLimiter";
import { extractUserFromAuth } from "../../core/middlewares/auth";
import { checkAdmin } from "../../core/middlewares/admin";
import { UserService } from "../user/user.service";

/**
 * @swagger
 * /api/v1/reviews/store:
 *   get:
 *     summary: Get saved Store/Google reviews for homepage
 *     tags: [Reviews]
 *     responses:
 *       200:
 *         description: List of latest 10 saved store reviews
 * 
 * /api/v1/reviews/store/stats:
 *   get:
 *     summary: Get dynamic Google store rating and review count
 *     tags: [Reviews]
 *     responses:
 *       200:
 *         description: Dynamic rating stats
 * 
 * /api/v1/reviews/store/sync:
 *   post:
 *     summary: Fetch latest 10 reviews from SerpApi and save to database (Admin only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reviews fetched and saved successfully
 */
export async function reviewRouter(req: NextRequest, routePath: string[]): Promise<NextResponse | null> {
  const method = req.method;
  const pathLen = routePath.length;

  if (method === "POST" && pathLen === 0) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1";
    await checkReviewRateLimit(ip);
    return await ReviewController.create(req);
  }

  if (method === "GET" && pathLen === 2 && routePath[0] === "product") {
    return await ReviewController.getByProduct(req, routePath[1]);
  }

  if (method === "GET" && pathLen === 2 && routePath[0] === "store" && routePath[1] === "account") {
    const userId = extractUserFromAuth(req);
    await checkAdmin(userId, UserService.getRole);
    return await ReviewController.getAccountStatus(req);
  }

  if (method === "GET" && pathLen === 2 && routePath[0] === "store" && routePath[1] === "stats") {
    return await ReviewController.getStoreRatingStats(req);
  }

  if (method === "GET" && pathLen === 1 && routePath[0] === "store") {
    return await ReviewController.getStoreReviews(req);
  }

  if (method === "POST" && pathLen === 2 && routePath[0] === "store" && routePath[1] === "sync") {
    const userId = extractUserFromAuth(req);
    await checkAdmin(userId, UserService.getRole);
    return await ReviewController.syncGoogleReviews(req);
  }

  return null;
}
