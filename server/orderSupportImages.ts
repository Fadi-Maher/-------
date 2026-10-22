import { TRPCError } from "@trpc/server";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import sharp from "sharp";
import {
  SUPPORT_IMAGE_MAX_BYTES,
  supportImageInput,
  type SupportImageInput,
} from "../shared/supportSharing";
import { storageGetSignedUrl, storagePut } from "./storage";

sharp.concurrency(1);
sharp.cache(false);
let processing = false;
function encryptionKey(secret = process.env.JWT_SECRET) {
  if (!secret)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "رفع الصور غير متاح مؤقتًا.",
    });
  return createHash("sha256")
    .update("maalamati-support-image-v1:")
    .update(secret)
    .digest();
}
export function sealSupportImage(bytes: Buffer, secret?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([
    Buffer.from("MCS1"),
    iv,
    cipher.getAuthTag(),
    encrypted,
  ]);
}
export function openSupportImage(bytes: Buffer, secret?: string) {
  if (bytes.length < 32 || !bytes.subarray(0, 4).equals(Buffer.from("MCS1")))
    throw new Error("Invalid encrypted support image.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(secret),
    bytes.subarray(4, 16)
  );
  decipher.setAuthTag(bytes.subarray(16, 32));
  return Buffer.concat([decipher.update(bytes.subarray(32)), decipher.final()]);
}
export async function normalizeSupportImage(raw: SupportImageInput) {
  const input = supportImageInput.parse(raw);
  const bytes = Buffer.from(input.dataBase64, "base64");
  if (
    bytes.length === 0 ||
    bytes.length > SUPPORT_IMAGE_MAX_BYTES ||
    bytes.toString("base64") !== input.dataBase64
  )
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "الصورة غير صالحة أو تتجاوز3MB.",
    });
  const matchesHeader =
    input.mimeType === "image/png"
      ? bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : input.mimeType === "image/jpeg"
        ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
        : bytes.subarray(0, 4).toString() === "RIFF" &&
          bytes.subarray(8, 12).toString() === "WEBP";
  if (!matchesHeader)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "محتوى الملف لا يطابق صيغة الصورة المسموح بها.",
    });
  if (processing)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "تجري معالجة صورة أخرى. حاول رفع اللقطة بعد لحظات.",
    });
  processing = true;
  try {
    const image = sharp(bytes, {
      limitInputPixels: 12_000_000,
      failOn: "error",
      animated: false,
    });
    const metadata = await image.metadata();
    const expected = {
      "image/png": "png",
      "image/jpeg": "jpeg",
      "image/webp": "webp",
    }[input.mimeType];
    if (
      metadata.format !== expected ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > 6000 ||
      metadata.height > 6000 ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error("Unsupported image.");
    // Re-encoding strips EXIF/GPS and other user-supplied metadata. No crop or AI processing.
    const normalized = await image
      .rotate()
      .resize({
        width: 2400,
        height: 6000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
    if (normalized.length > SUPPORT_IMAGE_MAX_BYTES)
      throw new Error("Normalized image is too large.");
    return normalized;
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "تعذر قراءة الصورة. اختر PNG أو JPEG أو WebP سليمة حتى3MB وبحد12مليون بكسل وطول6000بكسل.",
    });
  } finally {
    processing = false;
  }
}
export async function storeSupportImage(id: string, input: SupportImageInput) {
  const normalized = await normalizeSupportImage(input);
  const sealed = sealSupportImage(normalized);
  const stored = await storagePut(
    `support-private/${id}.bin`,
    sealed,
    "application/octet-stream"
  );
  return {
    storageKey: stored.key,
    byteSize: normalized.length,
    mimeType: "image/webp",
  };
}
export async function loadSupportImage(storageKey: string) {
  try {
    const url = await storageGetSignedUrl(storageKey);
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Unavailable.");
    const sealed = Buffer.from(await response.arrayBuffer());
    if (sealed.length > SUPPORT_IMAGE_MAX_BYTES + 32)
      throw new Error("Unexpected image size.");
    return {
      mimeType: "image/webp" as const,
      dataBase64: openSupportImage(sealed).toString("base64"),
    };
  } catch {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "لقطة الشاشة غير متاحة. حاول مجددًا أو أرسل شرحًا نصيًا.",
    });
  }
}
