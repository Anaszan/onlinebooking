import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getStorefront } from "@/modules/booking/public-catalog";

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
    <div style={{ "--brand": tenant.primary_color } as CSSProperties} className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          {tenant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
              {tenant.name.slice(0, 1)}
            </div>
          )}
          <Link href={`/s/${tenant.slug}`} className="text-lg font-semibold text-slate-900">
            {tenant.name}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{props.children}</main>
      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-400">
        ขับเคลื่อนโดย SYSRENT Booking
      </footer>
    </div>
  );
}
