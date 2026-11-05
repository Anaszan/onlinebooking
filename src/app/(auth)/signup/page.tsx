import { ActionForm } from "@/components/action-form";
import { AuthSwitch } from "@/components/auth-switch";
import { PasswordField } from "@/components/password-field";
import { Field } from "@/components/ui";
import { IconLogin, IconMail, IconUserPlus } from "@/components/icons";
import { signUp } from "../actions";

export const metadata = { title: "สมัครใช้งาน" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-center text-2xl text-slate-900">สมัครใช้งาน SYSRENT Booking</h1>
      <p className="mb-7 mt-1 text-center text-sm text-slate-500">ทดลองใช้ฟรี 14 วัน ไม่ต้องใช้บัตรเครดิต</p>
      <ActionForm action={signUp} submitLabel="สมัครใช้งาน" submitIcon={<IconUserPlus size={22} strokeWidth={2.25} />} className="space-y-5">
        <Field label="อีเมล" name="email" type="email" autoComplete="email" required placeholder="อีเมล" icon={<IconMail size={20} strokeWidth={2} />} />
        <PasswordField label="รหัสผ่าน" name="password" autoComplete="new-password" minLength={8} required hint="(อย่างน้อย 8 ตัว)" placeholder="รหัสผ่าน" />
      </ActionForm>
      <AuthSwitch question="มีบัญชีแล้ว?" href="/login" label="เข้าสู่ระบบ" icon={<IconLogin size={22} strokeWidth={2.25} />} />
    </>
  );
}
