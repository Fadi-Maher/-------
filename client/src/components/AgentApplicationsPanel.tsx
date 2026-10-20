import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { AgentApplicationDocumentReview } from "@/components/AgentApplicationDocumentReview";
import { useSearch } from "wouter";
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import React, {
  type ChangeEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type ApplicationStatus = "pending" | "approved" | "rejected";
type ReviewDecision = "approved" | "rejected";
type ApplicationPermissions = {
  canViewAssigned: boolean;
  canUpdateStatus: boolean;
  canAddCustomerUpdate: boolean;
};
type AgentApplication = {
  id: number;
  reference: string;
  phone: string;
  fullName: string;
  email: string;
  city: string;
  specialty: string;
  experienceYears: number;
  notes: string | null;
  status: ApplicationStatus;
  reviewNote: string | null;
  createdAt: number;
  reviewedAt: number | null;
  reviewedByUserId: number | null;
  activatedStaffAccountId: number | null;
};

const defaultPermissions: ApplicationPermissions = {
  canViewAssigned: true,
  canUpdateStatus: true,
  canAddCustomerUpdate: true,
};

function normalizePhone(value: string) {
  const arabicDigits: Record<string, string> = {
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
  };
  return value
    .replace(/[٠-٩]/g, digit => arabicDigits[digit] ?? digit)
    .replace(/\D/g, "");
}

function readableDate(value: number, isEnglish: boolean) {
  return new Intl.DateTimeFormat(isEnglish ? "en" : "ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AgentApplicationsPanel() {
  const { isEnglish } = useLanguage();
  const query = useSearch();
  const [targetApplicationId, setTargetApplicationId] = useState<number | null>(
    null
  );
  const list = trpc.agentApplications.list.useQuery();
  const review = trpc.agentApplications.review.useMutation();
  const utils = trpc.useUtils();
  const noteId = useId();
  const reviewingRef = useRef(false);
  const [filter, setFilter] = useState<"all" | ApplicationStatus>("pending");
  const [search, setSearch] = useState("");
  const [activeApplication, setActiveApplication] =
    useState<AgentApplication | null>(null);
  const [decision, setDecision] = useState<ReviewDecision>("approved");
  const [reviewNote, setReviewNote] = useState("");
  const [permissions, setPermissions] =
    useState<ApplicationPermissions>(defaultPermissions);
  const [reviewError, setReviewError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    const select = (value: unknown) => {
      const id = Number(value);
      if (!Number.isSafeInteger(id) || id <= 0) return;
      setFilter("all");
      setSearch("");
      setTargetApplicationId(id);
    };
    const fromUrl = new URLSearchParams(query).get("applicationId");
    if (fromUrl) select(fromUrl);
    const receive = (event: Event) =>
      select(
        (event as CustomEvent<{ applicationId?: number }>).detail?.applicationId
      );
    window.addEventListener("admin-application:open", receive);
    return () => window.removeEventListener("admin-application:open", receive);
  }, [query]);
  useEffect(() => {
    if (!targetApplicationId || !list.data) return;
    const frame = requestAnimationFrame(() => {
      const card = document.getElementById(
        `agent-application-${targetApplicationId}`
      );
      card?.scrollIntoView({ behavior: "auto", block: "center" });
      card?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [targetApplicationId, list.data]);

  const copy = isEnglish
    ? {
        kicker: "Team access",
        title: "Agent membership applications",
        description:
          "Review applications before activation. This stage uses demo OTP, not proof of mobile ownership. No account is created until you confirm approval.",
        pendingCount: "Pending review",
        all: "All",
        pending: "Pending",
        approved: "Approved",
        rejected: "Rejected",
        search: "Search by name or mobile number",
        refresh: "Refresh",
        loading: "Loading membership applications…",
        loadError: "We could not load membership applications.",
        retry: "Try again",
        empty: "No matching membership applications.",
        reference: "Reference",
        submitted: "Submitted",
        reviewed: "Reviewed",
        experience: "years experience",
        details: "Applicant details",
        notes: "Applicant notes",
        reviewNote: "Owner review note",
        approvedBy: "Reviewed by administration",
        activated: "Account activated",
        notActivated: "Account not activated",
        approve: "Approve",
        reject: "Reject",
        confirmApproval: "Confirm approval and activation",
        confirmRejection: "Confirm rejection",
        approvalTitle: "Approve and activate this agent?",
        approvalDescription:
          "Demo OTP is not proof of mobile ownership; review the applicant’s details first. Confirmation creates and activates the agent with the permissions below.",
        rejectionTitle: "Reject this application?",
        rejectionDescription:
          "A rejection does not create an agent account. Provide a short, respectful reason for the applicant.",
        viewAssigned: "View assigned requests",
        updateStatus: "Update request status",
        addCustomerUpdate: "Add customer update",
        reason: "Reason for decision",
        reasonPlaceholder: "Explain the decision for the applicant",
        rejectionReasonRequired:
          "Enter a rejection reason of at least 3 characters.",
        reviewError: "We could not save this review. Try again.",
        cancel: "Cancel",
        saving: "Saving…",
        approvedSuccess:
          "Application approved and account activation requested.",
        rejectedSuccess: "Application rejected.",
      }
    : {
        kicker: "وصول فريق العمل",
        title: "طلبات انضمام المعقبين",
        description:
          "راجع الطلبات قبل التفعيل. هذه المرحلة تستخدم OTP تجريبيًا لا يثبت ملكية الجوال. لا يُنشأ أي حساب حتى تؤكد الموافقة.",
        pendingCount: "بانتظار المراجعة",
        all: "الكل",
        pending: "بانتظار المراجعة",
        approved: "تمت الموافقة",
        rejected: "مرفوضة",
        search: "البحث بالاسم أو رقم الجوال",
        refresh: "تحديث",
        loading: "جارٍ تحميل طلبات الانضمام…",
        loadError: "تعذر تحميل طلبات الانضمام.",
        retry: "إعادة المحاولة",
        empty: "لا توجد طلبات انضمام مطابقة.",
        reference: "رقم الطلب",
        submitted: "تاريخ الإرسال",
        reviewed: "تاريخ المراجعة",
        experience: "سنوات خبرة",
        details: "تفاصيل المتقدم",
        notes: "ملاحظات المتقدم",
        reviewNote: "ملاحظة المالك",
        approvedBy: "راجعتها الإدارة",
        activated: "الحساب مفعل",
        notActivated: "الحساب غير مفعل",
        approve: "موافقة",
        reject: "رفض",
        confirmApproval: "تأكيد الموافقة والتفعيل",
        confirmRejection: "تأكيد الرفض",
        approvalTitle: "الموافقة وتفعيل هذا المعقب؟",
        approvalDescription:
          "الرمز التجريبي لا يثبت ملكية الجوال؛ راجع بيانات المتقدم أولًا. يؤكد هذا الإجراء إنشاء حساب المعقب وتفعيله بالصلاحيات أدناه.",
        rejectionTitle: "رفض هذا الطلب؟",
        rejectionDescription:
          "لا ينشئ الرفض حساب معقب. اكتب سببًا قصيرًا ومحترمًا ليظهر للمتقدم.",
        viewAssigned: "عرض الطلبات الموكلة",
        updateStatus: "تحديث حالة الطلب",
        addCustomerUpdate: "إضافة تحديث للعميل",
        reason: "سبب القرار",
        reasonPlaceholder: "اشرح القرار للمتقدم",
        rejectionReasonRequired: "أدخل سبب الرفض بثلاثة أحرف على الأقل.",
        reviewError: "تعذر حفظ المراجعة. أعد المحاولة.",
        cancel: "إلغاء",
        saving: "جارٍ الحفظ…",
        approvedSuccess: "تمت الموافقة على الطلب وطُلب تفعيل الحساب.",
        rejectedSuccess: "تم رفض الطلب.",
      };

  const applications = (list.data ?? []) as AgentApplication[];
  const pendingCount = applications.filter(
    application => application.status === "pending"
  ).length;
  const normalizedSearch = normalizePhone(search);
  const visibleApplications = useMemo(
    () =>
      applications.filter(application => {
        const matchesFilter = filter === "all" || application.status === filter;
        const matchesName = application.fullName
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase());
        const matchesPhone =
          Boolean(normalizedSearch) &&
          /^[+\d٠-٩()\s-]+$/.test(search.trim()) &&
          normalizePhone(application.phone).includes(normalizedSearch);
        return matchesFilter && (matchesName || matchesPhone);
      }),
    [applications, filter, normalizedSearch, search]
  );

  const statusLabel = (status: ApplicationStatus) =>
    status === "pending"
      ? copy.pending
      : status === "approved"
        ? copy.approved
        : copy.rejected;
  const statusClass = (status: ApplicationStatus) =>
    status === "pending"
      ? "border-[#f5d991] bg-[#fff9e8] text-[#8a5a00]"
      : status === "approved"
        ? "border-[#cce9c9] bg-[#f2fbee] text-[#287333]"
        : "border-[#f3c8cd] bg-[#fff4f5] text-[#a63240]";

  const closeReview = (force = false) => {
    if (review.isPending && !force) return;
    setReviewOpen(false);
    setActiveApplication(null);
    setReviewNote("");
    setPermissions(defaultPermissions);
    setReviewError("");
  };

  const openReview = (
    application: AgentApplication,
    nextDecision: ReviewDecision
  ) => {
    if (review.isPending) return;
    setActiveApplication(application);
    setDecision(nextDecision);
    setReviewNote("");
    setPermissions(defaultPermissions);
    setReviewError("");
    setReviewOpen(true);
  };

  const confirmReview = async () => {
    if (!activeApplication || reviewingRef.current || review.isPending) return;
    if (decision === "rejected" && reviewNote.trim().length < 3) {
      setReviewError(copy.rejectionReasonRequired);
      return;
    }

    reviewingRef.current = true;
    setReviewError("");
    try {
      await review.mutateAsync({
        id: activeApplication.id,
        decision,
        ...(reviewNote.trim() ? { reviewNote: reviewNote.trim() } : {}),
        permissions,
      });
      await Promise.all([
        utils.agentApplications.list.invalidate(),
        utils.staffAccounts.list.invalidate(),
      ]);
      closeReview(true);
    } catch (error) {
      setReviewError(errorMessage(error, copy.reviewError));
    } finally {
      reviewingRef.current = false;
    }
  };

  const PermissionSwitch = ({
    field,
    label,
  }: {
    field: keyof ApplicationPermissions;
    label: string;
  }) => {
    const id = useId();
    return (
      <div className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-[#dce8f6] bg-[#f8fbff] px-3 py-2">
        <Label
          htmlFor={id}
          className="cursor-pointer text-sm font-bold text-[#17334f]"
        >
          {label}
        </Label>
        <Switch
          id={id}
          checked={permissions[field]}
          disabled={review.isPending}
          onCheckedChange={checked =>
            setPermissions(current => ({ ...current, [field]: checked }))
          }
        />
      </div>
    );
  };

  return (
    <section
      className="mt-7 rounded-3xl border border-[#dce8f6] bg-white p-4 shadow-[0_10px_28px_rgba(25,93,164,.07)] sm:p-6"
      dir={isEnglish ? "ltr" : "rtl"}
      aria-labelledby="agent-applications-heading"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="section-kicker">{copy.kicker}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2
              id="agent-applications-heading"
              className="font-display text-2xl font-black text-[#102a43]"
            >
              {copy.title}
            </h2>
            <Badge className="rounded-full border border-[#f5d991] bg-[#fff9e8] px-2.5 py-1 text-[#8a5a00]">
              <ClipboardList className="me-1 h-3.5 w-3.5" aria-hidden="true" />
              {pendingCount} {copy.pendingCount}
            </Badge>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#60778f]">
            {copy.description}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void list.refetch()}
          disabled={list.isFetching}
          className="h-10 shrink-0 rounded-xl border-[#b7dbff] bg-white text-[#0668d9] hover:bg-[#f3f9ff]"
        >
          <RefreshCw
            className={`me-2 h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {copy.refresh}
        </Button>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#e4eef8] bg-[#f8fbff] p-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#7592ac] ltr:left-3 rtl:right-3"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setSearch(event.target.value)
            }
            placeholder={copy.search}
            aria-label={copy.search}
            className="h-10 rounded-xl bg-white px-10"
          />
        </div>
        <div
          className="flex flex-wrap gap-2"
          aria-label={
            isEnglish ? "Application status filter" : "تصفية حالة الطلب"
          }
        >
          {(["pending", "approved", "rejected", "all"] as const).map(value => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`min-h-10 rounded-xl border px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0668d9] ${filter === value ? "border-[#0668d9] bg-[#0668d9] text-white" : "border-[#cfe0f0] bg-white text-[#41617e] hover:bg-[#eef6ff]"}`}
            >
              {value === "all" ? copy.all : statusLabel(value)}
            </button>
          ))}
        </div>
      </div>

      {list.isLoading ? (
        <div
          className="grid min-h-40 place-items-center text-sm font-bold text-[#60778f]"
          aria-live="polite"
        >
          <span>
            <Loader2
              className="me-2 inline h-4 w-4 animate-spin"
              aria-hidden="true"
            />
            {copy.loading}
          </span>
        </div>
      ) : null}
      {list.isError ? (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-[#f3c8cd] bg-[#fff7f7] p-4 text-sm text-[#8f2835]"
        >
          <AlertCircle className="me-2 inline h-4 w-4" aria-hidden="true" />
          {errorMessage(list.error, copy.loadError)}
          <Button
            type="button"
            variant="outline"
            onClick={() => void list.refetch()}
            className="ms-3 h-9 rounded-xl border-[#e4aeb6] bg-white text-[#a63240]"
          >
            {copy.retry}
          </Button>
        </div>
      ) : null}
      {!list.isLoading && !list.isError && visibleApplications.length === 0 ? (
        <div className="mt-5 grid min-h-36 place-items-center rounded-2xl border border-dashed border-[#cfe0f0] bg-[#fbfdff] px-4 text-center text-sm text-[#60778f]">
          <div>
            <UserRound
              className="mx-auto h-7 w-7 text-[#87bff4]"
              aria-hidden="true"
            />
            <p className="mt-2">{copy.empty}</p>
          </div>
        </div>
      ) : null}

      {!list.isLoading && !list.isError && visibleApplications.length > 0 ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {visibleApplications.map(application => (
            <article
              key={application.id}
              id={`agent-application-${application.id}`}
              tabIndex={-1}
              className={`overflow-hidden rounded-2xl border bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] ${targetApplicationId === application.id ? "border-[#0878f9] ring-2 ring-[#cce5ff]" : "border-[#dce8f6]"}`}
            >
              <div className="flex items-start gap-3 bg-[#fbfdff] p-4">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf3ff] text-[#0668d9]"
                  aria-hidden="true"
                >
                  <UserRound className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="truncate font-display text-base font-black text-[#102a43]">
                      {application.fullName}
                    </h3>
                    <Badge
                      className={`border ${statusClass(application.status)}`}
                    >
                      {application.status === "approved" ? (
                        <CheckCircle2
                          className="me-1 h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      ) : application.status === "rejected" ? (
                        <XCircle
                          className="me-1 h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      ) : (
                        <ChevronDown
                          className="me-1 h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      )}
                      {statusLabel(application.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[#60778f]" dir="ltr">
                    {application.phone} · {application.email}
                  </p>
                </div>
              </div>
              <div className="space-y-3 p-4 text-sm">
                <div className="grid gap-2 text-[#31516e] sm:grid-cols-2">
                  <p>
                    <span className="font-bold text-[#60778f]">
                      {copy.reference}:{" "}
                    </span>
                    <span dir="ltr">{application.reference}</span>
                  </p>
                  <p>
                    <span className="font-bold text-[#60778f]">
                      {copy.submitted}:{" "}
                    </span>
                    {readableDate(application.createdAt, isEnglish)}
                  </p>
                  <p>
                    <span className="font-bold text-[#60778f]">
                      {copy.details}:{" "}
                    </span>
                    {application.city} · {application.specialty}
                  </p>
                  <p>
                    <span className="font-bold text-[#60778f]">
                      {copy.experience}:{" "}
                    </span>
                    {application.experienceYears}
                  </p>
                </div>
                <AgentApplicationDocumentReview
                  applicationId={application.id}
                />
                {application.notes ? (
                  <div className="rounded-xl bg-[#f8fbff] p-3">
                    <p className="text-xs font-black text-[#60778f]">
                      {copy.notes}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap leading-6 text-[#31516e]">
                      {application.notes}
                    </p>
                  </div>
                ) : null}
                {application.status !== "pending" ? (
                  <div className="rounded-xl border border-[#e4eef8] p-3">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="text-xs font-black text-[#60778f]">
                        {copy.reviewNote}
                      </p>
                      {application.reviewedAt ? (
                        <p className="text-xs text-[#60778f]">
                          {copy.reviewed}:{" "}
                          {readableDate(application.reviewedAt, isEnglish)}
                        </p>
                      ) : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap leading-6 text-[#31516e]">
                      {application.reviewNote || "—"}
                    </p>
                    {application.status === "approved" ? (
                      <p className="mt-2 text-xs font-bold text-[#287333]">
                        <ShieldCheck
                          className="me-1 inline h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        {application.activatedStaffAccountId
                          ? copy.activated
                          : copy.notActivated}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {application.status === "pending" ? (
                  <div className="flex flex-wrap gap-2 border-t border-[#e7eff8] pt-3">
                    <Button
                      type="button"
                      onClick={() => openReview(application, "approved")}
                      className="h-10 rounded-xl bg-[#0668d9] font-bold text-white hover:bg-[#055bbd]"
                    >
                      <BadgeCheck className="me-2 h-4 w-4" aria-hidden="true" />
                      {copy.approve}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openReview(application, "rejected")}
                      className="h-10 rounded-xl border-[#efb8c0] bg-white font-bold text-[#a63240] hover:bg-[#fff4f5] hover:text-[#8d2330]"
                    >
                      <XCircle className="me-2 h-4 w-4" aria-hidden="true" />
                      {copy.reject}
                    </Button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <AlertDialog
        open={reviewOpen}
        onOpenChange={open => {
          if (!open) closeReview();
          else setReviewOpen(true);
        }}
      >
        <AlertDialogContent
          className="max-h-[calc(100svh-2rem)] max-w-lg overflow-y-auto rounded-3xl border-[#dce8f6] bg-white p-5 sm:p-6"
          dir={isEnglish ? "ltr" : "rtl"}
          onEscapeKeyDown={event => {
            if (review.isPending) event.preventDefault();
          }}
        >
          <AlertDialogHeader className={isEnglish ? "text-left" : "text-right"}>
            <AlertDialogTitle className="font-display text-xl font-black text-[#102a43]">
              {decision === "approved"
                ? copy.approvalTitle
                : copy.rejectionTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-[#60778f]">
              {decision === "approved"
                ? copy.approvalDescription
                : copy.rejectionDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {activeApplication ? (
            <div className="rounded-xl border border-[#dce8f6] bg-[#f8fbff] p-3 text-sm">
              <p className="font-black text-[#102a43]">
                {activeApplication.fullName}
              </p>
              <p className="mt-1 text-[#60778f]" dir="ltr">
                {activeApplication.phone} · {activeApplication.reference}
              </p>
            </div>
          ) : null}
          <div className="grid gap-3">
            {decision === "approved" ? (
              <>
                <PermissionSwitch
                  field="canViewAssigned"
                  label={copy.viewAssigned}
                />
                <PermissionSwitch
                  field="canUpdateStatus"
                  label={copy.updateStatus}
                />
                <PermissionSwitch
                  field="canAddCustomerUpdate"
                  label={copy.addCustomerUpdate}
                />
              </>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor={noteId}>{copy.reason}</Label>
                <Textarea
                  id={noteId}
                  value={reviewNote}
                  disabled={review.isPending}
                  onChange={event => {
                    setReviewNote(event.target.value);
                    setReviewError("");
                  }}
                  placeholder={copy.reasonPlaceholder}
                  className="min-h-24 rounded-xl"
                  aria-invalid={Boolean(reviewError)}
                />
              </div>
            )}
            {reviewError ? (
              <p
                role="alert"
                className="rounded-xl bg-[#fff1f3] px-3 py-2 text-sm font-bold leading-6 text-[#a9323f]"
              >
                {reviewError}
              </p>
            ) : null}
          </div>
          <AlertDialogFooter className="gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="outline"
                disabled={review.isPending}
                className="h-11 rounded-xl"
              >
                {copy.cancel}
              </Button>
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={review.isPending}
              onClick={() => void confirmReview()}
              className={`h-11 rounded-xl font-extrabold text-white ${decision === "approved" ? "bg-[#0668d9] hover:bg-[#055bbd]" : "bg-[#b13b47] hover:bg-[#942c38]"}`}
            >
              {review.isPending ? (
                <Loader2
                  className="me-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : null}
              {review.isPending
                ? copy.saving
                : decision === "approved"
                  ? copy.confirmApproval
                  : copy.confirmRejection}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
