import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/ui";
import { signUp } from "../actions";

export const metadata = { title: "สมัครใช้งาน" };

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">สมัครใช้งาน SYSRENT Booking</h1>
      <p className="mb-6 text-sm text-slate-500">ทดลองใช้ฟรี 14 วัน ไม่ต้องใช้บัตรเครดิต</p>
      <ActionForm action={signUp} submitLabel="สมัครใช้งาน">
        <Field label="อีเมล" name="email" type="email" autoComplete="email" required />
        <Field label="รหัสผ่าน" name="password" type="password" autoComplete="new-password" minLength={8} required hint="(อย่างน้อย 8 ตัว)" />
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        มีบัญชีแล้ว?{" "}
        <Link href="/login" className="font-medium text-brand">
          เข้าสู่ระบบ
        </Link>
      </p>
    </>
  );
}
