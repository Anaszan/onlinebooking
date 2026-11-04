import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/ui";
import { signIn } from "../actions";

export const metadata = { title: "เข้าสู่ระบบ" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">เข้าสู่ระบบร้านค้า</h1>
      <p className="mb-6 text-sm text-slate-500">จัดการคิว บริการ และพนักงานของร้านคุณ</p>
      <ActionForm action={signIn} submitLabel="เข้าสู่ระบบ">
        <input type="hidden" name="next" value={typeof next === "string" ? next : ""} />
        <Field label="อีเมล" name="email" type="email" autoComplete="email" required />
        <Field label="รหัสผ่าน" name="password" type="password" autoComplete="current-password" required />
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        ยังไม่มีบัญชี?{" "}
        <Link href="/signup" className="font-medium text-brand">
          สมัครใช้งานฟรี
        </Link>
      </p>
    </>
  );
}
