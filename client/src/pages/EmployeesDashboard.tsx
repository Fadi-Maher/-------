import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { BadgeCheck, BriefcaseBusiness, ClipboardList, Link2, Pencil, Phone, Plus, RefreshCw, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type TeamRole = "employee" | "agent";
type Permissions = { canViewAssigned: boolean; canUpdateStatus: boolean; canAddCustomerUpdate: boolean };
type StaffForm = { id?: number; fullName: string; email: string; phone: string; role: TeamRole; isActive: boolean; permissions: Permissions };

const permissionsFor = (_role: TeamRole): Permissions => ({ canViewAssigned: true, canUpdateStatus: true, canAddCustomerUpdate: true });
const emptyForm = (role: TeamRole): StaffForm => ({ fullName: "", email: "", phone: "", role, isActive: true, permissions: permissionsFor(role) });

export default function EmployeesDashboard() {
  const [location] = useLocation();
  const sectionRole: TeamRole = location === "/agents" ? "agent" : "employee";
  const isAgents = sectionRole === "agent";
  const accounts = trpc.staffAccounts.list.useQuery();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StaffForm>(() => emptyForm(sectionRole));

  const visibleAccounts = useMemo(() => (accounts.data ?? []).filter((account) => account.role === sectionRole), [accounts.data, sectionRole]);
  const createAccount = trpc.staffAccounts.create.useMutation({
    onSuccess: async () => {
      toast.success(isAgents ? "تمت إضافة المعقب ويمكنه الدخول برقم جواله." : "تمت إضافة الموظف وسيتفعل عند دخوله ببريد العمل.");
      setOpen(false);
      setForm(emptyForm(sectionRole));
      await utils.staffAccounts.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const updateAccount = trpc.staffAccounts.update.useMutation({
    onSuccess: async () => {
      toast.success("تم تحديث بيانات الحساب وصلاحياته.");
      setOpen(false);
      setForm(emptyForm(sectionRole));
      await utils.staffAccounts.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const beginCreate = () => { setForm(emptyForm(sectionRole)); setOpen(true); };
  const beginEdit = (account: NonNullable<typeof accounts.data>[number]) => {
    setForm({ id: account.id, fullName: account.fullName, email: account.email, phone: account.phone ?? "", role: account.role, isActive: account.isActive, permissions: account.permissions });
    setOpen(true);
  };
  const submit = () => {
    if (form.fullName.trim().length < 2) return toast.error("أدخل الاسم بصورة صحيحة.");
    if (form.role === "employee" && !form.email.includes("@")) return toast.error("أدخل بريد عمل صحيحًا للموظف.");
    if (form.role === "agent" && !/^05\d{8}$/.test(form.phone)) return toast.error("أدخل رقم جوال معقب يبدأ بـ 05 ويتكون من 10 أرقام.");
    const payload = { fullName: form.fullName, email: form.role === "employee" ? form.email : "", phone: form.role === "agent" ? form.phone : undefined, role: form.role, permissions: form.permissions };
    if (form.id) updateAccount.mutate({ ...payload, id: form.id, isActive: form.isActive });
    else createAccount.mutate(payload);
  };

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-6xl" dir="rtl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="section-kicker">إدارة فريق التشغيل</p>
            <h1 className="font-display mt-4 text-3xl font-black text-[#102a43] sm:text-4xl">{isAgents ? "حسابات المعقبين" : "حسابات الموظفين"}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#60778f]">{isAgents ? "أضف رقم جوال المعقب واضبط صلاحياته، ثم يدخل برمز التحقق من زر الدخول العام." : "الموظفون يضيفهم المالك فقط باستخدام بريد العمل، مع صلاحيات الطلبات والتحديثات."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl border-[#b7dbff] bg-white text-[#0878f9]" onClick={() => accounts.refetch()}><RefreshCw className="ml-2 h-4 w-4" />تحديث</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button onClick={beginCreate} className="rounded-xl bg-[#0878f9] font-extrabold text-white hover:bg-[#0668d9]"><Plus className="ml-2 h-4 w-4" />{isAgents ? "إضافة معقب" : "إضافة موظف"}</Button></DialogTrigger>
              <DialogContent className="max-w-xl rounded-3xl" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl font-black">{form.id ? "تعديل حساب الفريق" : "إضافة حساب فريق"}</DialogTitle>
                  <DialogDescription>{form.role === "agent" ? "يدخل المعقب برقم الجوال ورمز التحقق. لا يمكن للزوار إنشاء حساب معقب بأنفسهم." : "ينشئ المالك الموظف، ثم يربط الحساب ببريد العمل عند الدخول."}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-5 py-3">
                  <div className="grid gap-2"><Label>الاسم الكامل</Label><Input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className="h-11 rounded-xl" /></div>
                  {form.role === "agent" ? (
                    <div className="grid gap-2"><Label>رقم جوال المعقب</Label><Input type="tel" dir="ltr" inputMode="numeric" maxLength={10} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "").slice(0, 10) }))} className="h-11 rounded-xl text-left" placeholder="05XXXXXXXX" /></div>
                  ) : (
                    <div className="grid gap-2"><Label>بريد عمل الموظف</Label><Input type="email" dir="ltr" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="h-11 rounded-xl text-left" /></div>
                  )}
                  <div className="grid gap-2"><Label>الدور</Label><Select value={form.role} onValueChange={(role: TeamRole) => setForm((current) => ({ ...current, role, permissions: permissionsFor(role) }))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="employee">موظف</SelectItem><SelectItem value="agent">معقب</SelectItem></SelectContent></Select></div>
                  <PermissionRow label="عرض الطلبات الموكلة" checked={form.permissions.canViewAssigned} onChange={(checked) => setForm((current) => ({ ...current, permissions: { ...current.permissions, canViewAssigned: checked } }))} />
                  <PermissionRow label="تحديث حالة الطلب" checked={form.permissions.canUpdateStatus} onChange={(checked) => setForm((current) => ({ ...current, permissions: { ...current.permissions, canUpdateStatus: checked } }))} />
                  <PermissionRow label="التواصل مع العميل" checked={form.permissions.canAddCustomerUpdate} onChange={(checked) => setForm((current) => ({ ...current, permissions: { ...current.permissions, canAddCustomerUpdate: checked } }))} />
                  {form.id ? <PermissionRow label="الحساب مفعل" checked={form.isActive} onChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} /> : null}
                  <Button disabled={createAccount.isPending || updateAccount.isPending} onClick={submit} className="h-12 rounded-xl bg-[#0878f9] font-extrabold text-white">حفظ الحساب والصلاحيات</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-[#cde3fa] bg-white p-5"><UserRoundCheck className="h-5 w-5 text-[#0878f9]" /><p className="mt-3 text-xs font-bold text-[#60778f]">إجمالي الحسابات</p><p className="mt-1 text-3xl font-black">{visibleAccounts.length}</p></article>
          <article className="rounded-2xl border border-[#d8edcf] bg-white p-5"><ShieldCheck className="h-5 w-5 text-[#4c9a43]" /><p className="mt-3 text-xs font-bold text-[#60778f]">الحسابات المفعلة</p><p className="mt-1 text-3xl font-black text-[#275c2a]">{visibleAccounts.filter((account) => account.isActive).length}</p></article>
          <article className="rounded-2xl border border-[#cde3fa] bg-white p-5"><ClipboardList className="h-5 w-5 text-[#0878f9]" /><p className="mt-3 text-xs font-bold text-[#60778f]">الطلبات الموكلة</p><p className="mt-1 text-3xl font-black">{visibleAccounts.reduce((total, account) => total + account.requests.length, 0)}</p></article>
        </div>

        {accounts.isLoading ? <p className="py-16 text-center text-sm text-[#60778f]">يتم تحميل الحسابات…</p> : visibleAccounts.length ? (
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {visibleAccounts.map((account) => (
              <article key={account.id} className="overflow-hidden rounded-3xl border border-[#dce8f6] bg-white shadow-[0_10px_28px_rgba(25,93,164,.07)]">
                <div className="flex items-start gap-3 border-b border-[#e7eff8] bg-[#f7fbff] p-5">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0878f9]">{isAgents ? <BadgeCheck className="h-5 w-5" /> : <BriefcaseBusiness className="h-5 w-5" />}</span>
                  <div className="min-w-0"><h2 className="font-display truncate text-lg font-black">{account.fullName}</h2><p className="mt-1 truncate text-xs text-[#60778f]" dir="ltr">{isAgents ? account.phone || "لا يوجد جوال" : account.email}</p><div className="mt-2 flex flex-wrap gap-2"><Badge className={account.isActive ? "bg-[#e9f8e7] text-[#327b38]" : "bg-[#fff1f1] text-[#a23b3b]"}>{account.isActive ? "مفعل" : "موقوف"}</Badge><Badge variant="outline" className="border-[#cde3fa] bg-white text-[#0878f9]"><Link2 className="ml-1 h-3 w-3" />{account.userId ? "مرتبط" : "بانتظار الدخول"}</Badge></div></div>
                  <Button size="icon" variant="outline" onClick={() => beginEdit(account)} className="mr-auto rounded-xl"><Pencil className="h-4 w-4" /></Button>
                </div>
                <div className="p-5"><div className="flex flex-wrap gap-2 text-xs font-bold text-[#60778f]"><span className="rounded-full bg-[#f4f8fc] px-3 py-1.5">عرض: {account.permissions.canViewAssigned ? "نعم" : "لا"}</span><span className="rounded-full bg-[#f4f8fc] px-3 py-1.5">تحديث الحالة: {account.permissions.canUpdateStatus ? "نعم" : "لا"}</span><span className="rounded-full bg-[#f4f8fc] px-3 py-1.5">رد العميل: {account.permissions.canAddCustomerUpdate ? "نعم" : "لا"}</span></div><div className="mt-5 space-y-2">{account.requests.slice(0, 3).map((request) => <div key={request.id} className="rounded-xl border border-[#e1edf9] bg-[#fbfdff] p-3"><p className="text-sm font-bold text-[#17334f]">{request.category}</p><p className="mt-1 text-xs text-[#60778f]">{request.requesterName} · {request.phone}</p></div>)}{account.requests.length === 0 ? <p className="rounded-xl bg-[#f7fbff] p-4 text-center text-sm text-[#70859b]">لا توجد طلبات موكلة.</p> : null}</div></div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 grid min-h-64 place-items-center rounded-3xl border border-dashed border-[#b7dbff] bg-white text-center"><div>{isAgents ? <Phone className="mx-auto h-11 w-11 text-[#87bff4]" /> : <BriefcaseBusiness className="mx-auto h-11 w-11 text-[#87bff4]" />}<h2 className="font-display mt-4 text-lg font-black">{isAgents ? "لا توجد حسابات معقبين" : "لا توجد حسابات موظفين"}</h2><p className="mt-2 text-sm text-[#70859b]">{isAgents ? "أضف رقم جوال المعقب من هنا؛ لا يوجد تسجيل عام للمعقبين." : "أضف الموظف ببريد العمل من لوحة المالك."}</p></div></div>
        )}
      </main>
    </DashboardLayout>
  );
}

function PermissionRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 rounded-xl border border-[#dce8f6] bg-[#f8fbff] p-3"><Label className="font-bold">{label}</Label><Switch checked={checked} onCheckedChange={onChange} /></div>;
}
