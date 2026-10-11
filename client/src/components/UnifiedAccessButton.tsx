import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { BadgeCheck, UserRound } from "lucide-react";

export function UnifiedAccessButton({ compact = false }: { compact?: boolean }) {
  const { isEnglish } = useLanguage();
  const copy = isEnglish
    ? { trigger: "Sign in", title: "How would you like to continue?", customer: "Service requester", agent: "Transaction specialist" }
    : { trigger: "الدخول", title: "كيف تريد المتابعة؟", customer: "طالب خدمة", agent: "معقب" };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={compact ? "grid h-10 w-10 place-items-center rounded-xl bg-[#eaf3ff] text-[#0878f9]" : "inline-flex items-center gap-2 rounded-xl border border-[#b7dbff] bg-[#f7fbff] px-3.5 py-2.5 text-sm font-extrabold text-[#0878f9] shadow-[0_4px_12px_rgba(8,120,249,.08)] transition-colors hover:border-[#0878f9] hover:bg-[#eef7ff]"} aria-label={copy.trigger}>
          {compact ? <UserRound className="h-4 w-4" /> : <>{copy.trigger}<UserRound className="h-4 w-4" /></>}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-[2rem] border-[#dce8f6] p-6 sm:p-8" dir={isEnglish ? "ltr" : "rtl"}>
        <DialogHeader className={isEnglish ? "text-left" : "text-right"}>
          <DialogTitle className="font-display text-2xl font-black text-[#102a43]">{copy.title}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Button asChild className="h-auto min-h-20 justify-start rounded-2xl bg-[#0878f9] p-5 text-start text-white hover:bg-[#0668d9]"><a href="/customer-signup"><span className="flex items-center gap-3"><UserRound className="h-7 w-7 shrink-0" /><strong className="font-display block text-xl font-black sm:text-2xl">{copy.customer}</strong></span></a></Button>
          <Button asChild variant="outline" className="h-auto min-h-20 justify-start rounded-2xl border-[#b7dbff] bg-[#f5faff] p-5 text-start text-[#17334f] hover:bg-[#eaf3ff]"><a href="/agent-login"><span className="flex items-center gap-3"><BadgeCheck className="h-7 w-7 shrink-0 text-[#0878f9]" /><strong className="font-display block text-xl font-black sm:text-2xl">{copy.agent}</strong></span></a></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
