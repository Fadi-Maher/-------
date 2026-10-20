import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AdminApplicationNotificationCenter } from "@/components/AdminApplicationNotificationCenter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { BadgeCheck, Bot, BriefcaseBusiness, History, LayoutDashboard, LogOut, PanelLeft, Settings, Users } from "lucide-react";
import { CSSProperties, useEffect } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const menuItems = [
  { icon: BadgeCheck, label: "المعقبين", path: "/agents" },
  { icon: BriefcaseBusiness, label: "الموظفين", path: "/employees" },
  { icon: Users, label: "العملاء", path: "/customers" },
  { icon: LayoutDashboard, label: "الطلبات", path: "/dashboard" },
  { icon: Settings, label: "إعدادات النموذج", path: "/settings" },
  { icon: Bot, label: "معرفة المساعد", path: "/settings/assistant" },
  { icon: History, label: "سجل التدقيق", path: "/audit" },
  { icon: Users, label: "واجهة الموقع", path: "/" },
];

const DEFAULT_WIDTH = 280;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f9ff] p-4" dir="rtl">
        <div className="portal-shadow flex w-full max-w-md flex-col items-center gap-8 rounded-3xl border border-[#dce8f6] bg-white p-8">
          <div className="flex flex-col items-center gap-6">
            <h1 className="font-display text-center text-2xl font-extrabold tracking-[-0.06em] text-[#102a43]">
              دخول المالك مطلوب للمتابعة
            </h1>
            <p className="max-w-sm text-center text-sm leading-7 text-[#60778f]">
              افتح صفحة المالك الخاصة لتسجيل الدخول إلى لوحة الإدارة.
            </p>
          </div>
          <Button
            onClick={() => window.location.assign("/owner-login")}
            size="lg"
            className="w-full rounded-xl bg-[#0878f9] shadow-[0_5px_0_#0457ba] transition-all hover:bg-[#0668d9]"
          >
            فتح صفحة دخول المالك
          </Button>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f9ff] p-4" dir="rtl">
        <div className="portal-shadow w-full max-w-md rounded-3xl border border-[#dce8f6] bg-white p-8 text-center">
          <h1 className="font-display text-2xl font-extrabold text-[#102a43]">هذه اللوحة مخصصة للمالك</h1>
          <p className="mt-3 text-sm leading-7 text-[#60778f]">صلاحية حسابك لا تسمح بعرض بيانات الإدارة أو العملاء أو الإعدادات.</p>
          <Button type="button" onClick={() => window.location.assign("/")} className="mt-7 w-full rounded-xl bg-[#0878f9] text-white hover:bg-[#0668d9]">العودة إلى الموقع</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${DEFAULT_WIDTH}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = { children: React.ReactNode };

function DashboardLayoutContent({ children }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const handleLogout = async () => { await logout(); setLocation("/owner-login"); };
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-svh w-full" dir="rtl">
        <Sidebar
          side="right"
          collapsible="icon"
          className="border-l-0 border-r-0 bg-white"
        >
          <SidebarHeader className="h-20 justify-center border-b border-[#e7eff8]">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <AdminApplicationNotificationCenter />
              <button
                onClick={toggleSidebar}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef7ff] text-[#0878f9] transition-colors hover:bg-[#e1f0ff] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-display truncate text-base font-extrabold tracking-[-0.06em] text-[#102a43]">
                    إدارة معاملاتي كير
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
              <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-11 rounded-xl px-3 font-bold transition-all ${isActive ? "bg-[#eaf3ff] text-[#0878f9]" : "text-[#5d7086] hover:bg-[#f5f9ff]"}`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 shrink-0 border border-[#cfe3f8]">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => void handleLogout()}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>تسجيل الخروج</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" variant="outline" onClick={() => void handleLogout()} className="mt-3 h-10 w-full justify-start rounded-xl border-[#f3c8cd] text-[#b33b47] hover:bg-[#fff3f4] hover:text-[#a12d3b] group-data-[collapsible=icon]:justify-center" aria-label="تسجيل الخروج"><LogOut className="mr-2 h-4 w-4 group-data-[collapsible=icon]:mr-0" /><span className="group-data-[collapsible=icon]:hidden">تسجيل الخروج</span></Button>
          </SidebarFooter>
        </Sidebar>

      <SidebarInset>
        {isMobile && (
          <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#dce8f6] bg-white/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "القائمة"}
                  </span>
                </div>
              </div>
            </div>
            <AdminApplicationNotificationCenter />
          </div>
        )}
        <main className="flex-1 bg-[#f5f9ff] p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </div>
  );
}
