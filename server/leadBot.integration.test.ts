import { randomUUID } from "node:crypto";
import { and, eq, gte, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { leadBotConversations, leadBotEvents, leadBotLeads, leadBotMessages, teamNotifications } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";

const notifyOwner = vi.hoisted(() => vi.fn(async () => true));
const invokeLLM = vi.hoisted(() => vi.fn());
vi.mock("./_core/notification", () => ({ notifyOwner }));
vi.mock("./_core/llm", () => ({ invokeLLM }));

import { appRouter } from "./routers";
import { LEAD_NOTIFICATION_TYPES } from "./leadBot/notifications";
import { MAX_MESSAGES_PER_MINUTE } from "./leadBot/service";
import { commitTurn } from "./leadBot/repo";
import { createInitialState } from "../shared/leadBot/engine";

const startedAt = Date.now();
const tokens: string[] = [];
const TEST_PHONE = "0500000177";

function publicCaller(ip = "203.0.113.77") {
  const ctx: TrpcContext = {
    user: null,
    req: { headers: { "x-forwarded-for": ip }, ip } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

function userCaller(role: "admin" | "user" | "employee", id = 990001) {
  const ctx: TrpcContext = {
    user: {
      id,
      openId: `leadbot-test-${role}-${id}`,
      name: role === "admin" ? "مالك الاختبار" : "مستخدم اختبار",
      email: null,
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
    req: { headers: { "x-forwarded-for": "203.0.113.78" }, ip: "203.0.113.78" } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

async function startConversation(caller = publicCaller()) {
  const view = await caller.leadBot.visitor.start({ lang: "ar", pagePath: "/contact", consentToStore: true });
  if (view.disabled) throw new Error("lead bot disabled in settings");
  tokens.push(view.token);
  return view;
}

function send(token: string, input: { text?: string; quickReply?: string; label?: string }, clientId = randomUUID(), caller = publicCaller()) {
  return caller.leadBot.visitor.send({ token, clientId, ...input });
}

async function conversationId(token: string) {
  const db = (await getDb())!;
  const [row] = await db.select({ id: leadBotConversations.id }).from(leadBotConversations).where(eq(leadBotConversations.token, token));
  return row.id;
}

async function waitFor<T>(probe: () => T | undefined | null, timeoutMs = 4000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value) return value;
    if (Date.now() > until) throw new Error("timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

afterAll(async () => {
  const db = await getDb();
  if (!db || !tokens.length) return;
  const rows = await db.select({ id: leadBotConversations.id }).from(leadBotConversations).where(inArray(leadBotConversations.token, tokens));
  const ids = rows.map((row) => row.id);
  if (ids.length) {
    await db.delete(leadBotEvents).where(inArray(leadBotEvents.conversationId, ids));
    await db.delete(leadBotMessages).where(inArray(leadBotMessages.conversationId, ids));
    await db.delete(leadBotLeads).where(inArray(leadBotLeads.conversationId, ids));
    await db.delete(leadBotConversations).where(inArray(leadBotConversations.id, ids));
  }
  await db
    .delete(teamNotifications)
    .where(and(inArray(teamNotifications.type, [...LEAD_NOTIFICATION_TYPES]), gte(teamNotifications.createdAt, new Date(startedAt - 1000))));
});

beforeEach(() => notifyOwner.mockClear());

describe("leadBot visitor API (consent, isolation, idempotency)", () => {
  it("refuses to create a conversation without explicit consent and exposes a safe public config", { timeout: 30_000 }, async () => {
    await expect(publicCaller().leadBot.visitor.start({ lang: "ar", pagePath: "/" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "consent_required" });
    await expect(publicCaller().leadBot.visitor.start({ lang: "ar", pagePath: "/", consentToStore: false })).rejects.toMatchObject({ message: "consent_required" });
    const config = await publicCaller().leadBot.visitor.config();
    expect(Object.keys(config).sort()).toEqual(["enabled", "whatsappNumber"]);
  });

  it("starts, replies, replays a duplicate clientId and resumes with the same token", async () => {
    const view = await startConversation();
    expect(view.token).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(view.messages.length).toBeGreaterThan(0);
    const clientId = randomUUID();
    const first = await send(view.token, { text: "كم السعر؟" }, clientId);
    expect(first.replayed).toBe(false);
    const again = await send(view.token, { text: "كم السعر؟" }, clientId);
    expect(again.replayed).toBe(true);
    const db = (await getDb())!;
    const stored = await db.select({ id: leadBotMessages.id }).from(leadBotMessages).where(and(eq(leadBotMessages.conversationId, await conversationId(view.token)), eq(leadBotMessages.clientId, clientId)));
    expect(stored).toHaveLength(1);
    const resumed = await publicCaller().leadBot.visitor.start({ lang: "ar", pagePath: "/", token: view.token });
    expect(resumed.disabled).toBe(false);
    if (!resumed.disabled) {
      expect(resumed.resumed).toBe(true);
      expect(resumed.token).toBe(view.token);
    }
  }, 30_000);

  it("isolates conversations by token and validates token shape", { timeout: 30_000 }, async () => {
    const unknown = randomUUID().replace(/-/g, "") + "abcdEFGH";
    await expect(send(unknown, { text: "مرحبا" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(publicCaller().leadBot.visitor.poll({ token: unknown, afterId: 0 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(send("bad token!", { text: "مرحبا" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("masks national IDs and secrets before storing the visitor message", async () => {
    const view = await startConversation();
    await send(view.token, { text: "رقم هويتي 1012345678 وكلمة المرور abc123" });
    const db = (await getDb())!;
    const rows = await db.select({ text: leadBotMessages.text }).from(leadBotMessages).where(and(eq(leadBotMessages.conversationId, await conversationId(view.token)), eq(leadBotMessages.role, "user")));
    expect(rows.map((row) => row.text).join(" ")).not.toMatch(/1012345678|abc123/);
    expect(rows[0].text).toContain("[رقم هوية محجوب]");
  }, 30_000);

  it(`rate-limits a conversation after ${MAX_MESSAGES_PER_MINUTE} messages per minute`, async () => {
    const view = await startConversation();
    for (let index = 0; index < MAX_MESSAGES_PER_MINUTE; index += 1) await send(view.token, { text: `سؤال ${index}` });
    await expect(send(view.token, { text: "سؤال زائد" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  }, 90_000);
});

describe("leadBot qualification, handoff and staff workflow", () => {
  it("creates a lead only after consent, alerts the team without the full phone, and lets staff reply and resolve", async () => {
    const view = await startConversation();
    const token = view.token;
    await send(token, { text: "أبغى سجل تجاري لمؤسستي في الرياض بشكل عاجل" });
    await send(token, { quickReply: "vol:many", label: "أكثر من 5 شهريًا" });
    await send(token, { quickReply: "bud:gt2000", label: "أكثر من 2,000 ريال" });
    await send(token, { text: "سارة اختبار" });
    await send(token, { text: "٠٥٠٠٠٠٠١٧٧" });
    await send(token, { quickReply: "time:now", label: "الآن" });
    const db = (await getDb())!;
    const id = await conversationId(token);
    expect(await db.select({ id: leadBotLeads.id }).from(leadBotLeads).where(eq(leadBotLeads.conversationId, id))).toHaveLength(0);
    await send(token, { quickReply: "consent:yes", label: "أوافق" });
    const done = await send(token, { quickReply: "confirm", label: "تأكيد وإرسال" });
    expect(done.stage).toBe("completed");
    const [lead] = await db.select().from(leadBotLeads).where(eq(leadBotLeads.conversationId, id));
    expect(lead.grade).toBe("hot");
    expect(lead.phoneKey).toBe(TEST_PHONE);
    expect(JSON.parse(lead.slotsJson).phone).toBe(TEST_PHONE);
    // Hot-lead alert (fire-and-forget) never contains the full phone number.
    const hotCall = await waitFor(() => notifyOwner.mock.calls.find((call) => JSON.stringify(call).includes(`LEAD-${lead.id}`)));
    expect(JSON.stringify(hotCall)).not.toContain(TEST_PHONE);

    notifyOwner.mockClear();
    const handoff = await send(token, { text: "أبي أكلم موظف" });
    expect(handoff.handoff?.status).toBe("waiting");
    const handoffCall = await waitFor(() => notifyOwner.mock.calls[0]);
    expect(JSON.stringify(handoffCall)).not.toContain(TEST_PHONE);
    expect(JSON.stringify(handoffCall)).toContain("050****177");

    const owner = userCaller("admin");
    const found = await owner.leadBot.staff.list({ query: "٠٥٠٠٠٠٠١٧٧", handoffOnly: true });
    expect(found.leads.map((item) => item.id)).toContain(lead.id);
    for (const query of [TEST_PHONE, "966500000177", "+966 50 000 0177", "00966500000177"]) {
      const byFormat = await owner.leadBot.staff.list({ query });
      expect(byFormat.leads.map((item) => item.id)).toContain(lead.id);
    }
    expect((await owner.leadBot.staff.list({ query: "سارة اختبار" })).leads.map((item) => item.id)).toContain(lead.id);
    expect(found.counts.waiting).toBeGreaterThan(0);
    const detail = await owner.leadBot.staff.get({ leadId: lead.id });
    expect(detail.messages.some((message) => message.role === "user")).toBe(true);

    const lastSeen = Math.max(...handoff.messages.map((message) => message.id));
    await owner.leadBot.staff.reply({ leadId: lead.id, text: "أهلًا سارة، معك فريق المبيعات." });
    const polled = await publicCaller().leadBot.visitor.poll({ token, afterId: lastSeen });
    expect(polled.messages.some((message) => message.role === "agent" && message.text.includes("فريق المبيعات"))).toBe(true);
    expect(polled.handoff?.status).toBe("active");

    const forwarded = await send(token, { text: "شكرًا، أنتظر العرض" });
    expect(forwarded.messages.every((message) => message.role !== "bot")).toBe(true);

    await owner.leadBot.staff.update({ leadId: lead.id, status: "qualified", notes: "ملاحظة اختبار" });
    await owner.leadBot.staff.resolve({ leadId: lead.id });
    const after = await owner.leadBot.staff.get({ leadId: lead.id });
    expect(after.lead.status).toBe("qualified");
    expect(after.conversation.handoff?.status).toBe("resolved");
    const analytics = await owner.leadBot.staff.analytics({ rangeDays: 7 });
    expect(analytics).toBeTruthy();
  }, 120_000);
});

describe("leadBot persistence", () => {
  it("stores the visitor message, bot replies, state and lead in one transaction (all or nothing)", async () => {
    const view = await startConversation();
    const id = await conversationId(view.token);
    const db = (await getDb())!;
    const countMessages = async () => (await db.select({ id: leadBotMessages.id }).from(leadBotMessages).where(eq(leadBotMessages.conversationId, id))).length;
    const stateOf = async () => (await db.select({ stateJson: leadBotConversations.stateJson }).from(leadBotConversations).where(eq(leadBotConversations.id, id)))[0].stateJson;
    const beforeMessages = await countMessages();
    const beforeState = await stateOf();
    const at = Date.now();
    await expect(
      commitTurn({
        conversationId: id,
        state: { ...createInitialState("ar"), turn: 99 },
        handoff: null,
        lang: "ar",
        now: at,
        messages: [
          { role: "user", text: "رسالة داخل معاملة", clientId: randomUUID(), createdAt: at },
          { role: "bot", text: "رد داخل معاملة", createdAt: at },
        ],
        events: [{ type: "fallback" }],
        // Invalid enum value: the lead write fails after the messages were inserted.
        lead: { kind: "bogus" as never, slots: {}, score: { score: 0, grade: "cold", breakdown: [] }, qualified: false, handoff: null, incrementUnread: false },
      }),
    ).rejects.toThrow();
    expect(await countMessages()).toBe(beforeMessages);
    expect(await stateOf()).toBe(beforeState);
    expect(await db.select({ id: leadBotLeads.id }).from(leadBotLeads).where(eq(leadBotLeads.conversationId, id))).toHaveLength(0);
  }, 30_000);
});

describe("leadBot staff permissions are enforced on the server", () => {
  it("rejects anonymous, regular users and employees without an active staff account", { timeout: 30_000 }, async () => {
    await expect(publicCaller().leadBot.staff.list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(userCaller("user").leadBot.staff.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(userCaller("user").leadBot.staff.alerts()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(userCaller("employee", 990099).leadBot.staff.get({ leadId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(userCaller("user").leadBot.staff.getSettings()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await userCaller("user").leadBot.staff.access()).toEqual({ role: null, name: null });
  });

  it("lets only the owner read settings and validates them before saving", { timeout: 30_000 }, async () => {
    const owner = userCaller("admin");
    expect((await owner.leadBot.staff.access()).role).toBe("owner");
    const current = await owner.leadBot.staff.getSettings();
    expect(typeof current.enabled).toBe("boolean");
    await expect(
      owner.leadBot.staff.saveSettings({
        enabled: current.enabled,
        aiAssist: current.aiAssist,
        offerHumanToHotLeads: current.offerHumanToHotLeads,
        autoEscalateAfterFallbacks: current.autoEscalateAfterFallbacks,
        workingDays: [],
        workStartHour: current.workStartHour,
        workEndHour: current.workEndHour,
        responseSlaAr: current.responseSlaAr,
        responseSlaEn: current.responseSlaEn,
        whatsappNumber: current.whatsappNumber ?? "",
        services: current.services,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
