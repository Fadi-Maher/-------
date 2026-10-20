import DashboardLayout from "@/components/DashboardLayout";
import { AnnouncementsPanel } from "@/components/settings/AnnouncementsPanel";
import { NotificationTemplatesPanel } from "@/components/settings/NotificationTemplatesPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BellRing, Megaphone } from "lucide-react";

export default function NotificationSettings() {
  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6" dir="rtl">
        <header className="rounded-[1.6rem] bg-[linear-gradient(115deg,#0a3f7a,#0878f9)] p-5 text-white shadow-[0_18px_44px_rgba(8,120,249,.22)] sm:p-7">
          <p className="text-xs font-extrabold text-white/80">إعدادات المحتوى</p>
          <h1 className="font-display mt-1 text-2xl font-black sm:text-3xl">الإشعارات والإعلانات</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/90">
            عدّل نصوص الإشعارات التي يرسلها النظام تلقائيًا للعملاء والمعقبين باللغتين، وأدر شريط الإعلان الذي يظهر أعلى صفحات الموقع العامة. الإشعارات تبقى آلية؛ تغيّر هنا صياغتها فقط.
          </p>
        </header>

        <Tabs defaultValue="templates" dir="rtl" className="gap-4">
          <TabsList className="h-auto w-full justify-start gap-1 rounded-2xl bg-white p-1.5 shadow-[0_8px_24px_rgba(16,42,67,.06)] sm:w-auto">
            <TabsTrigger value="templates" className="min-h-10 flex-1 rounded-xl px-4 text-sm font-extrabold data-[state=active]:bg-[#eaf3ff] data-[state=active]:text-[#0878f9] sm:flex-none">
              <BellRing className="ml-2 h-4 w-4" aria-hidden="true" />
              نصوص الإشعارات
            </TabsTrigger>
            <TabsTrigger value="announcement" className="min-h-10 flex-1 rounded-xl px-4 text-sm font-extrabold data-[state=active]:bg-[#eaf3ff] data-[state=active]:text-[#0878f9] sm:flex-none">
              <Megaphone className="ml-2 h-4 w-4" aria-hidden="true" />
              شريط الإعلان
            </TabsTrigger>
          </TabsList>
          <TabsContent value="templates">
            <NotificationTemplatesPanel />
          </TabsContent>
          <TabsContent value="announcement">
            <AnnouncementsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
