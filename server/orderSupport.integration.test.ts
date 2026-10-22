import { afterAll, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as support from "./orderSupportDb";
import {
  supportAttachments,
  supportEvents,
  supportFeedback,
  supportMessages,
  supportRateLimits,
  supportSessions,
} from "../drizzle/supportSchema";
import sharp from "sharp";
const tokens: string[] = [];
const rateKey = `support-integration-${randomUUID()}`;
// Isolate anonymous test events with a unique future timestamp; delete only that exact stamp.
const stamp =
  Date.now() + 7 * 24 * 60 * 60 * 1000 + Math.floor(Math.random() * 100000);
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
afterAll(async () => {
  vi.restoreAllMocks();
  const db = await getDb();
  if (!db) return;
  for (const token of tokens) await support.deleteSupport(token);
  await db.delete(supportEvents).where(eq(supportEvents.createdAt, stamp));
  await db.delete(supportFeedback).where(eq(supportFeedback.createdAt, stamp));
  await db
    .delete(supportRateLimits)
    .where(eq(supportRateLimits.keyHash, hash(rateKey)));
});
describe("تكامل الدعم الحقيقي", () => {
  it("يحفظ بموافقة ويستعيد ويصعّد مرة ويرسل ردًا بشريًا ويغلق ويحذف بأمان", async () => {
    vi.spyOn(Date, "now").mockReturnValue(stamp);
    const db = await getDb();
    expect(db).toBeTruthy();
    const anonymous = await support.sendSupport({
      language: "ar",
      turns: [{ role: "user", content: "كيف أتتبع حالة طلبي؟" }],
      turnId: randomUUID(),
    });
    expect(anonymous.saved).toBe(false);
    const { token } = await support.startSupport("ar", []);
    tokens.push(token);
    const [row] = await db!
      .select()
      .from(supportSessions)
      .where(eq(supportSessions.tokenHash, hash(token)));
    expect(row.tokenHash).not.toBe(token);
    expect(row.consentVersion).toBe("2026-10-20");
    await expect(support.readSupport("b".repeat(64))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const turnId = randomUUID();
    const payload = {
      token,
      language: "ar" as const,
      turns: [{ role: "user" as const, content: "كيف أقارن عروض الأسعار؟" }],
      turnId,
    };
    expect((await support.sendSupport(payload)).reply?.intent).toBe("quotes");
    await support.sendSupport(payload);
    expect((await support.readSupport(token)).messages).toHaveLength(2);
    const follow = await support.sendSupport({
      token,
      language: "ar",
      turns: [{ role: "user", content: "بعد الاعتماد" }],
      turnId: randomUUID(),
    });
    expect(follow.reply?.text).toContain("بعد اعتماد العرض");
    await support.sendSupport({
      token,
      language: "ar",
      turns: [
        {
          role: "user",
          content: "جوالي ٠٥٣٠٢٠٤٠٥٠ والبريد secret@example.com",
        },
      ],
      turnId: randomUUID(),
    });
    expect(
      JSON.stringify((await support.readSupport(token)).messages)
    ).not.toMatch(/0530204050|secret@example/);
    await support.handoffSupport(token);
    await support.handoffSupport(token);
    const waiting = await support.readSupport(token);
    expect(waiting.status).toBe("waiting");
    expect(waiting.messages.filter(m => m.sender === "system")).toHaveLength(1);
    const afterHandoff = await support.sendSupport({
      token,
      language: "ar",
      turns: [{ role: "user", content: "أحتاج مراجعة من الفريق" }],
      turnId: randomUUID(),
    });
    expect(afterHandoff.reply).toBeNull();
    expect(
      (await support.listSupport("waiting")).some(s => s.id === waiting.id)
    ).toBe(true);
    const humanTurn = randomUUID();
    await support.replySupport(
      waiting.id,
      "راجعنا سؤالك. افتح طلباتي لمتابعة التفاصيل بأمان.",
      humanTurn
    );
    await support.replySupport(
      waiting.id,
      "راجعنا سؤالك. افتح طلباتي لمتابعة التفاصيل بأمان.",
      humanTurn
    );
    const human = await support.readSupport(token);
    expect(human.status).toBe("human");
    expect(human.messages.filter(m => m.sender === "human")).toHaveLength(1);
    await support.rateSupport(token, "helpful");
    await support.rateSupport(token, "unhelpful");
    expect((await support.readSupport(token)).rating).toBe("helpful");
    const eventRows = await db!
      .select()
      .from(supportEvents)
      .where(eq(supportEvents.createdAt, stamp));
    expect(eventRows.filter(e => e.kind === "handoff")).toHaveLength(1);
    expect(eventRows.filter(e => e.kind === "helpful")).toHaveLength(1);
    await support.closeSupport(waiting.id);
    expect((await support.readSupport(token)).status).toBe("closed");
    await expect(
      support.replySupport(waiting.id, "رد إضافي", randomUUID())
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(support.sendSupport(payload)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    await support.deleteSupport(token);
    await expect(support.readSupport(token)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(
      await db!
        .select()
        .from(supportMessages)
        .where(eq(supportMessages.sessionId, waiting.id))
    ).toHaveLength(0);
  }, 60000);
  it("يرفض استعادة جلسة تجاوزت 30 يومًا ويطبّق حدًا دائمًا للاستخدام", async () => {
    vi.spyOn(Date, "now").mockReturnValue(stamp);
    const db = await getDb();
    const { token } = await support.startSupport("en", []);
    tokens.push(token);
    await db!
      .update(supportSessions)
      .set({ createdAt: stamp - 31 * 24 * 60 * 60 * 1000 })
      .where(eq(supportSessions.tokenHash, hash(token)));
    await expect(support.readSupport(token)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await db!.insert(supportRateLimits).values({
      keyHash: hash(rateKey),
      requestCount: 80,
      windowStartedAt: stamp,
    });
    await expect(support.limitSupport(rateKey)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  }, 10000);
  it("يقبل تقييم زائر دون سجل، ويمنع تقييم المحادثة المحفوظة قبل إغلاقها والتقييم المتكرر", async () => {
    vi.spyOn(Date, "now").mockReturnValue(stamp);
    const db = await getDb();
    const id = randomUUID();
    await support.submitSupportFeedback({
      id,
      language: "ar",
      stars: 3,
      comment: "خطوات أوضح، البريد test@example.com ورقم ٠٥٣٠٢٠٤٠٥٠",
      consent: true,
      finished: true,
    });
    await support.submitSupportFeedback({
      id,
      language: "ar",
      stars: 5,
      comment: "duplicate",
      consent: true,
      finished: true,
    });
    const anonymousRows = await db!
      .select()
      .from(supportFeedback)
      .where(eq(supportFeedback.id, id));
    expect(anonymousRows).toHaveLength(1);
    expect(anonymousRows[0].sessionId).toBeNull();
    expect(anonymousRows[0].stars).toBe(3);
    expect(anonymousRows[0].comment).not.toMatch(/test@example|0530204050/);
    const { token } = await support.startSupport("en", []);
    tokens.push(token);
    const payload = {
      id: randomUUID(),
      token,
      language: "en" as const,
      stars: 5,
      comment: "Clear help",
      consent: true as const,
      finished: true as const,
    };
    await expect(support.submitSupportFeedback(payload)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    await support.finishSupport(token);
    await support.finishSupport(token);
    await support.submitSupportFeedback(payload);
    await support.submitSupportFeedback({
      ...payload,
      id: randomUUID(),
      stars: 1,
    });
    const history = await support.readSupport(token);
    expect(history.status).toBe("closed");
    expect(history.feedback?.stars).toBe(5);
    expect(history.messages.filter(m => m.sender === "system")).toHaveLength(1);
    const summary = await support.supportAnalytics();
    expect(summary.feedbackSummary.total).toBeGreaterThanOrEqual(2);
    expect(summary.feedbackDistribution.some(item => item.stars === 3)).toBe(
      true
    );
    await support.deleteSupport(token);
    expect(
      await db!
        .select()
        .from(supportFeedback)
        .where(eq(supportFeedback.sessionId, history.id))
    ).toHaveLength(0);
  }, 30000);
  it("يحمي التفاصيل الإضافية للمجهول وللجلسة ولا يكرر حفظها أو يغير النجوم", async () => {
    vi.spyOn(Date, "now").mockReturnValue(stamp);
    const db = await getDb();
    const id = randomUUID();
    const accessKey = "c".repeat(64);
    await support.submitSupportFeedback({
      id,
      accessKey,
      language: "ar",
      stars: 2,
      comment: "",
      consent: true,
      finished: true,
    });
    await expect(
      support.followupSupportFeedback({
        id,
        accessKey: "d".repeat(64),
        note: "wrong",
        consent: true,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await support.followupSupportFeedback({
      id,
      accessKey,
      note: "تعثر في الخطوة، البريد private@example.com",
      consent: true,
    });
    await support.followupSupportFeedback({
      id,
      accessKey,
      note: "duplicate",
      consent: true,
    });
    const [row] = await db!
      .select()
      .from(supportFeedback)
      .where(eq(supportFeedback.id, id));
    expect(row.accessKeyHash).toBe(hash(accessKey));
    expect(row.accessKeyHash).not.toBe(accessKey);
    expect(row.followupNote).not.toContain("private@example");
    expect(row.followupNote).not.toBe("duplicate");
    expect(row.stars).toBe(2);
    const { token } = await support.startSupport("ar", []);
    tokens.push(token);
    await support.finishSupport(token);
    const own = await support.submitSupportFeedback({
      id: randomUUID(),
      token,
      language: "ar",
      stars: 1,
      comment: "",
      consent: true,
      finished: true,
    });
    await expect(
      support.followupSupportFeedback({
        id: own.id,
        token: "e".repeat(64),
        note: "wrong",
        consent: true,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await support.followupSupportFeedback({
      id: own.id,
      token,
      note: "الخطوات لم تكن واضحة",
      consent: true,
    });
    expect((await support.readSupport(token)).feedback?.followupProvided).toBe(
      true
    );
    const positive = await support.submitSupportFeedback({
      id: randomUUID(),
      accessKey,
      language: "ar",
      stars: 4,
      comment: "",
      consent: true,
      finished: true,
    });
    await expect(
      support.followupSupportFeedback({
        id: positive.id,
        accessKey,
        note: "unsupported",
        consent: true,
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  }, 30000);
  it("يحفظ لقطة مشفرة مع التصعيد مرة ويحميها من رمز مختلف ثم يبطلها عند حذف المحادثة", async () => {
    vi.spyOn(Date, "now").mockReturnValue(stamp);
    const db = await getDb();
    const { token } = await support.startSupport("ar", []);
    tokens.push(token);
    const attachment = {
      id: randomUUID(),
      mimeType: "image/png" as const,
      dataBase64: (
        await sharp({
          create: { width: 24, height: 16, channels: 3, background: "#0878f9" },
        })
          .png()
          .toBuffer()
      ).toString("base64"),
    };
    await expect(
      support.handoffSupport(token, {
        ...attachment,
        dataBase64: Buffer.from("invalid").toString("base64"),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await support.readSupport(token)).status).toBe("bot");
    await support.handoffSupport(token, attachment);
    await support.handoffSupport(token, attachment);
    const history = await support.readSupport(token);
    expect(history.attachments).toHaveLength(1);
    expect(JSON.stringify(history)).not.toMatch(
      /storageKey|support-private|manus-storage/
    );
    const rows = await db!
      .select()
      .from(supportAttachments)
      .where(eq(supportAttachments.sessionId, history.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].storageKey).toMatch(/support-private/);
    await expect(
      support.getSupportImage(attachment.id, "f".repeat(64))
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const image = await support.getSupportImage(attachment.id, token);
    expect(
      (await sharp(Buffer.from(image.dataBase64, "base64")).metadata()).format
    ).toBe("webp");
    expect(
      (await support.getSupportImage(attachment.id, undefined, true)).dataBase64
    ).toBe(image.dataBase64);
    await support.deleteSupport(token);
    await expect(
      support.getSupportImage(attachment.id, token)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      await db!
        .select()
        .from(supportAttachments)
        .where(eq(supportAttachments.id, attachment.id))
    ).toHaveLength(0);
  }, 45000);
});
