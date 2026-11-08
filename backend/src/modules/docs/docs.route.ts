import { NextRequest, NextResponse } from "next/server";
import { getSwaggerSpec } from "@/core/config/swagger";

/**
 * @file docs.route.ts
 * @description Serves Swagger UI and the OpenAPI JSON spec for automatic testing.
 * Protected: In production, requires Staff/Admin authentication to prevent information disclosure.
 */
export async function docsRouter(req: NextRequest, routePath: string[]): Promise<NextResponse | null> {
  // In production, Swagger documentation is strictly locked to Admin/Staff
  if (process.env.NODE_ENV === "production") {
    try {
      const { extractUserFromAuth } = await import("../../core/middlewares/auth");
      const { checkAdmin } = await import("../../core/middlewares/admin");
      const { UserService } = await import("../user/user.service");
      const userId = extractUserFromAuth(req);
      await checkAdmin(userId, UserService.getRole);
    } catch {
      return new NextResponse("Not Found", { status: 404 });
    }
  }

  if (req.method === "GET" && routePath.length === 0) {
    // Serve Swagger UI HTML
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Store4Riders Enterprise API Docs</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
        <style>
          body { margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
        <script>
          window.onload = () => {
            window.ui = SwaggerUIBundle({
              url: '/api/v1/docs/spec',
              dom_id: '#swagger-ui',
            });
          };
        </script>
      </body>
      </html>
    `;
    return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
  }

  if (req.method === "GET" && (routePath[0] === "spec" || routePath.length === 0)) {
    // Serve dynamic OpenAPI JSON Spec generated from JSDoc comments
    return NextResponse.json(getSwaggerSpec());
  }

  return null;
}
