"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/errors";

const schema = z
  .object({
    password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" });

export async function changePassword(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: "เปลี่ยนรหัสผ่านแล้ว" };
}
