import * as DialogPrimitive from "@radix-ui/react-dialog";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  browserWelcomeStorage,
  markWelcomeSeen,
  shouldShowWelcome,
} from "@/lib/welcome";
import { openAuthModal } from "@/lib/authFlow";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Globe2,
  MessagesSquare,
  Sparkles,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { useLocation } from "wouter";

function WelcomeExperience({
  isEnglish,
  onContinue,
  onSkip,
  onLanguageChange,
  primaryRef,
  dialog = false,
}: {
  isEnglish: boolean;
  onContinue: () => void;
  onSkip: () => void;
  onLanguageChange: () => void;
  primaryRef?: React.Ref<HTMLButtonElement>;
  dialog?: boolean;
}) {
  const copy = isEnglish
    ? {
        brand: "Maalamati Care",
        eyebrow: "Every step, thoughtfully handled",
        welcome: "Welcome to Maalamati Care",
        title: "Your requests.\nHandled with care.",
        intro:
          "From your first service request to the next update, keep your journey clear and connected.",
        start: "Let's get started",
        skip: "Skip welcome",
        close: "Close welcome",
        signIn: "Sign in",
        language: "التبديل إلى العربية",
        languageButton: "العربية",
        footnote:
          "A short introduction. Your requests are always one step away.",
        features: [
          {
            title: "Request a service",
            body: "Start with what you need.",
            icon: FileText,
          },
          {
            title: "Follow every step",
            body: "Keep requests and updates together.",
            icon: CheckCircle2,
          },
          {
            title: "Stay connected",
            body: "Message your service provider in your request.",
            icon: MessagesSquare,
          },
        ],
      }
    : {
        brand: "معاملاتي كير",
        eyebrow: "اهتمام بكل خطوة",
        welcome: "مرحبًا بك في معاملاتي كير",
        title: "معاملاتك،\nبعناية.",
        intro:
          "من طلب الخدمة إلى آخر تحديث، اجعل رحلة معاملتك واضحة ومترابطة في مكان واحد.",
        start: "لنبدأ",
        skip: "تخطي الترحيب",
        close: "إغلاق الترحيب",
        signIn: "الدخول",
        language: "Switch to English",
        languageButton: "English",
        footnote: "ترحيب مختصر، وطلباتك دائمًا على بُعد خطوة.",
        features: [
          {
            title: "اطلب خدمتك",
            body: "ابدأ بما تحتاجه من خدمات.",
            icon: FileText,
          },
          {
            title: "تابع كل خطوة",
            body: "طلباتك وتحديثاتها في مكان واحد.",
            icon: CheckCircle2,
          },
          {
            title: "ابقَ على تواصل",
            body: "راسل مقدم الخدمة داخل طلبك.",
            icon: MessagesSquare,
          },
        ],
      };
  const heading = dialog ? (
    <DialogTitle className="font-display text-2xl font-black leading-[1.5] tracking-[-.04em] text-[#102a43] sm:text-4xl">
      {copy.welcome}
    </DialogTitle>
  ) : (
    <h1 className="font-display text-2xl font-black leading-[1.5] tracking-[-.04em] text-[#102a43] sm:text-4xl">
      {copy.welcome}
    </h1>
  );
  const description = dialog ? (
    <DialogDescription className="mt-4 max-w-lg text-sm leading-8 text-[#506b85] sm:text-base">
      {copy.intro}
    </DialogDescription>
  ) : (
    <p className="mt-4 max-w-lg text-sm leading-8 text-[#506b85] sm:text-base">
      {copy.intro}
    </p>
  );
  return (
    <div
      className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 py-4 text-[#102a43] sm:px-8 sm:py-6"
      dir={isEnglish ? "ltr" : "rtl"}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark isEnglish={isEnglish} className="h-10 w-10 rounded-xl" />
          <span className="font-display text-base font-black sm:text-xl">
            {copy.brand}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            onClick={onLanguageChange}
            aria-label={copy.language}
            className="min-h-11 rounded-xl px-3 text-xs font-bold text-[#24598b]"
          >
            <Globe2 className="me-1.5 h-4 w-4" />
            {copy.languageButton}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onSkip}
            aria-label={copy.close}
            className="h-11 w-11 rounded-xl text-[#60778f]"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>
      <nav aria-label={isEnglish ? "Account access" : "الدخول والتسجيل"} className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={event => { onSkip(); openAuthModal({ intent: "signin", trigger: event.currentTarget }); }} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0668d9] px-4 text-sm font-extrabold text-white hover:bg-[#0457ba] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] focus-visible:ring-offset-2">{copy.signIn}</button>
      </nav>
      <div className="grid flex-1 content-center gap-6 py-5 sm:gap-10 sm:py-8 lg:grid-cols-[.95fr_1.05fr] lg:items-center lg:gap-14">
        <aside
          className="relative isolate flex flex-col items-center justify-center overflow-hidden rounded-[1.75rem] bg-[#0a2a56] px-6 py-6 text-center text-white shadow-[0_20px_60px_rgba(9,53,105,.16)] sm:px-10 sm:py-12 lg:min-h-[460px]"
          aria-label={
            isEnglish ? "Maalamati Care identity" : "هوية معاملاتي كير"
          }
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -start-24 -top-32 -z-10 h-96 w-96 rounded-full bg-[#0878f9]/30 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -end-28 -z-10 h-80 w-80 rounded-full bg-[#31d7d4]/15 blur-3xl"
          />
          <BrandMark
            isEnglish={isEnglish}
            className="h-24 w-24 rounded-[1.4rem] shadow-[0_12px_40px_rgba(0,0,0,.18)] sm:h-36 sm:w-36 sm:rounded-[2rem]"
          />
          <p className="font-display mt-5 whitespace-pre-line text-3xl font-black leading-[1.35] tracking-[-.04em] sm:mt-8 sm:text-5xl">
            {copy.title}
          </p>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#6fbbed]/25 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-[#abdfff]">
            <Sparkles className="h-3.5 w-3.5 text-[#6ee8e0]" />
            {copy.eyebrow}
          </span>
        </aside>
        <section className="min-w-0 px-1 sm:px-0">
          {heading}
          {description}
          <div className="mt-5 grid gap-3 sm:mt-7 sm:gap-4">
            {copy.features.map(({ title, body, icon: Icon }) => (
              <div key={title} className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#d5e9fb] bg-white text-[#0878f9]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-black text-[#173b5f]">{title}</h2>
                  <p className="mt-0.5 text-xs leading-5 text-[#60778f]">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2 sm:mt-9">
            <Button
              ref={primaryRef}
              type="button"
              onClick={onContinue}
              className="h-12 min-w-40 flex-1 rounded-xl bg-[#0878f9] px-5 text-sm font-black text-white shadow-[0_5px_0_#0457ba] hover:bg-[#0668d9] sm:flex-none"
            >
              {copy.start}
              {isEnglish ? (
                <ArrowRight className="ms-2 h-4 w-4" />
              ) : (
                <ArrowLeft className="ms-2 h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onSkip}
              className="h-12 rounded-xl px-4 text-xs font-bold text-[#506b85]"
            >
              {copy.skip}
            </Button>
          </div>
          <p className="mt-4 text-[11px] leading-6 text-[#73899e]">
            {copy.footnote}
          </p>
        </section>
      </div>
    </div>
  );
}

export function BrandWelcome() {
  const { isEnglish, toggleLanguage } = useLanguage();
  const [open, setOpen] = useState(() =>
    shouldShowWelcome(window.location, browserWelcomeStorage())
  );
  const primary = useRef<HTMLButtonElement>(null);
  const close = () => {
    markWelcomeSeen(browserWelcomeStorage());
    setOpen(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        if (!value) close();
      }}
    >
      <DialogPortal>
        <DialogOverlay className="z-[90] bg-[#e9f2ff]/95 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[100] overflow-y-auto bg-[#f4f9ff] outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:duration-200"
          onOpenAutoFocus={event => {
            event.preventDefault();
            primary.current?.focus();
          }}
          onCloseAutoFocus={event => {
            event.preventDefault();
            document
              .querySelector<HTMLElement>(
                'header a[href="#top"], header a[href="/"]'
              )
              ?.focus();
          }}
        >
          <WelcomeExperience
            isEnglish={isEnglish}
            onContinue={close}
            onSkip={close}
            onLanguageChange={toggleLanguage}
            primaryRef={primary}
            dialog
          />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

export function WelcomePage() {
  const { isEnglish, toggleLanguage } = useLanguage();
  const [, setLocation] = useLocation();
  const close = () => {
    markWelcomeSeen(browserWelcomeStorage());
    setLocation("/");
  };
  return (
    <main className="min-h-[100dvh] bg-[#f4f9ff]">
      <WelcomeExperience
        isEnglish={isEnglish}
        onContinue={close}
        onSkip={close}
        onLanguageChange={toggleLanguage}
      />
    </main>
  );
}
