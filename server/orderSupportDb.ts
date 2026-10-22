import { TRPCError } from "@trpc/server";
import { and, asc, avg, count, desc, eq, gt, sql } from "drizzle-orm";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  supportConfig,
  supportAttachments,
  supportEvents,
  supportFeedback,
  supportMessages,
  supportRateLimits,
  supportSessions,
} from "../drizzle/supportSchema";
import {
  buildSupportReply,
  redactSupportText,
  type SupportLanguage,
  type SupportTurn,
} from "../shared/orderSupport";
import { getDb, listAssistantFaqs } from "./db";
import {
  supportFeedbackInput,
  type SupportFeedbackInput,
} from "../shared/supportFeedback";

import {
  supportFollowupInput,
  type SupportFollowupInput,
  type SupportImageInput,
} from "../shared/supportSharing";
import { loadSupportImage, storeSupportImage } from "./orderSupportImages";

const TTL = 30 * 24 * 60 * 60 * 1000;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
async function database() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "خدمة الدعم غير متاحة مؤقتًا. حاول مجددًا أو افتح قنوات الدعم.",
    });
  return db;
}
export async function limitSupport(key: string) {
  const db = await database();
  const now = Date.now();
  const cutoff = now - 5 * 60_000;
  await db
    .insert(supportRateLimits)
    .values({ keyHash: hash(key), requestCount: 1, windowStartedAt: now })
    .onDuplicateKeyUpdate({
      set: {
        requestCount: sql`IF(${supportRateLimits.windowStartedAt} > ${cutoff}, ${supportRateLimits.requestCount} + 1, 1)`,
        windowStartedAt: sql`IF(${supportRateLimits.windowStartedAt} > ${cutoff}, ${supportRateLimits.windowStartedAt}, ${now})`,
      },
    });
  const [row] = await db
    .select()
    .from(supportRateLimits)
    .where(eq(supportRateLimits.keyHash, hash(key)))
    .limit(1);
  if (row.requestCount > 80)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "وصلت إلى الحد المؤقت. انتظر خمس دقائق ثم حاول مجددًا.",
    });
}
export async function getSupportConfig() {
  const db = await database();
  const [config] = await db
    .select()
    .from(supportConfig)
    .where(eq(supportConfig.id, 1))
    .limit(1);
  return {
    enabled: config?.enabled ?? true,
    handoffEnabled: config?.handoffEnabled ?? true,
  };
}
export async function updateSupportConfig(input: {
  enabled: boolean;
  handoffEnabled: boolean;
}) {
  const db = await database();
  await db
    .insert(supportConfig)
    .values({ id: 1, ...input, updatedAt: Date.now() })
    .onDuplicateKeyUpdate({ set: { ...input, updatedAt: Date.now() } });
  return input;
}
async function answer(language: SupportLanguage, turns: SupportTurn[]) {
  const faqs = await listAssistantFaqs();
  return buildSupportReply(
    language,
    turns.map(t => ({ ...t, content: redactSupportText(t.content) })),
    faqs.map(f => ({
      question: language === "en" ? f.questionEn || f.questionAr : f.questionAr,
      answer: language === "en" ? f.answerEn || f.answerAr : f.answerAr,
    }))
  );
}
export async function startSupport(
  language: SupportLanguage,
  turns: SupportTurn[]
) {
  const db = await database();
  const token = randomBytes(32).toString("hex");
  const id = randomUUID();
  const now = Date.now();
  await db.transaction(async tx => {
    await tx.insert(supportSessions).values({
      id,
      tokenHash: hash(token),
      language,
      consentVersion: "2026-10-20",
      createdAt: now,
      updatedAt: now,
    });
    if (turns.length)
      await tx.insert(supportMessages).values(
        turns.slice(-280).map((t, i) => ({
          id: randomUUID(),
          sessionId: id,
          turnId: randomUUID(),
          sender: t.role === "user" ? ("user" as const) : ("bot" as const),
          content: redactSupportText(t.content),
          createdAt: now + i,
          metadata: null,
        }))
      );
  });
  return { token };
}
export async function readSupport(token: string) {
  const db = await database();
  const [session] = await db
    .select()
    .from(supportSessions)
    .where(
      and(
        eq(supportSessions.tokenHash, hash(token)),
        gt(supportSessions.createdAt, Date.now() - TTL)
      )
    )
    .limit(1);
  if (!session)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "انتهت جلسة الدعم أو حُذفت. ابدأ محادثة جديدة.",
    });
  const messages = await db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.sessionId, session.id))
    .orderBy(asc(supportMessages.createdAt))
    .limit(300);
  const [feedback] = await db
    .select({
      id: supportFeedback.id,
      stars: supportFeedback.stars,
      followupNote: supportFeedback.followupNote,
    })
    .from(supportFeedback)
    .where(eq(supportFeedback.sessionId, session.id))
    .limit(1);
  return {
    id: session.id,
    status: session.status,
    language: session.language,
    rating: session.rating,
    feedback: feedback
      ? {
          id: feedback.id,
          stars: feedback.stars,
          followupProvided: Boolean(feedback.followupNote),
        }
      : null,
    attachments: await db
      .select({
        id: supportAttachments.id,
        mimeType: supportAttachments.mimeType,
        byteSize: supportAttachments.byteSize,
      })
      .from(supportAttachments)
      .where(eq(supportAttachments.sessionId, session.id))
      .limit(1),
    messages,
  };
}
export async function sendSupport(input: {
  language: SupportLanguage;
  turns: SupportTurn[];
  token?: string;
  turnId: string;
}) {
  const config = await getSupportConfig();
  const db = await database();
  const content = redactSupportText(input.turns.at(-1)!.content);
  if (!input.token) {
    if (!config.enabled)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "المساعد متوقف مؤقتًا. افتح قنوات الدعم.",
      });
    const reply = await answer(input.language, input.turns);
    await db
      .insert(supportEvents)
      .values({ kind: "answer", intent: reply.intent, createdAt: Date.now() });
    return { reply, saved: false };
  }
  return db.transaction(async tx => {
    const [session] = await tx
      .select()
      .from(supportSessions)
      .where(
        and(
          eq(supportSessions.tokenHash, hash(input.token!)),
          gt(supportSessions.createdAt, Date.now() - TTL)
        )
      )
      .limit(1)
      .for("update");
    if (!session)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "انتهت جلسة الدعم. ابدأ محادثة جديدة.",
      });
    if (session.status === "closed")
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "المحادثة مغلقة. ابدأ محادثة جديدة.",
      });
    const existing = await tx
      .select()
      .from(supportMessages)
      .where(
        and(
          eq(supportMessages.sessionId, session.id),
          eq(supportMessages.turnId, input.turnId)
        )
      );
    if (existing.length) {
      const bot = existing.find(m => m.sender === "bot");
      return {
        reply: bot?.metadata
          ? (JSON.parse(bot.metadata) as ReturnType<typeof buildSupportReply>)
          : null,
        saved: true,
      };
    }
    if (session.status === "bot" && !config.enabled)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "الردود الآلية متوقفة مؤقتًا.",
      });
    const previous = await tx
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.sessionId, session.id))
      .orderBy(desc(supportMessages.createdAt))
      .limit(20);
    if (
      (
        await tx
          .select({ total: count() })
          .from(supportMessages)
          .where(eq(supportMessages.sessionId, session.id))
      )[0].total >= 280
    )
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "وصلت المحادثة إلى حد الرسائل. ابدأ محادثة جديدة.",
      });
    const turns: SupportTurn[] = previous
      .reverse()
      .filter(m => m.sender === "user" || m.sender === "bot")
      .map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.content,
      }));
    turns.push({ role: "user", content });
    const reply =
      session.status === "bot" ? await answer(input.language, turns) : null;
    const now = Date.now();
    await tx.insert(supportMessages).values({
      id: randomUUID(),
      sessionId: session.id,
      turnId: input.turnId,
      sender: "user",
      content,
      createdAt: now,
    });
    if (reply) {
      await tx.insert(supportMessages).values({
        id: randomUUID(),
        sessionId: session.id,
        turnId: input.turnId,
        sender: "bot",
        content: reply.text,
        metadata: JSON.stringify(reply),
        createdAt: now + 1,
      });
      await tx
        .insert(supportEvents)
        .values({ kind: "answer", intent: reply.intent, createdAt: now });
    }
    await tx
      .update(supportSessions)
      .set({ intent: reply?.intent ?? session.intent, updatedAt: now })
      .where(eq(supportSessions.id, session.id));
    return { reply, saved: true };
  });
}
export async function handoffSupport(
  token: string,
  attachment?: SupportImageInput
) {
  const config = await getSupportConfig();
  if (!config.handoffEnabled)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "التصعيد داخل المحادثة متوقف مؤقتًا. استخدم قنوات الدعم.",
    });
  const db = await database();
  return db.transaction(async tx => {
    const [session] = await tx
      .select()
      .from(supportSessions)
      .where(
        and(
          eq(supportSessions.tokenHash, hash(token)),
          gt(supportSessions.createdAt, Date.now() - TTL)
        )
      )
      .limit(1)
      .for("update");
    if (!session)
      throw new TRPCError({ code: "NOT_FOUND", message: "انتهت جلسة الدعم." });
    if (session.status === "closed")
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "المحادثة مغلقة. ابدأ محادثة جديدة.",
      });
    const [existingImage] = await tx
      .select({ id: supportAttachments.id })
      .from(supportAttachments)
      .where(eq(supportAttachments.sessionId, session.id))
      .limit(1);
    if (session.status !== "bot") {
      if (attachment && attachment.id !== existingImage?.id)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "تم التصعيد بالفعل. لا يمكن إضافة صورة جديدة بهذه العملية.",
        });
      return { status: session.status };
    }
    if (attachment && !existingImage) {
      const [collision] = await tx
        .select({ id: supportAttachments.id })
        .from(supportAttachments)
        .where(eq(supportAttachments.id, attachment.id))
        .limit(1);
      if (collision)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "استخدم معرّف صورة جديدًا.",
        });
      const stored = await storeSupportImage(attachment.id, attachment);
      await tx.insert(supportAttachments).values({
        id: attachment.id,
        sessionId: session.id,
        ...stored,
        createdAt: Date.now(),
      });
    }
    const now = Date.now();
    await tx
      .update(supportSessions)
      .set({ status: "waiting", updatedAt: now })
      .where(eq(supportSessions.id, session.id));
    await tx.insert(supportMessages).values({
      id: randomUUID(),
      sessionId: session.id,
      turnId: randomUUID(),
      sender: "system",
      createdAt: now,
      content:
        session.language === "en"
          ? "Your conversation was sent to support for review. Leave this page open or return from this browser for a reply. No response time is guaranteed."
          : "أُرسلت محادثتك إلى فريق الدعم للمراجعة. أبقِ الصفحة مفتوحة أو عُد من هذا المتصفح للاطلاع على الرد. لا يوجد موعد رد مضمون.",
    });
    await tx
      .insert(supportEvents)
      .values({ kind: "handoff", intent: session.intent, createdAt: now });
    return { status: "waiting" as const };
  });
}
export async function deleteSupport(token: string) {
  const db = await database();
  await db
    .delete(supportSessions)
    .where(eq(supportSessions.tokenHash, hash(token)));
  return { success: true };
}
export async function rateSupport(
  token: string,
  rating: "helpful" | "unhelpful"
) {
  const db = await database();
  await db.transaction(async tx => {
    const [s] = await tx
      .select()
      .from(supportSessions)
      .where(
        and(
          eq(supportSessions.tokenHash, hash(token)),
          gt(supportSessions.createdAt, Date.now() - TTL)
        )
      )
      .limit(1)
      .for("update");
    if (!s)
      throw new TRPCError({ code: "NOT_FOUND", message: "انتهت جلسة الدعم." });
    if (s.rating) return;
    await tx
      .update(supportSessions)
      .set({ rating })
      .where(eq(supportSessions.id, s.id));
    await tx
      .insert(supportEvents)
      .values({ kind: rating, intent: s.intent, createdAt: Date.now() });
  });
  return { success: true };
}
export async function listSupport(status?: "waiting" | "human" | "closed") {
  const db = await database();
  return db
    .select({
      id: supportSessions.id,
      status: supportSessions.status,
      language: supportSessions.language,
      intent: supportSessions.intent,
      updatedAt: supportSessions.updatedAt,
      createdAt: supportSessions.createdAt,
      rating: supportSessions.rating,
    })
    .from(supportSessions)
    .where(
      and(
        gt(supportSessions.createdAt, Date.now() - TTL),
        status
          ? eq(supportSessions.status, status)
          : sql`${supportSessions.status} <> 'bot'`
      )
    )
    .orderBy(desc(supportSessions.updatedAt))
    .limit(200);
}
export async function supportDetail(id: string) {
  const db = await database();
  const [session] = await db
    .select({
      id: supportSessions.id,
      status: supportSessions.status,
      intent: supportSessions.intent,
      language: supportSessions.language,
    })
    .from(supportSessions)
    .where(
      and(
        eq(supportSessions.id, id),
        gt(supportSessions.createdAt, Date.now() - TTL)
      )
    )
    .limit(1);
  if (!session)
    throw new TRPCError({ code: "NOT_FOUND", message: "المحادثة غير موجودة." });
  const [feedback] = await db
    .select({
      stars: supportFeedback.stars,
      comment: supportFeedback.comment,
      followupNote: supportFeedback.followupNote,
    })
    .from(supportFeedback)
    .where(eq(supportFeedback.sessionId, id))
    .limit(1);
  return {
    ...session,
    feedback: feedback ?? null,
    attachments: await db
      .select({
        id: supportAttachments.id,
        mimeType: supportAttachments.mimeType,
        byteSize: supportAttachments.byteSize,
      })
      .from(supportAttachments)
      .where(eq(supportAttachments.sessionId, id))
      .limit(1),
    messages: await db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.sessionId, id))
      .orderBy(asc(supportMessages.createdAt))
      .limit(300),
  };
}
export async function replySupport(
  id: string,
  content: string,
  turnId: string
) {
  const db = await database();
  await db.transaction(async tx => {
    const [session] = await tx
      .select()
      .from(supportSessions)
      .where(
        and(
          eq(supportSessions.id, id),
          gt(supportSessions.createdAt, Date.now() - TTL)
        )
      )
      .limit(1)
      .for("update");
    if (
      !session ||
      (session.status !== "waiting" && session.status !== "human")
    )
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "لا يمكن الرد إلا على محادثة مصعّدة ومفتوحة.",
      });
    const existing = await tx
      .select({ id: supportMessages.id })
      .from(supportMessages)
      .where(
        and(
          eq(supportMessages.sessionId, id),
          eq(supportMessages.turnId, turnId),
          eq(supportMessages.sender, "human")
        )
      )
      .limit(1);
    if (existing.length) return;
    await tx.insert(supportMessages).values({
      id: randomUUID(),
      sessionId: id,
      turnId,
      sender: "human",
      content: redactSupportText(content),
      createdAt: Date.now(),
    });
    await tx
      .update(supportSessions)
      .set({ status: "human", updatedAt: Date.now() })
      .where(eq(supportSessions.id, id));
  });
  return { success: true };
}
export async function closeSupport(
  id: string,
  actor: "owner" | "customer" = "owner"
) {
  const db = await database();
  await db.transaction(async tx => {
    const [s] = await tx
      .select()
      .from(supportSessions)
      .where(eq(supportSessions.id, id))
      .limit(1)
      .for("update");
    if (!s)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "المحادثة غير موجودة.",
      });
    if (s.status === "closed") return;
    const now = Date.now();
    await tx
      .update(supportSessions)
      .set({ status: "closed", updatedAt: now })
      .where(eq(supportSessions.id, id));
    await tx.insert(supportMessages).values({
      id: randomUUID(),
      sessionId: id,
      turnId: randomUUID(),
      sender: "system",
      content:
        actor === "customer"
          ? s.language === "en"
            ? "You ended this conversation. This does not cancel or change your request. You may now rate your support experience."
            : "أنهيت هذه المحادثة. هذا لا يلغي طلبك ولا يغيره. يمكنك الآن تقييم تجربة الدعم."
          : s.language === "en"
            ? "Support closed this conversation. You can start a new chat if you need more help."
            : "أغلق فريق الدعم هذه المحادثة. يمكنك بدء محادثة جديدة إذا احتجت مساعدة أخرى.",
      createdAt: now,
    });
  });
  return { success: true };
}
export async function supportAnalytics() {
  const db = await database();
  const since = Date.now() - TTL;
  const events = await db
    .select({
      kind: supportEvents.kind,
      intent: supportEvents.intent,
      total: count(),
    })
    .from(supportEvents)
    .where(gt(supportEvents.createdAt, since))
    .groupBy(supportEvents.kind, supportEvents.intent);
  const statuses = await db
    .select({ status: supportSessions.status, total: count() })
    .from(supportSessions)
    .where(gt(supportSessions.createdAt, since))
    .groupBy(supportSessions.status);
  const [feedbackSummary] = await db
    .select({ total: count(), average: avg(supportFeedback.stars) })
    .from(supportFeedback)
    .where(gt(supportFeedback.createdAt, since));
  const feedbackDistribution = await db
    .select({ stars: supportFeedback.stars, total: count() })
    .from(supportFeedback)
    .where(gt(supportFeedback.createdAt, since))
    .groupBy(supportFeedback.stars);
  const feedbackComments = await db
    .select({
      id: supportFeedback.id,
      stars: supportFeedback.stars,
      comment: supportFeedback.comment,
      followupNote: supportFeedback.followupNote,
      createdAt: supportFeedback.createdAt,
    })
    .from(supportFeedback)
    .where(
      and(
        gt(supportFeedback.createdAt, since),
        sql`((${supportFeedback.comment} IS NOT NULL AND ${supportFeedback.comment} <> '') OR (${supportFeedback.followupNote} IS NOT NULL AND ${supportFeedback.followupNote} <> ''))`
      )
    )
    .orderBy(desc(supportFeedback.createdAt))
    .limit(20);
  return {
    events,
    statuses,
    since,
    feedbackSummary: {
      total: Number(feedbackSummary?.total ?? 0),
      average:
        feedbackSummary?.average == null
          ? null
          : Number(feedbackSummary.average),
    },
    feedbackDistribution,
    feedbackComments,
  };
}

