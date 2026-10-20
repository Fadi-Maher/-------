import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, Headset, Settings2, ShieldAlert, Users, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { AnalyticsTab } from "@/components/leadbot/dashboard/AnalyticsTab";
import { LeadDetailSheet } from "@/components/leadbot/dashboard/LeadDetail";
import { LeadsTab } from "@/components/leadbot/dashboard/LeadsTab";
import { SalesLeadAlertButton, isSalesSoundEnabled, playSalesTone, setSalesSoundEnabled } from "@/components/leadbot/dashboard/SalesLeadAlertButton";
import { SettingsTab } from "@/components/leadbot/dashboard/SettingsTab";
import { SalesLanguageToggle, useSalesLang } from "@/components/leadbot/dashboard/salesI18n";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";

type TabId = "leads" | "analytics" | "settings";

function readQuery() {
  if (typeof window === "undefined") return { tab: "leads" as TabId, lead: null as number | null };
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  const lead = Number(params.get("lead"));
  return {
    tab: (tab === "analytics" || tab === "settings" ? tab : "leads") as TabId,
    lead: Number.isInteger(lead) && lead > 0 ? lead : null,
  };
}

function writeQuery(tab: TabId, lead: number | null) {
  const params = new URLSearchParams();
  if (tab !== "leads") params.set("tab", tab);
  if (lead) params.set("lead", String(lead));
  const query = params.toString();
  window.history.replaceState(window.history.state, "", `/sales-assistant${query ? `?${query}` : ""}`);
}

function SoundToggle() {
  const { t } = useSalesLang();
  const [enabled, setEnabled] = useState(() => isSalesSoundEnabled());
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={enabled}
      onClick={() => {
        const next = !enabled;
        setEnabled(next);
        setSalesSoundEnabled(next);
        if (next) playSalesTone();
      }}
      className="rounded-xl border-[#dce8f6] bg-white text-[#31516e]"
    >
      {enabled ? <Volume2 className="me-1 h-4 w-4" aria-hidden="true" /> : <VolumeX className="me-1 h-4 w-4" aria-hidden="true" />}
      {enabled ? t("soundOn") : t("soundOff")}
    </Button>
  );
}

function SalesWorkspace({ role, staffName }: { role: "owner" | "staff"; staffName: string | null }) {
  const { t, dir, lang } = useSalesLang();
  const initial = readQuery();
  const [tab, setTab] = useState<TabId>(role === "owner" ? initial.tab : initial.tab === "settings" ? "leads" : initial.tab);
  const [leadId, setLeadId] = useState<number | null>(initial.lead);

  useEffect(() => {
    writeQuery(tab, leadId);
  }, [tab, leadId]);

  return (
    <section className="mx-auto max-w-6xl" dir={dir} lang={lang}>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="section-kicker">{t("kicker")}</p>
          <h1 className={`font-display mt-4 text-3xl font-extrabold text-[#102a43] sm:text-4xl ${lang === "en" ? "tracking-[-0.03em]" : "tracking-[-0.06em]"}`}>{t("title")}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#60778f]">{t("intro")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SalesLanguageToggle />
          <SoundToggle />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)} className="mt-6" dir={dir}>
        <TabsList aria-label={t("tabsLabel")} className="h-auto flex-wrap rounded-2xl border border-[#dce8f6] bg-white p-1">
          <TabsTrigger value="leads" className="gap-2 rounded-xl px-4 py-2 font-bold data-[state=active]:bg-[#0878f9] data-[state=active]:text-white">
            <Users className="h-4 w-4" aria-hidden="true" />
            {t("tabLeads")}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2 rounded-xl px-4 py-2 font-bold data-[state=active]:bg-[#0878f9] data-[state=active]:text-white">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            {t("tabAnalytics")}
          </TabsTrigger>
          {role === "owner" ? (
            <TabsTrigger value="settings" className="gap-2 rounded-xl px-4 py-2 font-bold data-[state=active]:bg-[#0878f9] data-[state=active]:text-white">
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              {t("tabSettings")}
            </TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="leads" className="mt-5">
          <LeadsTab onOpenLead={setLeadId} selectedLeadId={leadId} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-5">
          {tab === "analytics" ? <AnalyticsTab /> : null}
        </TabsContent>
        {role === "owner" ? (
          <TabsContent value="settings" className="mt-5">
            {tab === "settings" ? <SettingsTab /> : null}
          </TabsContent>
        ) : null}
      </Tabs>
      <LeadDetailSheet leadId={leadId} onClose={() => setLeadId(null)} staffName={staffName} />
    </section>
  );
}

function CenteredCard({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  const { dir, lang } = useSalesLang();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f5f9ff] p-4" dir={dir} lang={lang}>
      <SalesLanguageToggle />
      <div className="portal-shadow w-full max-w-md rounded-3xl border border-[#dce8f6] bg-white p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-[#0878f9]" aria-hidden="true" />
        <h1 className="mt-4 font-display text-2xl font-extrabold text-[#102a43]">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-[#60778f]">{body}</p>
        <div className="mt-7">{action}</div>
      </div>
    </div>
  );
}

/** Team member shell: no owner sidebar, a clear way back to the employee workspace. */
function StaffShell({ children }: { children: React.ReactNode }) {
  const { t, dir, lang } = useSalesLang();
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;
  return (
    <div className="min-h-screen bg-[#f5f9ff]" dir={dir} lang={lang}>
      <header className="sticky top-0 z-30 border-b border-[#dce8f6] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2 font-display font-extrabold text-[#17334f]">
            <Headset className="h-5 w-5 text-[#0878f9]" aria-hidden="true" />
            {t("staffShellTitle")}
          </div>
          <div className="flex items-center gap-2">
            <SalesLeadAlertButton />
            <Button type="button" variant="outline" size="sm" onClick={() => window.location.assign("/employee-dashboard")} className="rounded-xl border-[#dce8f6] bg-white">
              <BackIcon className="me-1 h-4 w-4" aria-hidden="true" />
              {t("backToStaff")}
            </Button>
          </div>
        </div>
      </header>
      <main className="p-4 sm:p-6">{children}</main>
    </div>
  );
}

export default function SalesAssistantPage() {
  const { user, loading } = useAuth();
  const { t } = useSalesLang();
  const access = trpc.leadBot.staff.access.useQuery(undefined, { enabled: Boolean(user), retry: false });

  if (loading) return <DashboardLayoutSkeleton />;
  if (user?.role === "admin") {
    return (
      <DashboardLayout>
        <SalesWorkspace role="owner" staffName={access.data?.name ?? user.name ?? null} />
      </DashboardLayout>
    );
  }
  if (!user) {
    return (
      <CenteredCard
        title={t("deniedTitle")}
        body={t("signInBody")}
        action={
          <Button type="button" onClick={() => window.location.assign("/team-login")} className="w-full rounded-xl bg-[#0878f9] text-white hover:bg-[#0668d9]">
            {t("teamLogin")}
          </Button>
        }
      />
    );
  }
  if (access.isLoading) return <DashboardLayoutSkeleton />;
  if (access.data?.role === "staff") {
    return (
      <StaffShell>
        <SalesWorkspace role="staff" staffName={access.data.name} />
      </StaffShell>
    );
  }
  return (
    <CenteredCard
      title={t("deniedTitle")}
      body={t("noAccessBody")}
      action={
        <Button type="button" onClick={() => window.location.assign("/")} className="w-full rounded-xl bg-[#0878f9] text-white hover:bg-[#0668d9]">
          {t("backToSite")}
        </Button>
      }
    />
  );
}
