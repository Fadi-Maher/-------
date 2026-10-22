import { z } from "zod";
export const supportFeedbackInput = z.object({
  id: z.string().uuid(),
  token: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  language: z.enum(["ar", "en"]),
  accessKey: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).default(""),
  consent: z.literal(true),
  finished: z.literal(true),
});
export type SupportFeedbackInput = z.infer<typeof supportFeedbackInput>;
