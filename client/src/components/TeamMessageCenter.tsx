import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ArrowDownLeft, ArrowUpRight, Loader2, LockKeyhole, MessageCircle } from "lucide-react";
import { useState } from "react";
import { matchesConversationFilter, type ConversationFilter } from "@shared/conversation";

export function TeamMessageCenter({ isEnglish, onOpenRequest }: { isEnglish: boolean; onOpenRequest: (id: number) => void }) {
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const query = trpc.conversation.teamInbox.useQuery(undefined, { refetchInterval: 20_000, refetchIntervalInBackground: false });
  const items = query.data ?? [];
  const visible = items.filter(item => matchesConversationFilter(item.senderType, "team", filter));
  return <section className="rounded-2xl border border-[#dce8f6] bg-white p-4 sm:p-5" dir={isEnglish ? "ltr" : "rtl"}>
    <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-[#0878f9]" /><h2 className="text-sm font-black text-[#17334f]">{isEnglish ? "Customer messages" : "رسائل العملاء"}</h2><span className="ms-auto text-[11px] text-[#70859b]">{isEnglish ? "Latest 200 messages" : "آخر 200 رسالة"}</span></div>
    <div role="tablist" aria-label={isEnglish ? "Message direction" : "اتجاه الرسائل"} className="mt-3 flex gap-1 rounded-xl bg-[#f4f8fc] p-1">{(["all", "incoming", "outgoing"] as const).map(id => <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)} className={`min-h-10 flex-1 rounded-lg px-2 text-xs font-bold ${filter === id ? "bg-white text-[#0878f9] shadow-sm" : "text-[#70859b]"}`}>{id === "all" ? (isEnglish ? "All" : "الكل") : id === "incoming" ? (isEnglish ? "Incoming" : "الوارد") : (isEnglish ? "Outgoing" : "الصادر")}<span className="ms-1 text-[10px]">{items.filter(item => matchesConversationFilter(item.senderType, "team", id)).length}</span></button>)}</div>
    <div role="tabpanel" className="mt-3 max-h-[400px] space-y-2 overflow-y-auto">{query.isLoading ? <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-[#0878f9]" /> : query.isError ? <div className="py-6 text-center"><p role="alert" className="text-xs text-red-700">{isEnglish ? "Could not load messages" : "تعذر تحميل الرسائل"}</p><Button size="sm" variant="ghost" onClick={() => void query.refetch()}>{isEnglish ? "Retry" : "إعادة المحاولة"}</Button></div> : visible.length ? visible.map(item => <button key={item.id} onClick={() => onOpenRequest(item.requestId)} className="flex w-full items-start gap-3 rounded-xl bg-[#f8fbff] p-3 text-start transition-colors hover:bg-[#eaf3ff]">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${item.senderType === "customer" ? "bg-[#edf8f1] text-[#238457]" : "bg-[#eaf3ff] text-[#0878f9]"}`}>{item.senderType === "customer" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span>
      <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-xs font-extrabold text-[#17334f]">{item.senderName || (isEnglish ? "Customer" : "العميل")}{item.requestStatus === "completed" ? <LockKeyhole className="h-3 w-3 text-[#70859b]" /> : null}</span><span className="mt-1 block truncate text-xs text-[#60778f]">{item.message}</span><span className="mt-1 block text-[10px] text-[#8a9bad]">{item.category} · {isEnglish ? "Request" : "طلب"} {item.requestId} · {new Date(item.createdAt).toLocaleString(isEnglish ? "en-US" : "ar-SA")}</span></span>
    </button>) : <p className="py-8 text-center text-xs text-[#70859b]">{isEnglish ? "No messages in this section." : "لا توجد رسائل في هذا القسم."}</p>}</div>
  </section>;
}
