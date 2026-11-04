import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, AppError } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { availabilityQuery } from "@/modules/booking/schemas";
import { getAvailability } from "@/modules/booking/booking-service";

export async function GET(request: NextRequest) {
  try {
    const rl = rateLimit(`avail:${clientIp(request.headers)}`, 120, 60_000);
    if (!rl.ok) throw new AppError("RATE_LIMITED", "เรียกใช้งานถี่เกินไป กรุณารอสักครู่", 429);

    const q = availabilityQuery.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { slots, ctx } = await getAvailability({
      tenantSlug: q.tenant,
      serviceId: q.service,
      branchId: q.branch,
      staffId: q.staff,
      date: q.date,
    });
    // only expose free slots — never other customers' bookings
    return NextResponse.json(
      { data: { date: q.date, timezone: ctx.branch.timezone, slots } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
