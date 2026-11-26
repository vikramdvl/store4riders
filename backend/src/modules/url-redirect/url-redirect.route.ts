import { NextRequest } from "next/server";
import { UrlRedirectController } from "./url-redirect.controller";
import { extractUserFromAuth } from "../../core/middlewares/auth";
import { checkPermission } from "../../core/middlewares/permission";
import { PermissionAction } from "../../core/config/permissions";
import { UserService } from "../user/user.service";

/**
 * @swagger
 * tags:
 *   name: URL Redirects
 *   description: SEO HTTP 301/302 URL Page Redirects & Auto-Slug Redirect Rules
 */

export async function urlRedirectRouter(req: NextRequest, routePath: string) {
  const method = req.method;

  /**
   * @swagger
   * /api/v1/url-redirects/resolve:
   *   get:
   *     summary: Resolve an active 301/302 redirect for a URL path
   *     tags: [URL Redirects]
   *     parameters:
   *       - in: query
   *         name: path
   *         schema:
   *           type: string
   *         required: true
   *         description: Source URL pathname (e.g. /old-helmet-page)
   *     responses:
   *       200:
   *         description: Redirect resolution result
   */
  if (method === "GET" && routePath === "resolve") {
    return await UrlRedirectController.resolve(req);
  }

  /**
   * @swagger
   * /api/v1/url-redirects/active-map:
   *   get:
   *     summary: Get active URL redirect rules map for edge/middleware routing
   *     tags: [URL Redirects]
   *     responses:
   *       200:
   *         description: Active URL redirect rules returned
   */
  if (method === "GET" && routePath === "active-map") {
    return await UrlRedirectController.activeMap();
  }

  // Admin-protected endpoints
  const userId = extractUserFromAuth(req);
  await checkPermission(userId, PermissionAction.MANAGE_CATEGORIES, UserService.getRole);

  /**
   * @swagger
   * /api/v1/url-redirects:
   *   get:
   *     summary: List paginated URL redirect rules
   *     tags: [URL Redirects]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *       - in: query
   *         name: source
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Paginated URL redirects fetched
   */
  if (method === "GET" && routePath === "") {
    return await UrlRedirectController.list(req);
  }

  /**
   * @swagger
   * /api/v1/url-redirects:
   *   post:
   *     summary: Create a manual 301/302 URL redirect rule
   *     tags: [URL Redirects]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [fromPath, toPath]
   *             properties:
   *               fromPath:
   *                 type: string
   *               toPath:
   *                 type: string
   *               statusCode:
   *                 type: integer
   *                 enum: [301, 302]
   *               isActive:
   *                 type: boolean
   *               note:
   *                 type: string
   *     responses:
   *       201:
   *         description: URL redirect created
   */
  if (method === "POST" && routePath === "") {
    return await UrlRedirectController.create(req);
  }

  const id = routePath.split("/")[0];
  if (id) {
    if (method === "GET") {
      return await UrlRedirectController.getById(id);
    }
    /**
     * @swagger
     * /api/v1/url-redirects/{id}:
     *   put:
     *     summary: Update an existing URL redirect rule
     *     tags: [URL Redirects]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: URL redirect updated
     */
    if (method === "PUT") {
      return await UrlRedirectController.update(req, id);
    }
    /**
     * @swagger
     * /api/v1/url-redirects/{id}:
     *   delete:
     *     summary: Delete a URL redirect rule
     *     tags: [URL Redirects]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: URL redirect deleted
     */
    if (method === "DELETE") {
      return await UrlRedirectController.delete(id);
    }
  }

  return null;
}
