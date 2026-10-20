import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, UserRound, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrandMark } from "@/components/BrandMark";
import { CustomerAuthForm } from "@/components/CustomerAuthForm";
import { AgentAuthForm } from "@/components/AgentAuthForm";
import { useLanguage } from "@/contexts/LanguageContext";
import { AUTH_COMPLETED_EVENT, AUTH_MODAL_OPEN_EVENT, openAuthModal, type AuthAudience, type AuthIntent, type AuthModalRequest } from "@/lib/authFlow";

export function AuthModal() {
  const { isEnglish } = useLanguage();
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<AuthAudience>("choose");
  const [intent, setIntent] = useState<AuthIntent>("signin");
  const [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState(0);
  const busyRef = useRef(false);
  const completedRef = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const updateBusy = useCallback((value: boolean) => { busyRef.current = value; setBusy(value); }, []);

  useEffect(() => {
    const onOpen = (event: Event) => {
      if (busyRef.current) return;
      const request = (event as CustomEvent<AuthModalRequest>).detail;
      if (!request || !["signin", "signup"].includes(request.intent)) return;
      if (request.audience && !["choose", "customer", "agent"].includes(request.audience)) return;
      openerRef.current = request.trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      completedRef.current = false;
      setIntent(request.intent);
      setAudience(request.audience ?? (request.intent === "signup" ? "customer" : "choose"));
      setGeneration(value => value + 1);
      setOpen(true);
    };
    const onComplete = () => { completedRef.current = true; setOpen(false); updateBusy(false); };
    const onAuthLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const target = new URL(anchor.href, window.location.origin);
      if (target.origin !== window.location.origin || !["/login", "/customer-signup", "/agent-login"].includes(target.pathname)) return;
      event.preventDefault();
      const nextIntent: AuthIntent = target.pathname === "/customer-signup" ? "signup" : "signin";
      openAuthModal({ intent: nextIntent, audience: target.pathname === "/agent-login" ? "agent" : target.pathname === "/customer-signup" ? "customer" : "choose", trigger: anchor });
    };
    window.addEventListener(AUTH_MODAL_OPEN_EVENT, onOpen);
    window.addEventListener(AUTH_COMPLETED_EVENT, onComplete);
    document.addEventListener("click", onAuthLink, true);
    return () => { window.removeEventListener(AUTH_MODAL_OPEN_EVENT, onOpen); window.removeEventListener(AUTH_COMPLETED_EVENT, onComplete); document.removeEventListener("click", onAuthLink, true); };
  }, [updateBusy]);

  useEffect(() => {
    if (!open || audience === "choose") return;
    const frame = requestAnimationFrame(() => contentRef.current?.querySelector<HTMLInputElement>("input:not([disabled])")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, audience, intent, generation]);

  const title = audience === "choose" ? (isEnglish ? "How would you like to continue?" : "كيف تريد المتابعة؟") : audience === "agent" ? (isEnglish ? "Agent sign in" : "دخول المعقب") : intent === "signup" ? (isEnglish ? "Create a customer account" : "إنشاء حساب العميل") : (isEnglish ? "Customer sign in" : "دخول العميل");
  const close = () => { if (!busyRef.current) setOpen(false); };
  const switchIntent = () => { if (!busyRef.current) { setIntent(intent === "signin" ? "signup" : "signin"); setAudience("customer"); setGeneration(value => value + 1); } };

  return (
    <Dialog open={open} onOpenChange={value => { if (value || !busyRef.current) setOpen(value); }}>
      <DialogContent ref={contentRef} overlayClassName="z-[105] motion-reduce:animate-none" showCloseButton={false} aria-describedby={undefined} className="z-[110] max-h-[90dvh] w-[calc(100vw-1.5rem)] overflow-y-auto rounded-[1.75rem] border-[#dce8f6] bg-white p-5 text-[#102a43] motion-reduce:animate-none sm:max-w-[510px] sm:p-7" dir={isEnglish ? "ltr" : "rtl"}
        onInteractOutside={event => event.preventDefault()}
        onEscapeKeyDown={event => { if (busyRef.current) event.preventDefault(); }}
        onOpenAutoFocus={event => { event.preventDefault(); const focus = contentRef.current?.querySelector<HTMLElement>("[data-account-choice='customer'], input:not([disabled])"); focus?.focus(); }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          if (completedRef.current) return;
          if (openerRef.current?.isConnected) { openerRef.current.focus(); return; }
          const fallback = Array.from(document.querySelectorAll<HTMLElement>("[data-auth-trigger='signin']")).find(element => element.getClientRects().length > 0);
          fallback?.focus();
        }}>
        <DialogHeader className="text-start sm:text-start">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3"><BrandMark isEnglish={isEnglish} className="h-10 w-10 shrink-0 rounded-xl" /><div className="min-w-0"><p className="text-xs font-extrabold text-[#60778f]">{isEnglish ? "Maalamati Care" : "معاملاتي كير"}</p><DialogTitle className="mt-1 font-display text-lg font-black leading-7 text-[#102a43] sm:text-xl">{title}</DialogTitle></div></div>
            <button type="button" disabled={busy} onClick={close} aria-label={isEnglish ? "Close sign in" : "إغلاق نافذة الدخول"} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#e1ebf6] text-[#60778f] hover:bg-[#f1f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] disabled:opacity-40"><X className="h-5 w-5" aria-hidden="true" /></button>
          </div>
        </DialogHeader>
        {audience === "choose" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" data-account-choice="customer" onClick={() => setAudience("customer")} className="flex min-h-24 items-center gap-3 rounded-2xl bg-[#0668d9] p-4 text-start font-extrabold text-white transition-colors hover:bg-[#0457ba] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] focus-visible:ring-offset-2"><UserRound className="h-7 w-7 shrink-0" aria-hidden="true" /><span className="text-lg">{isEnglish ? "Service requester" : "طالب خدمة"}</span></button>
            <button type="button" data-account-choice="agent" onClick={() => setAudience("agent")} className="flex min-h-24 items-center gap-3 rounded-2xl border border-[#b7dbff] bg-[#f5faff] p-4 text-start font-extrabold text-[#17334f] transition-colors hover:bg-[#eaf3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] focus-visible:ring-offset-2"><BadgeCheck className="h-7 w-7 shrink-0 text-[#0878f9]" aria-hidden="true" /><span className="text-lg">{isEnglish ? "Transaction specialist" : "معقب"}</span></button>
          </div>
        ) : (
          <div className="space-y-4">
            <button type="button" disabled={busy} onClick={() => { setAudience("choose"); setIntent("signin"); }} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-bold text-[#075aa8] hover:bg-[#f1f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] disabled:opacity-40">{isEnglish ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}{isEnglish ? "Change account type" : "تغيير نوع الحساب"}</button>
            {audience === "customer" ? <CustomerAuthForm key={`customer-${generation}-${intent}`} mode={intent} variant="modal" onBusyChange={updateBusy} /> : <AgentAuthForm key={`agent-${generation}`} variant="modal" onBusyChange={updateBusy} />}
          </div>
        )}
        {audience !== "agent" && <div className="border-t border-[#edf3fb] pt-3 text-center text-sm text-[#60778f]"><span>{intent === "signup" ? (isEnglish ? "Already have an account?" : "لديك حساب بالفعل؟") : (isEnglish ? "New to Maalamati Care?" : "جديد في معاملاتي كير؟")}</span><button type="button" disabled={busy} onClick={switchIntent} className="ms-1 min-h-11 rounded-lg px-2 font-extrabold text-[#075aa8] hover:bg-[#f1f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] disabled:opacity-40">{intent === "signup" ? (isEnglish ? "Sign in" : "تسجيل الدخول") : (isEnglish ? "Create account" : "إنشاء حساب")}</button></div>}
      </DialogContent>
    </Dialog>
  );
}
