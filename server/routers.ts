import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { CURRENT_TERMS_VERSION } from "../shared/legal";
import {
  acceptQuoteForCustomer,
  acceptSelectedQuoteForProvider,
  clearReadTeamNotifications,
  appendAssistantConversationExchange,
  createAssistantConversationSession,
  createAssistantFaq,
  createAssignedRequestUpdateWithAudit,
  createCustomerConversationAttachment,
  createCustomerRequestComment,
  createRequestReviewForCustomer,
  createRequestAttachment,
  createRequestUpdate,
  createTeamConversationAttachment,
  createStaffAccount,
  createTransactionRequest,
  deleteAssistantFaq,
  deleteTeamNotification,
  disablePwaSubscription,
  getCustomerAdminDetail,
  getActiveAgentAccountByPhone,
  getCustomerDashboard,
  getAppSettings,
  getAssistantConversationHistory,
  getTransactionRequestById,
  getRequestTrackingByPhone,
  getRequestTracking,
  getActiveStaffAccountForUser,
  isRequestAssignedToUser,
  listCustomerNotificationsForPhone,
  listCustomerRequestConversation,
  listAuditLogs,
  listAssistantFaqs,
  listAssignableStaff,
  listEmployeesWithAssignments,
  listOpenRequestsForTeam,
  listQuotesForCustomerPhone,
  listRequestsAssignedToUser,
  listStaffAccounts,
  listTeamNotificationsForUser,
  listTransactionRequests,
  listRequestUpdates,
  listCustomers,
  markOwnerNotified,
  markAllTeamNotificationsRead,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
  markCustomerQuoteNotificationsReadForRequest,
  markTeamNotificationRead,
  replaceAppSettings,
  revokeAssistantConversationConsent,
  resolveCustomerForRequest,
  registerCustomerWithPhone,
  getCustomerByPhone,
  type SavedCustomField,
  upsertPwaSubscription,
  updateRequestWorkflow,
  updateAssistantFaq,
  updateQuoteSubmissionDeadline,
  updateStaffAccount,
  updateTransactionRequestStatus,
  upsertRequestQuote,
  withdrawRequestQuote,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, agentProcedure, employeeProcedure, protectedProcedure, publicProcedure, router, teamProcedure } from "./_core/trpc";
import { PUSH_PUBLIC_KEY } from "./pushPublic";
import { storagePut } from "./storage";
import { answerPublicAssistant, redactAssistantMessage } from "./publicAssistant";
import { agentFinanceRouter } from "./agentFinanceRouter";
import { phoneAuthRouter } from "./phoneAuthRouter";
import { agentApplicationsRouter } from "./agentApplicationsRouter";
import { listTeamPrivateMessages } from "./teamMessages";
import { agentApplicationDocumentsRouter } from "./agentApplicationDocumentsRouter";
import { phoneProfileRouter } from "./phoneProfileRouter";
import { adminApplicationNotificationsRouter } from "./adminApplicationNotificationsRouter";
import { notificationTemplatesRouter, siteAnnouncementsRouter } from "./siteContentRouter";
import { leadBotRouter } from "./leadBot/router";
import { orderSupportRouter } from "./orderSupportRouter";
import { getCustomerProfileByPhone, updateCustomerProfileByPhone } from "./customerProfileDb";
import { assertCanRequestPhoneChange, assertPhoneAccessCurrent, changeCustomerPhone } from "./customerPhoneChangeDb";
import { requestPhoneCode, verifyPhoneCode } from "./phoneOtpDb";
const requestStatuses = ["received", "in_review", "in_progress", "completed"] as const;
const requestPriorities = ["low", "normal", "high", "urgent"] as const;
const assistantMessageInput = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(600),
});
const assistantConsentVersion = "2026-08-30";
const assistantPublicIdInput = z.string().uuid().max(64);
const assistantFaqFields = {
  questionAr: z.string().trim().min(2).max(500),
  answerAr: z.string().trim().min(2).max(4000),
  questionEn: z.string().trim().max(500).nullable().optional(),
  answerEn: z.string().trim().max(4000).nullable().optional(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(10_000),
} as const;
const validateAssistantFaqEnglish = (faq: { questionEn?: string | null; answerEn?: string | null }, ctx: z.RefinementCtx) => {
  const hasEnglishQuestion = Boolean(faq.questionEn?.trim());
  const hasEnglishAnswer = Boolean(faq.answerEn?.trim());
  if (hasEnglishQuestion !== hasEnglishAnswer) {
    ctx.addIssue({
      code: "custom",
      path: hasEnglishQuestion ? ["answerEn"] : ["questionEn"],
      message: "أدخل السؤال والإجابة بالإنجليزية معًا أو اتركهما فارغين.",
    });
  }
};
const assistantFaqInput = z.object(assistantFaqFields).superRefine(validateAssistantFaqEnglish);
const assistantFaqUpdateInput = z.object({ ...assistantFaqFields, id: z.number().int().positive() }).superRefine(validateAssistantFaqEnglish);
const assistantRateLimits = new Map<string, { count: number; resetAt: number }>();
const assertAssistantRateLimit = (clientKey: string) => {
  const now = Date.now();
  const current = assistantRateLimits.get(clientKey);
  if (!current || current.resetAt <= now) {
    assistantRateLimits.set(clientKey, { count: 1, resetAt: now + 5 * 60 * 1000 });
    return;
  }
  if (current.count >= 8) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "تم بلوغ الحد المؤقت للمحادثة. حاول بعد عدة دقائق." });
  }
  current.count += 1;
};
const quoteInput = z.object({ requestId: z.number().int().positive(), priceAmount: z.number().positive().max(1_000_000), durationDays: z.number().int().min(1).max(3650), note: z.string().trim().max(600).optional() });
const statusUpdates = {
  received: "تم استلام طلبك وهو بانتظار المراجعة.",
  in_review: "طلبك قيد المراجعة لدى فريق ستريك إكسبريس.",
  in_progress: "بدأ فريقنا تنفيذ إجراءات طلبك.",
  completed: "تم إكمال معالجة طلبك.",
} as const;

