import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  normalizeSupportImage,
  openSupportImage,
  sealSupportImage,
} from "./orderSupportImages";
import { SUPPORT_IMAGE_MAX_BYTES } from "../shared/supportSharing";
const secret = "support-test-key-not-a-real-secret";
async function png() {
  return sharp({
    create: { width: 32, height: 24, channels: 3, background: "#0878f9" },
  })
    .png()
    .toBuffer();
}
describe("صور دعم آمنة", () => {
  it("يفك الصورة الحقيقية ويعيد ترميزها دون قص أو metadata", async () => {
    const input = await sharp(await png())
      .withMetadata({ orientation: 1 })
      .png()
      .toBuffer();
    const output = await normalizeSupportImage({
      id: randomUUID(),
      mimeType: "image/png",
      dataBase64: input.toString("base64"),
    });
    const info = await sharp(output).metadata();
    expect(info.format).toBe("webp");
    expect(info.width).toBe(32);
    expect(info.height).toBe(24);
    expect(info.exif).toBeUndefined();
    expect(info.icc).toBeUndefined();
  });
  it("يرفض SVG متنكرًا وصيغة MIME لا تطابق الصورة أو ملفات تالفة", async () => {
    for (const bytes of [
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>bad()</script></svg>'
      ),
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    ])
      await expect(
        normalizeSupportImage({
          id: randomUUID(),
          mimeType: "image/png",
          dataBase64: bytes.toString("base64"),
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      normalizeSupportImage({
        id: randomUUID(),
        mimeType: "image/jpeg",
        dataBase64: (await png()).toString("base64"),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("يرفض أحجام الإدخال والارتفاعات المفرطة قبل التخزين", async () => {
    await expect(
      normalizeSupportImage({
        id: randomUUID(),
        mimeType: "image/png",
        dataBase64: Buffer.alloc(SUPPORT_IMAGE_MAX_BYTES + 1).toString(
          "base64"
        ),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const tall = await sharp({
      create: { width: 2, height: 6001, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await expect(
      normalizeSupportImage({
        id: randomUUID(),
        mimeType: "image/png",
        dataBase64: tall.toString("base64"),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("يحفظ ciphertext فقط ويمنع فك الصورة بمفتاح خاطئ أو بعد التلاعب", async () => {
    const plain = await png();
    const sealed = sealSupportImage(plain, secret);
    expect(sealed.includes(plain)).toBe(false);
    expect(openSupportImage(sealed, secret)).toEqual(plain);
    expect(() => openSupportImage(sealed, "different-key")).toThrow();
    const tampered = Buffer.from(sealed);
    tampered[tampered.length - 1] ^= 1;
    expect(() => openSupportImage(tampered, secret)).toThrow();
  });
});
