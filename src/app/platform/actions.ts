"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isPlatformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { actionError, AppError, fromDbError, type ActionResult } from "@/lib/errors";

async function assertAdmin() {
  if (!(await isPlatformAdmin())) throw new AppError("FORBIDDEN", "เฉพาะผู้ดูแลแพลตฟอร์ม", 403);
  return createClient();
}

export async function updateSubscription(tenantId: string, _p: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const supabase = await assertAdmin();
    const v = z
      .object({
        plan_id: z.uuid(),
        status: z.enum(["trial", "active", "past_due", "suspended", "cancelled"]),
        trial_ends_at: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
      })
      .parse(Object.fromEntries(form));
    // audit log is written by the booking_audit_tenant trigger
    const { error } = await supabase
      .from("booking_tenants")
      .update({
        plan_id: v.plan_id,
        status: v.status,
        trial_ends_at: v.trial_ends_at ? new Date(`${v.trial_ends_at}T23:59:59Z`).toISOString() : null,
      })
      .eq("id", tenantId);
    if (error) throw fromDbError(error);
    revalidatePath("/platform", "layout");
    return { ok: true, message: "อัปเดตแพ็กเกจ/สถานะแล้ว" };
  } catch (e) {
    return actionError(e);
  }
}

const nullableInt = z
  .string()
  .optional()
  .transform((s) => (s === undefined || s.trim() === "" ? null : Number(s)))
  .pipe(z.number().int().min(0).nullable());

export async function savePlan(planId: string | null, _p: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const supabase = await assertAdmin();
    const raw = Object.fromEntries(form);
    const v = z
      .object({
        code: z.string().regex(/^[a-z0-9_-]{2,30}$/),
        name: z.string().min(1).max(60),
        price_monthly: z.coerce.number().min(0),
        max_branches: nullableInt,
        max_staff: nullableInt,
        max_services: nullableInt,
        max_bookings_per_month: nullableInt,
      })
      .parse(raw);
    const row = {
      ...v,
      features: { custom_domain: raw.custom_domain === "on", reports: raw.reports === "on" },
      is_public: raw.is_public === "on",
    };
    const { error } = planId
      ? await supabase.from("booking_plans").update(row).eq("id", planId)
      : await supabase.from("booking_plans").insert(row);
    if (error) throw fromDbError(error);
    revalidatePath("/platform/plans");
    return { ok: true, message: "บันทึกแพ็กเกจแล้ว" };
  } catch (e) {
    return actionError(e);
  }
}
