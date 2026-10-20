import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, RotateCcw, Save, Settings2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { DEFAULT_LEAD_BOT_SETTINGS, formatWorkingHours, isWithinWorkingHours } from "../../../../../server/leadBot/settings";
import { errorText, relativeTime, serviceOptions } from "./labels";
import { EmptyCard } from "./LeadsTab";
import { DAY_LABELS, useSalesLang, type SalesKey } from "./salesI18n";
import type { SettingsInput } from "./types";

const HOURS = Array.from({ length: 25 }, (_, hour) => hour);

const VALIDATION_CODES = ["invalid_hours", "invalid_days", "invalid_whatsapp", "invalid_sla", "invalid_escalation"] as const;
const isValidationCode = (value: string): value is (typeof VALIDATION_CODES)[number] & SalesKey =>
  (VALIDATION_CODES as readonly string[]).includes(value);

function toInput(settings: SettingsInput & { updatedAt?: number; updatedByName?: string | null }): SettingsInput {
  return {
    enabled: settings.enabled,
    aiAssist: settings.aiAssist,
    autoEscalateAfterFallbacks: settings.autoEscalateAfterFallbacks,
    offerHumanToHotLeads: settings.offerHumanToHotLeads,
    workingDays: [...settings.workingDays].sort((a, b) => a - b),
    workStartHour: settings.workStartHour,
    workEndHour: settings.workEndHour,
    responseSlaAr: settings.responseSlaAr,
    responseSlaEn: settings.responseSlaEn,
    whatsappNumber: settings.whatsappNumber,
    services: [...settings.services],
  };
}

const sameSettings = (a: SettingsInput, b: SettingsInput) => JSON.stringify(toInput(a)) === JSON.stringify(toInput(b));

