import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  amountToHalalas,
  halalasToAmount,
  summarizeFinanceEntries,
} from "@shared/finance";
import {
  CheckCircle2,
  CircleDollarSign,
  RefreshCw,
  ScrollText,
} from "lucide-react";

export type AgentOverviewProps = {
  isEnglish: boolean;
  completedCount: number | null;
  totalAssignedCount: number | null;
  requestsLoading: boolean;
  requestsError: boolean;
  onRetryRequests?: () => void;
  onViewCompleted?: () => void;
  /** null while the account is loading; false prevents cached financial values from rendering. */
  canViewAssigned?: boolean | null;
};

function displayAmount(amount: string) {
  try {
    return halalasToAmount(amountToHalalas(amount));
  } catch {
    return amount;
  }
}

function MetricValue({
  value,
  testId,
}: {
  value: string | number | null;
  testId: string;
}) {
  return (
    <output
      data-testid={testId}
      className="mt-3 block font-display text-4xl font-black tabular-nums tracking-tight sm:text-5xl"
      dir="ltr"
    >
      <bdi>{value ?? "—"}</bdi>
    </output>
  );
}

export function AgentOverview({
  isEnglish,
  completedCount,
  totalAssignedCount,
  requestsLoading,
  requestsError,
  onRetryRequests,
  onViewCompleted,
  canViewAssigned = null,
}: AgentOverviewProps) {
  // This uses the same tRPC query key as AgentFinancePanel, so both views share its cache.
  const query = trpc.agentFinance.mine.useQuery(undefined, {
    enabled: canViewAssigned === true,
  });
  const accountDenied = canViewAssigned === false;
  const financeLoading = canViewAssigned === null || query.isLoading;
  const hasFinanceData =
    !accountDenied && !financeLoading && !query.isError && Boolean(query.data);
  const financeSummary =
    hasFinanceData && query.data
      ? summarizeFinanceEntries(query.data.entries)
      : null;
  const financeError =
    accountDenied || query.isError || (!financeLoading && !query.data);
  const assignmentError =
    accountDenied ||
    requestsError ||
    (!requestsLoading &&
      (completedCount === null || totalAssignedCount === null));
  const completedValue =
    assignmentError || requestsLoading ? null : completedCount;
  const totalValue =
    assignmentError || requestsLoading ? null : totalAssignedCount;
  const completionPercent =
    completedValue === null || totalValue === null
      ? null
      : totalValue > 0
        ? Math.round((completedValue / totalValue) * 100)
        : 0;
  const netIsNegative = financeSummary
    ? amountToHalalas(financeSummary.netProfit) < BigInt(0)
    : false;
  const netStatus = netIsNegative
    ? isEnglish
      ? "Loss"
      : "خسارة"
    : financeSummary?.netProfit === "0.00"
      ? isEnglish
        ? "Break-even"
        : "تعادل"
      : isEnglish
        ? "Profit"
        : "ربح";
  const text = isEnglish
    ? {
        title: "Your overview",
        allTime: "All time",
        completed: "Completed requests",
        assigned: "assigned requests",
        completion: "Completion",
        viewCompleted: "View completed requests",
        requestsUnavailable: "Completed work is unavailable right now.",
        retryRequests: "Retry completed work",
        netProfit: "Net cash profit",
        cashBasis: "Cash-basis from your recorded collections and costs only.",
        collected: "Collected",
        costs: "Costs",
        financeUnavailable: "Net cash profit is unavailable right now.",
        accessUnavailable: "This summary is unavailable for your account.",
        retryFinance: "Retry cash summary",
        openLedger: "Open cash ledger",
      }
    : {
        title: "ملخصك",
        allTime: "كل الفترات",
        completed: "الطلبات المكتملة",
        assigned: "طلبات موكلة",
        completion: "نسبة الإنجاز",
        viewCompleted: "عرض الطلبات المكتملة",
        requestsUnavailable: "يتعذر عرض الأعمال المكتملة الآن.",
        retryRequests: "إعادة محاولة الأعمال المكتملة",
        netProfit: "صافي الربح النقدي",
        cashBasis: "على الأساس النقدي من تحصيلاتك وتكاليفك المسجلة فقط.",
        collected: "المحصّل",
        costs: "التكاليف",
        financeUnavailable: "يتعذر عرض صافي الربح النقدي الآن.",
        accessUnavailable: "هذا الملخص غير متاح لحسابك.",
        retryFinance: "إعادة محاولة الملخص النقدي",
        openLedger: "فتح سجل القيود النقدية",
      };

  const scrollToLedger = () => {
    const ledger = document.getElementById("agent-cash-ledger");
    ledger?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    ledger?.focus({ preventScroll: true });
  };

  return (
    <section
      className="mt-6 overflow-hidden rounded-3xl bg-[#102a43] p-4 text-white shadow-[0_18px_46px_rgba(16,42,67,.24)] sm:p-6"
      dir={isEnglish ? "ltr" : "rtl"}
      aria-label={text.title}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#86e1dd]">
            {isEnglish ? "Agent dashboard" : "لوحة المعقب"}
          </p>
          <h2 className="mt-1 font-display text-2xl font-black sm:text-3xl">
            {text.title}
          </h2>
        </div>
        <span className="rounded-full border border-[#4e9fba] bg-[#153956] px-3 py-1 text-xs font-black text-[#c6f4ee]">
          {text.allTime}
        </span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#367aa0] bg-[#153956] p-4 shadow-inner shadow-[#0b2134]/30 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-[#c6f4ee]">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-black">{text.completed}</span>
            </div>
            {completionPercent === null ? null : (
              <span
                className="rounded-full bg-[#0e4b67] px-2.5 py-1 text-xs font-black text-[#86e1dd]"
                dir="ltr"
              >
                {completionPercent}%
              </span>
            )}
          </div>
          <MetricValue value={completedValue} testId="completed-count" />
          {assignmentError ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-[#e69ca5]/50 bg-[#4b2636]/45 p-3 text-sm text-[#ffe2e5]"
            >
              <p>{text.requestsUnavailable}</p>
              {onRetryRequests ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onRetryRequests}
                  className="mt-3 border-[#f2bbc2] bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <RefreshCw className="me-1 h-3.5 w-3.5" />
                  {text.retryRequests}
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm font-bold text-[#b6dced]">
                {totalValue ?? "—"} {text.assigned}
              </p>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={completionPercent ?? undefined}
                aria-busy={completionPercent === null}
                className="mt-4 h-2 overflow-hidden rounded-full bg-[#0b2a42]"
                aria-label={text.completion}
              >
                <span
                  className="block h-full rounded-full bg-[#2ec4b6]"
                  style={{ width: `${completionPercent ?? 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[#b6dced]">
                {text.completion}:{" "}
                <strong dir="ltr" className="tabular-nums text-white">
                  {completionPercent === null ? "—" : `${completionPercent}%`}
                </strong>
              </p>
            </>
          )}
          <Button
            type="button"
            onClick={onViewCompleted}
            disabled={!onViewCompleted || accountDenied}
            className="mt-4 min-h-10 w-full rounded-xl bg-[#2d86d0] font-black text-white hover:bg-[#2377bd]"
          >
            <CheckCircle2 className="me-2 h-4 w-4" />
            {text.viewCompleted}
          </Button>
        </div>

        <div className="rounded-2xl border border-[#328f94] bg-[#0f4b5c] p-4 shadow-inner shadow-[#082f3b]/30 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-[#d1fffa]">
              <CircleDollarSign className="h-5 w-5" />
              <span className="text-sm font-black">{text.netProfit}</span>
            </div>
            {financeSummary ? (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-black ${netIsNegative ? "bg-[#6d2938] text-[#ffe2e5]" : "bg-[#0e6267] text-[#d1fffa]"}`}
              >
                {netStatus}
              </span>
            ) : null}
          </div>
          {financeError ? (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-[#e69ca5]/50 bg-[#4b2636]/45 p-3 text-sm text-[#ffe2e5]"
            >
              <p>
                {accountDenied
                  ? text.accessUnavailable
                  : text.financeUnavailable}
              </p>
              {!accountDenied ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void query.refetch()}
                  className="mt-3 border-[#f2bbc2] bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <RefreshCw className="me-1 h-3.5 w-3.5" />
                  {text.retryFinance}
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <MetricValue
                value={
                  financeSummary
                    ? `${displayAmount(financeSummary.netProfit)} SAR`
                    : null
                }
                testId="net-profit"
              />
              <p className="mt-2 text-xs leading-5 text-[#c4efef]">
                {text.cashBasis}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-[#58a7aa]/50 pt-3 text-sm">
                <div>
                  <dt className="text-xs font-bold text-[#b3dddd]">
                    {text.collected}
                  </dt>
                  <dd
                    className="mt-1 font-black tabular-nums text-white"
                    dir="ltr"
                  >
                    <bdi>
                      {financeSummary
                        ? `${displayAmount(financeSummary.totalCollected)} SAR`
                        : "—"}
                    </bdi>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-[#b3dddd]">
                    {text.costs}
                  </dt>
                  <dd
                    className="mt-1 font-black tabular-nums text-white"
                    dir="ltr"
                  >
                    <bdi>
                      {financeSummary
                        ? `${displayAmount(financeSummary.totalCosts)} SAR`
                        : "—"}
                    </bdi>
                  </dd>
                </div>
              </dl>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={scrollToLedger}
            disabled={canViewAssigned !== true}
            className="mt-4 min-h-10 w-full rounded-xl border-[#7bd6d0] bg-transparent font-black text-white hover:bg-white/10 hover:text-white"
          >
            <ScrollText className="me-2 h-4 w-4" />
            {text.openLedger}
          </Button>
        </div>
      </div>
    </section>
  );
}
