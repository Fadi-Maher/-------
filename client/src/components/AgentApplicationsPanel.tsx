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
  findPhoneMatch,
  isCompleteSaudiMobile,
  looksLikePhoneQuery,
  matchesApplicationSearch,
  normalizePhoneQuery,
  normalizeStoredPhone,
} from "@/lib/phoneSearch";
import { downloadBase64File } from "@/lib/downloadFile";
import { toast } from "sonner";
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
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

/** Renders a stored phone with the searched digits highlighted. */
function HighlightedPhone({ phone, query }: { phone: string; query: string }) {
  const match = looksLikePhoneQuery(query) ? findPhoneMatch(phone, query) : null;
  const display = normalizeStoredPhone(phone) || phone;
  if (!match) return <>{phone}</>;
  return (
    <>
      {display.slice(0, match.start)}
      <mark className="rounded bg-[#fff1b8] px-0.5 font-black text-[#5b4200]">
        {display.slice(match.start, match.end)}
      </mark>
      {display.slice(match.end)}
    </>
  );
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
  const exportXlsx = trpc.agentApplications.exportXlsx.useMutation();
  const exportingRef = useRef(false);
  const utils = trpc.useUtils();
  const noteId = useId();
  const searchId = useId();
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
        search: "Search by mobile number or name",
        searchPlaceholder: "05XXXXXXXX, +966…, or applicant name",
        searchHint:
          "Arabic digits, +966, and numbers without the leading 0 are accepted. Match counts appear on every status filter.",
        clearSearch: "Clear search",
        phoneMode: "Searching by mobile",
        nameMode: "Searching by name",
        results: (count: number) =>
          count === 1 ? "1 matching application" : `${count} matching applications`,
        noPhoneMatch: "No membership application uses this mobile number.",
        noNameMatch: "No membership application matches this name.",
        otherStatusMatches: "No match in this status. Matches were found in:",
        exactMatch: "Exact mobile match",
        refresh: "Refresh",
        exportLabel: "Export Excel",
        exporting: "Exporting…",
        exportAria: (count: number) =>
          `Export ${count} visible ${count === 1 ? "application" : "applications"} to an Excel file`,
        exportEmpty: "No applications to export in this view.",
        exportSuccess: (count: number) =>
          `Exported ${count} ${count === 1 ? "application" : "applications"} to Excel`,
        exportHint: "The file matches the current search and status filter.",
        exportTruncated: "Only the first 5,000 applications were included; narrow the search to export the rest.",
        exportError: "We could not export the file. Please try again.",
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
        search: "البحث برقم الجوال أو الاسم",
        searchPlaceholder: "05XXXXXXXX أو ‎+966… أو اسم المتقدم",
        searchHint:
          "يقبل الأرقام العربية و‎+966 والرقم دون الصفر، وتظهر أعداد المطابقات على أزرار كل حالة.",
        clearSearch: "مسح البحث",
        phoneMode: "بحث برقم الجوال",
        nameMode: "بحث بالاسم",
        results: (count: number) =>
          count === 0
            ? "لا توجد طلبات مطابقة"
            : count === 1
              ? "طلب واحد مطابق"
              : count === 2
                ? "طلبان مطابقان"
                : `${count} طلبات مطابقة`,
        noPhoneMatch: "لا يوجد طلب انضمام مسجل بهذا الرقم.",
        noNameMatch: "لا يوجد طلب انضمام بهذا الاسم.",
        otherStatusMatches: "لا توجد مطابقة في هذه الحالة، وتوجد مطابقات في:",
        exactMatch: "تطابق تام لرقم الجوال",
        refresh: "تحديث",
        exportLabel: "تصدير Excel",
        exporting: "جارٍ التصدير…",
        exportAria: (count: number) =>
          `تصدير ${count} من الطلبات الظاهرة إلى ملف Excel`,
        exportEmpty: "لا توجد طلبات لتصديرها في هذا العرض.",
        exportSuccess: (count: number) =>
          count === 1
            ? "تم تصدير طلب واحد إلى Excel"
            : count === 2
              ? "تم تصدير طلبين إلى Excel"
              : `تم تصدير ${count} طلبات إلى Excel`,
        exportHint: "يطابق الملف البحث الحالي وتصفية الحالة.",
        exportTruncated: "صُدّر أول 5000 طلب فقط؛ ضيّق البحث لتصدير الباقي.",
        exportError: "تعذر تصدير الملف. حاول مرة أخرى.",
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
  const trimmedSearch = search.trim();
  const searchActive = trimmedSearch.length > 0;
  const searchIsPhone = looksLikePhoneQuery(trimmedSearch);
  const normalizedPhoneQuery = searchIsPhone
    ? normalizePhoneQuery(trimmedSearch)
    : "";
  const searchMatches = useMemo(
    () =>
      applications.filter(application =>
        matchesApplicationSearch(application, trimmedSearch)
      ),
    [applications, trimmedSearch]
  );
  const matchCounts = useMemo(
    () => ({
      all: searchMatches.length,
      pending: searchMatches.filter(item => item.status === "pending").length,
      approved: searchMatches.filter(item => item.status === "approved").length,
      rejected: searchMatches.filter(item => item.status === "rejected").length,
    }),
    [searchMatches]
  );
  const visibleApplications = useMemo(
    () =>
      searchMatches.filter(
        application => filter === "all" || application.status === filter
      ),
    [searchMatches, filter]
  );
  const exactMatchId =
    searchIsPhone && isCompleteSaudiMobile(normalizedPhoneQuery)
      ? (searchMatches.find(
          application =>
            normalizeStoredPhone(application.phone) === normalizedPhoneQuery
        )?.id ?? null)
      : null;
  const otherStatuses = (["pending", "approved", "rejected"] as const).filter(
    status => status !== filter && matchCounts[status] > 0
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

  const runExport = async () => {
    if (exportingRef.current || exportXlsx.isPending) return;
    if (visibleApplications.length === 0) return;
    exportingRef.current = true;
    try {
      const result = await exportXlsx.mutateAsync({
        query: trimmedSearch,
        status: filter,
        language: isEnglish ? "en" : "ar",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      downloadBase64File(result.base64, result.fileName, result.mimeType);
      toast.success(copy.exportSuccess(result.count), {
        description: result.truncated ? copy.exportTruncated : copy.exportHint,
      });
    } catch (error) {
      toast.error(errorMessage(error, copy.exportError));
    } finally {
      exportingRef.current = false;
    }
  };

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
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void runExport()}
            disabled={
              exportXlsx.isPending ||
              list.isLoading ||
              list.isError ||
              visibleApplications.length === 0
            }
            aria-label={
              visibleApplications.length === 0
                ? copy.exportEmpty
                : copy.exportAria(visibleApplications.length)
            }
            aria-busy={exportXlsx.isPending}
            title={
              visibleApplications.length === 0 ? copy.exportEmpty : copy.exportHint
            }
            className="h-10 rounded-xl border-[#bfe5cf] bg-white text-[#1d6f42] hover:bg-[#f1fbf5] hover:text-[#17583a]"
          >
            {exportXlsx.isPending ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileSpreadsheet className="me-2 h-4 w-4" aria-hidden="true" />
            )}
            {exportXlsx.isPending ? copy.exporting : copy.exportLabel}
            {!exportXlsx.isPending && !list.isLoading && !list.isError ? (
              <span
                className="ms-1.5 inline-grid min-w-5 place-items-center rounded-full bg-[#e8f5e9] px-1 text-[11px] font-black text-[#1d6f42]"
                aria-hidden="true"
              >
                {visibleApplications.length}
              </span>
            ) : null}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void list.refetch()}
            disabled={list.isFetching}
            className="h-10 rounded-xl border-[#b7dbff] bg-white text-[#0668d9] hover:bg-[#f3f9ff]"
          >
            <RefreshCw
              className={`me-2 h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {copy.refresh}
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#e4eef8] bg-[#f8fbff] p-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#7592ac] ltr:left-3 rtl:right-3"
            aria-hidden="true"
          />
          <Input
            id={searchId}
            type="search"
            value={search}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setSearch(event.target.value)
            }
            onKeyDown={event => {
              if (event.key === "Escape" && search) {
                event.preventDefault();
                setSearch("");
              }
            }}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.search}
            aria-describedby={`${searchId}-hint ${searchId}-status`}
            autoComplete="off"
            enterKeyHint="search"
            spellCheck={false}
            className="h-11 rounded-xl bg-white px-10 [&::-webkit-search-cancel-button]:hidden"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                document.getElementById(searchId)?.focus();
              }}
              aria-label={copy.clearSearch}
              className="absolute top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#60778f] transition-colors hover:bg-[#eef6ff] hover:text-[#0668d9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0668d9] ltr:right-1.5 rtl:left-1.5"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div
          role="group"
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
              {searchActive ? (
                <span
                  className={`ms-1.5 inline-grid min-w-5 place-items-center rounded-full px-1 text-[11px] font-black ${filter === value ? "bg-white/25 text-white" : matchCounts[value] > 0 ? "bg-[#eaf3ff] text-[#0668d9]" : "bg-[#f1f4f8] text-[#8a9bad]"}`}
                >
                  {matchCounts[value]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-xs text-[#60778f]">
        <p id={`${searchId}-hint`}>{copy.searchHint}</p>
        <p
          id={`${searchId}-status`}
          aria-live="polite"
          aria-atomic="true"
          className="font-bold text-[#31516e]"
        >
          {searchActive && !list.isLoading && !list.isError
            ? `${searchIsPhone ? copy.phoneMode : copy.nameMode} · ${copy.results(visibleApplications.length)}`
            : ""}
        </p>
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
        <div className="mt-5 grid min-h-36 place-items-center rounded-2xl border border-dashed border-[#cfe0f0] bg-[#fbfdff] px-4 py-6 text-center text-sm text-[#60778f]">
          <div>
            <UserRound
              className="mx-auto h-7 w-7 text-[#87bff4]"
              aria-hidden="true"
            />
            {searchActive && otherStatuses.length > 0 ? (
              <>
                <p className="mt-2 font-bold text-[#31516e]">
                  {copy.otherStatusMatches}
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {otherStatuses.map(status => (
                    <Button
                      key={status}
                      type="button"
                      variant="outline"
                      onClick={() => setFilter(status)}
                      className="h-9 rounded-xl border-[#b7dbff] bg-white text-[#0668d9] hover:bg-[#f3f9ff]"
                    >
                      {statusLabel(status)} ({matchCounts[status]})
                    </Button>
                  ))}
                </div>
              </>
            ) : searchActive ? (
              <>
                <p className="mt-2">
                  {searchIsPhone ? copy.noPhoneMatch : copy.noNameMatch}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSearch("")}
                  className="mt-2 h-9 rounded-xl text-[#0668d9]"
                >
                  {copy.clearSearch}
                </Button>
              </>
            ) : (
              <p className="mt-2">{copy.empty}</p>
            )}
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
              className={`overflow-hidden rounded-2xl border bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] ${targetApplicationId === application.id || exactMatchId === application.id ? "border-[#0878f9] ring-2 ring-[#cce5ff]" : "border-[#dce8f6]"}`}
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
                    <HighlightedPhone
                      phone={application.phone}
                      query={trimmedSearch}
                    />{" "}
                    · {application.email}
                  </p>
                  {exactMatchId === application.id ? (
                    <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#eaf3ff] px-2 py-0.5 text-[11px] font-black text-[#0668d9]">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {copy.exactMatch}
                    </p>
                  ) : null}
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
