import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { Plan, Tenant } from "@/modules/booking/types";
import { updateSubscription } from "../../actions";
import { IconArrowLeft, IconArrowUpRight } from "@/components/icons";

export default async function PlatformTenantPage(props: PageProps<"/platform/tenants/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: t } = await supabase.from("booking_tenants").select("*").eq("id", id).maybeSingle<Tenant>();
  if (!t) notFound();

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const head = { count: "exact" as const, head: true };
  const [plans, branches, staff, services, members, bookingsMonth, bookingsAll, domains, logs] = await Promise.all([
    supabase.from("booking_plans").select("*").order("price_monthly"),
    supabase.from("booking_branches").select("id", head).eq("tenant_id", id),
    supabase.from("booking_staff").select("id", head).eq("tenant_id", id),
    supabase.from("booking_services").select("id", head).eq("tenant_id", id),
    supabase.from("booking_members").select("id", head).eq("tenant_id", id),
    supabase.from("booking_appointments").select("id", head).eq("tenant_id", id).gte("created_at", monthStart).not("status", "in", "(cancelled,expired)"),
    supabase.from("booking_appointments").select("id", head).eq("tenant_id", id),
    supabase.from("booking_domains").select("hostname, status").eq("tenant_id", id),
    supabase.from("booking_audit_logs").select("*").eq("tenant_id", id).order("created_at", { ascending: false }).limit(30),
  ]);
  const planList = (plans.data ?? []) as Plan[];
  const plan = planList.find((p) => p.id === t.plan_id);

  const usage: [string, number | null, number | null | undefined][] = [
    ["สาขา", branches.count, plan?.max_branches],
    ["พนักงาน", staff.count, plan?.max_staff],
    ["บริการ", services.count, plan?.max_services],
    ["การจองเดือนนี้", bookingsMonth.count, plan?.max_bookings_per_month],
    ["การจองทั้งหมด", bookingsAll.count, undefined],
    ["สมาชิก", members.count, undefined],
  ];

  return (
    <div className="space-y-6">
      <Link href="/platform" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <IconArrowLeft size={14} />
        ร้านค้าทั้งหมด
      </Link>
      <PageHeader
        title={t.name}
        description={`/${t.slug} · ${t.id}`}
        actions={
          <>
            <a href={`/s/${t.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm hover:bg-slate-50">
              หน้าร้าน
              <IconArrowUpRight size={14} />
            </a>
            <Link href={`/dashboard/${t.slug}`} className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm hover:bg-slate-50">
              เปิด Dashboard (support)
            </Link>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-semibold">การใช้งาน</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {usage.map(([label, n, limit]) => (
              <div key={label} className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-lg font-semibold">
                  {n ?? 0}
                  {limit !== undefined && <span className="text-sm font-normal text-slate-500"> / {limit ?? "∞"}</span>}
                </p>
              </div>
            ))}
          </div>
          <h3 className="mb-2 mt-5 text-sm font-semibold">โดเมน</h3>
          <ul className="text-sm text-slate-600">
            {(domains.data ?? []).length === 0 && <li>—</li>}
            {(domains.data ?? []).map((d: { hostname: string; status: string }) => (
              <li key={d.hostname} className="font-mono">
                {d.hostname} <span className="text-xs">({d.status})</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">แพ็กเกจ & สถานะ</h2>
          <ActionForm action={updateSubscription.bind(null, t.id)} confirm="ยืนยันการเปลี่ยนแพ็กเกจ/สถานะของร้านนี้?">
            <div>
              <Label htmlFor="plan_id">แพ็กเกจ</Label>
              <Select id="plan_id" name="plan_id" defaultValue={t.plan_id ?? undefined}>
                {planList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.price_monthly}฿)
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="status">สถานะ</Label>
              <Select id="status" name="status" defaultValue={t.status}>
                {["trial", "active", "past_due", "suspended", "cancelled"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="trial_ends_at">Trial หมดอายุ</Label>
              <Input id="trial_ends_at" type="date" name="trial_ends_at" defaultValue={t.trial_ends_at?.slice(0, 10) ?? ""} />
            </div>
          </ActionForm>
        </Card>
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Audit log</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {(logs.data ?? []).map((l: { id: number; action: string; created_at: string; details: unknown; actor_id: string | null }) => (
            <li key={l.id} className="py-2">
              <span className="font-medium">{l.action}</span>{" "}
              <span className="text-slate-500">{new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short" }).format(new Date(l.created_at))}</span>
              <pre className="mt-1 overflow-x-auto text-xs text-slate-500">{JSON.stringify(l.details)}</pre>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
