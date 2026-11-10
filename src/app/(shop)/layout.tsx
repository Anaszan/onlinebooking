import { requireShopSlug } from "@/lib/shop";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getStorefront } from "@/modules/booking/public-catalog";
import { brandForeground } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const slug = await requireShopSlug();
  const sf = await getStorefront(slug);
  if (!sf) return { title: "จองคิวออนไลน์" };
  const description = sf.tenant.description ?? `จองคิวอาบน้ำ ตัดขน และดูแลสัตว์เลี้ยงออนไลน์กับ ${sf.tenant.name}`;
  return {
    title: { absolute: `${sf.tenant.name} — จองคิวอาบน้ำ ตัดขน ดูแลสัตว์เลี้ยง` },
    description,
    openGraph: { title: sf.tenant.name, description, images: sf.tenant.cover_url ? [sf.tenant.cover_url] : undefined },
  };
}

export default async function ShopLayout(props: LayoutProps<"/">) {
  const slug = await requireShopSlug();
  const sf = await getStorefront(slug);
  if (!sf) notFound();
  const { tenant } = sf;

  return (
    <div
      style={
        {
          "--brand": tenant.primary_color,
          "--brand-fg": brandForeground(tenant.primary_color),
          "--accent": tenant.accent_color ?? "#fbbf24",
          backgroundColor: "color-mix(in srgb, var(--accent) 12%, #fffaf5)",
        } as CSSProperties
      }
      className="paw-wallpaper flex min-h-screen flex-col"
    >
      <header className="border-b-2 border-white bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4 sm:px-6">
          {tenant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logo_url} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-slate-200" />
          ) : (
            <div className="btn-candy flex h-11 w-11 items-center justify-center rounded-full font-display text-lg text-[var(--brand-fg)]">
              {tenant.name.slice(0, 1)}
            </div>
          )}
          <Link href={"/"} className="min-w-0 truncate font-display text-lg text-slate-900">
            {tenant.name}
          </Link>
        </div>
      </header>
      {tenant.cover_url && (
        <div className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tenant.cover_url} alt="" className="aspect-[3/1] w-full rounded-3xl object-cover shadow-md ring-2 ring-white" />
        </div>
      )}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">{props.children}</main>
      <footer className="py-6 text-center text-xs text-slate-500">
        © {tenant.name}{" "}·{" "}
        <Link href="/login" className="font-medium text-slate-600 hover:text-slate-900">
          สำหรับพนักงาน
        </Link>
      </footer>
    </div>
  );
}
