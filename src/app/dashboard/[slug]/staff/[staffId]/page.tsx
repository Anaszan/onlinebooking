import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Card, Checkbox, Field, Input, Label, PageHeader, Select } from "@/components/ui";
import { getTenantContext } from "@/lib/auth";
import { WEEKDAY_LABELS_TH } from "@/lib/time";
import type { Branch, Service, Staff, WorkingHour } from "@/modules/booking/types";
import { saveStaff, saveStaffServices, saveWorkingHours } from "../../actions";
import { IconArrowLeft } from "@/components/icons";

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun

export default async function StaffDetailPage(props: PageProps<"/dashboard/[slug]/staff/[staffId]">) {
  const { slug, staffId } = await props.params;
  const { supabase, tenant, canManage } = await getTenantContext(slug);

  const { data: st } = await supabase.from("booking_staff").select("*").eq("tenant_id", tenant.id).eq("id", staffId).maybeSingle<Staff>();
  if (!st) notFound();

  const [{ data: b }, { data: h }, { data: sv }, { data: links }] = await Promise.all([
    supabase.from("booking_branches").select("*").eq("tenant_id", tenant.id).order("created_at"),
    supabase.from("booking_working_hours").select("*").eq("tenant_id", tenant.id).eq("staff_id", staffId).order("start_time"),
    supabase.from("booking_services").select("*").eq("tenant_id", tenant.id).order("sort_order"),
    supabase.from("booking_staff_services").select("service_id").eq("tenant_id", tenant.id).eq("staff_id", staffId),
  ]);
  const branches = (b ?? []) as Branch[];
  const hours = (h ?? []) as WorkingHour[];
  const services = (sv ?? []) as Service[];
  const linked = new Set((links ?? []).map((l: { service_id: string }) => l.service_id));
  const allServices = linked.size === 0;

  return (
    <div className="space-y-6">
      <Link href={`/dashboard/${slug}/staff`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <IconArrowLeft size={14} />
        พนักงานทั้งหมด
      </Link>
      <PageHeader title={st.display_name} description={branches.find((x) => x.id === st.branch_id)?.name} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-semibold">เวลาทำงานประจำสัปดาห์</h2>
          <p className="mb-4 text-sm text-slate-500">ตามเวลาท้องถิ่นของสาขา · ช่วงที่ 2 ใช้เมื่อมีพักกลางวัน (เว้นว่างได้)</p>
          <ActionForm action={saveWorkingHours.bind(null, slug, st.id)}>
            <div className="space-y-2">
              {ORDER.map((d) => {
                const w = hours.filter((x) => x.weekday === d);
                return (
                  <div key={d} className="grid grid-cols-[110px_1fr] items-center gap-2 sm:grid-cols-[110px_1fr_1fr]">
                    <Checkbox label={WEEKDAY_LABELS_TH[d]} name={`d${d}_on`} defaultChecked={w.length > 0} disabled={!canManage} />
                    <div className="flex items-center gap-1">
                      <Input type="time" name={`d${d}_s1`} defaultValue={w[0]?.start_time.slice(0, 5) ?? "09:00"} className="px-2" disabled={!canManage} />
                      <span className="text-slate-400">–</span>
                      <Input type="time" name={`d${d}_e1`} defaultValue={w[0]?.end_time.slice(0, 5) ?? "18:00"} className="px-2" disabled={!canManage} />
                    </div>
                    <div className="col-start-2 flex items-center gap-1 sm:col-start-auto">
                      <Input type="time" name={`d${d}_s2`} defaultValue={w[1]?.start_time.slice(0, 5) ?? ""} className="px-2" disabled={!canManage} />
                      <span className="text-slate-400">–</span>
                      <Input type="time" name={`d${d}_e2`} defaultValue={w[1]?.end_time.slice(0, 5) ?? ""} className="px-2" disabled={!canManage} />
                    </div>
                  </div>
                );
              })}
            </div>
          </ActionForm>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 font-semibold">บริการที่ทำได้</h2>
            <ActionForm action={saveStaffServices.bind(null, slug, st.id)}>
              <Checkbox label="ทำได้ทุกบริการ" name="all_services" defaultChecked={allServices} />
              <div className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
                {services.map((s) => (
                  <Checkbox key={s.id} label={s.name} name="service_ids" value={s.id} defaultChecked={linked.has(s.id)} />
                ))}
              </div>
              <p className="text-xs text-slate-500">ถ้าเลือก &quot;ทำได้ทุกบริการ&quot; ระบบจะไม่สนใจรายการด้านล่าง</p>
            </ActionForm>
          </Card>

          {canManage && (
            <Card>
              <h2 className="mb-4 font-semibold">ข้อมูลพนักงาน</h2>
              <ActionForm action={saveStaff.bind(null, slug, st.id)}>
                <Field label="ชื่อที่แสดง" name="display_name" defaultValue={st.display_name} required />
                <Field label="ตำแหน่ง" name="title" defaultValue={st.title ?? ""} />
                <div>
                  <Label htmlFor="branch_id">สาขา</Label>
                  <Select id="branch_id" name="branch_id" defaultValue={st.branch_id}>
                    {branches.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Checkbox label="เปิดใช้งาน (รับจองได้)" name="is_active" defaultChecked={st.is_active} />
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
