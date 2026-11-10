import { requireShopSlug } from "@/lib/shop";
import { ActionForm } from "@/components/action-form";
import { Alert, Badge, Card, Checkbox, Field, Label, PageHeader, Textarea } from "@/components/ui";
import { getTenantContext } from "@/lib/auth";
import { shopUrl } from "@/lib/env";
import { ROLE_LABELS, type MemberRole } from "@/modules/booking/types";
import { removeShopImage, updateSettings, uploadShopImage } from "../actions";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { ThemePicker } from "@/components/dashboard/theme-picker";
import { ShopImageUploader } from "@/components/dashboard/shop-image-uploader";

export const metadata = { title: "ตั้งค่า" };


export default async function SettingsPage() {
  const slug = await requireShopSlug();
  const { supabase, tenant, canAdmin } = await getTenantContext(slug);
  const [{ data: m }] = await Promise.all([
    supabase.from("booking_members").select("user_id, role, created_at").eq("tenant_id", tenant.id).order("created_at"),
  ]);
  const members = (m ?? []) as { user_id: string; role: MemberRole }[];
  // emails live in auth.users — fetched server-side for admins only
  const emails = new Map<string, string>();
  if (canAdmin) {
    const admin = createAdminClient();
    const found = await Promise.all(members.slice(0, 50).map((mm) => admin.auth.admin.getUserById(mm.user_id)));
    found.forEach((r, i) => r.data.user?.email && emails.set(members[i].user_id, r.data.user.email));
  }

  return (
    <div className="space-y-8">
      <PageHeader title="ตั้งค่าร้าน" />
      {!canAdmin && <Alert tone="info">เฉพาะเจ้าของ/ผู้ดูแลเท่านั้นที่แก้ไขการตั้งค่าได้</Alert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">ชื่อร้าน ธีมสี & นโยบาย</h2>
          <ActionForm action={updateSettings.bind(null, slug)}>
            <fieldset disabled={!canAdmin} className="space-y-4">
              <Field label="ชื่อร้าน" name="name" defaultValue={tenant.name} required />
              <div>
                <Label htmlFor="description">คำอธิบายร้าน</Label>
                <Textarea id="description" name="description" defaultValue={tenant.description ?? ""} />
              </div>
              <ThemePicker primary={tenant.primary_color} accent={tenant.accent_color ?? "#fbbf24"} disabled={!canAdmin} />
              <div className="grid grid-cols-2 gap-3">
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
            <h2 className="mb-4 font-semibold">โลโก้ & รูปหน้าปก</h2>
            <div className="space-y-6">
              <ShopImageUploader
                label="โลโก้ร้าน"
                kind="logo"
                currentUrl={tenant.logo_url}
                upload={uploadShopImage.bind(null, slug, "logo")}
                remove={removeShopImage.bind(null, slug, "logo")}
                disabled={!canAdmin}
              />
              <ShopImageUploader
                label="รูปหน้าปก (แสดงบนหน้าร้าน)"
                kind="cover"
                currentUrl={tenant.cover_url}
                upload={uploadShopImage.bind(null, slug, "cover")}
                remove={removeShopImage.bind(null, slug, "cover")}
                disabled={!canAdmin}
              />
            </div>
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">ลิงก์หน้าจองของร้าน</h2>
            <p className="mb-2 text-sm text-slate-500">แชร์ลิงก์นี้ให้ลูกค้า (LINE, Facebook, Google Maps)</p>
            <a href="/" className="break-all font-mono text-sm text-brand" target="_blank" rel="noreferrer">
              {shopUrl()}
            </a>
          </Card>

          <Card>
            <h2 className="mb-1 font-semibold">สมาชิกทีม</h2>
            <p className="mb-3 text-sm text-slate-500">
              เพิ่มบัญชีเข้าสู่ระบบให้พนักงานได้ที่หน้า{" "}
              <Link href={`/dashboard/staff`} className="font-medium text-slate-900 underline">
                พนักงาน
              </Link>
            </p>
            <ul className="divide-y divide-slate-100 text-sm">
              {members.map((mm) => (
                <li key={mm.user_id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate">
                    {emails.get(mm.user_id) ?? <span className="font-mono text-xs text-slate-500">{mm.user_id.slice(0, 8)}…</span>}
                  </span>
                  <Badge tone={mm.role === "owner" ? "blue" : "slate"}>{ROLE_LABELS[mm.role]}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
