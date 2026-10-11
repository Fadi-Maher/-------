import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { assistantConversationMessages, assistantConversationSessions, assistantFaqs } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";

const invokeLLM = vi.hoisted(() => vi.fn());
vi.mock("./_core/llm", () => ({ invokeLLM }));

import { appRouter } from "./routers";

const publicIds: string[] = [];
const faqIds: number[] = [];

function publicContext(ip: string): TrpcContext {
  return {
    user: null,
    req: { headers: { "x-forwarded-for": ip }, ip } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function adminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "assistant-integration-admin",
      name: "Integration Admin",
      email: "admin@example.com",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: { "x-forwarded-for": "198.51.100.8" }, ip: "198.51.100.8" } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("قاعدة معرفة المساعد وسجل المحادثة الموافق عليه", () => {
  beforeAll(() => {
    invokeLLM.mockResolvedValue({
      id: "assistant-integration",
      created: 0,
      model: "gpt-5-mini",
      choices: [{ index: 0, message: { role: "assistant", content: "افتح صفحة طلباتي لمتابعة الطلب." }, finish_reason: "stop" }],
    });
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    for (const publicId of publicIds) {
      const sessions = await db.select({ id: assistantConversationSessions.id }).from(assistantConversationSessions).where(eq(assistantConversationSessions.publicId, publicId));
      for (const session of sessions) await db.delete(assistantConversationMessages).where(eq(assistantConversationMessages.sessionId, session.id));
      await db.delete(assistantConversationSessions).where(eq(assistantConversationSessions.publicId, publicId));
    }
    for (const id of faqIds) await db.delete(assistantFaqs).where(eq(assistantFaqs.id, id));
  });

  it("يقصر إدارة الأسئلة على المالك ويدعم الإنشاء والتعديل والتعطيل والحذف", async () => {
    const publicCaller = appRouter.createCaller(publicContext("198.51.100.10"));
    await expect(publicCaller.assistant.knowledge.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const adminCaller = appRouter.createCaller(adminContext());
    const created = await adminCaller.assistant.knowledge.create({
      questionAr: "كيف أتابع طلبي التجريبي؟",
      answerAr: "استخدم صفحة طلباتي بعد التحقق.",
      questionEn: "How do I track my test request?",
      answerEn: "Open My Requests after verification.",
      isActive: true,
      sortOrder: 9999,
    });
    faqIds.push(created.id);
    expect((await adminCaller.assistant.knowledge.list()).some(item => item.id === created.id)).toBe(true);

    const updated = await adminCaller.assistant.knowledge.update({
      id: created.id,
      questionAr: created.questionAr,
      answerAr: "استخدم صفحة طلباتي بعد التحقق من رقم الجوال.",
      questionEn: created.questionEn,
      answerEn: created.answerEn,
      isActive: false,
      sortOrder: 9998,
    });
    expect(updated).toMatchObject({ id: created.id, isActive: false, sortOrder: 9998 });

    await adminCaller.assistant.knowledge.delete({ id: created.id });
    faqIds.splice(faqIds.indexOf(created.id), 1);
    expect((await adminCaller.assistant.knowledge.list()).some(item => item.id === created.id)).toBe(false);
  });

  it("لا يحفظ دون موافقة ويحفظ نسخة منقحة بعدها ثم يوقف الاستعادة عند إلغاء الموافقة", async () => {
    const caller = appRouter.createCaller(publicContext("198.51.100.11"));
    const withoutConsent = await caller.assistant.chat({
      language: "ar",
      messages: [{ role: "user", content: "كيف أتابع طلبي؟" }],
      consentSessionId: null,
    });
    expect(withoutConsent.saved).toBe(false);

    const publicId = crypto.randomUUID();
    publicIds.push(publicId);
    await caller.assistant.consent({ publicId, language: "ar", consent: true });
    expect(await caller.assistant.history({ publicId })).toMatchObject({ consented: true, messages: [] });

    const saved = await caller.assistant.chat({
      language: "ar",
      messages: [{ role: "user", content: "جوالي 0530204050، كيف أتابع طلبي؟" }],
      consentSessionId: publicId,
    });
    expect(saved.saved).toBe(true);
    const history = await caller.assistant.history({ publicId });
    expect(history.consented).toBe(true);
    expect(history.messages).toHaveLength(2);
    expect(JSON.stringify(history.messages)).not.toContain("0530204050");
    expect(JSON.stringify(history.messages)).toContain("[بيانات محجوبة]");

    await caller.assistant.revokeConsent({ publicId });
    expect(await caller.assistant.history({ publicId })).toEqual({ consented: false, messages: [] });
    const afterRevoke = await caller.assistant.chat({
      language: "ar",
      messages: [{ role: "user", content: "هل ما زال الحفظ يعمل؟" }],
      consentSessionId: publicId,
    });
    expect(afterRevoke.saved).toBe(false);
  });
});
