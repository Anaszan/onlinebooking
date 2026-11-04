import Link from "next/link";
import type { CSSProperties } from "react";
import { getTenantContext } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { ROLE_LABELS } from "@/modules/booking/types";
import { DashboardNav } from "@/components/dashboard/nav";
import { signOut } from "@/app/(auth)/actions";

export default async function TenantLayout(props: LayoutProps<"/dashboard/[slug]">) {
  const { slug } = await props.params;
  const { tenant, role, user } = await getTenantContext(slug);

  const statusTone = tenant.status === "active" ? "green" : tenant.status === "trial" ? "blue" : "red";

  return (
    <div style={{ "--brand": tenant.primary_color } as CSSProperties} className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-4 md:block">
          <div className="min-w-0">
            <Link href="/dashboard?list=1" className="block truncate font-semibold text-slate-900">
              {tenant.name}
            </Link>
            <div className="mt-1 flex gap-1.5">
              <Badge tone={statusTone}>{tenant.status}</Badge>
              <Badge>{role === "platform_admin" ? "Platform" : ROLE_LABELS[role]}</Badge>
            </div>
          </div>
          <a
            href={`/s/${tenant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-xs font-medium text-brand md:mt-3 md:inline-block"
          >
            ดูหน้าร้าน ↗
          </a>
        </div>
        <DashboardNav slug={slug} />
        <div className="hidden border-t border-slate-100 px-4 py-3 text-xs text-slate-500 md:absolute md:bottom-0 md:block md:w-60">
          <p className="truncate">{user.email}</p>
          <form action={signOut}>
            <button className="mt-1 text-slate-500 hover:text-slate-900">ออกจากระบบ</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
        {tenant.status === "suspended" || tenant.status === "past_due" ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            บัญชีร้านอยู่ในสถานะ {tenant.status} — หน้าจองสาธารณะปิดอยู่ กรุณาติดต่อผู้ดูแลระบบ
          </div>
        ) : null}
        {props.children}
      </main>
    </div>
  );
}
