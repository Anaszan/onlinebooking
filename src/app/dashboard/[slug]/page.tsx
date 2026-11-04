import Link from "next/link";
import { Alert, Card, PageHeader, StatusBadge } from "@/components/ui";
import { getTenantContext } from "@/lib/auth";
import { dayRangeUtc, formatTime, toDateKey } from "@/lib/time";
import { shopUrl } from "@/lib/env";
import type { AppointmentStatus, Plan } from "@/modules/booking/types";

export default async function OverviewPage(props: PageProps<"/dashboard/[slug]">) {
  const { slug } = await props.params;
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
          <h2 className="mb-3 font-semibold">เริ่มต้นใช้งาน</h2>
          <ol className="space-y-2 text-sm">
            {setup.map((s, i) => (
              <li key={s.label} className="flex items-center gap-2">
                <span className={s.done ? "text-emerald-600" : "text-slate-400"}>{s.done ? "✓" : `${i + 1}.`}</span>
                <Link href={`/dashboard/${slug}${s.href}`} className={s.done ? "text-slate-400 line-through" : "font-medium text-brand"}>
                  {s.label}
                </Link>
              </li>
            ))}
            <li className="flex items-center gap-2">
              <span className="text-slate-400">4.</span>
              <span>
                แชร์ลิงก์ร้าน:{" "}
                <a href={`/s/${tenant.slug}`} className="font-mono text-brand" target="_blank" rel="noreferrer">
                  {shopUrl(tenant.slug)}
                </a>
              </span>
            </li>
          </ol>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["คิววันนี้", counts.total],
          ["รอให้บริการ", counts.waiting],
          ["เสร็จสิ้น", counts.done],
          ["ไม่มาตามนัด", counts.noShow],
        ].map(([label, n]) => (
          <Card key={label as string} className="p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-3xl font-semibold">{n}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">คิววันนี้</h2>
            <Link href={`/dashboard/${slug}/appointments`} className="text-sm text-brand">
              จัดการคิว →
            </Link>
          </div>
          {todayList.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">ยังไม่มีคิววันนี้</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {todayList.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-12 font-mono font-medium">{formatTime(a.starts_at, tz)}</span>
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
