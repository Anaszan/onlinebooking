import { requireShopSlug } from "@/lib/shop";
import Link from "next/link";
import { Alert, Card, PageHeader, StatusBadge } from "@/components/ui";
import { getTenantContext } from "@/lib/auth";
import { dayRangeUtc, formatTime, toDateKey } from "@/lib/time";
import { shopUrl } from "@/lib/env";
import type { AppointmentStatus, Plan } from "@/modules/booking/types";
import { IconArrowRight, IconCheck } from "@/components/icons";

export default async function OverviewPage(props: PageProps<"/dashboard">) {
  const slug = await requireShopSlug();
  const sp = await props.searchParams;
  const { supabase, tenant } = await getTenantContext(slug);

  const { data: branches } = await supabase.from("booking_branches").select("id, timezone").eq("tenant_id", tenant.id).order("created_at");
  const tz = branches?.[0]?.timezone ?? "Asia/Bangkok";
  const today = toDateKey(new Date(), tz);
  const { start, end } = dayRangeUtc(today, tz);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [todayRes, monthRes, planRes, servicesRes, staffRes, hoursRes] = await Promise.all([
    supabase
      .from("booking_appointments")
      .select("id, starts_at, status, reference_code, customer:booking_customers(full_name, phone), service:booking_services(name), staff:booking_staff(display_name)")
      .eq("tenant_id", tenant.id)
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at"),
    supabase
      .from("booking_appointments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .gte("created_at", monthStart)
      .not("status", "in", "(cancelled,expired)"),
    tenant.plan_id
      ? supabase.from("booking_plans").select("*").eq("id", tenant.plan_id).maybeSingle<Plan>()
      : Promise.resolve({ data: null }),
    supabase.from("booking_services").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
    supabase.from("booking_staff").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
    supabase.from("booking_working_hours").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
  ]);

  const todayList = (todayRes.data ?? []) as unknown as {
    id: string;
    starts_at: string;
    status: AppointmentStatus;
    reference_code: string;
    customer: { full_name: string; phone: string };
    service: { name: string };
    staff: { display_name: string };
  }[];
  const plan = planRes.data as Plan | null;
  const active = todayList.filter((a) => !["cancelled", "expired"].includes(a.status));
  const counts = {
    total: active.length,
    done: todayList.filter((a) => a.status === "completed").length,
    waiting: todayList.filter((a) => ["pending", "confirmed"].includes(a.status)).length,
    noShow: todayList.filter((a) => a.status === "no_show").length,
  };

  const setup = [
    { done: (servicesRes.count ?? 0) > 0, label: "เพิ่มบริการ", href: "/services" },
    { done: (staffRes.count ?? 0) > 0, label: "เพิ่มพนักงาน", href: "/staff" },
    { done: (hoursRes.count ?? 0) > 0, label: "ตั้งเวลาทำงาน", href: "/staff" },
  ];
  const setupDone = setup.every((s) => s.done);

  return (
    <div className="space-y-6">
      <PageHeader title="ภาพรวม" description={`วันนี้ ${new Intl.DateTimeFormat("th-TH", { dateStyle: "full", timeZone: tz }).format(new Date())}`} />

      {sp.welcome === "1" && <Alert tone="success">สร้างร้านสำเร็จ! ทำตามขั้นตอนด้านล่างเพื่อเปิดรับจอง</Alert>}

      {!setupDone && (
        <Card>
          <h2 className="mb-4 font-semibold">เริ่มต้นใช้งาน</h2>
          <ol className="space-y-3 text-sm">
            {setup.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3">
                <span
                  className={
                    s.done
                      ? "flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white"
                      : "tnum flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-xs text-slate-500"
                  }
                >
                  {s.done ? <IconCheck size={14} strokeWidth={2.5} /> : i + 1}
                </span>
                <Link href={`/dashboard${s.href}`} className={s.done ? "text-slate-500 line-through" : "font-medium text-slate-900 underline hover:no-underline"}>
                  {s.label}
                </Link>
              </li>
            ))}
            <li className="flex items-center gap-3">
              <span className="tnum flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-xs text-slate-500">4</span>
              <span>
                แชร์ลิงก์ร้าน:{" "}
                <a href={"/"} className="font-mono text-brand" target="_blank" rel="noreferrer">
                  {shopUrl()}
                </a>
              </span>
            </li>
          </ol>
        </Card>
      )}

      <dl className="grid grid-cols-2 overflow-hidden rounded-3xl border-2 border-white bg-white shadow-md lg:grid-cols-4">
        {[
          ["คิววันนี้", counts.total],
          ["รอให้บริการ", counts.waiting],
          ["เสร็จสิ้น", counts.done],
          ["ไม่มาตามนัด", counts.noShow],
        ].map(([label, n], i) => (
          <div
            key={label as string}
            className={`px-5 py-4 ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""} border-slate-100`}
          >
            <dt className="text-[13px] text-slate-500">{label}</dt>
            <dd className="tnum mt-1 font-display text-3xl text-brand">{n}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">คิววันนี้</h2>
            <Link
              href={`/dashboard/appointments`}
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              จัดการคิว
              <IconArrowRight size={14} />
            </Link>
          </div>
          {todayList.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">ยังไม่มีคิววันนี้</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {todayList.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="tnum w-12 font-medium text-slate-900">{formatTime(a.starts_at, tz)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{a.customer.full_name}</span>
                    <span className="block truncate text-slate-500">
                      {a.service.name} · {a.staff.display_name}
                    </span>
                  </span>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">การใช้งานเดือนนี้</h2>
          <p className="text-sm text-slate-500">แพ็กเกจ</p>
          <p className="mb-3 font-medium">{plan?.name ?? "-"}</p>
          <p className="text-sm text-slate-500">จำนวนการจอง</p>
          <p className="font-medium">
            {monthRes.count ?? 0} / {plan?.max_bookings_per_month ?? "ไม่จำกัด"}
          </p>
          {plan?.max_bookings_per_month ? (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-brand"
                style={{ width: `${Math.min(100, ((monthRes.count ?? 0) / plan.max_bookings_per_month) * 100)}%` }}
              />
            </div>
          ) : null}
          {tenant.status === "trial" && tenant.trial_ends_at && (
            <p className="mt-4 text-xs text-slate-500">
              ทดลองใช้ถึง {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(tenant.trial_ends_at))}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
