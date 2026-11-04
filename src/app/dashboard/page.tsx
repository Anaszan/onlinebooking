import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Field, Label, Select, TIMEZONES } from "@/components/ui";
import { isPlatformAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS, type MemberRole } from "@/modules/booking/types";
import { createTenant } from "./actions";
import { signOut } from "../(auth)/actions";

export const metadata = { title: "ร้านของฉัน" };

export default async function DashboardHome(props: PageProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("booking_members")
    .select("role, tenant:booking_tenants(id, slug, name, status)")
    .eq("user_id", user.id)
    .order("created_at");
  const memberships = (data ?? []) as unknown as { role: MemberRole; tenant: { id: string; slug: string; name: string; status: string } }[];

  // single shop → go straight in (unless the user explicitly wants the list)
  if (memberships.length === 1 && sp.list !== "1") redirect(`/dashboard/${memberships[0].tenant.slug}`);

  const admin = await isPlatformAdmin();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">ร้านของฉัน</h1>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          {admin && (
            <Link href="/platform" className="text-sm font-medium text-brand">
              Super Admin
            </Link>
          )}
          <form action={signOut}>
            <button className="text-sm text-slate-500 hover:text-slate-900">ออกจากระบบ</button>
          </form>
        </div>
      </div>

      {memberships.length > 0 && (
        <div className="mb-8 space-y-2">
          {memberships.map((m) => (
            <Link
              key={m.tenant.id}
              href={`/dashboard/${m.tenant.slug}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-brand"
            >
              <div>
                <p className="font-medium">{m.tenant.name}</p>
                <p className="text-sm text-slate-500">/{m.tenant.slug}</p>
              </div>
              <div className="flex gap-2">
                <Badge>{ROLE_LABELS[m.role]}</Badge>
                <Badge tone={m.tenant.status === "active" ? "green" : m.tenant.status === "trial" ? "blue" : "red"}>
                  {m.tenant.status}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Card>
        <h2 className="mb-1 text-lg font-semibold">{memberships.length ? "สร้างร้านใหม่" : "สร้างร้านแรกของคุณ"}</h2>
        <p className="mb-5 text-sm text-slate-500">ใช้เวลาไม่ถึง 1 นาที — ได้หน้าจองของร้านทันที</p>
        <ActionForm action={createTenant} submitLabel="สร้างร้าน">
          <Field label="ชื่อร้าน" name="name" required maxLength={120} placeholder="เช่น ร้านตัดผมสมใจ" />
          <Field
            label="ลิงก์ร้าน (slug)"
            name="slug"
            required
            pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]"
            placeholder="somjai-barber"
            hint="(a-z, 0-9, - เท่านั้น)"
          />
          <div>
            <Label htmlFor="timezone">เขตเวลา</Label>
            <Select id="timezone" name="timezone" defaultValue="Asia/Bangkok">
              {TIMEZONES.map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </Select>
          </div>
        </ActionForm>
      </Card>
    </main>
  );
}
