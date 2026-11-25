import { z } from "zod";

export const blockIpSchema = z.object({
  ip: z
    .string()
    .trim()
    .ip({ message: "Please enter a valid IPv4 or IPv6 address" }),
  reason: z
    .string()
    .trim()
    .min(3, "Reason must be at least 3 characters")
    .max(300, "Reason cannot exceed 300 characters"),
  durationHours: z
    .union([z.literal(1), z.literal(24), z.literal(168), z.null()])
    .optional()
    .default(24),
});

export type BlockIpInput = z.infer<typeof blockIpSchema>;
