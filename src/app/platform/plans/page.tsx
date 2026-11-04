import { ActionForm } from "@/components/action-form";
import { Card, Checkbox, Field, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/modules/booking/types";
import { savePlan } from "../actions";

function PlanForm({ plan }: { plan?: Plan & { is_public?: boolean } }) {
  return (
    <ActionForm action={savePlan.bind(null, plan?.id ?? null)} resetOnSuccess={!plan}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code" name="code" defaultValue={plan?.code} required />
        <Field label="ชื่อ" name="name" defaultValue={plan?.name} required />
        <Field label="ราคา/เดือน (฿)" name="price_monthly" type="number" min={0} defaultValue={plan?.price_monthly ?? 0} />
        <Field label="สาขาสูงสุด" name="max_branches" type="number" min={0} defaultValue={plan?.max_branches ?? ""} hint="(ว่าง = ไม่จำกัด)" />
        <Field label="พนักงานสูงสุด" name="max_staff" type="number" min={0} defaultValue={plan?.max_staff ?? ""} />
        <Field label="บริการสูงสุด" name="max_services" type="number" min={0} defaultValue={plan?.max_services ?? ""} />
        <Field label="การจอง/เดือน" name="max_bookings_per_month" type="number" min={0} defaultValue={plan?.max_bookings_per_month ?? ""} />
      </div>
      <div className="flex flex-wrap gap-4">
        <Checkbox label="Custom domain" name="custom_domain" defaultChecked={plan?.features?.custom_domain ?? false} />
        <Checkbox label="Reports" name="reports" defaultChecked={plan?.features?.reports ?? false} />
        <Checkbox label="แสดงต่อสาธารณะ" name="is_public" defaultChecked={plan?.is_public ?? true} />
      </div>
    </ActionForm>
  );
}

export default async function PlansPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("booking_plans").select("*").order("price_monthly");
  const plans = (data ?? []) as (Plan & { is_public: boolean })[];
  return (
    <div className="space-y-6">
      <PageHeader title="แพ็กเกจ" description="โควตาถูกบังคับใช้ในฐานข้อมูล (trigger) ทั้งจาก UI และ API" />
      <div className="grid gap-6 lg:grid-cols-2">
        {plans.map((p) => (
          <Card key={p.id}>
            <h2 className="mb-4 font-semibold">{p.name}</h2>
            <PlanForm plan={p} />
          </Card>
        ))}
        <Card>
          <h2 className="mb-4 font-semibold">+ แพ็กเกจใหม่</h2>
          <PlanForm />
        </Card>
      </div>
    </div>
  );
}
