import Link from "next/link";
import { notFound } from "next/navigation";
import { isPlatformAdmin, requireUser } from "@/lib/auth";
import { BrandMark, IconArrowLeft } from "@/components/icons";

export const metadata = { title: "Super Admin" };

export default async function PlatformLayout({ children }: LayoutProps<"/platform">) {
  await requireUser("/platform");
  if (!(await isPlatformAdmin())) notFound();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <BrandMark size={20} />
            SYSRENT <span className="font-normal text-slate-400">Super Admin</span>
          </span>
          <nav className="flex gap-4 text-sm text-slate-300">
            <Link href="/platform" className="hover:text-white">
              ร้านค้า (Tenants)
            </Link>
            <Link href="/platform/plans" className="hover:text-white">
              แพ็กเกจ
            </Link>
            <Link href="/platform/audit" className="hover:text-white">
              Audit Logs
            </Link>
          </nav>
          <Link href="/dashboard?list=1" className="ml-auto inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white">
            <IconArrowLeft size={14} />
            Dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
