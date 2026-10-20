import { CustomerNotificationCenter } from "@/components/CustomerNotificationCenter";
import { CustomerProfilePanel } from "@/components/CustomerProfilePanel";
import { CustomerQuotePanel } from "@/components/CustomerQuotePanel";
import { PublicHeader } from "@/components/PublicHeader";
import { RequestConversation } from "@/components/RequestConversation";
import { RequestReviewPanel } from "@/components/RequestReviewPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { orderRequestsByLatestQuote } from "@/lib/customerRequestOrdering";
import { trpc } from "@/lib/trpc";
import { CUSTOMER_SESSION_EVENT } from "@/lib/customerSession";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  HandCoins,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PlusCircle,
  Search,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const statusLabels = {
  received: { ar: "تم الاستلام", en: "Received" },
  in_review: { ar: "قيد المراجعة", en: "In review" },
  in_progress: { ar: "قيد التنفيذ", en: "In progress" },
  completed: { ar: "مكتمل", en: "Completed" },
} as const;

type CustomerTab = "overview" | "requests" | "quotes" | "updates" | "profile";
type RequestStatusFilter = "all" | keyof typeof statusLabels;

export default function CustomerAccount() {
  const { isEnglish } = useLanguage();
  const [linkedRequestId] = useState(() => {
    if (typeof window === "undefined") return null;
    const value = Number(new URLSearchParams(window.location.search).get("request"));
    return Number.isInteger(value) && value > 0 ? value : null;
  });
  const [name, setName] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState<CustomerTab>(() => {
    if (linkedRequestId) return "requests";
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "profile") return "profile";
    return "overview";
  });
  const sessionTokenRef = useRef("");
  const [statusFilter, setStatusFilter] = useState<RequestStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRequestId, setExpandedRequestId] = useState<number | null>(linkedRequestId);
  const [unreadQuoteRequestIds, setUnreadQuoteRequestIds] = useState<number[]>([]);

  useEffect(() => {
    const refreshSession = () => {
      const token = localStorage.getItem("maalamati_customer_access_token") || "";
      setName(localStorage.getItem("maalamati_customer_name") || "");
      setAccessToken(token);
      const sameAccount = Boolean(token) && token === sessionTokenRef.current;
      sessionTokenRef.current = token;
      return sameAccount;
    };
    const onSessionChanged = () => {
      // A profile edit re-saves the same session, and a number change pre-registers its new token; keep the customer where they are.
      if (refreshSession()) return;
      setActiveTab("overview");
      setExpandedRequestId(null);
      setSearchQuery("");
      setStatusFilter("all");
      setUnreadQuoteRequestIds([]);
    };
    refreshSession();
    window.addEventListener(CUSTOMER_SESSION_EVENT, onSessionChanged);
    return () => window.removeEventListener(CUSTOMER_SESSION_EVENT, onSessionChanged);
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [accessToken]);

  const tokenInput = useMemo(
    () => ({ accessToken: accessToken || "demo-placeholder-token-000000" }),
    [accessToken],
  );
  const requests = trpc.requests.trackByPhoneVerified.useQuery(tokenInput, {
    enabled: accessToken.length > 20,
  });
  const quotes = trpc.quotes.customerList.useQuery(tokenInput, {
    enabled: accessToken.length > 20,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });
  useEffect(() => {
    if (!linkedRequestId || !requests.data?.some(request => request.id === linkedRequestId)) return;
    const timer = window.setTimeout(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(`customer-request-${linkedRequestId}`)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [linkedRequestId, requests.data]);
  const utils = trpc.useUtils();
  const acceptQuote = trpc.quotes.accept.useMutation({
    onSuccess: async result => {
      toast.success(
        isEnglish
          ? `You selected ${result.providerName}.`
          : `تم اعتماد عرض ${result.providerName}.`,
      );
      await Promise.all([
        utils.quotes.customerList.invalidate(),
        utils.requests.trackByPhoneVerified.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const markQuoteRequestRead = trpc.customerNotifications.markQuoteRequestRead.useMutation({
    onSuccess: () => utils.customerNotifications.list.invalidate({ accessToken }),
  });

  const copy = isEnglish
    ? {
        title: "My account",
        hello: "Hello",
        intro: "Your requests, quotes, replies, and latest updates are collected here.",
        dashboard: "Account overview",
        dashboardIntro: "A quick view of your active requests and latest activity.",
        requests: "My requests",
        requestsIntro: "Track and manage every service request from one place.",
        quotes: "Price quotes",
        quotesIntro: "Compare all received quotes by price and turnaround time.",
        updates: "Latest updates",
        updatesIntro: "Review replies and progress updates on your requests.",
        profile: "My profile",
        profileIntro: "Update your name and email. Changes apply to your account straight away.",
        noRequests: "No requests are linked to this account yet.",
        noQuoteRequests: "No price quotes have been received yet.",
        loading: "Loading your requests…",
        signUp: "Sign in with your mobile number",
        logout: "Sign out",
        home: "Home",
        attachments: "attachments",
        noUpdates: "No reply has been posted yet.",
        newRequest: "Create a new request",
        newRequestHint: "Share the service details and receive price quotes in your account.",
        search: "Search requests",
        searchPlaceholder: "Search by service or status",
        all: "All",
        recentRequests: "Recent requests",
        viewAll: "View all",
        totalRequests: "Total requests",
        availableQuotes: "Available quotes",
        inProgress: "In progress",
        completed: "Completed",
        updatesCount: "Updates",
        updatedAt: "Last updated",
      }
    : {
        title: "حسابي",
        hello: "مرحبًا",
        intro: "طلباتك وعروض الأسعار والردود والتحديثات الأخيرة في مكان واحد.",
        dashboard: "لوحة الحساب",
        dashboardIntro: "نظرة سريعة على طلباتك النشطة وآخر المستجدات.",
        requests: "طلباتي",
        requestsIntro: "تتبّع وأدر جميع طلبات الخدمات من مكان واحد.",
        quotes: "عروض الأسعار",
        quotesIntro: "قارن جميع العروض المستلمة حسب السعر ومدة الإنجاز.",
        updates: "آخر التحديثات",
        updatesIntro: "راجع الردود وتحديثات التقدم على طلباتك.",
        profile: "ملفي الشخصي",
        profileIntro: "حدّث اسمك وبريدك الإلكتروني، وتُطبّق التغييرات على حسابك فورًا.",
        noRequests: "لا توجد طلبات مرتبطة بهذا الحساب بعد.",
        noQuoteRequests: "لم تصل عروض أسعار بعد.",
        loading: "جارٍ تحميل طلباتك…",
        signUp: "الدخول برقم الجوال",
        logout: "تسجيل الخروج",
        home: "الرئيسية",
        attachments: "مرفقات",
        noUpdates: "لم تُنشر أي ردود بعد.",
        newRequest: "إنشاء طلب جديد",
        newRequestHint: "شارك تفاصيل الخدمة واستقبل عروض الأسعار داخل حسابك.",
        search: "البحث في الطلبات",
        searchPlaceholder: "ابحث بالخدمة أو الحالة",
        all: "الكل",
        recentRequests: "أحدث الطلبات",
        viewAll: "عرض الكل",
        totalRequests: "إجمالي الطلبات",
        availableQuotes: "العروض المتاحة",
        inProgress: "قيد التنفيذ",
        completed: "مكتملة",
        updatesCount: "التحديثات",
        updatedAt: "آخر تحديث",
      };

  const updates = useMemo(
    () =>
      (requests.data ?? [])
        .flatMap(request => request.updates.map(update => ({ ...update, request })))
        .sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)))
        .slice(0, 12),
    [requests.data],
  );
  const orderedRequests = useMemo(
    () => orderRequestsByLatestQuote(requests.data ?? [], quotes.data ?? []),
    [quotes.data, requests.data],
  );
  const activeQuoteCount = useMemo(
    () =>
      (quotes.data ?? []).reduce(
        (total, group) =>
          total +
          group.quotes.filter(
            quote => quote.status !== "declined" && quote.status !== "withdrawn",
          ).length,
        0,
      ),
    [quotes.data],
  );
  const quoteRequestIds = useMemo(
    () =>
      new Set(
        (quotes.data ?? [])
          .filter(group =>
            group.quotes.some(
              quote => quote.status !== "declined" && quote.status !== "withdrawn",
            ),
          )
          .map(group => group.requestId),
      ),
    [quotes.data],
  );
  const quoteRequests = useMemo(
    () => orderedRequests.filter(request => quoteRequestIds.has(request.id)),
    [orderedRequests, quoteRequestIds],
  );
  const requestStatusCounts = useMemo(
    () => ({
      all: orderedRequests.length,
      received: orderedRequests.filter(request => request.status === "received").length,
      in_review: orderedRequests.filter(request => request.status === "in_review").length,
      in_progress: orderedRequests.filter(request => request.status === "in_progress").length,
      completed: orderedRequests.filter(request => request.status === "completed").length,
    }),
    [orderedRequests],
  );
  const visibleRequests = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLocaleLowerCase(isEnglish ? "en" : "ar");
    const source = activeTab === "quotes" ? quoteRequests : orderedRequests;
    return source.filter(request => {
      if (activeTab === "requests" && statusFilter !== "all" && request.status !== statusFilter) {
        return false;
      }
      if (!normalizedSearch) return true;
      const status = isEnglish ? statusLabels[request.status].en : statusLabels[request.status].ar;
      return [request.category, request.subcategory ?? "", status]
        .join(" ")
        .toLocaleLowerCase(isEnglish ? "en" : "ar")
        .includes(normalizedSearch);
    });
  }, [activeTab, isEnglish, orderedRequests, quoteRequests, searchQuery, statusFilter]);

  const handleUnreadQuoteRequestsChange = useCallback((requestIds: number[]) => {
    setUnreadQuoteRequestIds(current =>
      current.length === requestIds.length &&
      current.every((id, index) => id === requestIds[index])
        ? current
        : requestIds,
    );
  }, []);

  const markRequestQuotesRead = (requestId: number) => {
    if (!unreadQuoteRequestIds.includes(requestId)) return;
    setUnreadQuoteRequestIds(current => current.filter(id => id !== requestId));
    markQuoteRequestRead.mutate({ accessToken, requestId });
  };

  const toggleRequest = (requestId: number) => {
    const nextRequestId = expandedRequestId === requestId ? null : requestId;
    setExpandedRequestId(nextRequestId);
    if (nextRequestId) markRequestQuotesRead(requestId);
  };

  const openRequest = (requestId: number) => {
    setActiveTab("requests");
    setStatusFilter("all");
    setExpandedRequestId(requestId);
    markRequestQuotesRead(requestId);
    window.setTimeout(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document
        .getElementById(`customer-request-${requestId}`)
        ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    }, 0);
  };

  const logout = () => {
    localStorage.removeItem("maalamati_customer_name");
    localStorage.removeItem("maalamati_customer_phone");
    localStorage.removeItem("maalamati_customer_access_token");
    window.location.assign("/");
  };

  const renderRequestCards = (
    items: typeof orderedRequests,
    emptyMessage: string,
  ) => {
    if (requests.isLoading) {
      return <p className="rounded-2xl bg-[#f5faff] p-5 text-sm text-[#70859b]">{copy.loading}</p>;
    }
    if (!items.length) {
      return (
        <div className="rounded-[1.5rem] border border-dashed border-[#cde3fa] bg-[#f8fbff] px-5 py-9 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white text-[#0878f9] shadow-[0_10px_28px_rgba(31,91,151,.10)]">
            <FileText className="h-6 w-6" />
          </span>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#60778f]">{emptyMessage}</p>
          <a
            href="/#request"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#0878f9] px-4 text-sm font-extrabold text-white shadow-[0_10px_22px_rgba(8,120,249,.22)] transition-transform duration-150 active:scale-[.97]"
          >
            <PlusCircle className="h-4 w-4" />
            {copy.newRequest}
          </a>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {items.map(request => {
          const group = quotes.data?.find(item => item.requestId === request.id);
          const hasUnreadQuote = unreadQuoteRequestIds.includes(request.id);
          return (
            <article
              id={`customer-request-${request.id}`}
              key={request.id}
              className={`scroll-mt-28 overflow-hidden rounded-[1.4rem] border bg-white shadow-[0_8px_26px_rgba(31,91,151,.06)] ${
                hasUnreadQuote
                  ? "border-[#87c2f7] ring-2 ring-[#dcefff]"
                  : "border-[#dce8f6]"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleRequest(request.id)}
                aria-expanded={expandedRequestId === request.id}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-start sm:grid-cols-[auto_minmax(0,1fr)_110px_auto] sm:p-5"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0878f9]">
                  <FileText className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-extrabold text-[#17334f] sm:text-base">
                      {request.category}
                      {request.subcategory ? ` — ${request.subcategory}` : ""}
                    </span>
                    {hasUnreadQuote ? (
                      <span className="shrink-0 rounded-full bg-[#e7f8ee] px-2.5 py-1 text-[10px] font-black text-[#17824b]">
                        {isEnglish ? "New quote" : "عرض جديد"}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1.5 block text-[11px] font-bold text-[#70859b]">
                    {copy.updatedAt}: {new Date(request.updatedAt).toLocaleDateString(isEnglish ? "en-US" : "ar-SA")}
                  </span>
                </span>
                <span className="hidden text-center text-xs font-bold text-[#60778f] sm:block">
                  {request.updates.length} {copy.updatesCount}
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-[#eaf3ff] px-3 py-1.5 text-[11px] font-bold text-[#0878f9] sm:text-xs">
                    {isEnglish ? statusLabels[request.status].en : statusLabels[request.status].ar}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[#8aa0b5] transition-transform duration-200 ${
                      expandedRequestId === request.id ? "rotate-180" : ""
                    }`}
                  />
                </span>
              </button>
              {expandedRequestId === request.id ? (
                <div className="border-t border-[#e7eff8] bg-[#fbfdff] p-4 sm:p-5">
                  <CustomerQuotePanel
                    group={group}
                    isEnglish={isEnglish}
                    acceptingQuoteId={
                      acceptQuote.isPending ? acceptQuote.variables?.quoteId ?? null : null
                    }
                    nowMs={nowMs}
                    compact
                    onAccept={quote => {
                      if (
                        window.confirm(
                          isEnglish
                            ? `Choose ${quote.providerName}'s quote?`
                            : `اعتماد عرض ${quote.providerName}؟`,
                        )
                      ) {
                        acceptQuote.mutate({ accessToken, quoteId: quote.id });
                      }
                    }}
                  />
                  {group?.providerAcceptedAt ? (
                    <RequestConversation
                      requestId={request.id}
                      isEnglish={isEnglish}
                      mode="customer"
                      status={request.status}
                      accessToken={accessToken}
                    />
                  ) : null}
                  <RequestReviewPanel
                    requestId={request.id}
                    status={request.status}
                    review={request.review}
                    accessToken={accessToken}
                    isEnglish={isEnglish}
                  />
                  {request.updates.length > 0 ? (
                    <div className="mt-3 flex justify-end">
                      <p className="flex items-center gap-2 text-xs font-bold text-[#17824b]">
                        <MessageSquare className="h-4 w-4" />
                        {request.updates.length} {copy.updatesCount}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    );
  };

  const renderUpdates = (limit?: number) => {
    const visibleUpdates = typeof limit === "number" ? updates.slice(0, limit) : updates;
    if (!visibleUpdates.length) {
      return (
        <p className="rounded-2xl bg-[#f5faff] p-5 text-sm leading-7 text-[#60778f]">
          {copy.noUpdates}
        </p>
      );
    }
    return (
      <div className="space-y-5">
        {visibleUpdates.map(update => (
          <article key={update.id} className="border-s-2 border-[#b6dbfb] ps-4">
            <p className="text-sm font-extrabold text-[#17334f]">{update.request.category}</p>
            {update.senderName &&
            (update.senderType === "employee" || update.senderType === "agent") ? (
              <p className="mt-1 text-xs font-bold text-[#0878f9]">
                {update.senderType === "agent"
                  ? isEnglish
                    ? "Transaction specialist"
                    : "المعقّب"
                  : isEnglish
                    ? "Employee"
                    : "الموظف"}
                : <strong className="text-[#17334f]">{update.senderName}</strong>
              </p>
            ) : null}
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#405d78]">
              {update.message}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[#7b91a8]">
              <time>{new Date(update.createdAt).toLocaleString(isEnglish ? "en-US" : "ar-SA")}</time>
              {update.attachments?.length ? (
                <span className="flex items-center gap-1 font-bold text-[#0878f9]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {update.attachments.length} {copy.attachments}
                </span>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    );
  };

  if (!accessToken) {
    return (
      <div
        className="min-h-screen overflow-x-hidden bg-[#f5f9ff] text-[#102a43]"
        dir={isEnglish ? "ltr" : "rtl"}
      >
        <PublicHeader onChooseService={() => window.location.assign("/#request")} />
        <main className="container grid min-h-[calc(100vh-150px)] place-items-center py-12">
          <section className="w-full max-w-lg rounded-[2rem] border border-[#dce8f6] bg-white p-8 text-center shadow-[0_20px_50px_rgba(27,79,129,.10)]">
            <UserRound className="mx-auto h-12 w-12 text-[#0878f9]" />
            <h1 className="font-display mt-5 text-3xl font-extrabold">{copy.title}</h1>
            <p className="mt-3 text-sm leading-7 text-[#60778f]">{copy.signUp}</p>
            <a
              href="/customer-signup"
              className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0878f9] px-5 text-sm font-extrabold text-white"
            >
              {copy.signUp}
              {isEnglish ? (
                <ArrowRight className="h-4 w-4" />
              ) : (
                <ArrowLeft className="h-4 w-4" />
              )}
            </a>
          </section>
        </main>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: copy.dashboard, icon: LayoutDashboard, count: orderedRequests.length },
    { id: "requests", label: copy.requests, icon: FileText, count: orderedRequests.length },
    { id: "quotes", label: copy.quotes, icon: HandCoins, count: activeQuoteCount },
    { id: "updates", label: copy.updates, icon: MessageSquare, count: updates.length },
    { id: "profile", label: copy.profile, icon: UserRound, count: null },
  ] as const;
  const pageMeta = {
    overview: { title: copy.dashboard, intro: copy.dashboardIntro },
    requests: { title: copy.requests, intro: copy.requestsIntro },
    quotes: { title: copy.quotes, intro: copy.quotesIntro },
    updates: { title: copy.updates, intro: copy.updatesIntro },
    profile: { title: copy.profile, intro: copy.profileIntro },
  }[activeTab];
  const statusTabs: Array<{ id: RequestStatusFilter; label: string; count: number }> = [
    { id: "all", label: copy.all, count: requestStatusCounts.all },
    {
      id: "received",
      label: isEnglish ? statusLabels.received.en : statusLabels.received.ar,
      count: requestStatusCounts.received,
    },
    {
      id: "in_review",
      label: isEnglish ? statusLabels.in_review.en : statusLabels.in_review.ar,
      count: requestStatusCounts.in_review,
    },
    {
      id: "in_progress",
      label: isEnglish ? statusLabels.in_progress.en : statusLabels.in_progress.ar,
      count: requestStatusCounts.in_progress,
    },
    {
      id: "completed",
      label: isEnglish ? statusLabels.completed.en : statusLabels.completed.ar,
      count: requestStatusCounts.completed,
    },
  ];

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#f5f9ff] text-[#102a43]"
      dir={isEnglish ? "ltr" : "rtl"}
    >
      <PublicHeader onChooseService={() => window.location.assign("/#request")} />
      <CustomerNotificationCenter
        accessToken={accessToken}
        onNewNotification={() => {
          void utils.quotes.customerList.invalidate();
          void utils.requests.trackByPhoneVerified.invalidate();
        }}
        onUnreadQuoteRequestsChange={handleUnreadQuoteRequestsChange}
        onOpenRequest={openRequest}
      />

      <main className="container py-6 sm:py-10">
        <a
          href="/#request"
          className="group flex min-h-24 items-center justify-between gap-4 overflow-hidden rounded-[1.75rem] bg-gradient-to-l from-[#0878f9] to-[#075fc9] px-5 py-5 text-white shadow-[0_18px_38px_rgba(8,120,249,.24)] transition-transform duration-150 active:scale-[.99] sm:px-7"
        >
          <span className="flex min-w-0 items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <PlusCircle className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="font-display block text-xl font-black sm:text-2xl">{copy.newRequest}</span>
              <span className="mt-1 block text-xs leading-6 text-white/80 sm:text-sm">{copy.newRequestHint}</span>
            </span>
          </span>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#0878f9] transition-transform duration-200 group-hover:translate-x-[-2px]">
            {isEnglish ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
          </span>
        </a>

        <nav
          aria-label={isEnglish ? "Customer account sections" : "أقسام حساب العميل"}
          className="-mx-4 mt-5 overflow-x-auto px-4 pb-2 lg:hidden"
        >
          <div className="flex min-w-max gap-2 rounded-2xl border border-[#dce8f6] bg-white p-2 shadow-[0_10px_28px_rgba(31,91,151,.06)]">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex min-w-[112px] items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-extrabold transition-colors ${
                    active ? "bg-[#eaf3ff] text-[#0878f9]" : "text-[#60778f] hover:bg-[#f5f9ff]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {tab.count !== null ? (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white" : "bg-[#eef4fa]"}`}>
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="mt-5 grid min-w-0 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
          <aside className="sticky top-24 hidden rounded-[1.75rem] border border-[#dce8f6] bg-white p-3 shadow-[0_16px_40px_rgba(27,79,129,.07)] lg:block">
            <div className="px-3 pb-3 pt-2">
              <p className="text-xs font-extrabold text-[#60778f]">{copy.hello}</p>
              <p className="mt-1 truncate text-lg font-black text-[#17334f]">{name}</p>
            </div>
            <nav aria-label={isEnglish ? "Customer account sections" : "أقسام حساب العميل"}>
              <div className="space-y-1.5">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-extrabold transition-colors ${
                        active
                          ? "bg-[#eaf3ff] text-[#0878f9] shadow-[inset_3px_0_0_#0878f9]"
                          : "text-[#405d78] hover:bg-[#f5f9ff]"
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                      {tab.count !== null ? (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-white" : "bg-[#eef4fa]"}`}>
                          {tab.count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </nav>
            <div className="mt-3 border-t border-[#e7eff8] pt-3">
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-extrabold text-[#c83d4b] hover:bg-[#fff4f5]"
              >
                <LogOut className="h-5 w-5" />
                {copy.logout}
              </button>
            </div>
          </aside>

          <section
            id="customer-account-panel"
            role="tabpanel"
            className="min-w-0 rounded-[1.75rem] border border-[#dce8f6] bg-white p-5 shadow-[0_16px_40px_rgba(27,79,129,.07)] sm:p-7"
          >
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#0878f9]">{copy.title}</p>
                <h1 className="font-display mt-2 text-3xl font-black tracking-[-.04em] text-[#17334f] sm:text-4xl">
                  {pageMeta.title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-[#60778f]">{pageMeta.intro}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={logout}
                className="h-10 w-fit rounded-xl border-[#ffd1d5] font-extrabold text-[#c83d4b] hover:bg-[#fff4f5] lg:hidden"
              >
                <LogOut className="h-4 w-4" />
                {copy.logout}
              </Button>
            </header>

            {activeTab === "overview" ? (
              <div className="mt-7">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: copy.totalRequests, value: orderedRequests.length, icon: FileText, tone: "bg-[#eaf3ff] text-[#0878f9]" },
                    { label: copy.availableQuotes, value: activeQuoteCount, icon: HandCoins, tone: "bg-[#effbf4] text-[#238457]" },
                    { label: copy.inProgress, value: requestStatusCounts.in_progress, icon: Clock3, tone: "bg-[#fff6e8] text-[#d98500]" },
                    { label: copy.completed, value: requestStatusCounts.completed, icon: CheckCircle2, tone: "bg-[#f0f7ff] text-[#426d98]" },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <article key={item.label} className="rounded-2xl border border-[#e2ecf7] bg-[#fbfdff] p-4">
                        <div className="flex items-center gap-3">
                          <span className={`grid h-10 w-10 place-items-center rounded-xl ${item.tone}`}>
                            <Icon className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="text-[11px] font-bold text-[#70859b]">{item.label}</p>
                            <p className="mt-0.5 text-2xl font-black text-[#17334f]">{item.value}</p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[1.15fr_.85fr]">
                  <section className="min-w-0 rounded-2xl border border-[#e2ecf7] bg-[#fbfdff] p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h2 className="font-display text-xl font-black text-[#17334f]">{copy.recentRequests}</h2>
                      <button type="button" onClick={() => setActiveTab("requests")} className="text-xs font-extrabold text-[#0878f9]">
                        {copy.viewAll}
                      </button>
                    </div>
                    {renderRequestCards(orderedRequests.slice(0, 3), copy.noRequests)}
                  </section>
                  <section className="min-w-0 rounded-2xl border border-[#e2ecf7] bg-[#fbfdff] p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h2 className="font-display text-xl font-black text-[#17334f]">{copy.updates}</h2>
                      <button type="button" onClick={() => setActiveTab("updates")} className="text-xs font-extrabold text-[#0878f9]">
                        {copy.viewAll}
                      </button>
                    </div>
                    {renderUpdates(4)}
                  </section>
                </div>
              </div>
            ) : null}

            {activeTab === "requests" || activeTab === "quotes" ? (
              <div id="customer-requests" className="mt-7 min-w-0 scroll-mt-24">
                <label className="sr-only" htmlFor="customer-request-search">{copy.search}</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8aa0b5]" />
                  <Input
                    id="customer-request-search"
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                    placeholder={copy.searchPlaceholder}
                    className="h-12 rounded-2xl border-[#d8e6f5] bg-[#fbfdff] ps-11 text-sm shadow-none"
                  />
                </div>

                {activeTab === "requests" ? (
                  <div className="-mx-1 mt-4 overflow-x-auto px-1 pb-2">
                    <div className="flex min-w-max gap-2" aria-label={isEnglish ? "Filter requests by status" : "تصفية الطلبات حسب الحالة"}>
                      {statusTabs.map(item => {
                        const active = statusFilter === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setStatusFilter(item.id)}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-extrabold transition-colors ${
                              active
                                ? "border-[#a9d2fa] bg-white text-[#0878f9] shadow-[0_7px_18px_rgba(31,91,151,.10)]"
                                : "border-transparent bg-[#f3f7fb] text-[#60778f] hover:bg-[#eaf3ff]"
                            }`}
                          >
                            {item.label}
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-[#eaf3ff]" : "bg-white"}`}>
                              {item.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="mt-5">
                  {renderRequestCards(
                    visibleRequests,
                    activeTab === "quotes" ? copy.noQuoteRequests : copy.noRequests,
                  )}
                </div>
              </div>
            ) : null}

            {activeTab === "updates" ? (
              <div className="mt-7 rounded-2xl border border-[#e2ecf7] bg-[#fbfdff] p-4 sm:p-5">
                {renderUpdates()}
              </div>
            ) : null}

            {activeTab === "profile" ? (
              <CustomerProfilePanel
                accessToken={accessToken}
                isEnglish={isEnglish}
                onSessionExpired={logout}
                // A verified number change issues a new token for the same account; stay on this tab.
                onAccessTokenRotated={token => {
                  sessionTokenRef.current = token;
                }}
              />
            ) : null}
          </section>
        </div>

        <a href="/" className="mx-auto mt-7 flex w-fit items-center gap-2 text-sm font-extrabold text-[#0878f9]">
          {isEnglish ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          {copy.home}
        </a>
      </main>
    </div>
  );
}
