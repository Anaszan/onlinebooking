"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/errors";

const credentials = z.object({
  email: z.email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร").max(72),
});

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

export async function signIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  redirect(safeNext(formData.get("next")));
}

const setupSchema = credentials.extend({
  shopName: z.string().trim().min(1, "กรุณากรอกชื่อร้าน").max(120),
  setupToken: z.string().optional(),
});

/**
 * One-time shop setup: creates the owner account and the shop.
 * Only works while no shop exists. If SETUP_TOKEN is set in the server
 * environment, the same token must be entered (protects a fresh deploy
 * from being claimed by someone else first).
 */
export async function setupShop(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = setupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { email, password, shopName, setupToken } = parsed.data;

  const required = process.env.SETUP_TOKEN;
  if (required && setupToken !== required) return { ok: false, error: "รหัสตั้งค่าร้านไม่ถูกต้อง" };

  const admin = createAdminClient();
  const { count } = await admin.from("booking_tenants").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return { ok: false, error: "ร้านถูกตั้งค่าไปแล้ว กรุณาเข้าสู่ระบบ" };

  const { data: existingId } = await admin.rpc("booking_find_user_by_email", { p_email: email });
  if (existingId) return { ok: false, error: "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาใช้อีเมลอื่น" };

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) return { ok: false, error: created.error?.message ?? "สร้างบัญชีไม่สำเร็จ" };

  const { error } = await admin.rpc("booking_setup_shop", { p_owner: created.data.user.id, p_name: shopName, p_timezone: "Asia/Bangkok" });
  if (error) {
    await admin.auth.admin.deleteUser(created.data.user.id);
    return { ok: false, error: error.message.startsWith("SHOP_EXISTS") ? "ร้านถูกตั้งค่าไปแล้ว" : "ตั้งค่าร้านไม่สำเร็จ" };
  }

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect("/dashboard?welcome=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
