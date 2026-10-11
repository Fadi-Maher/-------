import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Review = { rating: number; reviewText: string | null; providerName: string; createdAt: Date | string } | null;

export function RequestReviewPanel({ requestId, status, review, accessToken, isEnglish, mode = "customer" }: { requestId: number; status: string; review: Review; accessToken?: string; isEnglish: boolean; mode?: "customer" | "readonly" }) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const utils = trpc.useUtils();
  const submit = trpc.reviews.submit.useMutation({ onSuccess: async () => { toast.success(isEnglish ? "Thank you. Your review was saved." : "شكرًا لك، تم حفظ تقييمك."); await utils.requests.trackByPhoneVerified.invalidate(); }, onError: (error) => toast.error(error.message) });
  if (status !== "completed" && !review) return null;
  if (review) return <section className="mt-5 rounded-2xl border border-[#d8edcf] bg-[#fbfff9] p-4"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-black text-[#275c2a]">{isEnglish ? "Service review" : "تقييم الخدمة"}</span><span className="flex" aria-label={`${review.rating} / 5`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} className={`h-4 w-4 ${index < review.rating ? "fill-[#f4b740] text-[#f4b740]" : "text-[#cbd6df]"}`} />)}</span></div><p className="mt-2 text-xs font-bold text-[#60778f]">{isEnglish ? `Provider: ${review.providerName}` : `مقدم الخدمة: ${review.providerName}`}</p>{review.reviewText ? <p className="mt-3 rounded-xl bg-white p-3 text-sm leading-7 text-[#405d78]">{review.reviewText}</p> : null}</section>;
  if (mode === "readonly" || !accessToken) return null;
  return <section className="mt-5 rounded-2xl border border-[#f1d79a] bg-[#fffaf0] p-4"><div className="flex items-center gap-2"><Star className="h-5 w-5 text-[#d69716]" /><h3 className="font-display font-extrabold text-[#17334f]">{isEnglish ? "Rate the completed service" : "قيّم الخدمة المكتملة"}</h3></div><p className="mt-1 text-xs leading-6 text-[#806b3f]">{isEnglish ? "Your review is linked to this completed request and can only be submitted once." : "يرتبط تقييمك بهذا الطلب المكتمل ويمكن إرساله مرة واحدة فقط."}</p><div className="mt-3 flex gap-1" dir="ltr">{Array.from({ length: 5 }, (_, index) => { const value = index + 1; return <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} / 5`} className="rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]"><Star className={`h-7 w-7 transition-colors ${value <= rating ? "fill-[#f4b740] text-[#f4b740]" : "text-[#c7d2dc]"}`} /></button>; })}</div><Textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} maxLength={1200} placeholder={isEnglish ? "Optional: write a short review" : "اختياري: اكتب مراجعة مختصرة"} className="mt-3 min-h-20 rounded-xl bg-white" /><Button type="button" disabled={rating < 1 || submit.isPending} onClick={() => submit.mutate({ accessToken, requestId, rating, reviewText: reviewText.trim() || undefined })} className="mt-3 h-10 w-full rounded-xl bg-[#0878f9] font-extrabold text-white">{submit.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Star className="ml-2 h-4 w-4" />}{isEnglish ? "Submit review" : "إرسال التقييم"}</Button></section>;
}
