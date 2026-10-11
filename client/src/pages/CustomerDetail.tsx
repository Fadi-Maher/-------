import DashboardLayout from "@/components/DashboardLayout";
import { DataExportButtons } from "@/components/DataExportButtons";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ChevronLeft, Clock3, FileText, Loader2, Mail, Phone, UserRound } from "lucide-react";
import { useRoute } from "wouter";

const statusLabels = { received: "تم الاستلام", in_review: "قيد المراجعة", in_progress: "قيد التنفيذ", completed: "مكتمل" } as const;
const customerDetailExportColumns = [
  { key: "trackingPhone", label: "جوال التتبع" },
  { key: "category", label: "الخدمة" },
  { key: "status", label: "الحالة" },
  { key: "details", label: "التفاصيل" },
  { key: "updates", label: "عدد التحديثات" },
  { key: "lastUpdate", label: "آخر تحديث" },
] as const;

export default function CustomerDetail() {
  const [, params] = useRoute("/customers/:id");
  const customerId = Number(params?.id || 0);
  const detail = trpc.customers.detail.useQuery({ customerId }, { enabled: customerId > 0 });
  const data = detail.data;
  const trackingPhone = data?.customer.phone || "";

  return (
    <DashboardLayout>
      <main className="space-y-7" dir="rtl">
        <a href="/customers" className="inline-flex items-center gap-2 text-sm font-bold text-[#31516e] transition-colors hover:text-[#0878f9]"><ArrowRight className="h-4 w-4" />العودة إلى العملاء</a>
        {detail.isLoading ? (
          <div className="portal-shadow flex min-h-64 items-center justify-center gap-3 rounded-3xl border border-[#dce8f6] bg-white text-sm text-[#60778f]"><Loader2 className="h-5 w-5 animate-spin text-[#0878f9]" />يتم تحميل سجل العميل…</div>
        ) : !data ? (
          <div className="rounded-3xl border border-dashed border-[#c8daec] bg-white p-10 text-center"><UserRound className="mx-auto h-10 w-10 text-[#0878f9]" /><p className="font-display mt-4 text-xl font-extrabold">لم يتم العثور على العميل</p><p className="mt-2 text-sm text-[#70859b]">قد يكون السجل غير متاح أو تمت إزالته.</p></div>
        ) : (
          <>
            <section className="portal-shadow rounded-3xl border border-[#dce8f6] bg-white p-6 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0878f9]"><UserRound className="h-7 w-7" /></span><div><span className="section-kicker">سجل العميل</span><h1 className="font-display mt-2 text-2xl font-extrabold tracking-[-0.055em] sm:text-3xl">{data.customer.fullName}</h1></div></div>
                <div className="flex flex-wrap items-center gap-2">
                  <DataExportButtons columns={[...customerDetailExportColumns]} rows={data.requests.map((request) => ({ trackingPhone, category: `${request.category}${request.subcategory ? ` — ${request.subcategory}` : ""}`, status: statusLabels[request.status], details: request.details, updates: request.updates.length, lastUpdate: request.updates.at(-1)?.message || "لا يوجد تحديث بعد" }))} title={`سجل العميل: ${data.customer.fullName}`} subtitle="تصدير سجل الطلبات والتحديثات المختصر." filename={`maalamati-customer-${data.customer.id}`} />
                  <span className="rounded-full bg-[#f5faff] px-4 py-2 text-sm font-extrabold text-[#0878f9]">{data.requests.length} طلب</span>
                </div>
              </div>
              <div className="mt-7 grid gap-4 border-t border-[#e7eff8] pt-6 sm:grid-cols-2">
                {data.customer.email && <div className="flex items-center gap-3 rounded-2xl bg-[#f7fbff] p-4"><Mail className="h-5 w-5 text-[#0878f9]" /><div><p className="text-xs font-bold text-[#70859b]">البريد الإلكتروني</p><p className="mt-1 text-sm font-extrabold">{data.customer.email}</p></div></div>}
                {trackingPhone && <div className="flex items-center gap-3 rounded-2xl bg-[#f7fbff] p-4"><Phone className="h-5 w-5 text-[#0878f9]" /><div><p className="text-xs font-bold text-[#70859b]">رقم التواصل والتتبع</p><p className="mt-1 text-sm font-extrabold" dir="ltr">{trackingPhone}</p></div></div>}
              </div>
            </section>

            <section className="rounded-3xl border border-[#dce8f6] bg-white p-6 sm:p-8">
              <div><span className="section-kicker">سجل الطلبات</span><h2 className="font-display mt-3 text-2xl font-extrabold tracking-[-0.055em]">كل طلبات العميل</h2></div>
              {data.requests.length ? (
                <div className="mt-7 space-y-5">
                  {data.requests.map((request) => (
                    <article key={request.id} className="rounded-2xl border border-[#e1edf9] bg-[#fbfdff] p-5">
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div><p className="text-xs font-extrabold text-[#0878f9]">التتبع برقم الجوال <span dir="ltr">{trackingPhone || "غير متاح"}</span></p><h3 className="mt-2 text-base font-extrabold">{request.category}{request.subcategory ? ` — ${request.subcategory}` : ""}</h3><p className="mt-2 max-w-2xl text-sm leading-7 text-[#60778f]">{request.details}</p></div>
                        <div className="flex items-center gap-3"><span className="rounded-full bg-[#eaf3ff] px-3 py-1.5 text-xs font-bold text-[#0878f9]">{statusLabels[request.status]}</span><a href={trackingPhone ? `/track?phone=${encodeURIComponent(trackingPhone)}` : "/track"} className="grid h-9 w-9 place-items-center rounded-xl border border-[#c8daec] text-[#0878f9] transition-colors hover:bg-[#eaf3ff]" aria-label={`فتح التتبع برقم الجوال ${trackingPhone}`}><ChevronLeft className="h-4 w-4" /></a></div>
                      </div>
                      <div className="mt-5 border-t border-[#e7eff8] pt-4"><div className="flex items-center gap-2 text-xs font-extrabold text-[#60778f]"><Clock3 className="h-4 w-4 text-[#0878f9]" />التحديثات ({request.updates.length})</div>{request.updates.length ? <div className="mt-4 space-y-3">{request.updates.map((update) => <div key={update.id} className="border-r-2 border-[#b6dbfb] pr-3"><p className="whitespace-pre-wrap text-sm leading-7 text-[#405d78]">{update.message}</p>{update.attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{update.attachments.map((attachment) => <a key={attachment.id} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-bold text-[#0878f9]"><FileText className="h-3.5 w-3.5" />{attachment.fileName}</a>)}</div>}</div>)}</div> : <p className="mt-3 text-sm text-[#70859b]">لا توجد تحديثات لهذا الطلب بعد.</p>}</div>
                    </article>
                  ))}
                </div>
              ) : <p className="mt-6 rounded-2xl bg-[#f5faff] p-5 text-sm leading-7 text-[#60778f]">لا توجد طلبات مرتبطة بهذا العميل بعد.</p>}
            </section>
          </>
        )}
      </main>
    </DashboardLayout>
  );
}
