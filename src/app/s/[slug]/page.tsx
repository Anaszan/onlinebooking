import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, formatMoney } from "@/components/ui";
import { IconChat, IconChevronRight, IconClock, IconMail, IconPhone, IconPin } from "@/components/icons";
import { getStorefront } from "@/modules/booking/public-catalog";

export default async function ShopPage(props: PageProps<"/s/[slug]">) {
  const { slug } = await props.params;
  const sf = await getStorefront(slug);
  if (!sf) notFound();
  const { tenant, services, branches } = sf;

  return (
    <div className="space-y-10">
      {tenant.description && <p className="max-w-[60ch] leading-relaxed text-slate-600">{tenant.description}</p>}

      <section aria-labelledby="services">
        <h2 id="services" className="mb-3 text-lg text-slate-900">
          เลือกบริการ
        </h2>
        {services.length === 0 ? (
          <EmptyState title="ยังไม่มีบริการที่เปิดให้จอง" description="กรุณาติดต่อร้านโดยตรง" />
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border-2 border-white bg-white shadow-md">
            {services.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/s/${tenant.slug}/book/${s.id}`}
                  className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-slate-50 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{s.name}</p>
                    {s.description && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{s.description}</p>}
                    <p className="mt-1 inline-flex items-center gap-1 text-[13px] text-slate-500">
                      <IconClock size={13} />
                      <span className="tnum">{s.duration_minutes}</span> นาที
                    </p>
                  </div>
                  <p className="tnum shrink-0 font-semibold text-slate-900">
                    {Number(s.price) > 0 ? formatMoney(Number(s.price)) : "ฟรี"}
                  </p>
                  <span className="hidden h-8 shrink-0 items-center gap-1 btn-candy rounded-full px-4 font-display text-[13px] text-[var(--brand-fg)] sm:inline-flex">
                    จอง
                  </span>
                  <IconChevronRight size={18} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 sm:hidden" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-x-8 gap-y-8 border-t-2 border-dashed border-slate-200 pt-8 text-sm sm:grid-cols-2">
        <div>
          <h2 className="mb-3 text-base text-slate-900">สาขา</h2>
          <ul className="space-y-3 text-slate-600">
            {branches.map((b) => (
              <li key={b.id}>
                <p className="font-medium text-slate-800">{b.name}</p>
                {b.address && (
                  <p className="mt-0.5 flex gap-1.5">
                    <IconPin size={15} className="mt-[3px] shrink-0 text-slate-400" />
                    {b.address}
                  </p>
                )}
                {b.phone && (
                  <p className="mt-0.5 flex gap-1.5">
                    <IconPhone size={15} className="mt-[3px] shrink-0 text-slate-400" />
                    <a href={`tel:${b.phone}`} className="tnum hover:text-slate-900">
                      โทร {b.phone}
                    </a>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-slate-600">
          <h2 className="mb-3 text-base text-slate-900">ติดต่อร้าน</h2>
          <ul className="space-y-1.5">
            {tenant.contact_phone && (
              <li className="flex gap-1.5">
                <IconPhone size={15} className="mt-[3px] shrink-0 text-slate-400" />
                <a href={`tel:${tenant.contact_phone}`} className="tnum hover:text-slate-900">
                  โทร: {tenant.contact_phone}
                </a>
              </li>
            )}
            {tenant.contact_line && (
              <li className="flex gap-1.5">
                <IconChat size={15} className="mt-[3px] shrink-0 text-slate-400" />
                LINE: {tenant.contact_line}
              </li>
            )}
            {tenant.contact_email && (
              <li className="flex gap-1.5">
                <IconMail size={15} className="mt-[3px] shrink-0 text-slate-400" />
                <a href={`mailto:${tenant.contact_email}`} className="hover:text-slate-900">
                  อีเมล: {tenant.contact_email}
                </a>
              </li>
            )}
          </ul>
          <p className="mt-4 text-xs text-slate-500">ยกเลิกได้ก่อนเวลานัด {tenant.cancel_cutoff_hours} ชั่วโมง</p>
        </div>
      </section>
    </div>
  );
}
