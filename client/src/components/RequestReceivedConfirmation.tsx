import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { ClipboardCheck, Inbox, PhoneCall, Scale, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Confirmation shown after a request form is submitted.
 * "received": saved directly on the live site; the team contacts the visitor by phone.
 * "saved": saved to a signed-in/verified customer's requests (development and customer sessions).
 *
 * Motion (see index.css → .request-confirm*): a rare, celebratory feedback moment, so a short
 * delight sequence is justified — card rise, badge pop, check stroke draw, one ring pulse and
 * six sparks, then a 50ms text stagger. Transform/opacity only (plus the SVG stroke draw).
 * Reduced motion keeps only a gentle fade. Remount with a new `key` to replay on each submission.
 */
type Mode = "received" | "saved";
type Step = { icon: LucideIcon; label: string; done: boolean };
type Copy = { title: string; body: (phone: ReactNode) => ReactNode; steps: Step[]; done: string; next: string };

const COPY: Record<"ar" | "en", Record<Mode, Copy>> = {
  ar: {
    received: {
      title: "تم استلام طلبك بنجاح",
      body: (phone) => <>سنتواصل معك على الجوال {phone}</>,
      steps: [
        { icon: Inbox, label: "وصل طلبك إلى فريقنا", done: true },
        { icon: PhoneCall, label: "نتواصل معك على جوالك", done: false },
      ],
      done: "تم",
      next: "التالي",
    },
    saved: {
      title: "تم حفظ طلبك",
      body: (phone) => <>تابعه برقم الجوال {phone}. عند توفر عروض الأسعار يمكنك مقارنة السعر ومدة الإنجاز.</>,
      steps: [
        { icon: ClipboardCheck, label: "حُفظ في طلباتك", done: true },
        { icon: Scale, label: "قارن العروض عند توفرها", done: false },
      ],
      done: "تم",
      next: "التالي",
    },
  },
  en: {
    received: {
      title: "Your request was received",
      body: (phone) => <>We will contact you on {phone}</>,
      steps: [
        { icon: Inbox, label: "Received by our team", done: true },
        { icon: PhoneCall, label: "We contact you by mobile", done: false },
      ],
      done: "Done",
      next: "Next",
    },
    saved: {
      title: "Your request has been saved",
      body: (phone) => <>Track it with mobile number {phone}. When quotes are available, you can compare price and turnaround time.</>,
      steps: [
        { icon: ClipboardCheck, label: "Saved to your requests", done: true },
        { icon: Scale, label: "Compare quotes when ready", done: false },
      ],
      done: "Done",
      next: "Next",
    },
  },
};

// Each spark carries its own direction, so no parent variable drives child transforms.
const SPARKS: Array<{ x: number; y: number; color: string }> = [
  { x: 0, y: -34, color: "#17a765" },
  { x: 29, y: -17, color: "#0878f9" },
  { x: 29, y: 17, color: "#ffb020" },
  { x: 0, y: 34, color: "#17a765" },
  { x: -29, y: 17, color: "#0878f9" },
  { x: -29, y: -17, color: "#ffb020" },
];

const lineStyle = (index: number) => ({ "--line-index": index } as CSSProperties);

export function RequestReceivedConfirmation({ isEnglish, mode, phone }: { isEnglish: boolean; mode: Mode; phone: string }) {
  const copy = COPY[isEnglish ? "en" : "ar"][mode];
  const ref = useRef<HTMLDivElement>(null);

  // On small screens the confirmation can land below the fold after the form resets.
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof node.scrollIntoView !== "function") return;
    const rect = node.getBoundingClientRect();
    if (rect.top >= 0 && rect.bottom <= window.innerHeight) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, []);

  const phoneChip = (
    <strong dir="ltr" className="inline-block rounded-md bg-white px-1.5 py-0.5 font-extrabold text-[#0963bd] ring-1 ring-[#cfe3f7]">
      {phone}
    </strong>
  );

  return (
    <div
      ref={ref}
      role="status"
      data-testid="request-confirmation"
      // scroll-mb keeps the card clear of the floating assistant/support buttons when scrolled into view.
      className="request-confirm relative mt-5 scroll-mb-28 overflow-hidden rounded-2xl border border-[#bfe6d0] bg-[linear-gradient(135deg,#f0fbf5_0%,#eef7ff_100%)] p-4 sm:scroll-mb-8 sm:p-5"
    >
      <span aria-hidden="true" className="pointer-events-none absolute -end-10 -top-12 h-32 w-32 rounded-full bg-[#17a765]/[0.07]" />
      <div className="relative flex items-start gap-4">
        <span aria-hidden="true" className="request-confirm-badge relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#17a765] text-white shadow-[0_8px_18px_rgba(23,167,101,.28)]">
          <span className="request-confirm-ring absolute inset-0 rounded-full border-2 border-[#17a765]" />
          {SPARKS.map((spark, index) => (
            <span
              key={index}
              className="request-confirm-spark"
              style={{ "--spark-x": `${spark.x}px`, "--spark-y": `${spark.y}px`, background: spark.color } as CSSProperties}
            />
          ))}
          <svg viewBox="0 0 24 24" className="relative h-6 w-6" fill="none">
            <path className="request-confirm-check" d="M5 12.5l4.2 4.2L19 7" pathLength={1} stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1 text-start">
          <p className="request-confirm-line font-display text-base font-extrabold tracking-[-0.03em] text-[#0e5f3a] sm:text-lg" style={lineStyle(0)}>
            {copy.title}
          </p>
          <p className="request-confirm-line mt-1 text-sm leading-7 text-[#31516e]" style={lineStyle(1)}>
            {copy.body(phoneChip)}
          </p>
          <ol className="mt-3 flex flex-wrap gap-2">
            {copy.steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.label}
                  className={cn(
                    "request-confirm-line inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
                    step.done ? "bg-[#ddf4e7] text-[#11804a]" : "border border-[#d3e3f3] bg-white text-[#476580]"
                  )}
                  style={lineStyle(2 + index)}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">{step.done ? copy.done : copy.next}: </span>
                  {step.label}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
