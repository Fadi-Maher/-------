import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { BadgeCheck, Loader2, Phone, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

function normalizeSaudiPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (/^05\d{8}$/.test(digits)) return digits;
  if (/^5\d{8}$/.test(digits)) return `0${digits}`;
  if (/^9665\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  return null;
}

export default function AgentLogin() {
  const { isEnglish } = useLanguage();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const login = trpc.auth.agentPhoneDemo.useMutation({
    onSuccess: (result) => { toast.success(isEnglish ? `Welcome ${result.name}` : `مرحبًا ${result.name}`); window.location.assign("/agent-dashboard"); },
    onError: (error) => toast.error(error.message),
  });
  const continuePhone = (event: FormEvent) => { event.preventDefault(); const normalized = normalizeSaudiPhone(phoneInput); if (!normalized) return toast.error(isEnglish ? "Enter a valid Saudi mobile number." : "أدخل رقم جوال سعودي صحيحًا."); setPhone(normalized); setStep("code"); };
  const verify = (event: FormEvent) => { event.preventDefault(); if (code.length !== 6) return; login.mutate({ phone, code }); };
  return <main className="flex min-h-screen items-center justify-center overflow-x-hidden bg-[#f4f9ff] p-4" dir={isEnglish ? "ltr" : "rtl"}><section className="w-[calc(100vw-2rem)] min-w-0 max-w-md -translate-x-8 overflow-hidden rounded-[2rem] sm:translate-x-0 border border-[#dce8f6] bg-white p-7 shadow-[0_24px_70px_rgba(27,79,129,.14)] sm:p-9"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0878f9]"><BadgeCheck className="h-6 w-6" /></span><div><p className="font-display text-xl font-black text-[#102a43]">{isEnglish ? "Transaction specialist sign in" : "دخول المعقب"}</p><p className="mt-1 text-xs text-[#60778f]">{isEnglish ? "Mobile number registered by the owner" : "برقم الجوال المسجل من المالك"}</p></div></div>{step === "phone" ? <form onSubmit={continuePhone} className="mt-7"><label className="text-sm font-extrabold text-[#17334f]">{isEnglish ? "Mobile number" : "رقم الجوال"}</label><div className="relative mt-2"><Phone className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#87a1b8] ltr:left-4 rtl:right-4" /><Input dir="ltr" inputMode="tel" value={phoneInput} onChange={(event) => setPhoneInput(event.target.value)} placeholder="05XXXXXXXX" className="h-12 rounded-xl px-11 text-left" /></div><Button className="mt-4 h-12 w-full rounded-xl bg-[#0878f9] font-extrabold text-white">{isEnglish ? "Continue" : "متابعة"}</Button></form> : <form onSubmit={verify} className="mt-7"><div className="rounded-xl border border-[#b7dbff] bg-[#f0f8ff] p-3 text-xs leading-6 text-[#31516e]"><ShieldCheck className="mb-1 inline h-4 w-4 text-[#0878f9]" /> {isEnglish ? "Demo WhatsApp code: 123456" : "رمز واتساب التجريبي: 123456"}</div><p className="mt-4 text-sm font-bold text-[#60778f]">{isEnglish ? `Enter the code for ${phone}` : `أدخل الرمز المرسل إلى ${phone}`}</p><InputOTP maxLength={6} value={code} onChange={setCode} className="mt-4" dir="ltr"><InputOTPGroup className="w-full justify-between">{Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} className="h-12 w-11 rounded-lg border" />)}</InputOTPGroup></InputOTP><Button disabled={login.isPending || code.length !== 6} className="mt-5 h-12 w-full rounded-xl bg-[#0878f9] font-extrabold text-white">{login.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}{isEnglish ? "Sign in" : "دخول"}</Button><button type="button" onClick={() => { setStep("phone"); setCode(""); }} className="mt-4 w-full text-sm font-bold text-[#0878f9]">{isEnglish ? "Change mobile number" : "تغيير رقم الجوال"}</button></form>}<p className="mt-6 text-center text-xs leading-6 text-[#8798aa]">{isEnglish ? "Agent accounts are created by the owner. Unregistered numbers cannot sign in." : "حسابات المعقبين ينشئها المالك، ولا يمكن لرقم غير مسجل الدخول."}</p></section></main>;
}
