import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getStorefront } from "@/modules/booking/public-catalog";
import { brandForeground } from "@/components/ui";

export async function generateMetadata(props: LayoutProps<"/s/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const sf = await getStorefront(slug);
  if (!sf) return { title: "ไม่พบร้าน" };
  const description = sf.tenant.description ?? `จองคิวออนไลน์กับ ${sf.tenant.name}`;
  return {
    title: `จองคิว ${sf.tenant.name}`,
    description,
    openGraph: { title: sf.tenant.name, description, images: sf.tenant.cover_url ? [sf.tenant.cover_url] : undefined },
  };
}

export default async function ShopLayout(props: LayoutProps<"/s/[slug]">) {
  const { slug } = await props.params;
  const sf = await getStorefront(slug);
  if (!sf) notFound();
  const { tenant } = sf;

  return (
    <div
      style={{ "--brand": tenant.primary_color, "--brand-fg": brandForeground(tenant.primary_color) } as CSSProperties}
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
          <Link href={`/s/${tenant.slug}`} className="min-w-0 truncate font-display text-lg text-slate-900">
            {tenant.name}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">{props.children}</main>
      <footer className="py-6 text-center text-xs text-slate-500">
        ขับเคลื่อนโดย{" "}
        <Link href="/" className="font-medium text-slate-600 hover:text-slate-900">
          SYSRENT Booking
        </Link>
      </footer>
    </div>
  );
}