export async function finishSupport(token: string) {
  const session = await readSupport(token);
  await closeSupport(session.id, "customer");
  return { status: "closed" as const };
}
export async function submitSupportFeedback(raw: SupportFeedbackInput) {
  const input = supportFeedbackInput.parse(raw);
  const db = await database();
  return db.transaction(async tx => {
    let sessionId: string | null = null;
    if (input.token) {
      const [session] = await tx
        .select()
        .from(supportSessions)
        .where(
          and(
            eq(supportSessions.tokenHash, hash(input.token)),
            gt(supportSessions.createdAt, Date.now() - TTL)
          )
        )
        .limit(1)
        .for("update");
      if (!session)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "انتهت جلسة الدعم أو حُذفت.",
        });
      if (session.status !== "closed")
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "أنهِ المحادثة قبل إرسال تقييمها.",
        });
      sessionId = session.id;
      const [existing] = await tx
        .select({ id: supportFeedback.id, stars: supportFeedback.stars })
        .from(supportFeedback)
        .where(eq(supportFeedback.sessionId, sessionId))
        .limit(1);
      if (existing)
        return { success: true, id: existing.id, stars: existing.stars };
    }
    const [duplicate] = await tx
      .select({
        stars: supportFeedback.stars,
        sessionId: supportFeedback.sessionId,
      })
      .from(supportFeedback)
      .where(eq(supportFeedback.id, input.id))
      .limit(1);
    if (duplicate) {
      if (duplicate.sessionId !== sessionId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "استخدم معرّفًا جديدًا للتقييم.",
        });
      return { success: true, id: input.id, stars: duplicate.stars };
    }
    await tx
      .insert(supportFeedback)
      .values({
        id: input.id,
        sessionId,
        stars: input.stars,
        comment: redactSupportText(input.comment).slice(0, 500) || null,
        language: input.language,
        accessKeyHash: input.accessKey ? hash(input.accessKey) : null,
        consentVersion: "2026-10-22",
        createdAt: Date.now(),
      })
      .onDuplicateKeyUpdate({ set: { id: sql`${supportFeedback.id}` } });
    const [saved] = await tx
      .select({ stars: supportFeedback.stars })
      .from(supportFeedback)
      .where(eq(supportFeedback.id, input.id))
      .limit(1);
    return { success: true, id: input.id, stars: saved?.stars ?? input.stars };
  });
}

