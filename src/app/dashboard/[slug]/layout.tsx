import Link from "next/link";
import type { CSSProperties } from "react";
import { getTenantContext } from "@/lib/auth";
import { Alert, Badge, brandForeground } from "@/components/ui";
import { IconArrowUpRight, IconLogout } from "@/components/icons";
import { ROLE_LABELS } from "@/modules/booking/types";
import { DashboardNav } from "@/components/dashboard/nav";
import { signOut } from "@/app/(auth)/actions";

export default async function TenantLayout(props: LayoutProps<"/dashboard/[slug]">) {
  const { slug } = await props.params;
  const { tenant, role, user } = await getTenantContext(slug);

  const statusTone = tenant.status === "active" ? "green" : tenant.status === "trial" ? "blue" : "red";

  return (
    <div
      style={{ "--brand": tenant.primary_color, "--brand-fg": brandForeground(tenant.primary_color) } as CSSProperties}
      className="flex min-h-screen flex-col md:flex-row"
    >
      <aside className="flex flex-col border-b border-slate-200 bg-[#fff1e4]/80 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4 md:px-5 md:pb-5 md:pt-5">
          <span className="btn-candy flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[var(--brand-fg)]">
            {tenant.name.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <Link href="/dashboard?list=1" className="block truncate font-display text-[15px] text-slate-900 hover:underline">
              {tenant.name}
            </Link>
            <div className="mt-0.5 flex gap-1">
              <Badge tone={statusTone}>{tenant.status}</Badge>
              <Badge>{role === "platform_admin" ? "Platform" : ROLE_LABELS[role]}</Badge>
            </div>
          </div>
        </div>
        <DashboardNav slug={slug} />
        <div className="mt-auto hidden space-y-1 border-t border-slate-200 px-3 py-3 md:block">
          <a
            href={`/s/${tenant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 items-center gap-2.5 rounded-full px-3.5 text-sm text-slate-600 transition-colors hover:bg-slate-200/60 hover:text-slate-900"
          >
            <IconArrowUpRight size={16} className="text-slate-400" />
            ดูหน้าร้าน
          </a>
          <form action={signOut}>
            <button className="flex h-10 w-full items-center gap-2.5 rounded-full px-3.5 text-left text-sm text-slate-600 transition-colors hover:bg-slate-200/60 hover:text-slate-900">
              <IconLogout size={16} className="text-slate-400" />
              ออกจากระบบ
            </button>
          </form>
          <p className="truncate px-2.5 pt-1 text-xs text-slate-500">{user.email}</p>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-9">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex justify-end md:hidden">
            <a href={`/s/${tenant.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600">
              ดูหน้าร้าน
              <IconArrowUpRight size={14} />
            </a>
          </div>
          {tenant.status === "suspended" || tenant.status === "past_due" ? (
            <div className="mb-6">
              <Alert tone="error">บัญชีร้านอยู่ในสถานะ {tenant.status} — หน้าจองสาธารณะปิดอยู่ กรุณาติดต่อผู้ดูแลระบบ</Alert>
            </div>
          ) : null}
          {props.children}
        </div>
      </main>
    </div>
  );
}
