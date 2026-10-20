import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, Smartphone, UserRound, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { CustomerAuthForm, normalizeSaudiPhone } from "@/components/CustomerAuthForm";
import { AgentAuthForm } from "@/components/AgentAuthForm";
import { useLanguage } from "@/contexts/LanguageContext";
import { AUTH_COMPLETED_EVENT, AUTH_MODAL_OPEN_EVENT, openAuthModal, type AuthModalRequest } from "@/lib/authFlow";

type Phase = "phone" | "role" | "verify";

export function AuthModal() {
  const { isEnglish } = useLanguage();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("phone");
  const [audience, setAudience] = useState<"customer" | "agent" | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
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
      // Legacy entry hints remain compatible, but never skip the shared phone-first step.
      setPhase("phone");
      setAudience(null);
      setPhoneInput("");
      setPhone("");
      setPhoneError("");
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
      openAuthModal({ intent: "signin", trigger: anchor });
    };
    window.addEventListener(AUTH_MODAL_OPEN_EVENT, onOpen);
    window.addEventListener(AUTH_COMPLETED_EVENT, onComplete);
    document.addEventListener("click", onAuthLink, true);
    return () => {
      window.removeEventListener(AUTH_MODAL_OPEN_EVENT, onOpen);
      window.removeEventListener(AUTH_COMPLETED_EVENT, onComplete);
      document.removeEventListener("click", onAuthLink, true);
    };
  }, [updateBusy]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const selector = phase === "role" ? "[data-account-choice='customer']" : "input:not([disabled])";
      contentRef.current?.querySelector<HTMLElement>(selector)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, phase, audience, generation]);

  const changePhone = useCallback(() => {
    if (busyRef.current) return;
    setPhase("phone");
    setAudience(null);
    setPhoneError("");
    setGeneration(value => value + 1);
  }, []);
  const changeRole = () => {
    if (busyRef.current) return;
    setPhase("role");
    setAudience(null);
    setGeneration(value => value + 1);
  };
  const chooseRole = (role: "customer" | "agent") => {
    if (busyRef.current || !phone) return;
    setAudience(role);
    setPhase("verify");
  };
  const close = () => { if (!busyRef.current) setOpen(false); };
  const title = phase === "phone" ? (isEnglish ? "Continue with your mobile" : "الدخول برقم الجوال") : phase === "role" ? (isEnglish ? "Choose your account type" : "اختر نوع حسابك") : audience === "agent" ? (isEnglish ? "Agent sign in" : "دخول المعقب") : (isEnglish ? "Customer sign in" : "دخول العميل");
  const stepIndex = phase === "phone" ? 0 : phase === "role" ? 1 : 2;

  return (
    <Dialog open={open} onOpenChange={value => { if (value || !busyRef.current) setOpen(value); }}>
      <DialogContent ref={contentRef} overlayClassName="z-[105] motion-reduce:animate-none" showCloseButton={false} className="z-[110] max-h-[90dvh] w-[calc(100vw-1.5rem)] overflow-y-auto rounded-[1.75rem] border-[#dce8f6] bg-white p-5 text-[#102a43] motion-reduce:animate-none sm:max-w-[510px] sm:p-7" dir={isEnglish ? "ltr" : "rtl"}
        onInteractOutside={event => event.preventDefault()}
        onEscapeKeyDown={event => { if (busyRef.current) event.preventDefault(); }}
        onOpenAutoFocus={event => { event.preventDefault(); contentRef.current?.querySelector<HTMLInputElement>("input:not([disabled])")?.focus(); }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          if (completedRef.current) return;
          if (openerRef.current?.isConnected) { openerRef.current.focus(); return; }
          Array.from(document.querySelectorAll<HTMLElement>("[data-auth-trigger='signin']")).find(element => element.getClientRects().length > 0)?.focus();
        }}>
        <DialogHeader className="text-start sm:text-start">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark isEnglish={isEnglish} className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="min-w-0"><p className="text-xs font-extrabold text-[#60778f]">{isEnglish ? "Maalamati Care" : "معاملاتي كير"}</p><DialogTitle className="mt-1 font-display text-lg font-black leading-7 text-[#102a43] sm:text-xl">{title}</DialogTitle></div>
            </div>
            <button type="button" disabled={busy} onClick={close} aria-label={isEnglish ? "Close sign in" : "إغلاق نافذة الدخول"} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#e1ebf6] text-[#60778f] hover:bg-[#f1f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] disabled:opacity-40"><X className="h-5 w-5" aria-hidden="true" /></button>
          </div>
          <DialogDescription className="sr-only">{isEnglish ? "Enter your mobile, choose Customer or Agent, then verify to continue." : "أدخل رقم الجوال، واختر عميلًا أو معقبًا، ثم أكمل التحقق للدخول."}</DialogDescription>
        </DialogHeader>
        <ol aria-label={isEnglish ? "Account access steps" : "خطوات الدخول"} className="grid grid-cols-3 gap-2 rounded-xl bg-[#f4f9ff] p-2">
          {(isEnglish ? ["Mobile", "Account type", "Continue"] : ["الجوال", "نوع الحساب", "إتمام الدخول"]).map((label, index) => <li key={label} aria-current={index === stepIndex ? "step" : undefined} className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-1 py-2 text-center text-[11px] font-bold ${index === stepIndex ? "bg-white text-[#075aa8] shadow-sm" : "text-[#60778f]"}`}><span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current">{index + 1}</span><span>{label}</span></li>)}
        </ol>
        {phase === "phone" ? (
          <form noValidate onSubmit={event => {
            event.preventDefault();
            if (busyRef.current) return;
            const normalized = normalizeSaudiPhone(phoneInput);
            if (!normalized) { setPhoneError(isEnglish ? "Enter a valid Saudi mobile number." : "أدخل رقم جوال سعودي صحيحًا."); return; }
            setPhone(normalized);
            setPhoneInput(normalized);
            setPhoneError("");
            setPhase("role");
          }} className="space-y-5">
            <div><h2 className="flex items-center gap-2 font-display text-xl font-black"><Smartphone className="h-5 w-5 text-[#0878f9]" aria-hidden="true" />{isEnglish ? "Enter your mobile number" : "أدخل رقم جوالك"}</h2><p id={`${fieldId}-intro`} className="mt-2 text-sm leading-7 text-[#60778f]">{isEnglish ? "One entry for existing and new accounts. Choose Customer or Agent after entering your number." : "مدخل واحد للحساب الموجود أو الجديد. بعد رقم الجوال، اختر عميلًا أو معقبًا."}</p></div>
            <div><label htmlFor={`${fieldId}-phone`} className="block text-sm font-bold text-[#17334f]">{isEnglish ? "Mobile number" : "رقم الجوال"}</label><Input id={`${fieldId}-phone`} type="tel" required autoComplete="tel" inputMode="tel" dir="ltr" value={phoneInput} aria-invalid={Boolean(phoneError)} aria-describedby={phoneError ? `${fieldId}-error` : undefined} onChange={event => { setPhoneInput(event.target.value); setPhoneError(""); }} placeholder="05X XXX XXXX" className="mt-2 h-12 rounded-xl border-[#c8daec] bg-[#fbfdff] text-left" /></div>
            {phoneError && <p id={`${fieldId}-error`} role="alert" className="rounded-xl bg-[#fff1f3] px-3 py-2 text-xs font-bold leading-6 text-[#a9323f]">{phoneError}</p>}
            <Button type="submit" className="h-12 w-full rounded-xl bg-[#0878f9] font-extrabold text-white hover:bg-[#0668d9]">{isEnglish ? "Continue" : "متابعة"}{isEnglish ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}</Button>
          </form>
        ) : phase === "role" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dce8f6] bg-[#f8fbff] px-3 py-2"><p className="text-sm font-bold text-[#31516e]">{isEnglish ? "Your number" : "رقم جوالك"}: <bdi dir="ltr">{phone}</bdi></p><button type="button" onClick={changePhone} className="min-h-11 rounded-lg px-2 text-xs font-extrabold text-[#075aa8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]">{isEnglish ? "Change mobile number" : "تغيير رقم الجوال"}</button></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" data-account-choice="customer" onClick={() => chooseRole("customer")} className="flex min-h-28 items-center gap-3 rounded-2xl bg-[#0668d9] p-4 text-start text-white transition-colors hover:bg-[#0457ba] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] focus-visible:ring-offset-2"><UserRound className="h-7 w-7 shrink-0" aria-hidden="true" /><span><strong className="block text-lg">{isEnglish ? "Customer" : "عميل"}</strong><span className="mt-1 block text-xs leading-5">{isEnglish ? "Request services and follow your requests" : "طلب الخدمات ومتابعة طلباتك"}</span></span></button>
              <button type="button" data-account-choice="agent" onClick={() => chooseRole("agent")} className="flex min-h-28 items-center gap-3 rounded-2xl border border-[#b7dbff] bg-[#f5faff] p-4 text-start text-[#17334f] transition-colors hover:bg-[#eaf3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] focus-visible:ring-offset-2"><BadgeCheck className="h-7 w-7 shrink-0 text-[#0878f9]" aria-hidden="true" /><span><strong className="block text-lg">{isEnglish ? "Agent" : "معقب"}</strong><span className="mt-1 block text-xs leading-5">{isEnglish ? "Manage requests assigned to you" : "إدارة الطلبات المسندة إليك"}</span></span></button>
            </div>
            <p className="text-xs leading-6 text-[#60778f]">{isEnglish ? "Selecting Agent does not create an agent account. Agent access requires an account activated by the owner." : "اختيار معقب لا ينشئ حساب معقب؛ الدخول يتطلب حسابًا مفعّلًا من المالك."}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <button type="button" disabled={busy} onClick={changeRole} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-bold text-[#075aa8] hover:bg-[#f1f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] disabled:opacity-40">{isEnglish ? <ChevronLeft className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}{isEnglish ? "Change account type" : "تغيير نوع الحساب"}</button>
            {audience === "customer" ? <CustomerAuthForm key={`customer-${generation}`} mode="signin" variant="modal" initialPhone={phone} onChangePhone={changePhone} onBusyChange={updateBusy} /> : <AgentAuthForm key={`agent-${generation}`} variant="modal" initialPhone={phone} onChangePhone={changePhone} onBusyChange={updateBusy} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
