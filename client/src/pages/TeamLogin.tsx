import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { useLanguage } from "@/contexts/LanguageContext";
import { BadgeCheck, BriefcaseBusiness, Loader2, ShieldCheck } from "lucide-react";
import { useEffect } from "react";

export default function TeamLogin() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: false });
  const { isEnglish } = useLanguage();

  useEffect(() => {
    if (user?.role === "agent") window.location.assign("/agent-dashboard");
    if (user?.role === "employee") window.location.assign("/employee-dashboard");
    if (user?.role === "admin") window.location.assign("/dashboard");
  }, [user]);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#071d34,#0a3155_50%,#eaf5ff_50%)] p-5 sm:p-10" dir={isEnglish ? "ltr" : "rtl"}>
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl overflow-hidden rounded-[2rem] border border-white/20 bg-white shadow-[0_32px_90px_rgba(6,35,65,.28)] lg:grid-cols-[.9fr_1.1fr]">
        <section className="flex flex-col justify-between bg-[#082847] p-8 text-white sm:p-12">
          <div><span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#0b83f6]"><ShieldCheck className="h-7 w-7" /></span><h1 className="font-display mt-8 text-4xl font-black">{isEnglish ? "Employee access" : "دخول الموظفين"}</h1><p className="mt-5 text-sm leading-8 text-[#c9dff1]">{isEnglish ? "A private entry for employees whose accounts are created by the owner." : "مدخل خاص للموظفين الذين ينشئ المالك حساباتهم. المعقبون يدخلون برقم الجوال من زر الدخول العام."}</p></div>
          <div className="mt-10 grid gap-3"><p className="flex items-center gap-3 text-sm font-bold"><BriefcaseBusiness className="h-5 w-5 text-[#55b2ff]" />{isEnglish ? "Employees are registered by the owner only" : "الموظفون يسجلهم المالك فقط"}</p><p className="flex items-center gap-3 text-sm font-bold"><BadgeCheck className="h-5 w-5 text-[#55b2ff]" />{isEnglish ? "Permissions are applied from the owner dashboard" : "تُطبّق الصلاحيات من لوحة المالك"}</p></div>
        </section>
        <section className="flex items-center p-8 sm:p-14">
          <div className="w-full"><p className="section-kicker">{isEnglish ? "Maalamati Care team" : "فريق معاملاتي كير"}</p><h2 className="font-display mt-4 text-3xl font-black text-[#102a43]">{isEnglish ? "Continue with your work email" : "تابع ببريد العمل"}</h2><p className="mt-4 text-sm leading-7 text-[#60778f]">{isEnglish ? "The owner must add and activate your email first. Your role and permissions are applied automatically after sign-in." : "يجب أن يضيف المالك بريدك ويفعّل الحساب أولًا. سيُطبّق دورك وصلاحياتك تلقائيًا بعد تسجيل الدخول."}</p>
            {loading ? <div className="mt-8 flex items-center gap-3 text-sm text-[#60778f]"><Loader2 className="h-5 w-5 animate-spin" />{isEnglish ? "Checking your account…" : "يتم التحقق من الحساب…"}</div> : user && user.role === "user" ? <div className="mt-8 rounded-2xl border border-[#ffd4d4] bg-[#fff7f7] p-4 text-sm leading-7 text-[#9b2c2c]">{isEnglish ? "This email is not activated as a team account. Ask the owner to add it first." : "هذا البريد غير مفعل كحساب فريق. اطلب من المالك إضافته أولًا."}</div> : null}
            <Button type="button" onClick={startLogin} disabled={loading} className="mt-8 h-12 w-full rounded-xl bg-[#0878f9] text-base font-extrabold text-white shadow-[0_5px_0_#0457ba] hover:bg-[#0668d9]">{isEnglish ? "Employee sign in" : "دخول الموظف"}</Button>
            <a href="/" className="mt-5 block text-center text-sm font-bold text-[#60778f] hover:text-[#0878f9]">{isEnglish ? "Back to website" : "العودة إلى الموقع"}</a>
          </div>
        </section>
      </div>
    </main>
  );
}
