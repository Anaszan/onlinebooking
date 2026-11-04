import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default async function AuditPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("booking_audit_logs")
    .select("id, action, entity, entity_id, details, actor_id, created_at, tenant:booking_tenants(id, name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const logs = (data ?? []) as unknown as {
    id: number;
    action: string;
    entity: string;
    entity_id: string | null;
    details: unknown;
    actor_id: string | null;
    created_at: string;
    tenant: { id: string; name: string } | null;
  }[];

  return (
    <div className="space-y-5">
      <PageHeader title="Audit Logs" description="การเปลี่ยนแพ็กเกจ สถานะ และสิทธิ์สมาชิก (200 รายการล่าสุด)" />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">เวลา</th>
              <th className="px-4 py-2.5 font-medium">ร้าน</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
              <th className="px-4 py-2.5 font-medium">รายละเอียด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                  {new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short" }).format(new Date(l.created_at))}
                </td>
                <td className="px-4 py-2">{l.tenant ? <Link href={`/platform/tenants/${l.tenant.id}`} className="text-brand">{l.tenant.name}</Link> : "—"}</td>
                <td className="px-4 py-2 font-medium">{l.action}</td>
                <td className="max-w-md truncate px-4 py-2 font-mono text-xs text-slate-500">{JSON.stringify(l.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
