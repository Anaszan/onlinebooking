import { NextResponse, type NextRequest } from "next/server";
import { AppError, errorResponse } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { cancelBookingBody } from "@/modules/booking/schemas";
import { cancelBookingByCustomer } from "@/modules/booking/booking-service";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/public/bookings/[reference]/cancel">) {
  try {
    if (!rateLimit(`cancel:${clientIp(request.headers)}`, 20, 10 * 60_000).ok) {
      throw new AppError("RATE_LIMITED", "เรียกใช้งานถี่เกินไป", 429);
    }
    const { reference } = await ctx.params;
    const { token } = cancelBookingBody.parse(await request.json());
    await cancelBookingByCustomer(reference, token);
    return NextResponse.json({ data: { status: "cancelled" } });
  } catch (err) {
    return errorResponse(err);
  }
}