function Row({ title, hint, control, id }: { title: string; hint?: string; control: ReactNode; id: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#eef3f9] py-3 last:border-b-0">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-bold text-[#17334f]">{title}</label>
        {hint ? <p id={`${id}-hint`} className="mt-1 text-xs leading-6 text-[#60778f]">{hint}</p> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function Card({ icon, title, children, description }: { icon: ReactNode; title: string; children: ReactNode; description?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#dce8f6] bg-white p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-[#17334f]">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#eaf4ff] text-[#0878f9]" aria-hidden="true">{icon}</span>
        {title}
      </h3>
      {description ? <p className="mt-2 text-xs leading-6 text-[#60778f]">{description}</p> : null}
      <div className="mt-2">{children}</div>
    </section>
  );
}

const fieldClass = "h-10 rounded-xl border border-[#dce8f6] bg-white px-3 text-sm font-semibold text-[#17334f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0878f9]/40";

export function SettingsTab() {
  const { lang, t } = useSalesLang();
  const utils = trpc.useUtils();
  const settings = trpc.leadBot.staff.getSettings.useQuery();
  const save = trpc.leadBot.staff.saveSettings.useMutation();
  const [draft, setDraft] = useState<SettingsInput | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (settings.data && !draft) setDraft(toInput(settings.data));
  }, [settings.data, draft]);

  const dirty = useMemo(() => Boolean(draft && settings.data && !sameSettings(draft, settings.data)), [draft, settings.data]);
  const localError = useMemo(() => {
    if (!draft) return null;
    if (!draft.workingDays.length) return "invalid_days";
    if (draft.workEndHour <= draft.workStartHour) return "invalid_hours";
    if (!draft.responseSlaAr.trim() || !draft.responseSlaEn.trim()) return "invalid_sla";
    return null;
  }, [draft]);

  if (settings.isLoading || (!draft && settings.data)) {
    return (
      <div className="grid gap-4 lg:grid-cols-2" aria-hidden="true">
        <Skeleton className="bg-[#e6eef8] h-72 rounded-2xl" />
        <Skeleton className="bg-[#e6eef8] h-72 rounded-2xl" />
      </div>
    );
  }
  if (settings.isError || !draft || !settings.data) {
    return <EmptyCard icon={<AlertTriangle className="h-6 w-6" />} title={t("settingsError")} body={errorText(settings.error, t("checkConnection"), lang)} action={<Button type="button" onClick={() => void settings.refetch()} className="rounded-xl bg-[#0878f9]">{t("retry")}</Button>} />;
  }

  const patch = (value: Partial<SettingsInput>) => {
    setSavedNotice(false);
    setDraft((current) => (current ? { ...current, ...value } : current));
  };
  const toggleDay = (day: number) => patch({ workingDays: draft.workingDays.includes(day) ? draft.workingDays.filter((value) => value !== day) : [...draft.workingDays, day].sort((a, b) => a - b) });
  const toggleService = (id: SettingsInput["services"][number]) => patch({ services: draft.services.includes(id) ? draft.services.filter((value) => value !== id) : [...draft.services, id] });
  const openNow = isWithinWorkingHours(draft);

  const submit = async () => {
    if (localError) {
      toast.error(t(localError));
      return;
    }
    try {
      const saved = await save.mutateAsync(toInput(draft));
      utils.leadBot.staff.getSettings.setData(undefined, saved);
      void utils.leadBot.visitor.config.invalidate();
      setDraft(toInput(saved));
      setSavedNotice(true);
      toast.success(t("settingsSaved"));
    } catch (error) {
      const message = (error as { message?: string } | null)?.message ?? "";
      toast.error(isValidationCode(message) ? t(message) : errorText(error, t("settingsSaveFailed"), lang));
    }
  };

  return (
    <form
      className="space-y-4 pb-24"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card icon={<Settings2 className="h-4 w-4" />} title={t("behaviorTitle")}>
          <Row id="lb-enabled" title={t("enabledTitle")} hint={t("enabledHint")} control={<Switch id="lb-enabled" checked={draft.enabled} onCheckedChange={(enabled) => patch({ enabled })} aria-describedby="lb-enabled-hint" />} />
          <Row id="lb-ai" title={t("aiTitle")} hint={t("aiHint")} control={<Switch id="lb-ai" checked={draft.aiAssist} onCheckedChange={(aiAssist) => patch({ aiAssist })} aria-describedby="lb-ai-hint" />} />
          <Row id="lb-hot" title={t("hotTitle")} hint={t("hotHint")} control={<Switch id="lb-hot" checked={draft.offerHumanToHotLeads} onCheckedChange={(offerHumanToHotLeads) => patch({ offerHumanToHotLeads })} aria-describedby="lb-hot-hint" />} />
          <Row
            id="lb-escalate"
            title={t("escalateTitle")}
            hint={t("escalateHint")}
            control={
              <select id="lb-escalate" className={fieldClass} value={draft.autoEscalateAfterFallbacks} onChange={(event) => patch({ autoEscalateAfterFallbacks: Number(event.target.value) })} aria-describedby="lb-escalate-hint">
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>{value === 1 ? t("timesOne") : t("timesMany", { count: value })}</option>
                ))}
              </select>
            }
          />
        </Card>

        <Card
          icon={<Clock3 className="h-4 w-4" />}
          title={t("hoursTitle")}
          description={
            <>
              {t("hoursDescription", { hours: formatWorkingHours(draft, lang) })}{" "}
              <span className={cn("font-bold", openNow ? "text-emerald-700" : "text-amber-700")}>{openNow ? t("openNow") : t("closedNow")}</span>
            </>
          }
        >
          <fieldset className="py-2">
            <legend className="text-sm font-bold text-[#17334f]">{t("workingDays")}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {DAY_LABELS[lang].map((label, day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  aria-pressed={draft.workingDays.includes(day)}
                  className={cn("lb-press rounded-full border px-3 py-1.5 text-xs font-bold", draft.workingDays.includes(day) ? "border-[#0878f9] bg-[#0878f9] text-white" : "border-[#dce8f6] bg-white text-[#17334f]")}
                >
                  {label}
                </button>
              ))}
            </div>
            {!draft.workingDays.length ? <p className="mt-2 text-xs font-bold text-red-700" role="alert">{t("invalid_days")}</p> : null}
          </fieldset>
          <div className="grid grid-cols-2 gap-3 py-2">
            <label className="text-sm font-bold text-[#17334f]">
              {t("fromHour")}
              <select className={cn(fieldClass, "mt-1 w-full")} value={draft.workStartHour} onChange={(event) => patch({ workStartHour: Number(event.target.value) })}>
                {HOURS.slice(0, 24).map((hour) => (
                  <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold text-[#17334f]">
              {t("toHour")}
              <select className={cn(fieldClass, "mt-1 w-full")} value={draft.workEndHour} onChange={(event) => patch({ workEndHour: Number(event.target.value) })}>
                {HOURS.slice(1).map((hour) => (
                  <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>
                ))}
              </select>
            </label>
          </div>
          {draft.workEndHour <= draft.workStartHour ? <p className="text-xs font-bold text-red-700" role="alert">{t("invalid_hours")}</p> : null}
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <label className="text-sm font-bold text-[#17334f]">
              {t("slaArLabel")}
              <Input className="mt-1 h-10 rounded-xl border-[#dce8f6]" dir="rtl" lang="ar" value={draft.responseSlaAr} maxLength={80} onChange={(event) => patch({ responseSlaAr: event.target.value })} />
            </label>
            <label className="text-sm font-bold text-[#17334f]">
              {t("slaEnLabel")}
              <Input className="mt-1 h-10 rounded-xl border-[#dce8f6]" dir="ltr" lang="en" value={draft.responseSlaEn} maxLength={80} onChange={(event) => patch({ responseSlaEn: event.target.value })} />
            </label>
          </div>
          <label className="block py-2 text-sm font-bold text-[#17334f]">
            {t("whatsappLabel")}
            <Input className="mt-1 h-10 rounded-xl border-[#dce8f6]" dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" value={draft.whatsappNumber} maxLength={24} onChange={(event) => patch({ whatsappNumber: event.target.value })} aria-describedby="lb-wa-hint" />
            <span id="lb-wa-hint" className="mt-1 block text-xs font-normal text-[#60778f]">{t("whatsappHint")}</span>
          </label>
        </Card>
      </div>

      <Card icon={<ShoppingBag className="h-4 w-4" />} title={t("servicesTitle")} description={t("servicesDescription")}>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("servicesGroup")}>
          {serviceOptions(lang).filter((option) => option.id !== "other").map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => toggleService(option.id)}
              aria-pressed={draft.services.includes(option.id)}
              className={cn("lb-press rounded-full border px-3 py-1.5 text-xs font-bold", draft.services.includes(option.id) ? "border-[#0878f9] bg-[#0878f9] text-white" : "border-[#dce8f6] bg-white text-[#17334f]")}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce8f6] bg-white/95 p-3 shadow-[0_12px_30px_rgba(16,42,67,.08)] backdrop-blur">
        <p className="text-xs text-[#60778f]" aria-live="polite">
          {savedNotice ? (
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t("settingsSaved")}</span>
          ) : settings.data.updatedAt ? (
            `${t("lastUpdated", { time: relativeTime(settings.data.updatedAt, lang) })}${settings.data.updatedByName ? t("updatedBy", { name: settings.data.updatedByName }) : ""}`
          ) : (
            t("defaultSettings")
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => { setSavedNotice(false); setDraft(toInput(DEFAULT_LEAD_BOT_SETTINGS)); }} className="rounded-xl text-[#60778f]">
            {t("restoreDefaults")}
          </Button>
          <Button type="button" variant="outline" disabled={!dirty || save.isPending} onClick={() => setDraft(toInput(settings.data!))} className="rounded-xl border-[#dce8f6] bg-white">
            <RotateCcw className="me-1 h-4 w-4" aria-hidden="true" />
            {t("undo")}
          </Button>
          <Button type="submit" disabled={!dirty || save.isPending || Boolean(localError)} className="rounded-xl bg-[#0878f9]">
            {save.isPending ? <Loader2 className="me-1 h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> : <Save className="me-1 h-4 w-4" aria-hidden="true" />}
            {t("saveChanges")}
          </Button>
        </div>
      </div>
    </form>
  );
}