export const requestInput = z.object({
  requesterName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(6).max(40),
  category: z.enum(["تعقّب المعاملات", "طلب خدمة"]),
  subcategory: z.string().trim().max(120).optional(),
  details: z.string().trim().min(10).max(4000),
  customFields: z.record(z.string(), z.string().trim().max(2000)).optional(),
});

const customerRequestInput = requestInput.omit({ requesterName: true, phone: true }).extend({
  accessToken: z.string().min(20).max(300),
});

const makeReference = () =>
  `SE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const hashEndpoint = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");
const phoneAccessTtlSeconds = 7 * 24 * 60 * 60;
const phoneAccessPayload = (phone: string) => `${phone}.${Math.floor(Date.now() / 1000) + phoneAccessTtlSeconds}`;
const signPhoneAccess = (payload: string) => createHmac("sha256", ENV.cookieSecret).update(payload).digest("base64url");
const createPhoneAccessToken = (phone: string) => {
  if (!ENV.cookieSecret) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "إعداد أمان التحقق غير متاح." });
  const payload = phoneAccessPayload(phone);
  return `${Buffer.from(payload).toString("base64url")}.${signPhoneAccess(payload)}`;
};
/** Signature and expiry only; use requireCustomerPhone in procedures so released numbers are rejected too. */
const readPhoneAccessToken = (token: string) => {
  if (!ENV.cookieSecret) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "إعداد أمان التحقق غير متاح." });
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) throw new TRPCError({ code: "UNAUTHORIZED", message: "انتهت جلسة التحقق. أعد التحقق من رقم الجوال." });
  const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  const expected = signPhoneAccess(payload);
  const validSignature = signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  const [phone, expiresAt] = payload.split(".");
  if (!validSignature || !/^05\d{8}$/.test(phone ?? "") || Number(expiresAt) <= Math.floor(Date.now() / 1000)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "انتهت جلسة التحقق. أعد التحقق من رقم الجوال." });
  }
  return { phone, issuedAtMs: (Number(expiresAt) - phoneAccessTtlSeconds) * 1000 };
};
/** The verified customer phone for a token, unless the customer has since moved to another number. */
const requireCustomerPhone = async (token: string) => {
  const { phone, issuedAtMs } = readPhoneAccessToken(token);
  await assertPhoneAccessCurrent(phone, issuedAtMs);
  return phone;
};
/** For the number-change flow, where UNAUTHORIZED already means "wrong or expired code". */
const requirePhoneChangeSession = async (token: string, language: "ar" | "en") => {
  try {
    return await requireCustomerPhone(token);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "UNAUTHORIZED") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: language === "en" ? "Your session has ended. Sign in again, then try again." : "انتهت جلستك. سجّل الدخول من جديد ثم أعد المحاولة.",
      });
    }
    throw error;
  }
};
const subscriptionInput = z.object({
  endpoint: z.string().url().max(4000),
  p256dh: z.string().min(16).max(255),
  auth: z.string().min(8).max(255),
});

const customFieldInput = z.object({
  fieldKey: z.string().trim().regex(/^[a-z][a-z0-9_]{1,62}$/),
  label: z.string().trim().min(2).max(120),
  type: z.enum(["text", "textarea", "tel", "email", "select"]),
  placeholder: z.string().trim().max(255).nullable().optional(),
  options: z.array(z.string().trim().min(1).max(120)).max(30),
  isRequired: z.boolean(),
  isVisible: z.boolean(),
}).superRefine((field, ctx) => {
  if (field.type === "select" && field.options.length < 2) {
    ctx.addIssue({ code: "custom", message: "يحتاج الحقل من نوع قائمة إلى خيارين على الأقل." });
  }
});

const settingsInput = z.object({
  whatsappNumber: z.string().trim().max(32).nullable().optional(),
  fields: z.array(customFieldInput).max(12),
}).superRefine((settings, ctx) => {
  const keys = settings.fields.map((field) => field.fieldKey);
  if (new Set(keys).size !== keys.length) {
    ctx.addIssue({ code: "custom", message: "لا يمكن تكرار مفتاح الحقل." });
  }
});

const updateInput = z.object({
  requestId: z.number().int().positive(),
  message: z.string().trim().min(2).max(2000).optional(),
  status: z.enum(requestStatuses).optional(),
}).refine((input) => Boolean(input.message || input.status), {
  message: "اكتب ردًا من حرفين على الأقل أو اختر حالة جديدة للطلب.",
});

const workflowInput = z.object({
  id: z.number().int().positive(),
  assigneeId: z.number().int().positive().nullable(),
  priority: z.enum(requestPriorities),
  tags: z.array(z.string().trim().min(1).max(32)).max(12),
}).superRefine((input, ctx) => {
  const normalized = input.tags.map((tag) => tag.toLocaleLowerCase("ar"));
  if (new Set(normalized).size !== normalized.length) ctx.addIssue({ code: "custom", message: "لا يمكن تكرار الوسم." });
});

const staffPermissionsInput = z.object({
  canViewAssigned: z.boolean(),
  canUpdateStatus: z.boolean(),
  canAddCustomerUpdate: z.boolean(),
});

const staffAccountInput = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().max(320).refine((value) => !value || z.string().email().safeParse(value).success, "البريد الوظيفي غير صالح."),
  phone: z.string().trim().max(20).optional(),
  role: z.enum(["employee", "agent"]),
  permissions: staffPermissionsInput,
}).superRefine((input, ctx) => {
  if (input.role === "employee" && !input.email) ctx.addIssue({ code: "custom", path: ["email"], message: "البريد الوظيفي مطلوب للموظف." });
  if (input.role === "agent" && !/^05\d{8}$/.test(input.phone || "")) ctx.addIssue({ code: "custom", path: ["phone"], message: "رقم جوال المعقب يجب أن يبدأ بـ 05 ويتكون من 10 أرقام." });
});

const attachmentInput = z.object({
  updateId: z.number().int().positive(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(160),
  dataBase64: z.string().min(1).max(12 * 1024 * 1024),
});
const conversationAttachmentInput = z.object({
  requestId: z.number().int().positive(),
  message: z.string().trim().max(2000).optional(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(160),
  dataBase64: z.string().min(1).max(12 * 1024 * 1024),
});

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const OWNER_NOTIFICATION_TIMEOUT_MS = 1_800;
const allowedAttachmentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function safeAttachmentName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160) || "attachment";
}

async function storeConversationAttachment(input: z.infer<typeof conversationAttachmentInput>) {
  if (!allowedAttachmentTypes.has(input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "نوع الملف غير مدعوم. استخدم صورة أو PDF أو Word أو Excel." });
  const bytes = Buffer.from(input.dataBase64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_ATTACHMENT_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: "يجب ألا يتجاوز حجم المرفق 8 ميجابايت." });
  const stored = await storagePut(`request-attachments/request-${input.requestId}/${Date.now()}-${safeAttachmentName(input.fileName)}`, bytes, input.mimeType);
  return { fileName: input.fileName, fileKey: stored.key, fileUrl: stored.url, mimeType: input.mimeType, size: bytes.length };
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  agentFinance: agentFinanceRouter,
  notificationTemplates: notificationTemplatesRouter,
  siteAnnouncements: siteAnnouncementsRouter,
  phoneAuth: phoneAuthRouter,
  agentApplications: agentApplicationsRouter,
  leadBot: leadBotRouter,
  orderSupport: orderSupportRouter,
  phoneProfile: phoneProfileRouter,
  agentDocuments: agentApplicationDocumentsRouter,
  adminApplicationNotifications: adminApplicationNotificationsRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    agentPhoneDemo: publicProcedure.input(z.object({
      phone: z.string().trim().regex(/^0?5\d{8}$/).transform((value) => value.startsWith("0") ? value : `0${value}`),
      code: z.string().regex(/^\d{6}$/),
    })).mutation(async ({ input, ctx }) => {
      if (input.code !== "123456") throw new TRPCError({ code: "UNAUTHORIZED", message: "رمز التحقق غير صحيح." });
      const account = await getActiveAgentAccountByPhone(input.phone);
      if (!account) throw new TRPCError({ code: "FORBIDDEN", message: "رقم الجوال غير مسجل كمعقب مفعل." });
      const maxAge = 30 * 24 * 60 * 60 * 1000;
      const token = await sdk.createSessionToken(account.user.openId, { expiresInMs: maxAge, name: account.fullName });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge });
      return { success: true, name: account.fullName, role: "agent" as const };
    }),
  }),
  assistant: router({
    consent: publicProcedure.input(z.object({
      publicId: assistantPublicIdInput,
      language: z.enum(["ar", "en"]),
      consent: z.literal(true),
    })).mutation(async ({ input, ctx }) => {
      const forwarded = String(ctx.req.headers["x-forwarded-for"] || ctx.req.ip || "unknown");
      assertAssistantRateLimit(`consent:${forwarded.split(",")[0]?.trim() || "unknown"}`);
      const session = await createAssistantConversationSession({
        publicId: input.publicId,
        language: input.language,
        consentVersion: assistantConsentVersion,
      });
      if (session.consentRevokedAt) {
        throw new TRPCError({ code: "CONFLICT", message: input.language === "en" ? "This saved chat session has been stopped." : "تم إيقاف حفظ هذه الجلسة سابقًا." });
      }
      return { success: true, consentedAt: session.consentedAt } as const;
    }),
    history: publicProcedure.input(z.object({ publicId: assistantPublicIdInput })).query(async ({ input }) => {
      const history = await getAssistantConversationHistory(input.publicId);
      if (!history) return { consented: false as const, messages: [] };
      return { consented: true as const, language: history.session.language, messages: history.messages };
    }),
    revokeConsent: publicProcedure.input(z.object({ publicId: assistantPublicIdInput })).mutation(async ({ input }) => {
      await revokeAssistantConversationConsent(input.publicId);
      return { success: true } as const;
    }),
    knowledge: router({
      list: adminProcedure.query(() => listAssistantFaqs(true)),
      create: adminProcedure.input(assistantFaqInput).mutation(async ({ input, ctx }) => createAssistantFaq({
        ...input,
        questionEn: input.questionEn?.trim() || null,
        answerEn: input.answerEn?.trim() || null,
      }, ctx.user.id)),
      update: adminProcedure.input(assistantFaqUpdateInput).mutation(async ({ input }) => {
        const { id, ...values } = input;
        const updated = await updateAssistantFaq(id, {
          ...values,
          questionEn: values.questionEn?.trim() || null,
          answerEn: values.answerEn?.trim() || null,
        });
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "تعذر العثور على السؤال المطلوب." });
        return updated;
      }),
      delete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
        await deleteAssistantFaq(input.id);
        return { success: true } as const;
      }),
    }),
    chat: publicProcedure.input(z.object({
      language: z.enum(["ar", "en"]),
      messages: z.array(assistantMessageInput).min(1).max(8),
      consentSessionId: assistantPublicIdInput.nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      const forwarded = String(ctx.req.headers["x-forwarded-for"] || ctx.req.ip || "unknown");
      assertAssistantRateLimit(forwarded.split(",")[0]?.trim() || "unknown");
      if (input.messages.at(-1)?.role !== "user") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "يجب أن تكون الرسالة الأخيرة من المستخدم." });
      }
      try {
        const knowledge = (await listAssistantFaqs()).slice(0, 40).map(faq => ({
          question: input.language === "en" ? faq.questionEn || faq.questionAr : faq.questionAr,
          answer: input.language === "en" ? faq.answerEn || faq.answerAr : faq.answerAr,
        }));
        const reply = await answerPublicAssistant(input.language, input.messages, undefined, knowledge);
        let saved = false;
        if (input.consentSessionId) {
          const lastUserMessage = input.messages.at(-1)!;
          saved = await appendAssistantConversationExchange(input.consentSessionId, redactAssistantMessage(lastUserMessage.content), reply);
        }
        return { reply, saved };
      } catch (error) {
        console.error("[Public assistant] Failed to answer", error instanceof Error ? error.message : "unknown error");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: input.language === "en" ? "The assistant is unavailable right now." : "المساعد غير متاح الآن." });
      }
    }),
  }),
  push: router({
    publicConfig: publicProcedure.query(() => ({ publicKey: PUSH_PUBLIC_KEY })),
    subscribe: publicProcedure.input(subscriptionInput).mutation(async ({ input }) => {
      await upsertPwaSubscription({
        endpointHash: hashEndpoint(input.endpoint),
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
      });
      return { success: true } as const;
    }),
    unsubscribe: publicProcedure.input(z.object({ endpoint: z.string().url().max(4000) })).mutation(async ({ input }) => {
      await disablePwaSubscription(hashEndpoint(input.endpoint));
      return { success: true } as const;
    }),
  }),
  settings: router({
    publicConfig: publicProcedure.query(async () => {
      const settings = await getAppSettings();
      return { whatsappNumber: settings.whatsappNumber, fields: settings.fields };
    }),
    adminConfig: adminProcedure.query(async () => getAppSettings(true)),
    save: adminProcedure.input(settingsInput).mutation(async ({ input }) => {
      const whatsappNumber = input.whatsappNumber?.replace(/\D/g, "") || null;
      if (whatsappNumber && (whatsappNumber.length < 8 || whatsappNumber.length > 15)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "أدخل رقم واتساب دوليًا صحيحًا، من دون رمز +." });
      }
      const fields: SavedCustomField[] = input.fields.map((field, index) => ({
        fieldKey: field.fieldKey,
        label: field.label,
        type: field.type,
        placeholder: field.placeholder || null,
        options: field.options,
        isRequired: field.isRequired,
        isVisible: field.isVisible,
        sortOrder: index,
      }));
      await replaceAppSettings({ whatsappNumber, fields });
      return { success: true } as const;
    }),
  }),
  requests: router({
    create: publicProcedure.input(requestInput).mutation(async ({ input, ctx }) => {
      if (input.category === "طلب خدمة" && !input.subcategory) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "يرجى اختيار فئة الخدمة الفرعية.",
        });
      }

      const settings = await getAppSettings();
      for (const field of settings.fields) {
        const value = input.customFields?.[field.fieldKey]?.trim() || "";
        if (field.isRequired && !value) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `يرجى تعبئة حقل «${field.label}».` });
        }
        if (field.type === "select" && value && !field.options.includes(value)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `الخيار المختار لحقل «${field.label}» غير صالح.` });
        }
      }
      const customFields = Object.entries(input.customFields || {})
        .filter(([fieldKey, value]) => settings.fields.some((field) => field.fieldKey === fieldKey) && value.trim())
        .map(([fieldKey, value]) => ({ fieldKey, value: value.trim(), label: settings.fields.find((field) => field.fieldKey === fieldKey)?.label || fieldKey }));
      const emailField = settings.fields.find((field) => field.type === "email");
      const customerId = await resolveCustomerForRequest({
        user: ctx.user,
        requesterName: input.requesterName,
        phone: input.phone,
        email: emailField ? input.customFields?.[emailField.fieldKey]?.trim() || null : null,
      });

      const created = await createTransactionRequest({
        reference: makeReference(),
        customerId,
        requesterName: input.requesterName,
        phone: input.phone,
        category: input.category,
        subcategory: input.subcategory || null,
        details: input.details,
        customFields: customFields.length ? JSON.stringify(customFields) : null,
      });

      if (!created) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر حفظ الطلب." });
      }

      await createRequestUpdate({
        requestId: created.id,
        message: statusUpdates.received,
        status: "received",
      });

      const ownerNotification = notifyOwner({
          title: `طلب جديد ${created.reference}`,
          content: `${created.category}${created.subcategory ? ` — ${created.subcategory}` : ""}\n${created.requesterName} · ${created.phone}`,
        })
        .catch((error) => {
          console.warn("[Requests] Owner notification could not be delivered", error);
          return false;
        });

      const ownerNotified = await Promise.race([
        ownerNotification,
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), OWNER_NOTIFICATION_TIMEOUT_MS)),
      ]);

      if (ownerNotified) {
        await markOwnerNotified(created.id);
      } else {
        void ownerNotification.then(async (delivered) => {
          if (delivered) await markOwnerNotified(created.id);
        });
      }

      return { id: created.id, reference: created.reference, ownerNotified };
    }),
    createForCustomer: publicProcedure.input(customerRequestInput).mutation(async ({ input }) => {
      const phone = await requireCustomerPhone(input.accessToken);
      const customer = await getCustomerByPhone(phone);
      if (!customer) throw new TRPCError({ code: "UNAUTHORIZED", message: "تعذر العثور على حساب العميل. أعد تسجيل الدخول." });
      if (input.category === "طلب خدمة" && !input.subcategory) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "يرجى اختيار فئة الخدمة الفرعية." });
      }

      const settings = await getAppSettings();
      for (const field of settings.fields) {
        const value = input.customFields?.[field.fieldKey]?.trim() || "";
        if (field.type === "select" && value && !field.options.includes(value)) throw new TRPCError({ code: "BAD_REQUEST", message: `الخيار المختار لحقل «${field.label}» غير صالح.` });
      }
      const customFields = Object.entries(input.customFields || {})
        .filter(([fieldKey, value]) => settings.fields.some((field) => field.fieldKey === fieldKey) && value.trim())
        .map(([fieldKey, value]) => ({ fieldKey, value: value.trim(), label: settings.fields.find((field) => field.fieldKey === fieldKey)?.label || fieldKey }));

      const created = await createTransactionRequest({
        reference: makeReference(),
        customerId: customer.id,
        requesterName: customer.fullName,
        phone,
        category: input.category,
        subcategory: input.subcategory || null,
        details: input.details,
        customFields: customFields.length ? JSON.stringify(customFields) : null,
      });
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر حفظ الطلب." });

      await createRequestUpdate({ requestId: created.id, message: statusUpdates.received, status: "received" });
      const ownerNotification = notifyOwner({
        title: `طلب جديد ${created.reference}`,
        content: `${created.category}${created.subcategory ? ` — ${created.subcategory}` : ""}\n${created.requesterName} · ${created.phone}`,
      }).catch((error) => {
        console.warn("[Requests] Owner notification could not be delivered", error);
        return false;
      });
      const ownerNotified = await Promise.race([
        ownerNotification,
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), OWNER_NOTIFICATION_TIMEOUT_MS)),
      ]);
      if (ownerNotified) await markOwnerNotified(created.id);
      else void ownerNotification.then(async (delivered) => { if (delivered) await markOwnerNotified(created.id); });

      return { id: created.id, reference: created.reference, ownerNotified };
    }),
    list: adminProcedure.query(() => listTransactionRequests()),
    staff: adminProcedure.query(() => listAssignableStaff()),
    track: publicProcedure
      .input(z.object({ reference: z.string().trim().min(6).max(40) }))
      .query(({ input }) => getRequestTracking(input.reference.toUpperCase())),
    trackByPhoneAdmin: adminProcedure
      .input(z.object({ phone: z.string().trim().regex(/^0?5\d{8}$/).transform((value) => value.startsWith("0") ? value : `0${value}`) }))
      .query(({ input }) => getRequestTrackingByPhone(input.phone)),
    trackByPhone: adminProcedure
      .input(z.object({ phone: z.string().trim().regex(/^0?5\d{8}$/).transform((value) => value.startsWith("0") ? value : `0${value}`) }))
      .query(({ input }) => getRequestTrackingByPhone(input.phone)),
    verifyPhoneDemo: publicProcedure
      .input(z.object({
        phone: z.string().trim().regex(/^0?5\d{8}$/).transform((value) => value.startsWith("0") ? value : `0${value}`),
        code: z.string().regex(/^\d{6}$/),
      }))
      .mutation(async ({ input }) => {
        if (input.code !== "123456") {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "رمز التحقق غير صحيح." });
        }
        const customer = await getCustomerByPhone(input.phone);
        return { accessToken: createPhoneAccessToken(input.phone), expiresInSeconds: phoneAccessTtlSeconds, customerName: customer?.fullName ?? null };
      }),
    trackByPhoneVerified: publicProcedure
      .input(z.object({ accessToken: z.string().min(20).max(300) }))
      .query(async ({ input }) => getRequestTrackingByPhone(await requireCustomerPhone(input.accessToken))),
    updates: adminProcedure
      .input(z.object({ requestId: z.number().int().positive() }))
      .query(({ input }) => listRequestUpdates(input.requestId)),
    addUpdate: adminProcedure.input(updateInput).mutation(async ({ input, ctx }) => {
      if (input.status) await updateTransactionRequestStatus(input.requestId, input.status);
      const updateId = await createRequestUpdate({
        requestId: input.requestId,
        message: input.message ?? statusUpdates[input.status!],
        status: input.status ?? null,
        senderType: "owner",
        senderUserId: ctx.user.id,
        senderName: ctx.user.name,
      });
      return { success: true, updateId } as const;
    }),
    uploadAttachment: adminProcedure.input(attachmentInput).mutation(async ({ input }) => {
      if (!allowedAttachmentTypes.has(input.mimeType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "نوع الملف غير مدعوم." });
      }
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (bytes.length === 0 || bytes.length > MAX_ATTACHMENT_BYTES) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "يجب ألا يتجاوز حجم المرفق 8 ميجابايت." });
      }
      const stored = await storagePut(
        `request-attachments/update-${input.updateId}/${safeAttachmentName(input.fileName)}`,
        bytes,
        input.mimeType,
      );
      await createRequestAttachment({
        updateId: input.updateId,
        fileName: input.fileName,
        fileKey: stored.key,
        fileUrl: stored.url,
        mimeType: input.mimeType,
        size: bytes.length,
      });
      return { success: true, attachment: { fileName: input.fileName, url: stored.url } } as const;
    }),
    updateStatus: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(requestStatuses) }))
      .mutation(async ({ input, ctx }) => {
        await updateTransactionRequestStatus(input.id, input.status);
        await createRequestUpdate({
          requestId: input.id,
          message: statusUpdates[input.status],
          status: input.status,
          senderType: "owner",
          senderUserId: ctx.user.id,
          senderName: ctx.user.name,
        });
        return { success: true } as const;
      }),
    updateWorkflow: adminProcedure.input(workflowInput).mutation(async ({ input }) => {
      if (input.assigneeId) {
        const staff = await listAssignableStaff();
        if (!staff.some((member) => member.id === input.assigneeId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "الموظف المختار غير متاح للإسناد." });
        }
      }
      await updateRequestWorkflow(input);
      return { success: true } as const;
    }),
  }),
  employees: router({
    overview: adminProcedure.query(() => listEmployeesWithAssignments()),
    myAssignments: employeeProcedure.query(async ({ ctx }) => {
      const staff = await getActiveStaffAccountForUser(ctx.user.id);
      if (!staff?.permissions.canViewAssigned) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية عرض الطلبات الموكلة." });
      return listRequestsAssignedToUser(ctx.user.id);
    }),
    updateAssignment: employeeProcedure.input(updateInput).mutation(async ({ input, ctx }) => {
      const staff = await getActiveStaffAccountForUser(ctx.user.id);
      if (!staff) throw new TRPCError({ code: "FORBIDDEN", message: "حساب الموظف غير مفعل." });
      if (input.status && !staff.permissions.canUpdateStatus) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية تحديث حالة الطلب." });
      if (input.message && !staff.permissions.canAddCustomerUpdate) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية نشر تحديث للعميل." });
      const result = await createAssignedRequestUpdateWithAudit({ requestId: input.requestId, actorUserId: ctx.user.id, actorRole: "employee", actorName: ctx.user.name, message: input.message ?? statusUpdates[input.status!], status: input.status, action: input.status ? "employee_status_update" : "employee_customer_update", summary: input.status ? `غيّر الموظف حالة الطلب إلى ${input.status}.` : "أرسل الموظف رسالة إلى العميل." });
      if (!result) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك تحديث طلب غير موكل إليك." });
      return { success: true, updateId: result.updateId } as const;
    }),
  }),
  agents: router({
    myAssignments: agentProcedure.query(async ({ ctx }) => {
      const staff = await getActiveStaffAccountForUser(ctx.user.id);
      if (!staff?.permissions.canViewAssigned) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية عرض الطلبات الموكلة." });
      return listRequestsAssignedToUser(ctx.user.id);
    }),
    updates: agentProcedure
      .input(z.object({ requestId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const staff = await getActiveStaffAccountForUser(ctx.user.id);
        if (!staff?.permissions.canViewAssigned) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية عرض تحديثات الطلبات." });
        if (!(await isRequestAssignedToUser(input.requestId, ctx.user.id))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك عرض تحديثات طلب غير موكل إليك." });
        }
        return listRequestUpdates(input.requestId);
      }),
    addUpdate: agentProcedure.input(updateInput).mutation(async ({ input, ctx }) => {
      const staff = await getActiveStaffAccountForUser(ctx.user.id);
      if (!staff) throw new TRPCError({ code: "FORBIDDEN", message: "حساب المعقب غير مفعل." });
      if (input.status && !staff.permissions.canUpdateStatus) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية تحديث الحالة." });
      if (input.message && !staff.permissions.canAddCustomerUpdate) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية نشر تحديث للعميل." });
      const result = await createAssignedRequestUpdateWithAudit({ requestId: input.requestId, actorUserId: ctx.user.id, actorRole: "agent", actorName: ctx.user.name, message: input.message ?? statusUpdates[input.status!], status: input.status, action: input.status ? "agent_status_update" : "agent_customer_update", summary: input.status ? `غيّر المعقب حالة الطلب إلى ${input.status}.` : "نشر المعقب تحديثًا للعميل." });
      if (!result) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك تحديث طلب غير موكل إليك." });
      return { success: true, updateId: result.updateId } as const;
    }),
  }),
  staffAccounts: router({
    list: adminProcedure.query(() => listStaffAccounts()),
    create: adminProcedure.input(staffAccountInput).mutation(async ({ input, ctx }) => {
      const id = await createStaffAccount({ ...input, createdByUserId: ctx.user.id });
      return { success: true, id } as const;
    }),
    update: adminProcedure.input(staffAccountInput.safeExtend({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(async ({ input }) => {
      await updateStaffAccount(input);
      return { success: true } as const;
    }),
    me: teamProcedure.query(async ({ ctx }) => {
      const account = await getActiveStaffAccountForUser(ctx.user.id);
      if (!account) throw new TRPCError({ code: "FORBIDDEN", message: "حساب الفريق غير مفعل أو غير مرتبط." });
      return account;
    }),
  }),
  teamNotifications: router({
    list: teamProcedure.query(({ ctx }) => listTeamNotificationsForUser(ctx.user.id)),
    markRead: teamProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      await markTeamNotificationRead(input.notificationId, ctx.user.id);
      return { success: true } as const;
    }),
    markAllRead: teamProcedure.mutation(async ({ ctx }) => {
      await markAllTeamNotificationsRead(ctx.user.id);
      return { success: true } as const;
    }),
    delete: teamProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      await deleteTeamNotification(input.notificationId, ctx.user.id);
      return { success: true } as const;
    }),
    clearRead: teamProcedure.mutation(async ({ ctx }) => {
      await clearReadTeamNotifications(ctx.user.id);
      return { success: true } as const;
    }),
  }),
  conversation: router({
    teamInbox: teamProcedure.query(async ({ ctx }) => {
      const staff = await getActiveStaffAccountForUser(ctx.user.id);
      if (!staff?.permissions.canViewAssigned) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية عرض رسائل العملاء." });
      return listTeamPrivateMessages(ctx.user.id);
    }),
    customerList: publicProcedure.input(z.object({ accessToken: z.string().min(20).max(300), requestId: z.number().int().positive() })).query(async ({ input }) => {
      const updates = await listCustomerRequestConversation(await requireCustomerPhone(input.accessToken), input.requestId);
      if (!updates) throw new TRPCError({ code: "FORBIDDEN", message: "تُفتح المحادثة بعد اعتماد مقدم الخدمة فقط." });
      return updates;
    }),
    customerSend: publicProcedure.input(z.object({ accessToken: z.string().min(20).max(300), requestId: z.number().int().positive(), message: z.string().trim().min(2).max(2000) })).mutation(async ({ input }) => {
      const result = await createCustomerRequestComment({ phone: await requireCustomerPhone(input.accessToken), requestId: input.requestId, message: input.message });
      if (!result) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن إرسال تعليق إلا داخل طلب معتمد يخص رقم جوالك." });
      return { success: true, updateId: result.updateId } as const;
    }),
    customerUpload: publicProcedure.input(conversationAttachmentInput.extend({ accessToken: z.string().min(20).max(300) })).mutation(async ({ input }) => {
      const phone = await requireCustomerPhone(input.accessToken);
      if (!(await listCustomerRequestConversation(phone, input.requestId))) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن إرفاق ملف إلا داخل طلب معتمد يخص رقم جوالك." });
      const request = await getTransactionRequestById(input.requestId);
      if (request?.status === "completed") throw new TRPCError({ code: "CONFLICT", message: "المراسلة مغلقة للطلب المكتمل." });
      const attachment = await storeConversationAttachment(input);
      const result = await createCustomerConversationAttachment({ phone, requestId: input.requestId, message: input.message, attachment });
      if (!result) throw new TRPCError({ code: "FORBIDDEN", message: "تعذر ربط المرفق بهذا الطلب." });
      return { success: true, updateId: result.updateId, attachment: { fileName: attachment.fileName, url: attachment.fileUrl } } as const;
    }),
    teamList: teamProcedure.input(z.object({ requestId: z.number().int().positive() })).query(async ({ input, ctx }) => {
      const staff = await getActiveStaffAccountForUser(ctx.user.id);
      if (!staff?.permissions.canViewAssigned) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية عرض رسائل الطلب." });
      if (!(await isRequestAssignedToUser(input.requestId, ctx.user.id))) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك عرض محادثة طلب غير موكل إليك." });
      return listRequestUpdates(input.requestId);
    }),
    teamSend: teamProcedure.input(z.object({ requestId: z.number().int().positive(), message: z.string().trim().min(2).max(2000) })).mutation(async ({ input, ctx }) => {
      const staff = await getActiveStaffAccountForUser(ctx.user.id);
      if (!staff?.permissions.canAddCustomerUpdate) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية التواصل مع العميل." });
      const actorRole = ctx.user.role === "agent" ? "agent" : "employee";
      const result = await createAssignedRequestUpdateWithAudit({ requestId: input.requestId, actorUserId: ctx.user.id, actorRole, actorName: ctx.user.name, message: input.message, action: `${actorRole}_customer_message`, summary: "أرسل مقدم الخدمة رسالة إلى العميل." });
      if (!result) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك مراسلة عميل طلب غير معتمد لك." });
      return { success: true, updateId: result.updateId } as const;
    }),
    teamUpload: teamProcedure.input(conversationAttachmentInput).mutation(async ({ input, ctx }) => {
      const staff = await getActiveStaffAccountForUser(ctx.user.id);
      if (!staff?.permissions.canAddCustomerUpdate) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية إرسال مرفقات للعميل." });
      const request = await getTransactionRequestById(input.requestId);
      if (!request || request.assigneeId !== ctx.user.id || !request.providerAcceptedAt) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن إرفاق ملف لطلب غير معتمد لك." });
      if (request.status === "completed") throw new TRPCError({ code: "CONFLICT", message: "المراسلة مغلقة للطلب المكتمل." });
      const attachment = await storeConversationAttachment(input);
      const actorRole = ctx.user.role === "agent" ? "agent" : "employee";
      const result = await createTeamConversationAttachment({ requestId: input.requestId, actorUserId: ctx.user.id, actorRole, actorName: ctx.user.name, message: input.message, attachment });
      if (!result) throw new TRPCError({ code: "FORBIDDEN", message: "تعذر ربط المرفق بهذا الطلب." });
      return { success: true, updateId: result.updateId, attachment: { fileName: attachment.fileName, url: attachment.fileUrl } } as const;
    }),
  }),
  reviews: router({
    submit: publicProcedure.input(z.object({ accessToken: z.string().min(20).max(300), requestId: z.number().int().positive(), rating: z.number().int().min(1).max(5), reviewText: z.string().trim().max(1200).optional() })).mutation(async ({ input }) => {
      try {
        const review = await createRequestReviewForCustomer({ phone: await requireCustomerPhone(input.accessToken), requestId: input.requestId, rating: input.rating, reviewText: input.reviewText });
        return { success: true, review } as const;
      } catch (error) {
        throw new TRPCError({ code: "CONFLICT", message: error instanceof Error ? error.message : "تعذر حفظ التقييم." });
      }
    }),
  }),
  customerNotifications: router({
    list: publicProcedure.input(z.object({ accessToken: z.string().min(20).max(300) })).query(async ({ input }) => listCustomerNotificationsForPhone(await requireCustomerPhone(input.accessToken))),
    markRead: publicProcedure.input(z.object({ accessToken: z.string().min(20).max(300), notificationId: z.number().int().positive() })).mutation(async ({ input }) => {
      await markCustomerNotificationRead(input.notificationId, await requireCustomerPhone(input.accessToken));
      return { success: true } as const;
    }),
    markAllRead: publicProcedure.input(z.object({ accessToken: z.string().min(20).max(300) })).mutation(async ({ input }) => {
      await markAllCustomerNotificationsRead(await requireCustomerPhone(input.accessToken));
      return { success: true } as const;
    }),
    markQuoteRequestRead: publicProcedure.input(z.object({ accessToken: z.string().min(20).max(300), requestId: z.number().int().positive() })).mutation(async ({ input }) => {
      await markCustomerQuoteNotificationsReadForRequest(input.requestId, await requireCustomerPhone(input.accessToken));
      return { success: true } as const;
    }),
  }),
  quotes: router({
    openRequests: teamProcedure.query(({ ctx }) => listOpenRequestsForTeam(ctx.user.id)),
    submit: teamProcedure.input(quoteInput).mutation(async ({ input, ctx }) => {
      return upsertRequestQuote({ requestId: input.requestId, providerUserId: ctx.user.id, priceAmount: input.priceAmount.toFixed(2), durationDays: input.durationDays, note: input.note });
    }),
    withdraw: teamProcedure.input(z.object({ requestId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      try {
        return await withdrawRequestQuote({ requestId: input.requestId, providerUserId: ctx.user.id });
      } catch (error) {
        throw new TRPCError({ code: "CONFLICT", message: error instanceof Error ? error.message : "تعذر سحب العرض." });
      }
    }),
    providerAccept: teamProcedure.input(z.object({ requestId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      try {
        return await acceptSelectedQuoteForProvider({ requestId: input.requestId, providerUserId: ctx.user.id });
      } catch (error) {
        throw new TRPCError({ code: "CONFLICT", message: error instanceof Error ? error.message : "تعذر قبول الطلب." });
      }
    }),
    setDeadline: adminProcedure.input(z.object({ requestId: z.number().int().positive(), deadlineMs: z.number().int().positive() })).mutation(async ({ input }) => {
      const deadline = new Date(input.deadlineMs);
      if (Number.isNaN(deadline.getTime()) || deadline.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1000) throw new TRPCError({ code: "BAD_REQUEST", message: "مهلة استقبال العروض غير صالحة." });
      try {
        return await updateQuoteSubmissionDeadline({ requestId: input.requestId, deadline });
      } catch (error) {
        throw new TRPCError({ code: "CONFLICT", message: error instanceof Error ? error.message : "تعذر تعديل المهلة." });
      }
    }),
    customerList: publicProcedure.input(z.object({ accessToken: z.string().min(20).max(300) })).query(async ({ input }) => listQuotesForCustomerPhone(await requireCustomerPhone(input.accessToken))),
    accept: publicProcedure.input(z.object({ accessToken: z.string().min(20).max(300), quoteId: z.number().int().positive() })).mutation(async ({ input }) => {
      try {
        return await acceptQuoteForCustomer({ phone: await requireCustomerPhone(input.accessToken), quoteId: input.quoteId });
      } catch (error) {
        throw new TRPCError({ code: "CONFLICT", message: error instanceof Error ? error.message : "تعذر اعتماد العرض." });
      }
    }),
  }),
  audit: router({
    list: adminProcedure.input(z.object({
      requestId: z.number().int().positive().optional(),
      actorUserId: z.number().int().positive().optional(),
      action: z.string().trim().max(80).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }).optional()).query(({ input }) => listAuditLogs(input ?? {})),
  }),
  customers: router({
    // Self-service profile: the signed phone token is the only identity. The phone changes only through
    // requestPhoneChange/confirmPhoneChange, after the new number is verified with its own code.
    myProfile: publicProcedure.input(z.object({ accessToken: z.string().min(20).max(300) })).query(async ({ input }) =>
      getCustomerProfileByPhone(await requireCustomerPhone(input.accessToken))),
    updateMyProfile: publicProcedure.input(z.object({
      accessToken: z.string().min(20).max(300),
      fullName: z.string().trim().min(2, "اكتب الاسم الكامل بحرفين على الأقل.").max(160),
      email: z.string().trim().max(320).optional().nullable(),
    })).mutation(async ({ input }) =>
      updateCustomerProfileByPhone(await requireCustomerPhone(input.accessToken), { fullName: input.fullName, email: input.email })),
    // Changing the sign-in number: a code is prepared for the new number, then the change is
    // applied only after that number is verified. The old number's sessions stop working.
    requestPhoneChange: publicProcedure.input(z.object({
      accessToken: z.string().min(20).max(300),
      newPhone: z.string().trim().regex(/^05\d{8}$/),
      language: z.enum(["ar", "en"]).default("ar"),
    })).mutation(async ({ input }) => {
      const phone = await requirePhoneChangeSession(input.accessToken, input.language);
      await assertCanRequestPhoneChange(phone, input.newPhone, input.language);
      return requestPhoneCode(input.newPhone, input.language);
    }),
    confirmPhoneChange: publicProcedure.input(z.object({
      accessToken: z.string().min(20).max(300),
      challengeId: z.string().uuid(),
      code: z.string().regex(/^\d{6}$/),
      clientKey: z.string().uuid(),
      language: z.enum(["ar", "en"]).default("ar"),
    })).mutation(async ({ input }) => {
      const phone = await requirePhoneChangeSession(input.accessToken, input.language);
      // Fail before spending the code when the signed-in account itself is gone.
      await getCustomerProfileByPhone(phone);
      // The verified challenge decides the new number; the browser never supplies it here.
      const verified = await verifyPhoneCode({ challengeId: input.challengeId, code: input.code, clientKey: input.clientKey, language: input.language });
      const result = await changeCustomerPhone(phone, verified.phone, input.language);
      return { ...result, accessToken: createPhoneAccessToken(result.profile.phone), expiresInSeconds: phoneAccessTtlSeconds };
    }),
    findByPhoneAccessToken: publicProcedure.input(z.object({ accessToken: z.string().min(20).max(300) })).mutation(async ({ input }) => {
      const phone = await requireCustomerPhone(input.accessToken);
      return getCustomerByPhone(phone);
    }),
    registerWithPhone: publicProcedure.input(z.object({ fullName: z.string().trim().min(2).max(160), phone: z.string().trim().regex(/^05\d{8}$/), email: z.string().trim().email().max(320).optional(), accessToken: z.string().min(20).max(300), termsAccepted: z.literal(true), termsVersion: z.literal(CURRENT_TERMS_VERSION) })).mutation(async ({ input }) => {
      const verifiedPhone = await requireCustomerPhone(input.accessToken);
      if (verifiedPhone !== input.phone) throw new TRPCError({ code: "FORBIDDEN", message: "لا يتطابق رقم الجوال مع تصريح التحقق." });
      return registerCustomerWithPhone({ fullName: input.fullName, phone: input.phone, email: input.email, termsAcceptedAt: new Date(), termsVersion: input.termsVersion });
    }),
    list: adminProcedure.query(() => listCustomers()),
    detail: adminProcedure.input(z.object({ customerId: z.number().int().positive() })).query(({ input }) => getCustomerAdminDetail(input.customerId)),
    dashboard: protectedProcedure.query(({ ctx }) => getCustomerDashboard(ctx.user)),
  }),
});

export type AppRouter = typeof appRouter;
