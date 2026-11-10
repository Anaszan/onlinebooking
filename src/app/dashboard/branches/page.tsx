import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ActionButton } from "@/components/action-button";
import { Badge, Card, Checkbox, Field, Input, Label, PageHeader, Select, TIMEZONES } from "@/components/ui";
import { getTenantContext } from "@/lib/auth";
import { formatDateTime, toDateKey } from "@/lib/time";
import type { Branch, Staff, TimeOff } from "@/modules/booking/types";
import { addTimeOff, deleteTimeOff, saveBranch } from "../actions";

export const metadata = { title: "สาขา & วันหยุด" };

export default async function BranchesPage(props: PageProps<"/dashboard/[slug]/branches">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { supabase, tenant, canManage } = await getTenantContext(slug);
  const [{ data: b }, { data: s }, { data: t }] = await Promise.all([
    supabase.from("booking_branches").select("*").eq("tenant_id", tenant.id).order("created_at"),
    supabase.from("booking_staff").select("*").eq("tenant_id", tenant.id).order("display_name"),
    supabase
      .from("booking_time_off")
      .select("*")
      .eq("tenant_id", tenant.id)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at")
      .limit(100),
  ]);
  const branches = (b ?? []) as Branch[];
  const staff = (s ?? []) as Staff[];
  const timeOff = (t ?? []) as TimeOff[];
  const editing = typeof sp.edit === "string" ? branches.find((x) => x.id === sp.edit) : undefined;
  const today = toDateKey(new Date(), branches[0]?.timezone ?? "Asia/Bangkok");

  return (
    <div className="space-y-8">
      <PageHeader title="สาขา & วันหยุด" />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-3">
          {branches.map((x) => (
            <Card key={x.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">
                  {x.name} {!x.is_active && <Badge tone="red">ปิด</Badge>}
                </p>
                <p className="text-sm text-slate-500">
                  {x.address ?? "—"} · {x.timezone}
                </p>
              </div>
              {canManage && (
                <Link href={`?edit=${x.id}`} className="text-sm font-medium text-brand">
                  แก้ไข
                </Link>
              )}
            </Card>
          ))}
        </div>
        {canManage && (
          <Card className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">{editing ? `แก้ไขสาขา: ${editing.name}` : "เพิ่มสาขา"}</h2>
              {editing && (
                <Link href="?" className="text-sm text-slate-500">
                  ยกเลิก
                </Link>
              )}
            </div>
            <ActionForm key={editing?.id ?? "new"} action={saveBranch.bind(null, slug, editing?.id ?? null)} resetOnSuccess={!editing}>
              <Field label="ชื่อสาขา" name="name" defaultValue={editing?.name} required />
              <Field label="ที่อยู่" name="address" defaultValue={editing?.address ?? ""} />
              <Field label="เบอร์โทร" name="phone" defaultValue={editing?.phone ?? ""} />
              <div>
                <Label htmlFor="timezone">เขตเวลา</Label>
                <Select id="timezone" name="timezone" defaultValue={editing?.timezone ?? "Asia/Bangkok"}>
                  {TIMEZONES.map((tz) => (
                    <option key={tz}>{tz}</option>
                  ))}
                </Select>
              </div>
              <Checkbox label="เปิดให้บริการ" name="is_active" defaultChecked={editing?.is_active ?? true} />
            </ActionForm>
          </Card>
        )}
      </div>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h2 className="mb-3 text-lg font-semibold">วันหยุด / วันลา ที่กำลังจะมาถึง</h2>
          {timeOff.length === 0 ? (
            <p className="text-sm text-slate-500">ไม่มี</p>
          ) : (
            <ul className="space-y-2">
              {timeOff.map((o) => {
                const br = branches.find((x) => x.id === o.branch_id);
                const tz = br?.timezone ?? "Asia/Bangkok";
                return (
                  <Card key={o.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {o.staff_id ? staff.find((x) => x.id === o.staff_id)?.display_name : `ปิดทั้งสาขา: ${br?.name}`}
                        {o.reason && <span className="font-normal text-slate-500"> — {o.reason}</span>}
                      </p>
                      <p className="text-slate-500">
                        {formatDateTime(o.starts_at, tz)} → {formatDateTime(o.ends_at, tz)}
                      </p>
                    </div>
                    {canManage && <ActionButton action={deleteTimeOff.bind(null, slug, o.id)} label="ลบ" confirm="ลบรายการนี้?" />}
                  </Card>
                );
              })}
            </ul>
          )}
        </div>
        {canManage && (
          <Card className="lg:col-span-2">
            <h2 className="mb-4 font-semibold">เพิ่มวันหยุด / วันลา</h2>
            <ActionForm action={addTimeOff.bind(null, slug)} resetOnSuccess>
              <div>
                <Label htmlFor="to_branch">สาขา</Label>
                <Select id="to_branch" name="branch_id" required>
                  {branches.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="to_staff">พนักงาน</Label>
                <Select id="to_staff" name="staff_id">
                  <option value="">— ปิดทั้งสาขา (วันหยุดร้าน) —</option>
                  {staff.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.display_name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>เริ่ม</Label>
                  <Input type="date" name="start_date" defaultValue={today} required />
                </div>
                <div>
                  <Label>&nbsp;</Label>
                  <Input type="time" name="start_time" defaultValue="00:00" required />
                </div>
                <div>
                  <Label>สิ้นสุด</Label>
                  <Input type="date" name="end_date" defaultValue={today} required />
                </div>
                <div>
                  <Label>&nbsp;</Label>
                  <Input type="time" name="end_time" defaultValue="23:59" required />
                </div>
              </div>
              <Field label="เหตุผล" name="reason" placeholder="เช่น วันหยุดสงกรานต์" />
            </ActionForm>
          </Card>
        )}
      </section>
    </div>
  );
}
