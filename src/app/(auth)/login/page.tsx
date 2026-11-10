import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { AuthSwitch } from "@/components/auth-switch";
import { PasswordField } from "@/components/password-field";
import { Field } from "@/components/ui";
import { IconCalendar, IconLogin, IconMail } from "@/components/icons";
import { getShop } from "@/lib/shop";
import { signIn } from "../actions";

export const metadata = { title: "เข้าสู่ระบบพนักงาน" };

export default async function LoginPage(props: PageProps<"/login">) {
  if (!(await getShop())) redirect("/setup");
  const { next } = await props.searchParams;
  return (
    <>
      <h1 className="text-center text-2xl text-slate-900">เข้าสู่ระบบหลังร้าน</h1>
      <p className="mb-7 mt-1 text-center text-sm text-slate-500">สำหรับพนักงานและผู้ดูแลร้าน — จัดการคิว บริการ และพนักงาน</p>
      <ActionForm action={signIn} submitLabel="เข้าสู่ระบบ" submitIcon={<IconLogin size={22} strokeWidth={2.25} />} className="space-y-5">
        <input type="hidden" name="next" value={typeof next === "string" ? next : ""} />
        <Field label="อีเมล" name="email" type="email" autoComplete="email" required placeholder="อีเมล" icon={<IconMail size={20} strokeWidth={2} />} />
        <PasswordField label="รหัสผ่าน" name="password" autoComplete="current-password" required placeholder="รหัสผ่าน" />
      </ActionForm>
      <p className="mt-4 text-center text-xs text-slate-500">ยังไม่มีบัญชี? ให้ผู้ดูแลร้านสร้างให้ที่เมนู “พนักงาน”</p>
      <AuthSwitch question="ลูกค้าต้องการจองคิว?" href="/" label="ไปหน้าจองคิว" icon={<IconCalendar size={22} strokeWidth={2.25} />} />
    </>
  );
}
