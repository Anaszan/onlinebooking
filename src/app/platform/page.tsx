import Link from "next/link";
import { Badge, Card, Input, PageHeader, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { Plan, Tenant } from "@/modules/booking/types";

const STATUSES = ["trial", "active", "past_due", "suspended", "cancelled"];
const tone = { active: "green", trial: "blue", past_due: "amber", suspended: "red", cancelled: "slate" } as const;

export default async function PlatformTenantsPage(props: PageProps<"/platform">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().replace(/[%,()]/g, "") : "";
  const status = typeof sp.status === "string" && STATUSES.includes(sp.status) ? sp.status : "";
  const supabase = await createClient();

  let query = supabase.from("booking_tenants").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(200);
  if (q) query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`);
  if (status) query = query.eq("status", status);
  const [{ data, count }, { data: planRows }] = await Promise.all([query, supabase.from("booking_plans").select("*")]);
  const tenants = (data ?? []) as Tenant[];
  const plans = new Map(((planRows ?? []) as Plan[]).map((p) => [p.id, p]));

  return (
    <div className="space-y-5">
      <PageHeader title="ร้านค้าทั้งหมด" description={`${count ?? 0} ร้าน`} />
      <form method="get" className="flex max-w-xl gap-2">
        <Input name="q" defaultValue={q} placeholder="ค้นหาชื่อ / slug" />
        <Select name="status" defaultValue={status} className="w-40">
          <option value="">ทุกสถานะ</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <button className="rounded-lg bg-slate-900 px-4 text-sm font-medium text-white">ค้นหา</button>
      </form>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">ร้าน</th>
              <th className="px-4 py-2.5 font-medium">แพ็กเกจ</th>
              <th className="px-4 py-2.5 font-medium">สถานะ</th>
              <th className="px-4 py-2.5 font-medium">สร้างเมื่อ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`/platform/tenants/${t.id}`} className="font-medium text-brand">
                    {t.name}
                  </Link>
                  <span className="block font-mono text-xs text-slate-500">{t.slug}</span>
                </td>
                <td className="px-4 py-2.5">{t.plan_id ? plans.get(t.plan_id)?.name : "—"}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={tone[t.status]}>{t.status}</Badge>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(t.created_at))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
