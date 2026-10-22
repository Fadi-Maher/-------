import { z } from "zod";
export const SUPPORT_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const SUPPORT_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const supportImageInput = z.object({
  id: z.string().uuid(),
  mimeType: z.enum(SUPPORT_IMAGE_TYPES),
  dataBase64: z
    .string()
    .min(4)
    .max(Math.ceil(SUPPORT_IMAGE_MAX_BYTES / 3) * 4 + 4)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
export const supportFollowupInput = z.object({
  id: z.string().uuid(),
  token: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  accessKey: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  note: z.string().trim().min(1).max(500),
  consent: z.literal(true),
});
export type SupportImageInput = z.infer<typeof supportImageInput>;
export type SupportFollowupInput = z.infer<typeof supportFollowupInput>;
export function createSupportAccessKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
