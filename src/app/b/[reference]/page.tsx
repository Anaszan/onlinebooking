import type { CSSProperties } from "react";
import Link from "next/link";
import { Alert, Card, StatusBadge, brandForeground, formatMoney } from "@/components/ui";
import { IconArrowLeft, IconCheck } from "@/components/icons";
import { canCustomerCancel, getBookingByToken } from "@/modules/booking/booking-service";
import { formatDate, formatTime } from "@/lib/time";
import { SPECIES_EMOJI, SPECIES_LABELS, type AppointmentStatus } from "@/modules/booking/types";
import { CancelBookingButton } from "@/components/booking/cancel-booking-button";

export const metadata = { title: "รายละเอียดการจอง", robots: { index: false } };

export default async function BookingDetailPage(props: PageProps<"/b/[reference]">) {
  const { reference } = await props.params;
  const sp = await props.searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const isNew = sp.new === "1";
  const booking = token ? await getBookingByToken(reference, token) : null;

  if (!booking) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <Alert tone="error">ไม่พบการจอง หรือ ลิงก์ไม่ถูกต้อง</Alert>
      </main>
    );
  }

  const tz = booking.branch.timezone;
  const canCancel = canCustomerCancel(booking);

  return (
    <main style={{ "--brand": booking.tenant.primary_color, "--brand-fg": brandForeground(booking.tenant.primary_color) } as CSSProperties}
      className="mx-auto w-full max-w-md space-y-5 px-4 py-10 sm:py-14">
      {isNew && (
        <div className="pb-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
            <IconCheck size={24} strokeWidth={2.25} />
          </div>
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-slate-900">{booking.status === "pending" ? "ส่งคำขอจองแล้ว" : "จองสำเร็จ"}</h1>
          <p className="mt-1 text-sm text-slate-500">กรุณาบันทึกหน้านี้ไว้เพื่อดูหรือยกเลิกการจอง</p>
        </div>
      )}

      <Card className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 mb-5">
          <div>
            <p className="text-xs text-slate-500">เลขอ้างอิง</p>
            <p className="mt-0.5 font-mono text-xl font-medium tracking-wider text-slate-900">{booking.reference_code}</p>
          </div>
          <StatusBadge status={booking.status as AppointmentStatus} />
        </div>
        {booking.pet && (
          <div className="mb-5 flex items-center gap-4 px-5">
            {booking.pet_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={booking.pet_photo_url} alt={`รูปของ ${booking.pet.name}`} className="h-20 w-20 rounded-3xl object-cover ring-2 ring-white shadow-md" />
            ) : (
              <span aria-hidden className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-4xl">
                {SPECIES_EMOJI[booking.pet.species]}
              </span>
            )}
            <div>
              <p className="font-display text-lg text-slate-900">{booking.pet.name}</p>
              <p className="text-sm text-slate-500">
                {SPECIES_LABELS[booking.pet.species]}
                {booking.pet.breed && ` · ${booking.pet.breed}`}
              </p>
            </div>
          </div>
        )}
        <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5 px-5 pb-5 text-sm">
          <dt className="text-slate-500">ร้าน</dt>
          <dd className="col-span-2 font-medium">{booking.tenant.name}</dd>
          <dt className="text-slate-500">บริการ</dt>
          <dd className="col-span-2">{booking.service.name}</dd>
          <dt className="text-slate-500">วันที่</dt>
          <dd className="col-span-2">{formatDate(booking.starts_at, tz)}</dd>
          <dt className="text-slate-500">เวลา</dt>
          <dd className="col-span-2">
            {formatTime(booking.starts_at, tz)} – {formatTime(booking.ends_at, tz)}
          </dd>
          <dt className="text-slate-500">สาขา</dt>
          <dd className="col-span-2">
            {booking.branch.name}
            {booking.branch.address && <span className="block text-slate-500">{booking.branch.address}</span>}
          </dd>
          <dt className="text-slate-500">พนักงาน</dt>
          <dd className="col-span-2">{booking.staff.display_name}</dd>
          <dt className="text-slate-500">ผู้จอง</dt>
          <dd className="col-span-2">{booking.customer.full_name}</dd>
          {Number(booking.price) > 0 && (
            <>
              <dt className="text-slate-500">ราคา</dt>
              <dd className="col-span-2">{formatMoney(Number(booking.price))}</dd>
            </>
          )}
        </dl>
        {(booking.tenant.contact_phone || booking.tenant.contact_line) && (
          <p className="border-t border-slate-200 px-5 py-3.5 text-sm text-slate-500">
            ติดต่อร้าน: {booking.tenant.contact_phone} {booking.tenant.contact_line && `· LINE ${booking.tenant.contact_line}`}
          </p>
        )}
      </Card>

      {canCancel ? (
        <CancelBookingButton reference={booking.reference_code} token={token} />
      ) : (
        ["pending", "confirmed"].includes(booking.status) && (
          <p className="text-center text-sm text-slate-500">
            ยกเลิกออนไลน์ได้ก่อนเวลานัด {booking.tenant.cancel_cutoff_hours} ชั่วโมง — กรุณาติดต่อร้าน
          </p>
        )
      )}

      <Link href={`/s/${booking.tenant.slug}`} className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
        <IconArrowLeft size={15} />
        กลับไปหน้าร้าน
      </Link>
    </main>
  );
}
