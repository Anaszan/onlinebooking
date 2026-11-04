import { ActionForm } from "@/components/action-form";
import { ActionButton } from "@/components/action-button";
import { Alert, Badge, Card, Checkbox, Field, Label, PageHeader, Textarea } from "@/components/ui";
import { getTenantContext } from "@/lib/auth";
import { env, shopUrl } from "@/lib/env";
import { ROLE_LABELS, type Domain, type MemberRole } from "@/modules/booking/types";
import { addDomain, removeDomain, updateSettings, verifyDomain } from "../actions";

export const metadata = { title: "ตั้งค่า" };

const domainTone = { active: "green", verified: "green", provisioning: "blue", pending_verification: "amber", failed: "red" } as const;

export default async function SettingsPage(props: PageProps<"/dashboard/[slug]/settings">) {
  const { slug } = await props.params;
  const { supabase, tenant, canAdmin } = await getTenantContext(slug);
  const [{ data: d }, { data: m }] = await Promise.all([
    supabase.from("booking_domains").select("*").eq("tenant_id", tenant.id).order("created_at"),
    supabase.from("booking_members").select("user_id, role, created_at").eq("tenant_id", tenant.id).order("created_at"),
  ]);
  const domains = (d ?? []) as Domain[];
  const members = (m ?? []) as { user_id: string; role: MemberRole }[];
  const rootHost = env.rootDomain.split(":")[0];

  return (
    <div className="space-y-8">
      <PageHeader title="ตั้งค่าร้าน" />
      {!canAdmin && <Alert tone="info">เฉพาะเจ้าของ/ผู้ดูแลเท่านั้นที่แก้ไขการตั้งค่าได้</Alert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">ข้อมูลร้าน & ธีม</h2>
          <ActionForm action={updateSettings.bind(null, slug)}>
            <fieldset disabled={!canAdmin} className="space-y-4">
              <Field label="ชื่อร้าน" name="name" defaultValue={tenant.name} required />
              <div>
                <Label htmlFor="description">คำอธิบายร้าน</Label>
                <Textarea id="description" name="description" defaultValue={tenant.description ?? ""} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="สีหลัก" name="primary_color" type="color" defaultValue={tenant.primary_color} className="[&_input]:h-10 [&_input]:p-1" />
                <Field label="โลโก้ (URL)" name="logo_url" type="url" defaultValue={tenant.logo_url ?? ""} />
                <Field label="เบอร์โทร" name="contact_phone" defaultValue={tenant.contact_phone ?? ""} />
                <Field label="LINE ID" name="contact_line" defaultValue={tenant.contact_line ?? ""} />
              </div>
              <Field label="อีเมลร้าน" name="contact_email" type="email" defaultValue={tenant.contact_email ?? ""} hint="(รับแจ้งเตือนการจองใหม่)" />

              <h3 className="border-t border-slate-100 pt-4 font-semibold">นโยบายการจอง</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ช่วงห่างของเวลา (นาที)" name="slot_interval_minutes" type="number" min={5} max={240} defaultValue={tenant.slot_interval_minutes} />
                <Field label="จองล่วงหน้าขั้นต่ำ (นาที)" name="min_advance_minutes" type="number" min={0} defaultValue={tenant.min_advance_minutes} />
                <Field label="จองล่วงหน้าได้สูงสุด (วัน)" name="max_advance_days" type="number" min={1} max={365} defaultValue={tenant.max_advance_days} />
                <Field label="ยกเลิกได้ก่อน (ชั่วโมง)" name="cancel_cutoff_hours" type="number" min={0} defaultValue={tenant.cancel_cutoff_hours} />
              </div>
              <Checkbox label="ยืนยันการจองอัตโนมัติ (ถ้าไม่เลือก การจองจะอยู่ในสถานะ รอยืนยัน)" name="auto_confirm" defaultChecked={tenant.auto_confirm} />
            </fieldset>
          </ActionForm>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-2 font-semibold">ลิงก์หน้าร้าน</h2>
            <ul className="space-y-1 text-sm">
              <li>
                <a href={`/s/${tenant.slug}`} className="font-mono text-brand" target="_blank" rel="noreferrer">
                  {shopUrl(tenant.slug)}
                </a>
              </li>
              <li className="font-mono text-slate-500">
                https://{tenant.slug}.{rootHost}
              </li>
            </ul>
          </Card>

          <Card>
            <h2 className="mb-1 font-semibold">Custom Domain</h2>
            <p className="mb-4 text-sm text-slate-500">ใช้โดเมนของร้านเอง เช่น booking.example.com (แพ็กเกจ Pro ขึ้นไป)</p>
            {domains.length > 0 && (
              <ul className="mb-4 space-y-3">
                {domains.map((dm) => (
                  <li key={dm.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-medium">{dm.hostname}</span>
                      <Badge tone={domainTone[dm.status]}>{dm.status}</Badge>
                    </div>
                    {dm.status !== "active" && (
                      <div className="mt-2 space-y-1 rounded bg-slate-50 p-2 font-mono text-xs text-slate-600">
                        <p>1) CNAME {dm.hostname} → cname.{rootHost}</p>
                        <p className="break-all">
                          2) TXT _sysrent-verify.{dm.hostname} = {dm.verification_token}
                        </p>
                      </div>
                    )}
                    {dm.last_error && <p className="mt-1 text-xs text-red-600">{dm.last_error}</p>}
                    {canAdmin && (
                      <div className="mt-2 flex gap-2">
                        {dm.status !== "active" && <ActionButton action={verifyDomain.bind(null, slug, dm.id)} label="ตรวจสอบ DNS" variant="primary" />}
                        <ActionButton action={removeDomain.bind(null, slug, dm.id)} label="ลบ" confirm={`ลบโดเมน ${dm.hostname}?`} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canAdmin && (
              <ActionForm action={addDomain.bind(null, slug)} submitLabel="เพิ่มโดเมน" resetOnSuccess>
                <Field label="โดเมน" name="hostname" placeholder="booking.example.com" required />
              </ActionForm>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">สมาชิกทีม</h2>
            <ul className="space-y-2 text-sm">
              {members.map((mm) => (
                <li key={mm.user_id} className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-500">{mm.user_id.slice(0, 8)}…</span>
                  <Badge>{ROLE_LABELS[mm.role]}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
