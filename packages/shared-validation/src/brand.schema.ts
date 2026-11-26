import { z } from "zod";

export const brandFaqSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

const booleanCoerce = z
  .union([z.boolean(), z.string(), z.number()])
  .transform((val) => {
    if (val === true || val === "true" || val === 1 || val === "1") return true;
    return false;
  });

export const brandBaseSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100),
  aliases: z.array(z.string()).optional(),
  logo: z.string().optional(),
  description: z.string().optional(),
  faqs: z.array(brandFaqSchema).optional(),
  isActive: booleanCoerce.optional(),
  showInMenu: booleanCoerce.optional(),
  menuGroup: z.string().optional(),
  menuGroups: z.array(z.string()).optional(),
  metaTitle: z.string().max(300).optional().or(z.literal("")),
  metaDescription: z.string().max(2000).optional().or(z.literal("")),
  metaKeywords: z.string().max(2000).optional().or(z.literal("")),
});

export const createBrandSchema = brandBaseSchema.extend({
  isActive: booleanCoerce.default(true),
  showInMenu: booleanCoerce.default(false),
});

export const updateBrandSchema = brandBaseSchema.partial();
