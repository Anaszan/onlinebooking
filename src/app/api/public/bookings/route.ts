import { NextResponse, type NextRequest } from "next/server";
import { AppError, errorResponse } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createBookingBody } from "@/modules/booking/schemas";
import { createPublicBooking } from "@/modules/booking/booking-service";
import { notifyBookingCreated } from "@/modules/notifications/notification-service";

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request.headers);
    if (!rateLimit(`book:${ip}`, 10, 10 * 60_000).ok) {
      throw new AppError("RATE_LIMITED", "ส่งคำขอจองถี่เกินไป กรุณารอสักครู่", 429);
    }

    const body = createBookingBody.parse(await request.json());
    if (!rateLimit(`book-phone:${body.customer.phone}`, 5, 60 * 60_000).ok) {
      throw new AppError("RATE_LIMITED", "เบอร์นี้จองถี่เกินไป กรุณาติดต่อร้าน", 429);
    }

    const booking = await createPublicBooking({
      tenantSlug: body.tenant,
      serviceId: body.serviceId,
      branchId: body.branchId,
      staffId: body.staffId,
      start: body.start,
      customer: {
        name: body.customer.name,
        phone: body.customer.phone,
        email: body.customer.email || undefined,
        note: body.customer.note,
      },
      idempotencyKey: body.idempotencyKey,
    });

    if (booking.created) {
      // fire-and-forget; failures are logged, never block the booking
      notifyBookingCreated(booking.appointmentId).catch((e) => console.error("[notify]", e));
    }

    return NextResponse.json(
      {
        data: {
          reference: booking.referenceCode,
          token: booking.accessToken,
          status: booking.status,
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
        },
      },
      { status: booking.created ? 201 : 200 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
