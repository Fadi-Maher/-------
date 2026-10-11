import { beforeEach, describe, expect, it, vi } from "vitest";
import { UNAUTHED_ERR_MSG } from "../shared/const";
import { CURRENT_TERMS_VERSION } from "../shared/legal";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  acceptQuoteForCustomer: vi.fn(),
  acceptSelectedQuoteForProvider: vi.fn(),
  clearReadTeamNotifications: vi.fn(),
  createAssignedRequestUpdateWithAudit: vi.fn(),
  createCustomerConversationAttachment: vi.fn(),
  createCustomerRequestComment: vi.fn(),
  createRequestReviewForCustomer: vi.fn(),
  createAuditLog: vi.fn(),
  createRequestAttachment: vi.fn(),
  createRequest: vi.fn(),
  createRequestUpdate: vi.fn(),
  createStaffAccount: vi.fn(),
  createTeamConversationAttachment: vi.fn(),
  deleteTeamNotification: vi.fn(),
  getActiveAgentAccountByPhone: vi.fn(),
  getActiveStaffAccountForUser: vi.fn(),
  getCustomerAdminDetail: vi.fn(),
  getCustomerDashboard: vi.fn(),
  getCustomerByPhone: vi.fn(),
  getAppSettings: vi.fn(),
  getRequestTrackingByPhone: vi.fn(),
  getTransactionRequestById: vi.fn(),
  isRequestAssignedToUser: vi.fn(),
  listAssignableStaff: vi.fn(),
  listCustomers: vi.fn(),
  listOpenRequestsForTeam: vi.fn(),
  listQuotesForCustomerPhone: vi.fn(),
  listEmployeesWithAssignments: vi.fn(),
  listRequestsAssignedToUser: vi.fn(),
  listAuditLogs: vi.fn(),
  listCustomerNotificationsForPhone: vi.fn(),
  listCustomerRequestConversation: vi.fn(),
  listRequestUpdates: vi.fn(),
  listStaffAccounts: vi.fn(),
  listTeamNotificationsForUser: vi.fn(),
  updateRequestStatus: vi.fn(),
  markOwnerNotified: vi.fn(),
  markAllTeamNotificationsRead: vi.fn(),
  markAllCustomerNotificationsRead: vi.fn(),
  markCustomerNotificationRead: vi.fn(),
  markCustomerQuoteNotificationsReadForRequest: vi.fn(),
  markTeamNotificationRead: vi.fn(),
  notifyOwner: vi.fn(),
  resolveCustomerForRequest: vi.fn(),
  registerCustomerWithPhone: vi.fn(),
  storagePut: vi.fn(),
  updateRequestWorkflow: vi.fn(),
  updateQuoteSubmissionDeadline: vi.fn(),
  updateStaffAccount: vi.fn(),
  upsertRequestQuote: vi.fn(),
  withdrawRequestQuote: vi.fn(),
}));

vi.mock("./db", () => ({
  acceptQuoteForCustomer: mocks.acceptQuoteForCustomer,
  acceptSelectedQuoteForProvider: mocks.acceptSelectedQuoteForProvider,
  clearReadTeamNotifications: mocks.clearReadTeamNotifications,
  createAssignedRequestUpdateWithAudit: mocks.createAssignedRequestUpdateWithAudit,
  createCustomerConversationAttachment: mocks.createCustomerConversationAttachment,
  createCustomerRequestComment: mocks.createCustomerRequestComment,
  createRequestReviewForCustomer: mocks.createRequestReviewForCustomer,
  createAuditLog: mocks.createAuditLog,
  createRequestAttachment: mocks.createRequestAttachment,
  createRequestUpdate: mocks.createRequestUpdate,
  createStaffAccount: mocks.createStaffAccount,
  createTeamConversationAttachment: mocks.createTeamConversationAttachment,
  createTransactionRequest: mocks.createRequest,
  deleteTeamNotification: mocks.deleteTeamNotification,
  getActiveAgentAccountByPhone: mocks.getActiveAgentAccountByPhone,
  getCustomerAdminDetail: mocks.getCustomerAdminDetail,
  getCustomerDashboard: mocks.getCustomerDashboard,
  getCustomerByPhone: mocks.getCustomerByPhone,
  getRequestTracking: vi.fn(),
  getRequestTrackingByPhone: mocks.getRequestTrackingByPhone,
  getActiveStaffAccountForUser: mocks.getActiveStaffAccountForUser,
  getTransactionRequestById: mocks.getTransactionRequestById,
  getAppSettings: mocks.getAppSettings,
  isRequestAssignedToUser: mocks.isRequestAssignedToUser,
  listAssignableStaff: mocks.listAssignableStaff,
  listCustomers: mocks.listCustomers,
  listOpenRequestsForTeam: mocks.listOpenRequestsForTeam,
  listQuotesForCustomerPhone: mocks.listQuotesForCustomerPhone,
  listEmployeesWithAssignments: mocks.listEmployeesWithAssignments,
  listRequestsAssignedToUser: mocks.listRequestsAssignedToUser,
  listAuditLogs: mocks.listAuditLogs,
  listCustomerNotificationsForPhone: mocks.listCustomerNotificationsForPhone,
  listCustomerRequestConversation: mocks.listCustomerRequestConversation,
  listStaffAccounts: mocks.listStaffAccounts,
  listTeamNotificationsForUser: mocks.listTeamNotificationsForUser,
  listTransactionRequests: vi.fn(),
  listRequestUpdates: mocks.listRequestUpdates,
  markOwnerNotified: mocks.markOwnerNotified,
  markAllTeamNotificationsRead: mocks.markAllTeamNotificationsRead,
  markAllCustomerNotificationsRead: mocks.markAllCustomerNotificationsRead,
  markCustomerNotificationRead: mocks.markCustomerNotificationRead,
  markCustomerQuoteNotificationsReadForRequest: mocks.markCustomerQuoteNotificationsReadForRequest,
  markTeamNotificationRead: mocks.markTeamNotificationRead,
  replaceAppSettings: vi.fn(),
  resolveCustomerForRequest: mocks.resolveCustomerForRequest,
  registerCustomerWithPhone: mocks.registerCustomerWithPhone,
  updateTransactionRequestStatus: mocks.updateRequestStatus,
  updateRequestWorkflow: mocks.updateRequestWorkflow,
  updateQuoteSubmissionDeadline: mocks.updateQuoteSubmissionDeadline,
  updateStaffAccount: mocks.updateStaffAccount,
  upsertRequestQuote: mocks.upsertRequestQuote,
  withdrawRequestQuote: mocks.withdrawRequestQuote,
  upsertPwaSubscription: vi.fn(),
  disablePwaSubscription: vi.fn(),
}));

