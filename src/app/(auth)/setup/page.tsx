import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { PasswordField } from "@/components/password-field";
import { Field } from "@/components/ui";
import { IconMail } from "@/components/icons";
import { getShop } from "@/lib/shop";
import { setupShop } from "../actions";

export const metadata = { title: "ตั้งค่าร้านครั้งแรก" };

/** One-time setup — only reachable while no shop exists. */
export default async function SetupPage() {
  if (await getShop()) redirect("/login");
  const needsToken = !!process.env.SETUP_TOKEN;
  return (
    <>
      <h1 className="text-center text-2xl text-slate-900">ตั้งค่าร้านครั้งแรก</h1>
      <p className="mb-7 mt-1 text-center text-sm text-slate-500">สร้างบัญชีผู้ดูแลร้าน (เจ้าของร้าน) — ทำได้ครั้งเดียว</p>
      <ActionForm action={setupShop} submitLabel="สร้างร้าน" className="space-y-5">
        <Field label="ชื่อร้าน" name="shopName" required maxLength={120} placeholder="เช่น ปุยฝ้าย Pet Grooming" />
        <Field label="อีเมลผู้ดูแล" name="email" type="email" autoComplete="email" required placeholder="อีเมล" icon={<IconMail size={20} strokeWidth={2} />} />
        <PasswordField label="รหัสผ่าน" name="password" autoComplete="new-password" required minLength={8} placeholder="อย่างน้อย 8 ตัวอักษร" />
        {needsToken && <Field label="รหัสตั้งค่าร้าน" name="setupToken" required hint="(SETUP_TOKEN จากไฟล์ .env)" />}
      </ActionForm>
    </>
  );
}
