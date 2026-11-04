import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Label, PageHeader, StatusBadge, Textarea, formatMoney } from "@/components/ui";
import { getTenantContext } from "@/lib/auth";
import { formatDateTime } from "@/lib/time";
import type { AppointmentStatus, Customer } from "@/modules/booking/types";
import { updateCustomer } from "../../actions";

export default async function CustomerDetailPage(props: PageProps<"/dashboard/[slug]/customers/[customerId]">) {
  const { slug, customerId } = await props.params;
  const { supabase, tenant, canManage } = await getTenantContext(slug);
  const { data: c } = await supabase.from("booking_customers").select("*").eq("tenant_id", tenant.id).eq("id", customerId).maybeSingle<Customer>();
  if (!c) notFound();

  const { data } = await supabase
    .from("booking_appointments")
    .select("id, starts_at, status, price, reference_code, service:booking_services(name), staff:booking_staff(display_name), branch:booking_branches(timezone)")
    .eq("tenant_id", tenant.id)
    .eq("customer_id", c.id)
    .order("starts_at", { ascending: false })
    .limit(100);
  const history = (data ?? []) as unknown as {
    id: string;
    starts_at: string;
    status: AppointmentStatus;
    price: number;
    reference_code: string;
    service: { name: string };
    staff: { display_name: string };
    branch: { timezone: string };
  }[];
  const completed = history.filter((h) => h.status === "completed");
  const noShows = history.filter((h) => h.status === "no_show").length;

  return (
    <div className="space-y-6">
      <Link href={`/dashboard/${slug}/customers`} className="text-sm text-slate-500">
        ← ลูกค้าทั้งหมด
      </Link>
      <PageHeader
        title={c.full_name}
        description={`${c.phone}${c.email ? ` · ${c.email}` : ""}`}
        actions={
          <a href={`tel:${c.phone}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            โทร
          </a>
        }
      />
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-sm text-slate-500">จองทั้งหมด</p>
          <p className="text-2xl font-semibold">{history.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">ยอดใช้บริการ</p>
          <p className="text-2xl font-semibold">{formatMoney(completed.reduce((s, h) => s + Number(h.price), 0))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">ไม่มาตามนัด</p>
          <p className="text-2xl font-semibold">{noShows}</p>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="mb-3 font-semibold">ประวัติการจอง</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="font-medium">{h.service.name}</p>
                  <p className="text-slate-500">
                    {formatDateTime(h.starts_at, h.branch.timezone)} · {h.staff.display_name} · {h.reference_code}
                  </p>
                </div>
                <StatusBadge status={h.status} />
              </li>
            ))}
          </ul>
        </Card>
        {canManage && (
          <Card className="lg:col-span-2">
            <h2 className="mb-4 font-semibold">ข้อมูลลูกค้า</h2>
            <ActionForm action={updateCustomer.bind(null, slug, c.id)}>
              <Field label="ชื่อ" name="full_name" defaultValue={c.full_name} required />
              <Field label="อีเมล" name="email" type="email" defaultValue={c.email ?? ""} />
              <div>
                <Label htmlFor="notes">หมายเหตุ (เห็นเฉพาะร้าน)</Label>
                <Textarea id="notes" name="notes" defaultValue={c.notes ?? ""} />
              </div>
            </ActionForm>
          </Card>
        )}
      </div>
    </div>
  );
}
