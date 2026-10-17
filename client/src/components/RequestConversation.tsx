import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Download, FileText, ImageIcon, Loader2, MessageCircle, Paperclip, Send, X } from "lucide-react";
import { useRef, useState } from "react";
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

export function RequestConversation({ requestId, isEnglish, mode, accessToken }: { requestId: number; isEnglish: boolean; mode: "customer" | "team"; accessToken?: string }) {
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const customerInput = { accessToken: accessToken || "placeholder-token-000000000", requestId };
  const customerConversation = trpc.conversation.customerList.useQuery(customerInput, { enabled: mode === "customer" && Boolean(accessToken), refetchInterval: 20_000, refetchIntervalInBackground: false });
  const teamConversation = trpc.conversation.teamList.useQuery({ requestId }, { enabled: mode === "team", refetchInterval: 20_000, refetchIntervalInBackground: false });
  const refresh = async () => {
    setMessage("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (mode === "customer") await utils.conversation.customerList.invalidate(customerInput);
    else await utils.conversation.teamList.invalidate({ requestId });
  };
  const customerSend = trpc.conversation.customerSend.useMutation({ onSuccess: async () => { toast.success(isEnglish ? "Message sent." : "تم إرسال الرسالة."); await refresh(); }, onError: (error) => toast.error(error.message) });
  const teamSend = trpc.conversation.teamSend.useMutation({ onSuccess: async () => { toast.success(isEnglish ? "Message sent." : "تم إرسال الرسالة."); await refresh(); }, onError: (error) => toast.error(error.message) });
  const customerUpload = trpc.conversation.customerUpload.useMutation({ onSuccess: async () => { toast.success(isEnglish ? "Attachment sent securely." : "تم إرسال المرفق بأمان."); await refresh(); }, onError: (error) => toast.error(error.message) });
  const teamUpload = trpc.conversation.teamUpload.useMutation({ onSuccess: async () => { toast.success(isEnglish ? "Attachment sent securely." : "تم إرسال المرفق بأمان."); await refresh(); }, onError: (error) => toast.error(error.message) });
  const items = mode === "customer" ? customerConversation.data : teamConversation.data;
  const loading = mode === "customer" ? customerConversation.isLoading : teamConversation.isLoading;
  const pending = customerSend.isPending || teamSend.isPending || customerUpload.isPending || teamUpload.isPending;

  const chooseFile = (selected: File | null) => {
    if (!selected) return setFile(null);
    if (!acceptedTypes.includes(selected.type)) return toast.error(isEnglish ? "Unsupported file type." : "نوع الملف غير مدعوم.");
    if (selected.size > MAX_FILE_BYTES) return toast.error(isEnglish ? "Maximum file size is 8 MB." : "الحد الأقصى لحجم الملف 8 ميجابايت.");
    setFile(selected);
  };
  const send = async () => {
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (isEnglish ? "Could not read the file." : "تعذرت قراءة الملف."));
    }
  };

  return <section className="mt-5 rounded-2xl border border-[#cde3fa] bg-white p-4"><div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-[#0878f9]" /><h3 className="font-display font-extrabold text-[#17334f]">{isEnglish ? "Request conversation" : "محادثة الطلب"}</h3><Badge variant="outline" className="mr-auto rounded-full border-[#cde3fa] text-[#0878f9]">{items?.length ?? 0}</Badge></div><p className="mt-1 text-xs leading-6 text-[#60778f]">{isEnglish ? "Private messages and secure attachments between the customer and selected provider." : "رسائل ومرفقات خاصة بين العميل ومقدم الخدمة المختار."}</p><div className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-xl bg-[#f7fbff] p-3">{loading ? <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-[#0878f9]" /> : items?.length ? items.map((item) => { const own = mode === "customer" ? item.senderType === "customer" : item.senderType === "employee" || item.senderType === "agent"; return <div key={item.id} className={`flex ${own ? "justify-end" : "justify-start"}`}><div className={`max-w-[90%] rounded-2xl px-4 py-3 ${own ? "bg-[#0878f9] text-white" : "border border-[#dce8f6] bg-white text-[#17334f]"}`}><div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-black">{item.senderName || (item.senderType === "customer" ? (isEnglish ? "Customer" : "العميل") : item.senderType === "system" ? (isEnglish ? "System" : "النظام") : (isEnglish ? "Provider" : "مقدم الخدمة"))}</span>{item.status ? <Badge className={own ? "bg-white/20 text-white" : "bg-[#eaf3ff] text-[#0878f9]"}>{item.status}</Badge> : null}</div><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.message}</p>{item.attachments?.length ? <div className="mt-3 grid gap-2">{item.attachments.map((attachment) => attachment.mimeType.startsWith("image/") ? <a key={attachment.id} href={attachment.fileUrl} target="_blank" rel="noreferrer" className={`overflow-hidden rounded-xl border ${own ? "border-white/25 bg-white/10" : "border-[#dce8f6] bg-[#f7fbff]"}`}><img src={attachment.fileUrl} alt={attachment.fileName} className="max-h-48 w-full object-cover" /><span className="flex items-center gap-2 px-3 py-2 text-xs font-bold"><ImageIcon className="h-4 w-4" />{attachment.fileName}<Download className="mr-auto h-4 w-4" /></span></a> : <a key={attachment.id} href={attachment.fileUrl} target="_blank" rel="noreferrer" className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold ${own ? "border-white/25 bg-white/10" : "border-[#dce8f6] bg-[#f7fbff]"}`}><FileText className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{attachment.fileName}</span><Download className="h-4 w-4" /></a>)}</div> : null}<time className={`mt-2 block text-[10px] ${own ? "text-white/75" : "text-[#7b91a8]"}`}>{new Date(item.createdAt).toLocaleString(isEnglish ? "en-US" : "ar-SA")}</time></div></div>; }) : <p className="py-6 text-center text-xs text-[#70859b]">{isEnglish ? "No messages yet." : "لا توجد رسائل بعد."}</p>}</div><Textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} placeholder={isEnglish ? "Write a message about the request…" : "اكتب رسالة حول حالة إنجاز الطلب…"} className="mt-3 min-h-20 rounded-xl" />{file ? <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#b7dbff] bg-[#f0f8ff] p-3 text-xs font-bold text-[#31516e]"><Paperclip className="h-4 w-4 text-[#0878f9]" /><span className="min-w-0 flex-1 truncate">{file.name}</span><button type="button" onClick={() => chooseFile(null)} aria-label={isEnglish ? "Remove attachment" : "إزالة المرفق"}><X className="h-4 w-4" /></button></div> : null}<input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} /><div className="mt-2 grid grid-cols-[auto_1fr] gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => fileInputRef.current?.click()} className="h-10 rounded-xl border-[#b7dbff] text-[#0878f9]" aria-label={isEnglish ? "Attach file" : "إرفاق ملف"}><Paperclip className="h-4 w-4" /><span className="hidden sm:inline">{isEnglish ? "Attach" : "إرفاق"}</span></Button><Button type="button" disabled={pending || (!file && message.trim().length < 2)} onClick={() => void send()} className="h-10 rounded-xl bg-[#0878f9] font-extrabold text-white">{pending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Send className="ml-2 h-4 w-4" />}{isEnglish ? "Send" : "إرسال"}</Button></div><p className="mt-2 text-[10px] text-[#7b91a8]">{isEnglish ? "Images, PDF, Word or Excel · up to 8 MB" : "صور أو PDF أو Word أو Excel · حتى 8 ميجابايت"}</p></section>;
}
