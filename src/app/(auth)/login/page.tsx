import { ActionForm } from "@/components/action-form";
import { AuthSwitch } from "@/components/auth-switch";
import { PasswordField } from "@/components/password-field";
import { Field } from "@/components/ui";
import { IconLogin, IconMail, IconUserPlus } from "@/components/icons";
import { signIn } from "../actions";

export const metadata = { title: "เข้าสู่ระบบ" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  return (
    <>
      <h1 className="text-center text-2xl text-slate-900">เข้าสู่ระบบร้านค้า</h1>
      <p className="mb-7 mt-1 text-center text-sm text-slate-500">จัดการคิว บริการ และพนักงานของร้านคุณ</p>
      <ActionForm action={signIn} submitLabel="เข้าสู่ระบบ" submitIcon={<IconLogin size={22} strokeWidth={2.25} />} className="space-y-5">
        <input type="hidden" name="next" value={typeof next === "string" ? next : ""} />
        <Field label="อีเมล" name="email" type="email" autoComplete="email" required placeholder="อีเมล" icon={<IconMail size={20} strokeWidth={2} />} />
        <PasswordField label="รหัสผ่าน" name="password" autoComplete="current-password" required placeholder="รหัสผ่าน" />
      </ActionForm>
      <AuthSwitch question="ยังไม่มีบัญชี?" href="/signup" label="สมัครใช้งานฟรี" icon={<IconUserPlus size={22} strokeWidth={2.25} />} />
    </>
  );
}
