import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Card, EmptyState, Input, Label, PageHeader, Select, StatusBadge, cn, formatMoney } from "@/components/ui";
import { AppointmentActions } from "@/components/dashboard/appointment-actions";
import { getTenantContext } from "@/lib/auth";
import { addDays, dayRangeUtc, formatTime, toDateKey, weekdayOf, WEEKDAY_LABELS_TH } from "@/lib/time";
import { STATUS_LABELS, type AppointmentStatus, type Branch, type Service, type Staff } from "@/modules/booking/types";
import { createManualBooking } from "../actions";

export const metadata = { title: "คิว / นัดหมาย" };

interface Row {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  reference_code: string;
  price: number;
  customer_note: string | null;
  internal_note: string | null;
  source: string;
  branch_id: string;
  staff_id: string;
  customer: { id: string; full_name: string; phone: string };
  service: { name: string };
}

export default async function AppointmentsPage(props: PageProps<"/dashboard/[slug]/appointments">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { supabase, tenant } = await getTenantContext(slug);

  const [{ data: branchRows }, { data: staffRows }, { data: serviceRows }] = await Promise.all([
    supabase.from("booking_branches").select("*").eq("tenant_id", tenant.id).order("created_at"),
    supabase.from("booking_staff").select("*").eq("tenant_id", tenant.id).order("display_name"),
    supabase.from("booking_services").select("*").eq("tenant_id", tenant.id).eq("is_active", true).order("sort_order"),
  ]);
  const branches = (branchRows ?? []) as Branch[];
  const allStaff = (staffRows ?? []) as Staff[];
  const services = (serviceRows ?? []) as Service[];

  const branchId = typeof sp.branch === "string" && branches.some((b) => b.id === sp.branch) ? sp.branch : branches[0]?.id;
  const branch = branches.find((b) => b.id === branchId);
  const tz = branch?.timezone ?? "Asia/Bangkok";
  const view = sp.view === "week" ? "week" : "day";
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : toDateKey(new Date(), tz);
  const staffFilter = typeof sp.staff === "string" ? sp.staff : "";
  const statusFilter = typeof sp.status === "string" ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const rangeStart = view === "week" ? addDays(date, -((weekdayOf(date) + 6) % 7)) : date; // week starts Monday
  const rangeDays = view === "week" ? 7 : 1;
  const from = dayRangeUtc(rangeStart, tz).start;
  const to = dayRangeUtc(addDays(rangeStart, rangeDays - 1), tz).end;

  let query = supabase
    .from("booking_appointments")
    .select(
      "id, starts_at, ends_at, status, reference_code, price, customer_note, internal_note, source, branch_id, staff_id, customer:booking_customers!inner(id, full_name, phone), service:booking_services(name)",
    )
    .eq("tenant_id", tenant.id)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at")
    .limit(500);
  if (branchId) query = query.eq("branch_id", branchId);
  if (staffFilter) query = query.eq("staff_id", staffFilter);
  if (statusFilter && statusFilter in STATUS_LABELS) query = query.eq("status", statusFilter);
  if (q) {
    const safe = q.replace(/[%,()]/g, "");
    query = query.or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`, { referencedTable: "booking_customers" });
  }
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const staff = allStaff.filter((s) => s.branch_id === branchId && (!staffFilter || s.id === staffFilter));
  const staffName = new Map(allStaff.map((s) => [s.id, s.display_name]));

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ date, view, ...(branchId ? { branch: branchId } : {}), ...(staffFilter ? { staff: staffFilter } : {}), ...(statusFilter ? { status: statusFilter } : {}), ...(q ? { q } : {}), ...patch });
    return `?${p}`;
  };

  const dayLabel = (d: string) =>
    new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", weekday: "long", day: "numeric", month: "short" }).format(new Date(`${d}T00:00:00Z`));

  return (
    <div className="space-y-5">
      <PageHeader title="คิว / นัดหมาย" description={branch ? `${branch.name} · ${tz}` : undefined} />

      {/* Filters */}
      <Card className="p-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
          <input type="hidden" name="view" value={view} />
          <div>
            <Label htmlFor="date">วันที่</Label>
            <Input id="date" type="date" name="date" defaultValue={date} />
          </div>
          <div>
            <Label htmlFor="branch">สาขา</Label>
            <Select id="branch" name="branch" defaultValue={branchId}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="staff">พนักงาน</Label>
            <Select id="staff" name="staff" defaultValue={staffFilter}>
              <option value="">ทั้งหมด</option>
              {allStaff
                .filter((s) => s.branch_id === branchId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="status">สถานะ</Label>
            <Select id="status" name="status" defaultValue={statusFilter}>
              <option value="">ทั้งหมด</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="q">ค้นหาลูกค้า</Label>
            <Input id="q" name="q" defaultValue={q} placeholder="ชื่อ / เบอร์" />
          </div>
          <div className="flex items-end">
            <button className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">กรอง</button>
          </div>
        </form>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={qs({ date: addDays(date, view === "week" ? -7 : -1) })} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
          ←
        </Link>
        <Link href={qs({ date: toDateKey(new Date(), tz) })} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
          วันนี้
        </Link>
        <Link href={qs({ date: addDays(date, view === "week" ? 7 : 1) })} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
          →
        </Link>
        <span className="ml-2 font-medium">
          {view === "week" ? `${dayLabel(rangeStart)} – ${dayLabel(addDays(rangeStart, 6))}` : dayLabel(date)}
        </span>
        <span className="ml-auto inline-flex overflow-hidden rounded-lg border border-slate-300 text-sm">
          <Link href={qs({ view: "day" })} className={cn("px-3 py-1.5", view === "day" ? "bg-slate-900 text-white" : "bg-white")}>
            รายวัน
          </Link>
          <Link href={qs({ view: "week" })} className={cn("px-3 py-1.5", view === "week" ? "bg-slate-900 text-white" : "bg-white")}>
            รายสัปดาห์
          </Link>
        </span>
      </div>

      {view === "day" ? (
        staff.length === 0 ? (
          <EmptyState title="ยังไม่มีพนักงานในสาขานี้" action={<Link href={`/dashboard/${slug}/staff`} className="text-sm font-medium text-brand">เพิ่มพนักงาน →</Link>} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {staff.map((s) => {
              const list = rows.filter((r) => r.staff_id === s.id);
              return (
                <Card key={s.id} className="p-4">
                  <h3 className="mb-3 flex items-center justify-between font-semibold">
                    {s.display_name}
                    <span className="text-xs font-normal text-slate-500">{list.filter((r) => !["cancelled", "expired"].includes(r.status)).length} คิว</span>
                  </h3>
                  {list.length === 0 ? (
                    <p className="py-4 text-center text-sm text-slate-400">ว่าง</p>
                  ) : (
                    <ul className="space-y-3">
                      {list.map((r) => (
                        <AppointmentCard key={r.id} r={r} tz={tz} slug={slug} />
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <div className="grid gap-3 lg:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i)).map((d) => {
            const list = rows.filter((r) => toDateKey(new Date(r.starts_at), tz) === d);
            return (
              <Card key={d} className="p-3">
                <Link href={qs({ view: "day", date: d })} className="mb-2 block text-sm font-semibold hover:text-brand">
                  {WEEKDAY_LABELS_TH[weekdayOf(d)]} {Number(d.slice(8))}
                </Link>
                {list.length === 0 ? (
                  <p className="text-xs text-slate-400">—</p>
                ) : (
                  <ul className="space-y-1.5">
                    {list.map((r) => (
                      <li key={r.id} className={cn("rounded-md border border-slate-100 bg-slate-50 p-1.5 text-xs", ["cancelled", "expired"].includes(r.status) && "opacity-50 line-through")}>
                        <span className="font-mono font-medium">{formatTime(r.starts_at, tz)}</span> {r.customer.full_name}
                        <span className="block truncate text-slate-500">
                          {r.service.name} · {staffName.get(r.staff_id)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Walk-in / phone booking */}
      <details className="rounded-xl border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer font-semibold">+ เพิ่มนัดหมาย (walk-in / โทรจอง)</summary>
        <p className="mb-4 mt-1 text-sm text-slate-500">ระบบยังตรวจเวลาชนให้อัตโนมัติ (ไม่ตรวจเวลาทำงาน เพื่อให้ร้านรับนัดพิเศษได้)</p>
        <ActionForm action={createManualBooking.bind(null, slug)} submitLabel="เพิ่มนัด" resetOnSuccess className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="m_service">บริการ</Label>
            <Select id="m_service" name="service_id" required>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration_minutes} นาที)
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="m_staff">พนักงาน</Label>
            <Select id="m_staff" name="staff_id" required defaultValue={staffFilter || undefined}>
              {allStaff
                .filter((s) => s.is_active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name} — {branches.find((b) => b.id === s.branch_id)?.name}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="m_date">วันที่</Label>
            <Input id="m_date" type="date" name="date" defaultValue={date} required />
          </div>
          <div>
            <Label htmlFor="m_time">เวลา</Label>
            <Input id="m_time" type="time" name="time" required step={300} />
          </div>
          <div>
            <Label htmlFor="m_name">ชื่อลูกค้า</Label>
            <Input id="m_name" name="name" required />
          </div>
          <div>
            <Label htmlFor="m_phone">เบอร์โทร</Label>
            <Input id="m_phone" name="phone" type="tel" required />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="m_note">หมายเหตุ</Label>
            <Input id="m_note" name="note" />
          </div>
        </ActionForm>
      </details>
    </div>
  );
}

function AppointmentCard({ r, tz, slug }: { r: Row; tz: string; slug: string }) {
  const inactive = ["cancelled", "expired"].includes(r.status);
  return (
    <li className={cn("rounded-lg border border-slate-200 p-3", inactive && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold">
            {formatTime(r.starts_at, tz)}–{formatTime(r.ends_at, tz)}
          </p>
          <Link href={`/dashboard/${slug}/customers/${r.customer.id}`} className="block truncate font-medium hover:text-brand">
            {r.customer.full_name}
          </Link>
          <p className="truncate text-sm text-slate-500">
            {r.service.name} · <a href={`tel:${r.customer.phone}`}>{r.customer.phone}</a>
          </p>
          <p className="text-xs text-slate-400">
            {r.reference_code} · {r.source === "online" ? "จองออนไลน์" : "ร้านบันทึก"}
            {Number(r.price) > 0 && ` · ${formatMoney(Number(r.price))}`}
          </p>
          {r.customer_note && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">ลูกค้า: {r.customer_note}</p>}
        </div>
        <StatusBadge status={r.status} />
      </div>
      <AppointmentActions id={r.id} status={r.status} internalNote={r.internal_note} date={toDateKey(new Date(r.starts_at), tz)} time={formatTime(r.starts_at, tz)} />
    </li>
  );
}
