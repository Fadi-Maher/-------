import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Download, FileText, ImageIcon, Loader2, LockKeyhole, MessageCircle, Paperclip, Send, UserRoundCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isConversationClosed, isOwnConversationMessage, matchesConversationFilter, type ConversationFilter } from "@shared/conversation";
import { toast } from "sonner";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const acceptedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
export const conversationPrivacyDescription = "محادثة خاصة بين العميل ومقدم الخدمة المختار";

async function fileToBase64(file: File) {
  const result = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذر قراءة الملف."));
    reader.readAsDataURL(file);
  });
  return result.split(",")[1] || "";
}

export function RequestConversation({ requestId, isEnglish, mode, accessToken, status }: { requestId: number; isEnglish: boolean; mode: "customer" | "team"; accessToken?: string; status?: string }) {
  const closed = isConversationClosed(status);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  useEffect(() => { setArchiveOpen(false); setMessage(""); setFile(null); setFilter("all"); }, [closed, requestId]);
  const customerInput = { accessToken: accessToken || "placeholder-token-000000000", requestId };
  const visible = !closed || archiveOpen;
  const customerConversation = trpc.conversation.customerList.useQuery(customerInput, { enabled: mode === "customer" && Boolean(accessToken) && visible, refetchInterval: closed ? false : 20_000, refetchIntervalInBackground: false });
  const teamConversation = trpc.conversation.teamList.useQuery({ requestId }, { enabled: mode === "team" && visible, refetchInterval: closed ? false : 20_000, refetchIntervalInBackground: false });
  const refresh = async () => {
    setMessage(""); setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (mode === "customer") await utils.conversation.customerList.invalidate(customerInput);
    else await utils.conversation.teamList.invalidate({ requestId });
  };
  const customerSend = trpc.conversation.customerSend.useMutation({ onSuccess: async () => { toast.success(isEnglish ? "Message sent." : "تم إرسال الرسالة."); await refresh(); }, onError: (error) => toast.error(error.message) });
  const teamSend = trpc.conversation.teamSend.useMutation({ onSuccess: async () => { toast.success(isEnglish ? "Message sent." : "تم إرسال الرسالة."); await refresh(); }, onError: (error) => toast.error(error.message) });
  const customerUpload = trpc.conversation.customerUpload.useMutation({ onSuccess: async () => { toast.success(isEnglish ? "Attachment sent securely." : "تم إرسال المرفق بأمان."); await refresh(); }, onError: (error) => toast.error(error.message) });
  const teamUpload = trpc.conversation.teamUpload.useMutation({ onSuccess: async () => { toast.success(isEnglish ? "Attachment sent securely." : "تم إرسال المرفق بأمان."); await refresh(); }, onError: (error) => toast.error(error.message) });
  const query = mode === "customer" ? customerConversation : teamConversation;
  const items = query.data ?? [];
  const filtered = items.filter(item => matchesConversationFilter(item.senderType, mode, filter));
  const pending = customerSend.isPending || teamSend.isPending || customerUpload.isPending || teamUpload.isPending;
  const tabs: Array<{ id: ConversationFilter; label: string }> = [
    { id: "all", label: isEnglish ? "All" : "الكل" },
    { id: "incoming", label: isEnglish ? "Incoming" : "الوارد" },
    { id: "outgoing", label: isEnglish ? "Outgoing" : "الصادر" },
  ];

  const chooseFile = (selected: File | null) => {
    if (closed) return;
    if (!selected) return setFile(null);
    if (!acceptedTypes.includes(selected.type)) return toast.error(isEnglish ? "Unsupported file type." : "نوع الملف غير مدعوم.");
    if (selected.size > MAX_FILE_BYTES) return toast.error(isEnglish ? "Maximum file size is 8 MB." : "الحد الأقصى لحجم الملف 8 ميجابايت.");
    setFile(selected);
  };
  const send = async () => {
    if (closed || pending) return;
    const value = message.trim();
    if (!file && value.length < 2) return;
    if (!file) {
      if (mode === "customer") customerSend.mutate({ ...customerInput, message: value });
      else teamSend.mutate({ requestId, message: value });
      return;
    }
    try {
      const payload = { requestId, message: value || undefined, fileName: file.name, mimeType: file.type, dataBase64: await fileToBase64(file) };
      if (mode === "customer") customerUpload.mutate({ ...payload, accessToken: customerInput.accessToken });
      else teamUpload.mutate(payload);
    } catch (error) { toast.error(error instanceof Error ? error.message : (isEnglish ? "Could not read the file." : "تعذرت قراءة الملف.")); }
  };

  const archiveLabel = isEnglish ? "Provider · completed conversation archive" : "المعقب · سجل محادثة الطلب المكتمل";
  if (closed && !archiveOpen) return <div className="mt-3" dir={isEnglish ? "ltr" : "rtl"}><button type="button" onClick={() => setArchiveOpen(true)} aria-label={archiveLabel} title={archiveLabel} aria-expanded={false} className="grid h-11 w-11 place-items-center rounded-full bg-[#eef5fb] text-[#60778f] ring-1 ring-[#dce8f6] transition-colors hover:bg-[#eaf3ff] hover:text-[#0878f9] focus-visible:outline-2 focus-visible:outline-[#0878f9]"><UserRoundCheck className="h-5 w-5" /></button></div>;

  return <section className="mt-4 rounded-xl border border-[#dce8f6] bg-white p-3 sm:p-4" dir={isEnglish ? "ltr" : "rtl"} aria-label={isEnglish ? "Private request messages" : "رسائل الطلب الخاصة"}>
    <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-[#0878f9]" /><h3 className="text-sm font-extrabold text-[#17334f]">{isEnglish ? "Request conversation" : "محادثة الطلب"}</h3><Badge variant="outline" className="ms-auto rounded-full border-[#dce8f6] text-[#60778f]">{items.length}</Badge>{closed ? <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setArchiveOpen(false)} aria-label={isEnglish ? "Collapse archive" : "تصغير سجل المحادثة"}><X className="h-4 w-4" /></Button> : null}</div>
    <p className="mt-1 text-[11px] leading-5 text-[#70859b]">{closed ? (isEnglish ? "Completed request: read-only archive. Messaging is closed." : "طلب مكتمل: السجل للقراءة فقط، والمراسلة مغلقة.") : (isEnglish ? "Private messages and secure attachments between the customer and selected provider." : "رسائل ومرفقات خاصة بين العميل ومقدم الخدمة المختار.")}</p>
    <div role="tablist" aria-label={isEnglish ? "Message filters" : "تصفية الرسائل"} className="mt-3 flex gap-1 rounded-lg bg-[#f3f7fb] p-1">{tabs.map(tab => <button key={tab.id} role="tab" type="button" aria-selected={filter === tab.id} onClick={() => setFilter(tab.id)} className={`min-h-9 min-w-0 flex-1 rounded-md px-2 text-xs font-bold ${filter === tab.id ? "bg-white text-[#0878f9] shadow-sm" : "text-[#70859b]"}`}>{tab.label}<span className="ms-1 text-[10px]">{items.filter(item => matchesConversationFilter(item.senderType, mode, tab.id)).length}</span></button>)}</div>
    <div role="tabpanel" className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-lg bg-[#f8fbff] p-2">
      {query.isLoading ? <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-[#0878f9]" /> : query.isError ? <p role="alert" className="p-3 text-xs text-[#a9323f]">{isEnglish ? "Could not load messages. Please try again." : "تعذر تحميل الرسائل. حاول مرة أخرى."}<button onClick={() => void query.refetch()} className="ms-2 underline">{isEnglish ? "Retry" : "إعادة المحاولة"}</button></p> : filtered.length ? filtered.map(item => {
        const own = isOwnConversationMessage(item.senderType, mode);
        return <div key={item.id} className={`flex ${own ? "justify-end" : "justify-start"}`}><div className={`max-w-[90%] rounded-xl px-3 py-2 ${own ? "bg-[#eaf3ff] text-[#17334f]" : "border border-[#e5edf5] bg-white text-[#17334f]"}`}>
          <div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black text-[#60778f]">{item.senderName || (item.senderType === "customer" ? (isEnglish ? "Customer" : "العميل") : item.senderType === "system" ? (isEnglish ? "System" : "النظام") : (isEnglish ? "Provider" : "المعقب"))}</span>{item.status ? <Badge className="bg-[#edf5fc] text-[10px] text-[#60778f]">{item.status}</Badge> : null}</div>
          <p className="mt-1 break-words whitespace-pre-wrap text-xs leading-6">{item.message}</p>
          {item.attachments?.length ? <div className="mt-2 grid gap-2">{item.attachments.map(attachment => attachment.mimeType.startsWith("image/") ? <a key={attachment.id} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-[#dce8f6] bg-white"><img src={attachment.fileUrl} alt={attachment.fileName} className="max-h-36 w-full object-contain" /><span className="flex items-center gap-2 px-2 py-2 text-[11px] font-bold"><ImageIcon className="h-3.5 w-3.5" />{attachment.fileName}<Download className="ms-auto h-3.5 w-3.5" /></span></a> : <a key={attachment.id} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-[#dce8f6] bg-white p-2 text-[11px] font-bold"><FileText className="h-3.5 w-3.5" /><span className="min-w-0 flex-1 truncate">{attachment.fileName}</span><Download className="h-3.5 w-3.5" /></a>)}</div> : null}
          <time className="mt-1 block text-[9px] text-[#8a9bad]">{new Date(item.createdAt).toLocaleString(isEnglish ? "en-US" : "ar-SA")}</time>
        </div></div>;
      }) : <p className="py-5 text-center text-xs text-[#70859b]">{isEnglish ? "No messages in this section." : "لا توجد رسائل في هذا القسم."}</p>}
    </div>
    {closed ? <p className="mt-3 flex items-center gap-1 text-[11px] text-[#70859b]"><LockKeyhole className="h-3.5 w-3.5" />{isEnglish ? "Messaging closed after completion" : "أُغلقت المراسلة بعد اكتمال الطلب"}</p> : <>
      <Textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={2000} placeholder={isEnglish ? "Write a message about the request…" : mode === "team" ? "اكتب رسالة للعميل…" : "اكتب رسالة للمعقب…"} aria-label={isEnglish ? "Message" : "نص الرسالة"} className="mt-3 min-h-16 rounded-lg text-xs" disabled={pending} />
      {file ? <div className="mt-2 flex items-center gap-2 rounded-lg bg-[#f0f8ff] p-2 text-xs text-[#31516e]"><Paperclip className="h-3.5 w-3.5" /><span className="min-w-0 flex-1 truncate">{file.name}</span><button type="button" onClick={() => chooseFile(null)} aria-label={isEnglish ? "Remove attachment" : "إزالة المرفق"}><X className="h-4 w-4" /></button></div> : null}
      <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx" onChange={event => chooseFile(event.target.files?.[0] ?? null)} />
      <div className="mt-2 flex items-center justify-end gap-2"><span className="me-auto text-[10px] text-[#8a9bad]">{isEnglish ? "Up to 8 MB" : "حتى 8 ميجابايت"}</span><Button type="button" variant="outline" disabled={pending} onClick={() => fileInputRef.current?.click()} className="h-9 rounded-lg border-[#dce8f6] px-3 text-[#60778f]" aria-label={isEnglish ? "Attach file" : "إرفاق ملف"}><Paperclip className="h-4 w-4" /></Button><Button type="button" disabled={pending || (!file && message.trim().length < 2)} onClick={() => void send()} className="h-9 rounded-lg bg-[#0878f9] px-4 text-xs font-extrabold text-white">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{isEnglish ? "Send" : "إرسال"}</Button></div>
    </>}
  </section>;
}
