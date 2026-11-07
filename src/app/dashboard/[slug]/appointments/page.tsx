import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Card, EmptyState, Input, Label, PageHeader, Select, StatusBadge, cn, formatMoney } from "@/components/ui";
import { AppointmentActions } from "@/components/dashboard/appointment-actions";
import { getTenantContext } from "@/lib/auth";
import { addDays, dayRangeUtc, formatTime, toDateKey, weekdayOf, WEEKDAY_LABELS_TH } from "@/lib/time";
import {
  SPECIES,
  SPECIES_EMOJI,
  SPECIES_LABELS,
  STATUS_LABELS,
  type AppointmentStatus,
  type Branch,
  type Service,
  type Species,
  type Staff,
} from "@/modules/booking/types";
import { evaluateStaff, type EligibilityBusy, type StaffCandidate } from "@/modules/booking/eligibility";
import { parseRange } from "@/modules/booking/availability";
import { createManualBooking } from "../actions";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";

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
  service_id: string;
  customer: { id: string; full_name: string; phone: string };
  service: { name: string; buffer_before_min: number; buffer_after_min: number };
  pet: { name: string; species: Species; breed: string | null; weight_kg: number | null; notes: string | null; photo_path: string | null } | null;
}

export default async function AppointmentsPage(props: PageProps<"/dashboard/[slug]/appointments">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { supabase, tenant, user, role } = await getTenantContext(slug);

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
  // "My jobs": staff accounts start on their own queue; anyone linked to a staff record can toggle it
  const myStaff = allStaff.find((s) => s.user_id === user.id) ?? null;
  const mine = myStaff ? (sp.mine === "1" || (sp.mine === undefined && role === "staff")) : false;
  const staffFilter = mine && myStaff ? myStaff.id : typeof sp.staff === "string" ? sp.staff : "";
  const statusFilter = typeof sp.status === "string" ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const rangeStart = view === "week" ? addDays(date, -((weekdayOf(date) + 6) % 7)) : date; // week starts Monday
  const rangeDays = view === "week" ? 7 : 1;
  const from = dayRangeUtc(rangeStart, tz).start;
  const to = dayRangeUtc(addDays(rangeStart, rangeDays - 1), tz).end;

  let query = supabase
    .from("booking_appointments")
    .select(
      "id, starts_at, ends_at, status, reference_code, price, customer_note, internal_note, source, branch_id, staff_id, service_id, customer:booking_customers!inner(id, full_name, phone), service:booking_services(name, buffer_before_min, buffer_after_min), pet:booking_pets(name, species, breed, weight_kg, notes, photo_path)",
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

  // Pet photos are private: signed URLs via the member's own session (storage RLS)
  const photoPaths = [...new Set(rows.map((r) => r.pet?.photo_path).filter((p): p is string => !!p))];
  const photoUrls = new Map<string, string>();
  if (photoPaths.length) {
    const { data: signed } = await supabase.storage.from("pet-photos").createSignedUrls(photoPaths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) photoUrls.set(s.path, s.signedUrl);
  }

  // "Who can take this job?" — computed for open jobs in the day view
  const candidatesById = new Map<string, StaffCandidate[]>();
  const openRows = view === "day" ? rows.filter((r) => r.status === "pending" || r.status === "confirmed") : [];
  if (openRows.length && branch) {
    const pad = { from: dayRangeUtc(addDays(date, -1), tz).start.toISOString(), to: dayRangeUtc(addDays(date, 1), tz).end.toISOString() };
    const branchStaff = allStaff.filter((s) => s.branch_id === branch.id);
    const ids = branchStaff.map((s) => s.id);
    const [{ data: allocs }, { data: offs }, { data: hrs }, { data: links }] = await Promise.all([
      supabase
        .from("booking_allocations")
        .select("appointment_id, resource_id, during")
        .eq("tenant_id", tenant.id)
        .eq("resource_kind", "staff")
        .eq("active", true)
        .in("resource_id", ids)
        .overlaps("during", `[${pad.from},${pad.to})`),
      supabase
        .from("booking_time_off")
        .select("staff_id, branch_id, starts_at, ends_at")
        .eq("tenant_id", tenant.id)
        .lt("starts_at", pad.to)
        .gt("ends_at", pad.from),
      supabase.from("booking_working_hours").select("staff_id, weekday, start_time, end_time").eq("tenant_id", tenant.id).in("staff_id", ids),
      supabase.from("booking_staff_services").select("staff_id, service_id").eq("tenant_id", tenant.id).in("staff_id", ids),
    ]);
    const serviceSets = new Map<string, Set<string>>();
    for (const l of (links ?? []) as { staff_id: string; service_id: string }[]) {
      if (!serviceSets.has(l.staff_id)) serviceSets.set(l.staff_id, new Set());
      serviceSets.get(l.staff_id)!.add(l.service_id);
    }
    const busy: EligibilityBusy[] = [
      ...((allocs ?? []) as { appointment_id: string; resource_id: string; during: string }[]).map((a) => {
        const [start, end] = parseRange(a.during);
        return { staffId: a.resource_id, start, end, appointmentId: a.appointment_id };
      }),
      ...((offs ?? []) as { staff_id: string | null; branch_id: string | null; starts_at: string; ends_at: string }[])
        .filter((o) => o.staff_id || o.branch_id === branch.id)
        .map((o) => ({ staffId: o.staff_id, start: new Date(o.starts_at), end: new Date(o.ends_at) })),
    ];
    const evalStaff = branchStaff.map((s) => ({
      id: s.id,
      name: s.display_name,
      branchId: s.branch_id,
      isActive: s.is_active,
      serviceIds: serviceSets.get(s.id) ?? null,
      hours: ((hrs ?? []) as { staff_id: string; weekday: number; start_time: string; end_time: string }[])
        .filter((h) => h.staff_id === s.id)
        .map((h) => ({ weekday: h.weekday, start: h.start_time, end: h.end_time })),
    }));
    for (const r of openRows) {
      const start = new Date(r.starts_at);
      const end = new Date(r.ends_at);
      candidatesById.set(
        r.id,
        evaluateStaff({
          appointment: {
            id: r.id,
            serviceId: r.service_id,
            branchId: r.branch_id,
            staffId: r.staff_id,
            start,
            end,
            blockStart: new Date(start.getTime() - r.service.buffer_before_min * 60_000),
            blockEnd: new Date(end.getTime() + r.service.buffer_after_min * 60_000),
          },
          timeZone: tz,
          staff: evalStaff,
          busy,
        }),
      );
    }
  }

  const staff = allStaff.filter((s) => s.branch_id === branchId && (!staffFilter || s.id === staffFilter));
  const staffName = new Map(allStaff.map((s) => [s.id, s.display_name]));

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({
      date,
      view,
      ...(branchId ? { branch: branchId } : {}),
      ...(staffFilter && !mine ? { staff: staffFilter } : {}),
      ...(myStaff ? { mine: mine ? "1" : "0" } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(q ? { q } : {}),
      ...patch,
    });
    return `?${p}`;
  };

  const dayLabel = (d: string) =>
    new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", weekday: "long", day: "numeric", month: "short" }).format(new Date(`${d}T00:00:00Z`));

  return (
    <div className="space-y-5">
      <PageHeader
        title={mine ? "งานของฉัน" : "คิว / นัดหมาย"}
        description={branch ? `${branch.name} · ${tz}` : undefined}
        actions={
          myStaff ? (
            <span className="inline-flex h-9 overflow-hidden rounded-full border-2 border-slate-200 bg-white text-sm">
              <Link href={qs({ mine: "1" })} className={cn("inline-flex items-center px-4", mine ? "bg-slate-900 text-white" : "hover:bg-slate-50")}>
                งานของฉัน
              </Link>
              <Link href={qs({ mine: "0" })} className={cn("inline-flex items-center px-4", !mine ? "bg-slate-900 text-white" : "hover:bg-slate-50")}>
                ทั้งร้าน
              </Link>
            </span>
          ) : undefined
        }
      />

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
            <button className="h-10 w-full rounded-lg bg-slate-900 px-4 text-sm font-medium text-white shadow-sm hover:bg-slate-800">กรอง</button>
          </div>
        </form>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={qs({ date: addDays(date, view === "week" ? -7 : -1) })} aria-label="ก่อนหน้า" className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm hover:bg-slate-50 w-9 px-0">
          <IconChevronLeft />
        </Link>
        <Link href={qs({ date: toDateKey(new Date(), tz) })} className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm hover:bg-slate-50">
          วันนี้
        </Link>
        <Link href={qs({ date: addDays(date, view === "week" ? 7 : 1) })} aria-label="ถัดไป" className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm hover:bg-slate-50 w-9 px-0">
          <IconChevronRight />
        </Link>
        <span className="ml-2 font-medium text-slate-900">
          {view === "week" ? `${dayLabel(rangeStart)} – ${dayLabel(addDays(rangeStart, 6))}` : dayLabel(date)}
        </span>
        <span className="ml-auto inline-flex h-9 overflow-hidden rounded-lg border border-slate-300 bg-white text-sm shadow-sm">
          <Link href={qs({ view: "day" })} className={cn("inline-flex items-center px-3", view === "day" ? "bg-slate-900 text-white" : "hover:bg-slate-50")}>
            รายวัน
          </Link>
          <Link href={qs({ view: "week" })} className={cn("inline-flex items-center px-3", view === "week" ? "bg-slate-900 text-white" : "hover:bg-slate-50")}>
            รายสัปดาห์
          </Link>
        </span>
      </div>

      {view === "day" ? (
        staff.length === 0 ? (
          <EmptyState title="ยังไม่มีพนักงานในสาขานี้" action={<Link href={`/dashboard/${slug}/staff`} className="inline-flex items-center gap-1 text-sm font-medium text-slate-900 underline hover:no-underline">เพิ่มพนักงาน<IconChevronRight size={14} /></Link>} />
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
                        <AppointmentCard
                          key={r.id}
                          r={r}
                          tz={tz}
                          slug={slug}
                          photoUrl={r.pet?.photo_path ? (photoUrls.get(r.pet.photo_path) ?? null) : null}
                          candidates={candidatesById.get(r.id) ?? []}
                          myStaffId={myStaff?.id ?? null}
                        />
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
                        <span className="font-mono font-medium">{formatTime(r.starts_at, tz)}</span>{" "}
                        {r.pet ? `${SPECIES_EMOJI[r.pet.species]} ${r.pet.name}` : r.customer.full_name}
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
          <div>
            <Label htmlFor="m_pet">ชื่อสัตว์เลี้ยง</Label>
            <Input id="m_pet" name="pet_name" maxLength={60} />
          </div>
          <div>
            <Label htmlFor="m_species">ประเภท</Label>
            <Select id="m_species" name="pet_species" defaultValue="dog">
              {SPECIES.map((sp) => (
                <option key={sp} value={sp}>
                  {SPECIES_EMOJI[sp]} {SPECIES_LABELS[sp]}
                </option>
              ))}
            </Select>
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

function AppointmentCard({
  r,
  tz,
  slug,
  photoUrl,
  candidates,
  myStaffId,
}: {
  r: Row;
  tz: string;
  slug: string;
  photoUrl: string | null;
  candidates: StaffCandidate[];
  myStaffId: string | null;
}) {
  const inactive = ["cancelled", "expired"].includes(r.status);
  return (
    <li className={cn("rounded-2xl border border-slate-200 bg-white p-3", inactive && "opacity-60")}>
      <div className="flex items-start gap-3">
        {r.pet &&
          (photoUrl ? (
            <a href={photoUrl} target="_blank" rel="noreferrer" className="shrink-0" aria-label={`ดูรูปของ ${r.pet.name}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt={`รูปของ ${r.pet.name}`} className="h-14 w-14 rounded-2xl object-cover" />
            </a>
          ) : (
            <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
              {SPECIES_EMOJI[r.pet.species]}
            </span>
          ))}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-mono text-sm font-semibold">
              {formatTime(r.starts_at, tz)}–{formatTime(r.ends_at, tz)}
            </p>
            <StatusBadge status={r.status} />
          </div>
          {r.pet && (
            <p className="truncate font-medium text-slate-900">
              {r.pet.name}{" "}
              <span className="font-normal text-slate-500">
                · {SPECIES_LABELS[r.pet.species]}
                {r.pet.breed && ` · ${r.pet.breed}`}
                {r.pet.weight_kg && ` · ${Number(r.pet.weight_kg)} กก.`}
              </span>
            </p>
          )}
          <Link href={`/dashboard/${slug}/customers/${r.customer.id}`} className={cn("block truncate hover:text-brand", r.pet ? "text-sm text-slate-600" : "font-medium")}>
            {r.pet ? `เจ้าของ: ${r.customer.full_name}` : r.customer.full_name}
          </Link>
          <p className="truncate text-sm text-slate-500">
            {r.service.name} · <a href={`tel:${r.customer.phone}`}>{r.customer.phone}</a>
          </p>
          <p className="text-xs text-slate-400">
            {r.reference_code} · {r.source === "online" ? "จองออนไลน์" : "ร้านบันทึก"}
            {Number(r.price) > 0 && ` · ${formatMoney(Number(r.price))}`}
          </p>
          {r.pet?.notes && <p className="mt-1 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-800">ข้อควรระวัง: {r.pet.notes}</p>}
          {r.customer_note && <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">ลูกค้า: {r.customer_note}</p>}
        </div>
      </div>
      <AppointmentActions
        id={r.id}
        status={r.status}
        internalNote={r.internal_note}
        date={toDateKey(new Date(r.starts_at), tz)}
        time={formatTime(r.starts_at, tz)}
        candidates={candidates}
        myStaffId={myStaffId}
      />
    </li>
  );
}