vi.mock("./_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));

import { appRouter, requestInput } from "./routers";

function publicContext(): TrpcContext {
  return { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

function adminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-admin",
      name: "Test Admin",
      email: "admin@example.com",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function clientContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "test-client",
      name: "Test Client",
      email: "client@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function employeeContext(): TrpcContext {
  return {
    user: {
      id: 3,
      openId: "test-employee",
      name: "Test Employee",
      email: "employee@example.com",
      loginMethod: "manus",
      role: "employee",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function agentContext(): TrpcContext {
  return {
    user: {
      id: 4,
      openId: "test-agent",
      name: "Test Agent",
      email: "agent@example.com",
      loginMethod: "manus",
      role: "agent",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const baseRequest = {
  requesterName: "عميل تجريبي",
  phone: "0500000000",
  category: "تعقّب المعاملات" as const,
  details: "أحتاج متابعة حالة المعاملة بعد تقديم المستندات المطلوبة.",
};

describe("طلبات ستريك إكسبريس", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createRequest.mockResolvedValue({
      id: 7,
      reference: "SE-TEST-0001",
      category: baseRequest.category,
      requesterName: baseRequest.requesterName,
      phone: baseRequest.phone,
      subcategory: null,
    });
    mocks.createRequestUpdate.mockResolvedValue(undefined);
    mocks.createRequestAttachment.mockResolvedValue(undefined);
    mocks.getCustomerDashboard.mockResolvedValue({ customer: { id: 3 }, requests: [], totalRequests: 0 });
    mocks.getAppSettings.mockResolvedValue({ whatsappNumber: null, fields: [] });
    mocks.listCustomers.mockResolvedValue([]);
    mocks.listAssignableStaff.mockResolvedValue([{ id: 1, name: "Test Admin", email: "admin@example.com", role: "admin" }]);
    mocks.listEmployeesWithAssignments.mockResolvedValue([]);
    mocks.listOpenRequestsForTeam.mockResolvedValue([]);
    mocks.listQuotesForCustomerPhone.mockResolvedValue([]);
    mocks.listRequestsAssignedToUser.mockResolvedValue([]);
    mocks.listAuditLogs.mockResolvedValue([]);
    mocks.listCustomerNotificationsForPhone.mockResolvedValue({ items: [], unreadCount: 0 });
    mocks.listCustomerRequestConversation.mockResolvedValue([]);
    mocks.listRequestUpdates.mockResolvedValue([]);
    mocks.listStaffAccounts.mockResolvedValue([]);
    mocks.listTeamNotificationsForUser.mockResolvedValue({ items: [], unreadCount: 0 });
    mocks.isRequestAssignedToUser.mockResolvedValue(false);
    mocks.getActiveStaffAccountForUser.mockImplementation(async (userId: number) => ({
      id: userId,
      userId,
      fullName: userId === 4 ? "Test Agent" : "Test Employee",
      email: userId === 4 ? "agent@example.com" : "employee@example.com",
      role: userId === 4 ? "agent" : "employee",
      isActive: true,
      permissions: { canViewAssigned: true, canUpdateStatus: true, canAddCustomerUpdate: userId === 4 },
      requests: [],
    }));
    mocks.getActiveAgentAccountByPhone.mockResolvedValue(null);
    mocks.getCustomerByPhone.mockResolvedValue({ id: 3, fullName: "عميل مسجل", phone: "0530204050", email: "customer@example.com" });
    mocks.createCustomerRequestComment.mockResolvedValue({ updateId: 71 });
    mocks.createCustomerConversationAttachment.mockResolvedValue({ updateId: 72 });
    mocks.createTeamConversationAttachment.mockResolvedValue({ updateId: 73 });
    mocks.getTransactionRequestById.mockResolvedValue({ id: 31, status: "received" });
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.createAssignedRequestUpdateWithAudit.mockResolvedValue({ updateId: 44 });
    mocks.createStaffAccount.mockResolvedValue(9);
    mocks.updateStaffAccount.mockResolvedValue({ id: 9 });
    mocks.notifyOwner.mockResolvedValue(true);
    mocks.markOwnerNotified.mockResolvedValue(undefined);
    mocks.markAllTeamNotificationsRead.mockResolvedValue(undefined);
    mocks.markTeamNotificationRead.mockResolvedValue(undefined);
    mocks.deleteTeamNotification.mockResolvedValue(undefined);
    mocks.clearReadTeamNotifications.mockResolvedValue(undefined);
    mocks.markAllCustomerNotificationsRead.mockResolvedValue(undefined);
    mocks.markCustomerNotificationRead.mockResolvedValue(undefined);
    mocks.upsertRequestQuote.mockResolvedValue({ updated: false });
    mocks.acceptQuoteForCustomer.mockResolvedValue({ requestId: 31, providerName: "Test Agent", priceAmount: "450.00", durationDays: 5 });
    mocks.acceptSelectedQuoteForProvider.mockResolvedValue({ success: true, acceptedAt: new Date() });
    mocks.withdrawRequestQuote.mockResolvedValue({ success: true });
    mocks.updateQuoteSubmissionDeadline.mockResolvedValue({ success: true });
    mocks.resolveCustomerForRequest.mockResolvedValue(3);
    mocks.registerCustomerWithPhone.mockResolvedValue({ id: 4, fullName: "عميل جديد", phone: "0555555555", email: "new@example.com", termsVersion: CURRENT_TERMS_VERSION, termsAcceptedAt: new Date() });
    mocks.storagePut.mockResolvedValue({ key: "request-attachments/demo.pdf", url: "/manus-storage/request-attachments/demo.pdf" });
    mocks.updateRequestWorkflow.mockResolvedValue(undefined);
  });

  it("يتحقق من البيانات المطلوبة قبل حفظ الطلب", () => {
    expect(requestInput.parse(baseRequest).category).toBe("تعقّب المعاملات");
    expect(() => requestInput.parse({ ...baseRequest, details: "قصير" })).toThrow();
  });

  it("يحفظ الطلب ويرسل تنبيهًا تشغيليًا للمالك", async () => {
    const caller = appRouter.createCaller(publicContext());
    const result = await caller.requests.create(baseRequest);

    expect(result).toEqual({ id: 7, reference: "SE-TEST-0001", ownerNotified: true });
    expect(mocks.createRequest).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 3,
      requesterName: baseRequest.requesterName,
      category: "تعقّب المعاملات",
    }));
    expect(mocks.createRequestUpdate).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 7,
      status: "received",
    }));
    expect(mocks.notifyOwner).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining("طلب جديد") }));
    expect(mocks.markOwnerNotified).toHaveBeenCalledWith(7);
  });

  it("يحفظ الطلب حتى عند تعذر إرسال تنبيه المالك", async () => {
    mocks.notifyOwner.mockResolvedValueOnce(false);
    const caller = appRouter.createCaller(publicContext());

    await expect(caller.requests.create(baseRequest)).resolves.toEqual({
      id: 7,
      reference: "SE-TEST-0001",
      ownerNotified: false,
    });
    expect(mocks.createRequestUpdate).toHaveBeenCalledWith(expect.objectContaining({ requestId: 7 }));
    expect(mocks.markOwnerNotified).not.toHaveBeenCalled();
  });

  it("يحفظ طلب العميل المسجل مباشرة ببيانات جلسة الجوال الموثقة", async () => {
    const caller = appRouter.createCaller(publicContext());
    const verified = await caller.requests.verifyPhoneDemo({ phone: "0530204050", code: "123456" });
    const result = await caller.requests.createForCustomer({
      accessToken: verified.accessToken,
      category: "طلب خدمة",
      subcategory: "استشارة أو طلب مخصص",
      details: "تفاصيل طلب مكتملة تُحفظ مباشرة داخل حساب العميل المسجل.",
    });

    expect(result).toMatchObject({ id: 7, reference: "SE-TEST-0001" });
    expect(mocks.getCustomerByPhone).toHaveBeenCalledWith("0530204050");
    expect(mocks.createRequest).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 3,
      requesterName: "عميل مسجل",
      phone: "0530204050",
      category: "طلب خدمة",
    }));
    expect(mocks.resolveCustomerForRequest).not.toHaveBeenCalled();
  });

  it("يتحقق من الحقول المخصصة المطلوبة ويحفظ الإجابات المصرح بها", async () => {
    mocks.getAppSettings.mockResolvedValue({
      whatsappNumber: null,
      fields: [{ fieldKey: "city", label: "المدينة", type: "text", placeholder: null, options: [], isRequired: true, isVisible: true, sortOrder: 0 }],
    });
    const caller = appRouter.createCaller(publicContext());

    await expect(caller.requests.create(baseRequest)).rejects.toThrow("يرجى تعبئة حقل «المدينة».");
    await caller.requests.create({ ...baseRequest, customFields: { city: "الرياض", ignored: "لا يُحفظ" } });

    expect(mocks.createRequest).toHaveBeenLastCalledWith(expect.objectContaining({
      customFields: JSON.stringify([{ fieldKey: "city", value: "الرياض", label: "المدينة" }]),
    }));
  });

  it("يعيد خطأً مفهومًا عندما يتعذر حفظ الطلب", async () => {
    mocks.createRequest.mockRejectedValueOnce(new Error("Database is not available"));
    const caller = appRouter.createCaller(publicContext());
    await expect(caller.requests.create(baseRequest)).rejects.toThrow("Database is not available");
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
  });

  it("يطلب تسجيل الدخول قبل نشر رد على الطلب", async () => {
    const caller = appRouter.createCaller(publicContext());

    await expect(caller.requests.addUpdate({ requestId: 7, message: "تحديث للعميل" })).rejects.toThrow(UNAUTHED_ERR_MSG);
    expect(mocks.createRequestUpdate).not.toHaveBeenCalled();
  });

  it("يحمي لوحة العميل ويعيد ملف المستخدم المسجل فقط", async () => {
    const anonymous = appRouter.createCaller(publicContext());
    await expect(anonymous.customers.dashboard()).rejects.toThrow(UNAUTHED_ERR_MSG);

    const client = appRouter.createCaller(clientContext());
    await expect(client.customers.dashboard()).resolves.toMatchObject({ customer: { id: 3 }, totalRequests: 0 });
    expect(mocks.getCustomerDashboard).toHaveBeenCalledWith(expect.objectContaining({ id: 2, role: "user" }));
  });

  it("يقصر قائمة العملاء على المالك", async () => {
    const client = appRouter.createCaller(clientContext());
    await expect(client.customers.list()).rejects.toThrow();

    const admin = appRouter.createCaller(adminContext());
    await expect(admin.customers.list()).resolves.toEqual([]);
    expect(mocks.listCustomers).toHaveBeenCalled();
  });

  it("يمنع التتبع العام برقم الجوال قبل تفعيل رمز التحقق", async () => {
    const anonymous = appRouter.createCaller(publicContext());
    await expect(anonymous.requests.trackByPhone({ phone: "0500000000" })).rejects.toThrow(UNAUTHED_ERR_MSG);
  });

  it("يتطلب تصريح OTP موقّعًا قبل جلب طلبات الجوال", async () => {
    mocks.getRequestTrackingByPhone.mockResolvedValue([{ id: 9, phone: "0500000000" }]);
    const caller = appRouter.createCaller(publicContext());
    await expect(caller.requests.verifyPhoneDemo({ phone: "0500000000", code: "000000" })).rejects.toThrow("رمز التحقق غير صحيح");
    const verified = await caller.requests.verifyPhoneDemo({ phone: "0500000000", code: "123456" });
    expect(verified.expiresInSeconds).toBe(7 * 24 * 60 * 60);
    await expect(caller.requests.trackByPhoneVerified({ accessToken: "invalid-token" })).rejects.toThrow();
    await expect(caller.requests.trackByPhoneVerified({ accessToken: verified.accessToken })).resolves.toEqual([{ id: 9, phone: "0500000000" }]);
    expect(mocks.getRequestTrackingByPhone).toHaveBeenCalledWith("0500000000");
  });

  it("يفرض موافقة الشروط على تسجيل العميل الجديد ويحفظ النسخة والوقت", async () => {
    mocks.getCustomerByPhone.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(publicContext());
    const verified = await caller.requests.verifyPhoneDemo({ phone: "0555555555", code: "123456" });

    await expect(caller.customers.registerWithPhone({
      fullName: "عميل جديد",
      phone: "0555555555",
      email: "new@example.com",
      accessToken: verified.accessToken,
      termsVersion: CURRENT_TERMS_VERSION,
    } as never)).rejects.toThrow();
    expect(mocks.registerCustomerWithPhone).not.toHaveBeenCalled();

    await expect(caller.customers.registerWithPhone({
      fullName: "عميل جديد",
      phone: "0555555555",
      email: "new@example.com",
      accessToken: verified.accessToken,
      termsAccepted: true,
      termsVersion: CURRENT_TERMS_VERSION,
    })).resolves.toMatchObject({ id: 4, termsVersion: CURRENT_TERMS_VERSION });
    expect(mocks.registerCustomerWithPhone).toHaveBeenCalledWith(expect.objectContaining({
      phone: "0555555555",
      termsVersion: CURRENT_TERMS_VERSION,
      termsAcceptedAt: expect.any(Date),
    }));
  });

  it("يقصر سجل العميل الكامل على المالك", async () => {
    mocks.getCustomerAdminDetail.mockResolvedValue({ customer: { id: 3 }, requests: [] });
    const client = appRouter.createCaller(clientContext());
    await expect(client.customers.detail({ customerId: 3 })).rejects.toThrow();

    const admin = appRouter.createCaller(adminContext());
    await expect(admin.customers.detail({ customerId: 3 })).resolves.toMatchObject({ customer: { id: 3 } });
    expect(mocks.getCustomerAdminDetail).toHaveBeenCalledWith(3);
  });

  it("يحفظ الإسناد والأولوية والوسوم للمالك فقط", async () => {
    const client = appRouter.createCaller(clientContext());
    await expect(client.requests.updateWorkflow({ id: 7, assigneeId: 1, priority: "high", tags: ["مستعجل", "وثائق"] })).rejects.toThrow();

    const admin = appRouter.createCaller(adminContext());
    await expect(admin.requests.updateWorkflow({ id: 7, assigneeId: 1, priority: "high", tags: ["مستعجل", "وثائق"] })).resolves.toEqual({ success: true });
    expect(mocks.updateRequestWorkflow).toHaveBeenCalledWith({ id: 7, assigneeId: 1, priority: "high", tags: ["مستعجل", "وثائق"] });
  });

  it("يرفض رسالة التحديث القصيرة ويحفظ الرد الصالح أو تحديث الحالة التلقائي للمالك", async () => {
    const caller = appRouter.createCaller(adminContext());
    mocks.createRequestUpdate.mockResolvedValueOnce(21);

    await expect(caller.requests.addUpdate({ requestId: 7, message: "ا" })).rejects.toThrow();
    expect(mocks.createRequestUpdate).not.toHaveBeenCalled();

    await expect(caller.requests.addUpdate({ requestId: 7, message: "تمت المراجعة", status: "in_review" })).resolves.toEqual({ success: true, updateId: 21 });
    expect(mocks.createRequestUpdate).toHaveBeenCalledWith({
      requestId: 7,
      message: "تمت المراجعة",
      status: "in_review",
      senderType: "owner",
      senderUserId: 1,
      senderName: "Test Admin",
    });

    mocks.createRequestUpdate.mockResolvedValueOnce(22);
    await expect(caller.requests.addUpdate({ requestId: 7, status: "completed" })).resolves.toEqual({ success: true, updateId: 22 });
    expect(mocks.updateRequestStatus).toHaveBeenCalledWith(7, "completed");
    expect(mocks.createRequestUpdate).toHaveBeenLastCalledWith({
      requestId: 7,
      message: "تم إكمال معالجة طلبك.",
      status: "completed",
      senderType: "owner",
      senderUserId: 1,
      senderName: "Test Admin",
    });
  });

  it("يرفع مرفقًا مسموحًا ويحفظ بياناته مع التحديث", async () => {
    const caller = appRouter.createCaller(adminContext());
    const result = await caller.requests.uploadAttachment({
      updateId: 12,
      fileName: "document.pdf",
      mimeType: "application/pdf",
      dataBase64: Buffer.from("document data").toString("base64"),
    });

    expect(result).toMatchObject({ success: true, attachment: { fileName: "document.pdf" } });
    expect(mocks.storagePut).toHaveBeenCalled();
    expect(mocks.createRequestAttachment).toHaveBeenCalledWith(expect.objectContaining({ updateId: 12, fileName: "document.pdf" }));
  });

  it("يقصر نظرة الموظفين الشاملة على المالك", async () => {
    const client = appRouter.createCaller(clientContext());
    await expect(client.employees.overview()).rejects.toThrow();

    const admin = appRouter.createCaller(adminContext());
    await expect(admin.employees.overview()).resolves.toEqual([]);
    expect(mocks.listEmployeesWithAssignments).toHaveBeenCalledOnce();
  });

  it("يسمح للموظف بقراءة طلباته الموكلة فقط دون صلاحيات المعقب", async () => {
    mocks.listRequestsAssignedToUser.mockResolvedValueOnce([{ id: 31, assigneeId: 3 }]);
    const employee = appRouter.createCaller(employeeContext());
    await expect(employee.employees.myAssignments()).resolves.toEqual([{ id: 31, assigneeId: 3 }]);
    expect(mocks.listRequestsAssignedToUser).toHaveBeenCalledWith(3);
    await expect(employee.agents.myAssignments()).rejects.toThrow("هذه المساحة مخصصة للمعقبين");
  });

  it("يمنع المعقب من تحديث طلب غير موكل إليه ويسمح له بطلبه فقط", async () => {
    const agent = appRouter.createCaller(agentContext());
    await expect(agent.employees.myAssignments()).rejects.toThrow("هذه المساحة مخصصة للموظفين");

    mocks.createAssignedRequestUpdateWithAudit.mockResolvedValueOnce(null);
    await expect(agent.agents.addUpdate({ requestId: 77, message: "تمت مراجعة المعاملة" })).rejects.toThrow("غير موكل إليك");

    mocks.createAssignedRequestUpdateWithAudit.mockResolvedValueOnce({ updateId: 44 });
    await expect(agent.agents.addUpdate({ requestId: 31, message: "تمت مراجعة المعاملة" })).resolves.toEqual({ success: true, updateId: 44 });
    expect(mocks.createAssignedRequestUpdateWithAudit).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 4, requestId: 31, action: "agent_customer_update" }));
  });

  it("يتيح للمالك إنشاء حساب فريق وتعديل صلاحياته فقط", async () => {
    const input = { fullName: "موظف جديد", email: "staff@example.com", role: "employee" as const, permissions: { canViewAssigned: true, canUpdateStatus: true, canAddCustomerUpdate: false } };
    await expect(appRouter.createCaller(clientContext()).staffAccounts.create(input)).rejects.toThrow();
    await expect(appRouter.createCaller(adminContext()).staffAccounts.create(input)).resolves.toEqual({ success: true, id: 9 });
    expect(mocks.createStaffAccount).toHaveBeenCalledWith({ ...input, createdByUserId: 1 });

    await expect(appRouter.createCaller(adminContext()).staffAccounts.update({ ...input, id: 9, role: "agent", phone: "0500000004", isActive: false })).resolves.toEqual({ success: true });
    expect(mocks.updateStaffAccount).toHaveBeenCalledWith(expect.objectContaining({ id: 9, role: "agent", isActive: false }));
  });

  it("يطبق صلاحيات حساب المعقب قبل نشر التحديث", async () => {
    mocks.getActiveStaffAccountForUser.mockResolvedValueOnce({ role: "agent", permissions: { canViewAssigned: true, canUpdateStatus: true, canAddCustomerUpdate: false } });
    const agent = appRouter.createCaller(agentContext());
    await expect(agent.agents.addUpdate({ requestId: 31, message: "رسالة للعميل" })).rejects.toThrow("لا تملك صلاحية نشر تحديث للعميل");
    expect(mocks.isRequestAssignedToUser).not.toHaveBeenCalled();
  });

  it("يسجل تغيير حالة الموظف مع الحالة السابقة واللاحقة", async () => {
    mocks.createAssignedRequestUpdateWithAudit.mockResolvedValueOnce({ updateId: 55 });
    const employee = appRouter.createCaller(employeeContext());
    await expect(employee.employees.updateAssignment({ requestId: 31, status: "in_progress" })).resolves.toEqual({ success: true, updateId: 55 });
    expect(mocks.createAssignedRequestUpdateWithAudit).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 3, requestId: 31, action: "employee_status_update", status: "in_progress" }));
  });

  it("يقصر قراءة سجل التدقيق على المالك", async () => {
    await expect(appRouter.createCaller(agentContext()).audit.list({ limit: 20 })).rejects.toThrow();
    await expect(appRouter.createCaller(adminContext()).audit.list({ limit: 20 })).resolves.toEqual([]);
    expect(mocks.listAuditLogs).toHaveBeenCalledWith({ limit: 20 });
  });

  it("يعزل إشعارات الفريق حسب المستخدم المسجل", async () => {
    mocks.listTeamNotificationsForUser.mockResolvedValueOnce({ items: [{ id: 5, recipientUserId: 4, isRead: false }], unreadCount: 1 });
    await expect(appRouter.createCaller(clientContext()).teamNotifications.list()).rejects.toThrow("هذه المساحة مخصصة لفريق التشغيل");
    await expect(appRouter.createCaller(agentContext()).teamNotifications.list()).resolves.toMatchObject({ unreadCount: 1 });
    expect(mocks.listTeamNotificationsForUser).toHaveBeenCalledWith(4);
  });

  it("يعلم الإشعار للمستلم الحالي فقط ويدعم قراءة الكل", async () => {
    const employee = appRouter.createCaller(employeeContext());
    await expect(employee.teamNotifications.markRead({ notificationId: 12 })).resolves.toEqual({ success: true });
    expect(mocks.markTeamNotificationRead).toHaveBeenCalledWith(12, 3);
    await expect(employee.teamNotifications.markAllRead()).resolves.toEqual({ success: true });
    expect(mocks.markAllTeamNotificationsRead).toHaveBeenCalledWith(3);
  });

  it("يعرض الطلبات الجديدة لجميع أعضاء الفريق دون العملاء", async () => {
    mocks.listOpenRequestsForTeam.mockResolvedValueOnce([{ id: 31, category: "طلب خدمة", details: "تفاصيل الخدمة", quoteCount: 0, myQuote: null }]);
    await expect(appRouter.createCaller(clientContext()).quotes.openRequests()).rejects.toThrow("هذه المساحة مخصصة لفريق التشغيل");
    await expect(appRouter.createCaller(employeeContext()).quotes.openRequests()).resolves.toHaveLength(1);
    expect(mocks.listOpenRequestsForTeam).toHaveBeenCalledWith(3);
  });

  it("يسمح للموظف والمعقب بتقديم عرض واحد قابل للتحديث", async () => {
    await expect(appRouter.createCaller(agentContext()).quotes.submit({ requestId: 31, priceAmount: 450, durationDays: 5, note: "يشمل المتابعة" })).resolves.toEqual({ updated: false });
    expect(mocks.upsertRequestQuote).toHaveBeenCalledWith({ requestId: 31, providerUserId: 4, priceAmount: "450.00", durationDays: 5, note: "يشمل المتابعة" });
  });

  it("يعتمد العميل عرضًا بعد تصريح الجوال فقط", async () => {
    const caller = appRouter.createCaller(publicContext());
    const verified = await caller.requests.verifyPhoneDemo({ phone: "0530204050", code: "123456" });
    await expect(caller.quotes.customerList({ accessToken: verified.accessToken })).resolves.toEqual([]);
    expect(mocks.listQuotesForCustomerPhone).toHaveBeenCalledWith("0530204050");
    await expect(caller.quotes.accept({ accessToken: verified.accessToken, quoteId: 8 })).resolves.toMatchObject({ providerName: "Test Agent" });
    expect(mocks.acceptQuoteForCustomer).toHaveBeenCalledWith({ phone: "0530204050", quoteId: 8 });
  });

  it("يحذف إشعارات المستخدم الحالي أو يمسح المقروءة فقط", async () => {
    const employee = appRouter.createCaller(employeeContext());
    await expect(employee.teamNotifications.delete({ notificationId: 12 })).resolves.toEqual({ success: true });
    expect(mocks.deleteTeamNotification).toHaveBeenCalledWith(12, 3);
    await expect(employee.teamNotifications.clearRead()).resolves.toEqual({ success: true });
    expect(mocks.clearReadTeamNotifications).toHaveBeenCalledWith(3);
  });

  it("يسمح بسحب العرض وقبول الطلب المختار لصاحب العرض فقط", async () => {
    const agent = appRouter.createCaller(agentContext());
    await expect(agent.quotes.withdraw({ requestId: 31 })).resolves.toEqual({ success: true });
    expect(mocks.withdrawRequestQuote).toHaveBeenCalledWith({ requestId: 31, providerUserId: 4 });
    await expect(agent.quotes.providerAccept({ requestId: 31 })).resolves.toMatchObject({ success: true });
    expect(mocks.acceptSelectedQuoteForProvider).toHaveBeenCalledWith({ requestId: 31, providerUserId: 4 });
    await expect(appRouter.createCaller(clientContext()).quotes.providerAccept({ requestId: 31 })).rejects.toThrow("هذه المساحة مخصصة لفريق التشغيل");
  });

  it("يعزل إشعارات العميل بتصريح الجوال ويتيح تعليمها كمقروءة", async () => {
    const caller = appRouter.createCaller(publicContext());
    const verified = await caller.requests.verifyPhoneDemo({ phone: "0530204050", code: "123456" });
    await expect(caller.customerNotifications.list({ accessToken: verified.accessToken })).resolves.toEqual({ items: [], unreadCount: 0 });
    expect(mocks.listCustomerNotificationsForPhone).toHaveBeenCalledWith("0530204050");
    await caller.customerNotifications.markRead({ accessToken: verified.accessToken, notificationId: 4 });
    expect(mocks.markCustomerNotificationRead).toHaveBeenCalledWith(4, "0530204050");
    await caller.customerNotifications.markQuoteRequestRead({ accessToken: verified.accessToken, requestId: 31 });
    expect(mocks.markCustomerQuoteNotificationsReadForRequest).toHaveBeenCalledWith(31, "0530204050");
    await caller.customerNotifications.markAllRead({ accessToken: verified.accessToken });
    expect(mocks.markAllCustomerNotificationsRead).toHaveBeenCalledWith("0530204050");
  });

  it("يسمح للمالك فقط بتعديل مهلة استقبال العروض", async () => {
    const deadlineMs = Date.now() + 24 * 60 * 60 * 1000;
    await expect(appRouter.createCaller(adminContext()).quotes.setDeadline({ requestId: 31, deadlineMs })).resolves.toEqual({ success: true });
    expect(mocks.updateQuoteSubmissionDeadline).toHaveBeenCalledWith({ requestId: 31, deadline: new Date(deadlineMs) });
    await expect(appRouter.createCaller(agentContext()).quotes.setDeadline({ requestId: 31, deadlineMs })).rejects.toThrow();
  });

  it("يدخل المعقب برقم جوال سجله المالك ويرفض الرمز أو الرقم غير المسجل", async () => {
    const context = publicContext();
    const cookie = vi.fn();
    context.req = { headers: {}, protocol: "http", hostname: "localhost" } as unknown as TrpcContext["req"];
    context.res = { cookie } as unknown as TrpcContext["res"];
    const caller = appRouter.createCaller(context);

    await expect(caller.auth.agentPhoneDemo({ phone: "0500000004", code: "000000" })).rejects.toThrow("رمز التحقق غير صحيح");
    await expect(caller.auth.agentPhoneDemo({ phone: "0500000004", code: "123456" })).rejects.toThrow("رقم الجوال غير مسجل");
    mocks.getActiveAgentAccountByPhone.mockResolvedValueOnce({
      id: 14,
      fullName: "معقب تجريبي",
      phone: "0500000004",
      user: { id: 4, openId: "mobile-agent:test", role: "agent" },
    });
    await expect(caller.auth.agentPhoneDemo({ phone: "0500000004", code: "123456" })).resolves.toMatchObject({ success: true, role: "agent", name: "معقب تجريبي" });
    expect(cookie).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.objectContaining({ maxAge: expect.any(Number) }));
  });

  it("يعزل محادثة الطلب المعتمد ويتيح الرسائل للعميل وصاحب الطلب فقط", async () => {
    const publicCaller = appRouter.createCaller(publicContext());
    const verified = await publicCaller.requests.verifyPhoneDemo({ phone: "0530204050", code: "123456" });
    mocks.listCustomerRequestConversation.mockResolvedValueOnce([{ id: 1, senderType: "agent", message: "تم استلام طلبك" }]);
    await expect(publicCaller.conversation.customerList({ accessToken: verified.accessToken, requestId: 31 })).resolves.toHaveLength(1);
    expect(mocks.listCustomerRequestConversation).toHaveBeenCalledWith("0530204050", 31);
    await expect(publicCaller.conversation.customerSend({ accessToken: verified.accessToken, requestId: 31, message: "شكرًا، هل تم البدء؟" })).resolves.toEqual({ success: true, updateId: 71 });
    expect(mocks.createCustomerRequestComment).toHaveBeenCalledWith({ phone: "0530204050", requestId: 31, message: "شكرًا، هل تم البدء؟" });

    mocks.isRequestAssignedToUser.mockResolvedValueOnce(false);
    await expect(appRouter.createCaller(agentContext()).conversation.teamList({ requestId: 77 })).rejects.toThrow("غير موكل إليك");
    mocks.isRequestAssignedToUser.mockResolvedValueOnce(true);
    mocks.listRequestUpdates.mockResolvedValueOnce([{ id: 1, senderType: "customer", message: "تم" }]);
    await expect(appRouter.createCaller(agentContext()).conversation.teamList({ requestId: 31 })).resolves.toHaveLength(1);
    await expect(appRouter.createCaller(agentContext()).conversation.teamSend({ requestId: 31, message: "بدأنا تنفيذ الطلب" })).resolves.toEqual({ success: true, updateId: 44 });
    expect(mocks.createAssignedRequestUpdateWithAudit).toHaveBeenCalledWith(expect.objectContaining({ actorRole: "agent", action: "agent_customer_message" }));
  });

  it("يرفع مرفق المحادثة للعميل بعد التحقق ويحفظ مرجع التخزين فقط", async () => {
    const caller = appRouter.createCaller(publicContext());
    const verified = await caller.requests.verifyPhoneDemo({ phone: "0530204050", code: "123456" });
    mocks.listCustomerRequestConversation.mockResolvedValueOnce([]);
    const result = await caller.conversation.customerUpload({ accessToken: verified.accessToken, requestId: 31, fileName: "identity.png", mimeType: "image/png", dataBase64: Buffer.from("image-data").toString("base64") });
    expect(result).toMatchObject({ success: true, updateId: 72 });
    expect(mocks.storagePut).toHaveBeenCalledWith(expect.stringContaining("request-31"), expect.any(Buffer), "image/png");
    expect(mocks.createCustomerConversationAttachment).toHaveBeenCalledWith(expect.objectContaining({ phone: "0530204050", requestId: 31, attachment: expect.objectContaining({ fileName: "identity.png", fileKey: expect.any(String) }) }));
  });

  it("يمنع مرفق مقدم الخدمة لطلب غير معتمد له ويقبل المرفق المصرح", async () => {
    const caller = appRouter.createCaller(agentContext());
    mocks.getTransactionRequestById.mockResolvedValueOnce({ id: 31, assigneeId: 99, providerAcceptedAt: new Date() });
    await expect(caller.conversation.teamUpload({ requestId: 31, fileName: "document.pdf", mimeType: "application/pdf", dataBase64: Buffer.from("pdf").toString("base64") })).rejects.toThrow("غير معتمد لك");
    expect(mocks.storagePut).not.toHaveBeenCalled();
    mocks.getTransactionRequestById.mockResolvedValueOnce({ id: 31, assigneeId: 4, providerAcceptedAt: new Date() });
    await expect(caller.conversation.teamUpload({ requestId: 31, fileName: "document.pdf", mimeType: "application/pdf", dataBase64: Buffer.from("pdf").toString("base64") })).resolves.toMatchObject({ success: true, updateId: 73 });
    expect(mocks.createTeamConversationAttachment).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 4, actorRole: "agent", requestId: 31 }));
  });

  it("يرفض قيمة تقييم خارج النطاق قبل حفظ أي مراجعة", async () => {
    const caller = appRouter.createCaller(publicContext());
    const verified = await caller.requests.verifyPhoneDemo({ phone: "0530204050", code: "123456" });
    await expect(caller.reviews.submit({ accessToken: verified.accessToken, requestId: 31, rating: 0 })).rejects.toThrow();
    expect(mocks.createRequestReviewForCustomer).not.toHaveBeenCalled();
  });
});
