import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Card, Field } from "@/components/ui";
import { IconArrowLeft } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { changePassword } from "./actions";

export const metadata = { title: "บัญชีของฉัน" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <Link href="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <IconArrowLeft size={14} />
        กลับไป Dashboard
      </Link>
      <h1 className="text-2xl text-slate-900">บัญชีของฉัน</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">{user.email}</p>
      <Card>
        <h2 className="mb-1 font-semibold">เปลี่ยนรหัสผ่าน</h2>
        <p className="mb-4 text-sm text-slate-500">ถ้าได้รับรหัสผ่านชั่วคราวจากร้าน กรุณาเปลี่ยนเป็นรหัสของคุณเอง</p>
        <ActionForm action={changePassword} submitLabel="บันทึกรหัสผ่านใหม่" resetOnSuccess>
          <Field label="รหัสผ่านใหม่" name="password" type="password" minLength={8} required autoComplete="new-password" />
          <Field label="ยืนยันรหัสผ่านใหม่" name="confirm" type="password" minLength={8} required autoComplete="new-password" />
        </ActionForm>
      </Card>
    </main>
  );
}
