import { NextResponse, type NextRequest } from "next/server";
import { AppError, errorResponse } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ImageValidationError, MAX_PET_PHOTO_BYTES, readImage } from "@/lib/images";
import { createBookingBody } from "@/modules/booking/schemas";
import { createPublicBooking } from "@/modules/booking/booking-service";
import { notifyBookingCreated } from "@/modules/notifications/notification-service";

/**
 * Create a public booking.
 * Accepts either JSON, or multipart/form-data with:
 *   payload  = the JSON body (string)
 *   petPhoto = optional image file (JPG/PNG/WEBP, ≤ 5 MB, type checked by magic bytes)
 */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request.headers);
    if (!rateLimit(`book:${ip}`, 10, 10 * 60_000).ok) {
      throw new AppError("RATE_LIMITED", "ส่งคำขอจองถี่เกินไป กรุณารอสักครู่", 429);
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_PET_PHOTO_BYTES + 64 * 1024) {
      throw new AppError("PAYLOAD_TOO_LARGE", "รูปใหญ่เกินไป (สูงสุด 5 MB)", 413);
    }

    let raw: unknown;
    let photoFile: File | null = null;
    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await request.formData();
      try {
        raw = JSON.parse(String(form.get("payload") ?? ""));
      } catch {
        throw new AppError("VALIDATION", "ข้อมูลไม่ถูกต้อง", 422);
      }
      const f = form.get("petPhoto");
      if (f instanceof File && f.size > 0) photoFile = f;
    } else {
      raw = await request.json();
    }

    const body = createBookingBody.parse(raw);
    if (!rateLimit(`book-phone:${body.customer.phone}`, 5, 60 * 60_000).ok) {
      throw new AppError("RATE_LIMITED", "เบอร์นี้จองถี่เกินไป กรุณาติดต่อร้าน", 429);
    }

    let petPhoto: { bytes: Uint8Array; mime: string; ext: string } | undefined;
    if (photoFile) {
      try {
        petPhoto = await readImage(photoFile, MAX_PET_PHOTO_BYTES);
      } catch (e) {
        if (e instanceof ImageValidationError) throw new AppError("INVALID_PHOTO", e.message, 422);
        throw e;
      }
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
      pet: body.pet,
      petPhoto,
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
