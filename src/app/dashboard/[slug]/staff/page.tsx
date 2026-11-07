import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Checkbox, EmptyState, Field, Label, PageHeader, Select } from "@/components/ui";
import { getTenantContext } from "@/lib/auth";
import { WEEKDAY_LABELS_TH } from "@/lib/time";
import type { Branch, Staff, WorkingHour } from "@/modules/booking/types";
import { saveStaff } from "../actions";
import { IconChevronRight } from "@/components/icons";

export const metadata = { title: "พนักงาน" };

export default async function StaffPage(props: PageProps<"/dashboard/[slug]/staff">) {
  const { slug } = await props.params;
  const { supabase, tenant, canManage } = await getTenantContext(slug);
  const [{ data: s }, { data: b }, { data: h }] = await Promise.all([
    supabase.from("booking_staff").select("*").eq("tenant_id", tenant.id).order("display_name"),
    supabase.from("booking_branches").select("*").eq("tenant_id", tenant.id).order("created_at"),
    supabase.from("booking_working_hours").select("*").eq("tenant_id", tenant.id),
  ]);
  const staff = (s ?? []) as Staff[];
  const branches = (b ?? []) as Branch[];
  const hours = (h ?? []) as WorkingHour[];

  return (
    <div className="space-y-6">
      <PageHeader title="พนักงาน" description="เพิ่มพนักงาน กำหนดเวลาทำงาน บริการที่แต่ละคนทำได้ และสร้างบัญชีเข้าระบบให้พนักงาน" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-3">
          {staff.length === 0 ? (
            <EmptyState title="ยังไม่มีพนักงาน" description="ต้องมีพนักงานอย่างน้อย 1 คนเพื่อเปิดรับจอง" />
          ) : (
            staff.map((st) => {
              const days = [...new Set(hours.filter((x) => x.staff_id === st.id).map((x) => x.weekday))].sort();
              return (
                <Link key={st.id} href={`/dashboard/${slug}/staff/${st.id}`} className="block">
                  <Card className="flex items-center justify-between gap-3 p-4 hover:border-brand">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {st.display_name} {!st.is_active && <Badge tone="red">ปิดใช้งาน</Badge>}{" "}
                        {st.user_id && <Badge tone="green">มีบัญชีเข้าระบบ</Badge>}
                      </p>
                      <p className="text-sm text-slate-500">
                        {st.title ? `${st.title} · ` : ""}
                        {branches.find((x) => x.id === st.branch_id)?.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {days.length ? `ทำงาน: ${days.map((d) => WEEKDAY_LABELS_TH[d].slice(0, 2)).join(" ")}` : "ยังไม่ได้ตั้งเวลาทำงาน"}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-slate-600">ตั้งค่า<IconChevronRight size={14} /></span>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
        {canManage && (
          <Card className="lg:col-span-2">
            <h2 className="mb-4 font-semibold">เพิ่มพนักงาน</h2>
            <ActionForm action={saveStaff.bind(null, slug, null)} resetOnSuccess>
              <Field label="ชื่อที่แสดง" name="display_name" required />
              <Field label="ตำแหน่ง" name="title" placeholder="เช่น ช่างกรูมมิ่ง, สัตวแพทย์" />
              <div>
                <Label htmlFor="branch_id">สาขา</Label>
                <Select id="branch_id" name="branch_id" required>
                  {branches.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Checkbox label="เปิดใช้งาน" name="is_active" defaultChecked />
            </ActionForm>
          </Card>
        )}
      </div>
    </div>
  );
}
