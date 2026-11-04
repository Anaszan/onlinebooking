"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { actionError, fromDbError, type ActionResult } from "@/lib/errors";
import { tenantCreateForm } from "@/modules/booking/schemas";

export async function createTenant(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let slug: string;
  try {
    const input = tenantCreateForm.parse(Object.fromEntries(formData));
    const supabase = await createClient();
    const { error } = await supabase.rpc("booking_create_tenant", {
      p_slug: input.slug,
      p_name: input.name,
      p_timezone: input.timezone,
      p_branch_name: null,
    });
    if (error) throw fromDbError(error);
    slug = input.slug;
  } catch (e) {
    return actionError(e);
  }
  redirect(`/dashboard/${slug}?welcome=1`);
}
