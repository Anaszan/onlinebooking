import { NextResponse, type NextRequest } from "next/server";
import { AppError, errorResponse, fromDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { appointmentAction } from "@/modules/booking/schemas";
import { zonedToUtc } from "@/lib/time";

/**
 * Merchant appointment actions. Authorization is enforced inside the
 * SECURITY DEFINER functions (membership check) and by RLS for reads.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/booking/appointments/[id]">) {
  try {
    const { id } = await ctx.params;
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new AppError("UNAUTHENTICATED", "กรุณาเข้าสู่ระบบ", 401);

    const body = appointmentAction.parse(await request.json());

    if (body.action === "status") {
      const { error } = await supabase.rpc("booking_set_appointment_status", { p_appointment: id, p_status: body.status });
      if (error) throw fromDbError(error);
    } else if (body.action === "reschedule") {
      // RLS: only members of the tenant can see this row
      const { data: appt } = await supabase
        .from("booking_appointments")
        .select("id, branch:booking_branches(timezone)")
        .eq("id", id)
        .maybeSingle<{ id: string; branch: { timezone: string } }>();
      if (!appt) throw new AppError("NOT_FOUND", "ไม่พบนัดหมาย", 404);
      const start = zonedToUtc(body.date, body.time, appt.branch.timezone);
      const { error } = await supabase.rpc("booking_reschedule_appointment", {
        p_appointment: id,
        p_new_start: start.toISOString(),
        p_new_staff: body.staffId ?? null,
      });
      if (error) throw fromDbError(error);
    } else if (body.action === "assign") {
      // same time, different staff — overlap and service capability are checked in the DB
      const { data: appt } = await supabase
        .from("booking_appointments")
        .select("id, starts_at")
        .eq("id", id)
        .maybeSingle<{ id: string; starts_at: string }>();
      if (!appt) throw new AppError("NOT_FOUND", "ไม่พบนัดหมาย", 404);
      const { error } = await supabase.rpc("booking_reschedule_appointment", {
        p_appointment: id,
        p_new_start: appt.starts_at,
        p_new_staff: body.staffId,
      });
      if (error) throw fromDbError(error);
    } else {
      const { error } = await supabase.rpc("booking_set_internal_note", { p_appointment: id, p_note: body.internalNote });
      if (error) throw fromDbError(error);
    }
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return errorResponse(err);
  }
}
