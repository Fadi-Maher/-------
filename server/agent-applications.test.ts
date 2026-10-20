import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  verifyTicket: vi.fn(),
  getStatus: vi.fn(),
  submit: vi.fn(),
  list: vi.fn(),
  review: vi.fn(),
}));

vi.mock("./phoneLoginTicket", () => ({
  verifyPhoneLoginTicket: mocks.verifyTicket,
}));
vi.mock("./agentApplicationsDb", () => ({
  getAgentApplicationStatus: mocks.getStatus,
  submitAgentApplication: mocks.submit,
  listAgentApplications: mocks.list,
  reviewAgentApplication: mocks.review,
  toPublicAgentApplication: (application: unknown) => application,
}));

import { agentApplicationsRouter } from "./agentApplicationsRouter";

const phone = "0512345678";
const application = {
  id: 42,
  reference: "JOIN-42",
  phone,
  fullName: "معقب اختبار",
  email: "agent@example.test",
  city: "الرياض",
  specialty: "التعقيب",
  experienceYears: 4,
  notes: null,
  status: "pending" as const,
  reviewNote: null,
  createdAt: 1,
  reviewedAt: null,
};

function context(role: "admin" | "agent" | "employee" | "user" | null): TrpcContext {
  return {
    user: role ? {
      id: 77,
      role,
      openId: `application-unit-${role}`,
      name: "مستخدم اختبار",
      email: "unit@example.test",
      loginMethod: "test",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const submitInput = () => ({
  verificationToken: "valid-ticket",
  fullName: "  معقب اختبار  ",
  email: "AGENT@EXAMPLE.TEST",
  city: " الرياض ",
  specialty: " التعقيب ",
  experienceYears: 4,
  notes: "  خبرة في الخدمات الحكومية  ",
  consent: true as const,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyTicket.mockReturnValue(phone);
  mocks.getStatus.mockResolvedValue({ hasActiveAgent: false, application: null });
  mocks.submit.mockResolvedValue(application);
  mocks.list.mockResolvedValue([application]);
  mocks.review.mockResolvedValue(application);
});

describe("agentApplications router", () => {
  it("لا يلمس حالة أو إرسال الطلب دون تصريح جوال صالح", async () => {
    mocks.verifyTicket.mockImplementation(() => {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    });
    const caller = agentApplicationsRouter.createCaller(context(null));

    await expect(caller.status({ verificationToken: "bad-ticket" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.submit(submitInput())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getStatus).not.toHaveBeenCalled();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("يستمد رقم الجوال من التصريح فقط ويطبع بيانات الطلب", async () => {
    const caller = agentApplicationsRouter.createCaller(context(null));
    const maliciousInput = { ...submitInput(), phone: "0599999999" };

    await expect(caller.status({ verificationToken: "valid-ticket" })).resolves.toEqual({ hasActiveAgent: false, application: null });
    await expect(caller.submit(maliciousInput)).resolves.toEqual(application);
    expect(mocks.getStatus).toHaveBeenCalledWith(phone);
    expect(mocks.submit).toHaveBeenCalledWith(phone, {
      fullName: "معقب اختبار",
      email: "agent@example.test",
      city: "الرياض",
      specialty: "التعقيب",
      experienceYears: 4,
      notes: "خبرة في الخدمات الحكومية",
    });
  });

  it("يفرض الموافقة الصريحة والحدود وسبب الرفض", async () => {
    const caller = agentApplicationsRouter.createCaller(context(null));
    await expect(caller.submit({ ...submitInput(), consent: false })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.submit({ ...submitInput(), fullName: "أ" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.submit({ ...submitInput(), email: "ليس-بريدًا" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.submit).not.toHaveBeenCalled();

    const admin = agentApplicationsRouter.createCaller(context("admin"));
    await expect(admin.review({
      id: 42,
      decision: "rejected",
      reviewNote: "لا",
      permissions: { canViewAssigned: false, canUpdateStatus: false, canAddCustomerUpdate: false },
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it.each([null, "user", "agent", "employee"] as const)("يمنع %s من القائمة وقرار الموافقة", async role => {
    const caller = agentApplicationsRouter.createCaller(context(role));
    const expectedCode = role ? "FORBIDDEN" : "UNAUTHORIZED";
    await expect(caller.list()).rejects.toMatchObject({ code: expectedCode });
    await expect(caller.review({
      id: 42,
      decision: "approved",
      permissions: { canViewAssigned: true, canUpdateStatus: true, canAddCustomerUpdate: true },
    })).rejects.toMatchObject({ code: expectedCode });
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it("يسمح للمدير فقط بالمراجعة ويحفظ الصلاحيات المختارة", async () => {
    const caller = agentApplicationsRouter.createCaller(context("admin"));
    const permissions = { canViewAssigned: true, canUpdateStatus: false, canAddCustomerUpdate: true };
    await expect(caller.list()).resolves.toEqual([application]);
    await expect(caller.review({ id: 42, decision: "approved", reviewNote: "جاهز", permissions })).resolves.toEqual(application);
    expect(mocks.review).toHaveBeenCalledWith({
      id: 42,
      decision: "approved",
      reviewNote: "جاهز",
      permissions,
      actorUserId: 77,
    });
  });
});
