import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { History, RefreshCw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

const actionLabels: Record<string, string> = { employee_status_update: "تحديث موظف", agent_status_update: "تحديث حالة معقب", agent_customer_update: "رد معقب للعميل", quote_submitted: "تقديم عرض سعر", quote_updated: "تعديل عرض سعر", quote_accepted: "اعتماد العميل للعرض" };
const statusLabels: Record<string, string> = { received: "تم الاستلام", in_review: "قيد المراجعة", in_progress: "قيد التنفيذ", completed: "مكتمل" };

function auditStatus(value: string | null) {
  if (!value) return "—";
  try {
    const snapshot = JSON.parse(value) as { status?: string; priceAmount?: string; durationDays?: number; providerName?: string };
    if (snapshot.priceAmount && snapshot.durationDays) return `${snapshot.priceAmount} ر.س · ${snapshot.durationDays} يوم`;
    if (snapshot.providerName) return snapshot.providerName;
    return snapshot.status ? statusLabels[snapshot.status] ?? snapshot.status : "—";
  } catch {
    return "—";
  }
}

export default function AuditDashboard() {
  const [requestText, setRequestText] = useState("");
  const [action, setAction] = useState("all");
  const [actor, setActor] = useState("all");
  const staff = trpc.staffAccounts.list.useQuery();
  const requestId = Number(requestText) > 0 ? Number(requestText) : undefined;
  const actorUserId = actor !== "all" ? Number(actor) : undefined;
  const auditInput = useMemo(() => ({ requestId, actorUserId, action: action === "all" ? undefined : action, limit: 150 }), [requestId, actorUserId, action]);
  const logs = trpc.audit.list.useQuery(auditInput);

  return <DashboardLayout><main className="mx-auto max-w-6xl" dir="rtl"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="section-kicker">الحوكمة</p><h1 className="font-display mt-4 text-3xl font-black text-[#102a43] sm:text-4xl">سجل تدقيق الطلبات</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[#60778f]">سجل دائم يوضح من غيّر الطلب، ومتى حدث التغيير، وما الحالة قبل التحديث وبعده.</p></div><Button variant="outline" className="rounded-xl border-[#b7dbff] bg-white text-[#0878f9]" onClick={() => logs.refetch()}><RefreshCw className="ml-2 h-4 w-4" />تحديث</Button></div><section className="mt-6 grid gap-3 rounded-3xl border border-[#dce8f6] bg-white p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]"><Input value={requestText} onChange={(event) => setRequestText(event.target.value.replace(/\D/g, ""))} placeholder="رقم الطلب الداخلي" className="h-11 rounded-xl border-[#c8daec]" /><Select value={actor} onValueChange={setActor}><SelectTrigger className="h-11 rounded-xl border-[#c8daec]"><SelectValue placeholder="كل أعضاء الفريق" /></SelectTrigger><SelectContent><SelectItem value="all">كل أعضاء الفريق</SelectItem>{staff.data?.filter((member) => member.userId).map((member) => <SelectItem key={member.id} value={String(member.userId)}>{member.fullName} · {member.role === "agent" ? "معقب" : "موظف"}</SelectItem>)}</SelectContent></Select><Select value={action} onValueChange={setAction}><SelectTrigger className="h-11 rounded-xl border-[#c8daec]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الإجراءات</SelectItem><SelectItem value="employee_status_update">تحديثات الموظفين</SelectItem><SelectItem value="agent_status_update">حالات المعقبين</SelectItem><SelectItem value="agent_customer_update">ردود المعقبين</SelectItem><SelectItem value="quote_submitted">عروض جديدة</SelectItem><SelectItem value="quote_updated">تعديلات العروض</SelectItem><SelectItem value="quote_accepted">عروض معتمدة</SelectItem></SelectContent></Select><Button variant="outline" className="h-11 rounded-xl" onClick={() => { setRequestText(""); setActor("all"); setAction("all"); }}>مسح الفلاتر</Button></section><section className="mt-6 space-y-3">{logs.data?.length ? logs.data.map((log) => <article key={log.id} className="rounded-2xl border border-[#dce8f6] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf3ff] text-[#0878f9]"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="font-bold text-[#17334f]">{log.actorName || "حساب فريق"} · {actionLabels[log.action] || log.action}</h2><p className="mt-1 text-xs text-[#60778f]">الدور: {log.actorRole} · الطلب: {log.requestId ?? "غير مرتبط"}</p></div></div><time className="text-xs font-bold text-[#60778f]">{new Date(log.createdAt).toLocaleString("ar-SA")}</time></div><p className="mt-4 rounded-xl bg-[#f7fbff] p-3 text-sm text-[#405d78]">{log.summary}</p><div className="mt-3 grid gap-2 text-xs font-bold text-[#60778f] sm:grid-cols-2"><span className="rounded-xl border border-[#e1edf9] p-3">قبل التغيير: {auditStatus(log.beforeJson)}</span><span className="rounded-xl border border-[#d8edcf] bg-[#fbfff9] p-3">بعد التغيير: {auditStatus(log.afterJson)}</span></div></article>) : <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-[#b7dbff] bg-white text-center"><div><History className="mx-auto h-10 w-10 text-[#87bff4]" /><h2 className="font-display mt-4 text-lg font-black">لا توجد سجلات مطابقة</h2><p className="mt-2 text-sm text-[#70859b]">ستظهر هنا تغييرات الموظفين والمعقبين على الطلبات.</p></div></div>}</section></main></DashboardLayout>;
}