export async function followupSupportFeedback(raw: SupportFollowupInput) {
  const input = supportFollowupInput.parse(raw);
  const db = await database();
  return db.transaction(async tx => {
    const [feedback] = await tx
      .select()
      .from(supportFeedback)
      .where(
        and(
          eq(supportFeedback.id, input.id),
          gt(supportFeedback.createdAt, Date.now() - TTL)
        )
      )
      .limit(1)
      .for("update");
    const denied = () =>
      new TRPCError({
        code: "NOT_FOUND",
        message: "التقييم غير متاح أو لا تملك صلاحية متابعته.",
      });
    if (!feedback) throw denied();
    if (feedback.sessionId) {
      if (!input.token) throw denied();
      const [session] = await tx
        .select({ id: supportSessions.id })
        .from(supportSessions)
        .where(
          and(
            eq(supportSessions.id, feedback.sessionId),
            eq(supportSessions.tokenHash, hash(input.token)),
            eq(supportSessions.status, "closed"),
            gt(supportSessions.createdAt, Date.now() - TTL)
          )
        )
        .limit(1);
      if (!session) throw denied();
    } else if (
      !input.accessKey ||
      feedback.accessKeyHash !== hash(input.accessKey)
    )
      throw denied();
    if (feedback.stars > 2)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "التفاصيل الإضافية متاحة للتقييم1أو2فقط.",
      });
    if (feedback.followupNote !== null) return { success: true };
    await tx
      .update(supportFeedback)
      .set({
        followupNote: redactSupportText(input.note).slice(0, 500),
        followupCreatedAt: Date.now(),
      })
      .where(eq(supportFeedback.id, feedback.id));
    return { success: true };
  });
}
export async function getSupportImage(
  id: string,
  token?: string,
  owner = false
) {
  const db = await database();
  const [attachment] = await db
    .select({ storageKey: supportAttachments.storageKey })
    .from(supportAttachments)
    .innerJoin(
      supportSessions,
      eq(supportAttachments.sessionId, supportSessions.id)
    )
    .where(
      and(
        eq(supportAttachments.id, id),
        gt(supportSessions.createdAt, Date.now() - TTL),
        sql`${supportSessions.status} <> 'bot'`,
        owner
          ? sql`TRUE`
          : token
            ? eq(supportSessions.tokenHash, hash(token))
            : sql`FALSE`
      )
    )
    .limit(1);
  if (!attachment)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "لقطة الشاشة غير متاحة أو انتهت صلاحية الوصول.",
    });
  return loadSupportImage(attachment.storageKey);
}
