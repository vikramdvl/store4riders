import { z } from "zod";
import {
  createUrlRedirectSchema,
  updateUrlRedirectSchema,
  normalizeSourcePath,
} from "@store4riders/shared-validation";

export class UrlRedirectValidator {
  static sanitizeFilterText(term: string | undefined | null): string {
    if (!term || typeof term !== "string") return "";
    return term
      .replace(/[\0\$\{\}\[\]\<\>\\]/g, "")
      .trim()
      .slice(0, 120);
  }

  static resolveQuery = z.object({
    path: z
      .string()
      .trim()
      .min(1, "Path is required")
      .max(500, "Path too long")
      .transform(normalizeSourcePath),
  });

  static listQuery = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    search: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((val) => (val ? UrlRedirectValidator.sanitizeFilterText(val) : undefined)),
    source: z
      .enum(["all", "manual", "auto_product", "auto_category", "auto_brand", "auto_blog"])
      .optional()
      .default("all"),
  });

  static createBody = createUrlRedirectSchema;
  static updateBody = updateUrlRedirectSchema;
}
