import { BrandMark } from "@/components/BrandMark";
import { JoinSupportWhatsAppButton } from "@/components/JoinSupportWhatsApp";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { agentAccessCopy } from "@/lib/agentAccessCopy";
import { openAuthModal } from "@/lib/authFlow";
import {
  useRedirectSignedInVisitor,
  useSignedInWorkspace,
} from "@/lib/signedInWorkspace";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  ShieldCheck,
  Smartphone,
  UserRoundCheck,
} from "lucide-react";
import React, { useEffect, useRef } from "react";
import { Link } from "wouter";

const JOIN_CARD_ICONS = [FileText, ShieldCheck, UserRoundCheck] as const;

/**
 * Direct visits to /agent-login use the exact same flow and wording as the
 * "دخول المعقبين" pop-up: the page opens that window automatically, and its
 * copy comes from the shared agentAccessCopy so both stay identical. Behind the
 * window, the page explains the join request for new agents.
 */
export default function AgentLogin() {
  const { isEnglish } = useLanguage();
  const signedIn = useRedirectSignedInVisitor(isEnglish);
  const { loading } = useSignedInWorkspace();
  const copy = agentAccessCopy(isEnglish);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    // Wait for the session check so a signed-in visitor is redirected instead.
    // The timer lets the app-level AuthModal attach its listener first.
    if (loading || signedIn || autoOpenedRef.current) return;
    const timer = window.setTimeout(() => {
      autoOpenedRef.current = true;
      openAuthModal({ intent: "signin", audience: "agent", trigger: ctaRef.current });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, signedIn]);

  if (signedIn) return null;

  const openSignIn = () =>
    openAuthModal({ intent: "signin", audience: "agent", trigger: ctaRef.current });
  const Chevron = isEnglish ? ChevronRight : ChevronLeft;

  return (
    <main
      className="public-flat min-h-screen overflow-x-hidden bg-[#f5f9ff] text-[#102a43]"
      dir={isEnglish ? "ltr" : "rtl"}
    >
      <PublicHeader
        onChooseService={action =>
          window.location.assign(action === "طلب خدمة" ? "/#request" : "/track")
        }
      />

      <section
        className="app-grid relative overflow-hidden bg-[#eef7ff] py-12 sm:py-16"
        aria-labelledby="agent-login-title"
      >
        <div
          className="blue-orb absolute -right-32 -top-36 h-[30rem] w-[30rem]"
          aria-hidden="true"
        />
        <div className="container relative grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#cce2fb] bg-white px-4 py-2 text-xs font-extrabold text-[#0878f9] shadow-sm">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {copy.kicker}
            </span>
            <h1
              id="agent-login-title"
              className="font-display mt-5 text-4xl font-extrabold leading-[1.3] tracking-[-0.04em] sm:text-5xl"
            >
              {copy.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[#59718b] sm:text-lg">
              {copy.lead}
            </p>
            <ol
              aria-label={copy.stepsLabel}
              className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-2"
            >
              {copy.steps.map((step, index) => (
                <li
                  key={step.label}
                  className="soft-card flex min-w-0 items-start gap-3 p-4 text-start"
                >
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eaf3ff] text-sm font-black text-[#075aa8]"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display font-extrabold text-[#102a43]">
                      {step.label}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#60778f]">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="min-w-0 rounded-[1.75rem] border border-[#d5e6f7] bg-white p-5 shadow-[0_24px_70px_rgba(27,79,129,.12)] sm:p-7">
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark isEnglish={isEnglish} className="h-11 w-11 shrink-0 rounded-2xl" />
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#60778f]">{copy.brand}</p>
                <h2 className="mt-1 font-display text-lg font-black leading-7 text-[#102a43] sm:text-xl">
                  {copy.title}
                </h2>
              </div>
            </div>
            <h3 className="mt-6 flex items-center gap-2 font-display text-xl font-black">
              <Smartphone className="h-5 w-5 text-[#0878f9]" aria-hidden="true" />
              {copy.phoneHeading}
            </h3>
            <p
              data-agent-join-note
              className="mt-3 flex items-start gap-2 rounded-xl border border-[#d7e8fa] bg-[#f5faff] px-3 py-2 text-xs font-bold leading-6 text-[#31516e]"
            >
              <FileText className="mt-1 h-4 w-4 shrink-0 text-[#0878f9]" aria-hidden="true" />
              {copy.joinNote}
            </p>
            <button
              ref={ctaRef}
              type="button"
              onClick={openSignIn}
              data-auth-trigger="agent"
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0668d9] px-4 text-sm font-extrabold text-white transition-[transform,background-color] duration-150 hover:bg-[#0457ba] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9] focus-visible:ring-offset-2 active:scale-[0.97]"
            >
              {copy.cta}
              <Chevron className="h-4 w-4" aria-hidden="true" />
            </button>
            <p className="mt-2 text-center text-xs leading-6 text-[#60778f]">{copy.ctaHint}</p>
            <p className="mt-4 rounded-xl bg-[#f4f9ff] px-3 py-2 text-xs leading-6 text-[#536e88]">
              {copy.demo}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-16" aria-labelledby="agent-join-request-title">
        <div className="container">
          <span className="section-kicker">{copy.joinKicker}</span>
          <h2
            id="agent-join-request-title"
            className="font-display mt-3 text-3xl font-extrabold leading-[1.35] tracking-[-0.03em] sm:text-4xl"
          >
            {copy.joinTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-8 text-[#59718b]">{copy.joinIntro}</p>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {copy.joinCards.map((card, index) => {
              const Icon = JOIN_CARD_ICONS[index] ?? FileText;
              return (
                <li key={card.title} className="soft-card min-w-0 p-5 text-start">
                  <span
                    aria-hidden="true"
                    className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0878f9]"
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-extrabold text-[#102a43]">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-[#60778f]">{card.text}</p>
                </li>
              );
            })}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/join-as-agent"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#cfe3fa] bg-white px-5 text-sm font-bold text-[#075aa8] transition-colors hover:border-[#0878f9] hover:bg-[#f1f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]"
            >
              {copy.joinLink}
              <ArrowLeft className={`h-4 w-4 ${isEnglish ? "rotate-180" : ""}`} aria-hidden="true" />
            </Link>
            <JoinSupportWhatsAppButton />
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
