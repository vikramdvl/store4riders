import { z } from "zod";

const FORBIDDEN_SOURCE_PREFIXES = ["/admin", "/api", "/_next"];

export function normalizeRedirectPath(rawPath: string): string {
  const trimmed = (rawPath || "").trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "") || "/"}${parsed.search}`;
    } catch {
      return trimmed;
    }
  }

  const [pathOnly, queryPart] = trimmed.split("?");
  const cleanedPath =
    "/" +
    pathOnly
      .replace(/^\/+|\/+$/g, "")
      .replace(/\/{2,}/g, "/")
      .toLowerCase();

  if (cleanedPath === "/") {
    return queryPart ? `/?${queryPart}` : "/";
  }

  return queryPart ? `${cleanedPath}?${queryPart}` : cleanedPath;
}

export function normalizeSourcePath(rawPath: string): string {
  const trimmed = (rawPath || "").trim();
  if (!trimmed) return "";

  // If admin pastes a full URL, extract pathname cleanly
  let pathOnly = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      pathOnly = new URL(trimmed).pathname;
    } catch {
      return "";
    }
  } else {
    pathOnly = trimmed.split("?")[0].split("#")[0];
  }

  const normalized =
    "/" +
    pathOnly
      .replace(/^\/+|\/+$/g, "")
      .replace(/\/{2,}/g, "/")
      .toLowerCase();

  return normalized;
}

export const createUrlRedirectSchema = z
  .object({
    fromPath: z
      .string()
      .trim()
      .min(1, "Source URL path is required")
      .max(500, "Source URL path cannot exceed 500 characters")
      .transform(normalizeSourcePath)
      .refine((val) => val.startsWith("/") && val.length > 1, {
        message: "Source path must be a valid non-root path like /old-page",
      })
      .refine((val) => !val.includes("..") && !/\s/.test(val), {
        message: "Source path cannot contain spaces or '..'",
      })
      .refine(
        (val) =>
          !FORBIDDEN_SOURCE_PREFIXES.some(
            (prefix) => val === prefix || val.startsWith(`${prefix}/`)
          ),
        {
          message: "Cannot redirect internal /admin, /api, or /_next routes",
        }
      ),
    toPath: z
      .string()
      .trim()
      .min(1, "Destination URL is required")
      .max(500, "Destination URL cannot exceed 500 characters")
      .transform(normalizeRedirectPath)
      .refine(
        (val) =>
          (val.startsWith("/") || /^https?:\/\//i.test(val)) &&
          !val.includes("..") &&
          !/\s/.test(val),
        {
          message: "Destination must be a valid path (/new-page) or http(s) URL without spaces",
        }
      ),
    statusCode: z.union([z.literal(301), z.literal(302)]).default(301),
    source: z
      .enum(["manual", "auto_product", "auto_category", "auto_brand", "auto_blog"])
      .optional()
      .default("manual"),
    isActive: z.boolean().optional().default(true),
    note: z.string().trim().max(300).optional().default(""),
  })
  .refine((data) => data.fromPath !== data.toPath, {
    message: "Source path and destination URL cannot be the same",
    path: ["toPath"],
  });

export const updateUrlRedirectSchema = z.object({
  fromPath: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .transform(normalizeSourcePath)
    .refine((val) => val.startsWith("/") && val.length > 1, {
      message: "Source path must be a valid non-root path like /old-page",
    })
    .refine((val) => !val.includes("..") && !/\s/.test(val), {
      message: "Source path cannot contain spaces or '..'",
    })
    .refine(
      (val) =>
        !FORBIDDEN_SOURCE_PREFIXES.some(
          (prefix) => val === prefix || val.startsWith(`${prefix}/`)
        ),
      {
        message: "Cannot redirect internal /admin, /api, or /_next routes",
      }
    )
    .optional(),
  toPath: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .transform(normalizeRedirectPath)
    .refine(
      (val) =>
        (val.startsWith("/") || /^https?:\/\//i.test(val)) &&
        !val.includes("..") &&
        !/\s/.test(val),
      {
        message: "Destination must be a valid path (/new-page) or http(s) URL without spaces",
      }
    )
    .optional(),
  statusCode: z.union([z.literal(301), z.literal(302)]).optional(),
  isActive: z.boolean().optional(),
  note: z.string().trim().max(300).optional(),
});
