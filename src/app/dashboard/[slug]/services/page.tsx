import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Checkbox, EmptyState, Field, Label, PageHeader, Textarea, formatMoney } from "@/components/ui";
import { getTenantContext } from "@/lib/auth";
import type { Service } from "@/modules/booking/types";
import { saveService } from "../actions";

export const metadata = { title: "บริการ" };

export default async function ServicesPage(props: PageProps<"/dashboard/[slug]/services">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { supabase, tenant, canManage } = await getTenantContext(slug);
  const { data } = await supabase.from("booking_services").select("*").eq("tenant_id", tenant.id).order("sort_order").order("name");
  const services = (data ?? []) as Service[];
  const editing = typeof sp.edit === "string" ? services.find((s) => s.id === sp.edit) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="บริการ" description="กำหนดชื่อ ราคา ระยะเวลา และเวลาเผื่อ (buffer) ของแต่ละบริการ" />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-3">
          {services.length === 0 ? (
            <EmptyState title="ยังไม่มีบริการ" description="เพิ่มบริการแรกจากฟอร์มด้านขวา" />
          ) : (
            services.map((s) => (
              <Card key={s.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {s.name}{" "}
                    {!s.is_active && <Badge tone="red">ปิดใช้งาน</Badge>} {s.is_active && !s.is_online_bookable && <Badge tone="amber">ไม่เปิดจองออนไลน์</Badge>}
                  </p>
                  <p className="text-sm text-slate-500">
                    {s.duration_minutes} นาที · {formatMoney(Number(s.price))}
                    {(s.buffer_before_min > 0 || s.buffer_after_min > 0) && ` · buffer ${s.buffer_before_min}/${s.buffer_after_min} นาที`}
                  </p>
                </div>
                {canManage && (
                  <Link href={`?edit=${s.id}`} className="shrink-0 text-sm font-medium text-brand">
                    แก้ไข
                  </Link>
                )}
              </Card>
            ))
          )}
        </div>

        {canManage && (
          <Card className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">{editing ? `แก้ไข: ${editing.name}` : "เพิ่มบริการ"}</h2>
              {editing && (
                <Link href="?" className="text-sm text-slate-500">
                  ยกเลิก
                </Link>
              )}
            </div>
            <ActionForm key={editing?.id ?? "new"} action={saveService.bind(null, slug, editing?.id ?? null)} resetOnSuccess={!editing}>
              <Field label="ชื่อบริการ" name="name" defaultValue={editing?.name} required />
              <div>
                <Label htmlFor="description">รายละเอียด</Label>
                <Textarea id="description" name="description" defaultValue={editing?.description ?? ""} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ระยะเวลา (นาที)" name="duration_minutes" type="number" min={5} max={1440} defaultValue={editing?.duration_minutes ?? 60} required />
                <Field label="ราคา (บาท)" name="price" type="number" min={0} step="0.01" defaultValue={editing?.price ?? 0} required />
                <Field label="Buffer ก่อน (นาที)" name="buffer_before_min" type="number" min={0} max={240} defaultValue={editing?.buffer_before_min ?? 0} />
                <Field label="Buffer หลัง (นาที)" name="buffer_after_min" type="number" min={0} max={240} defaultValue={editing?.buffer_after_min ?? 0} />
              </div>
              <div className="flex flex-col gap-2">
                <Checkbox label="เปิดให้จองออนไลน์" name="is_online_bookable" defaultChecked={editing?.is_online_bookable ?? true} />
                <Checkbox label="เปิดใช้งาน" name="is_active" defaultChecked={editing?.is_active ?? true} />
              </div>
            </ActionForm>
          </Card>
        )}
      </div>
    </div>
  );
}
