import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, formatMoney } from "@/components/ui";
import { getStorefront } from "@/modules/booking/public-catalog";

export default async function ShopPage(props: PageProps<"/s/[slug]">) {
  const { slug } = await props.params;
  const sf = await getStorefront(slug);
  if (!sf) notFound();
  const { tenant, services, branches } = sf;

  return (
    <div className="space-y-8">
      {tenant.description && <p className="text-slate-600">{tenant.description}</p>}

      <section>
        <h2 className="mb-3 text-lg font-semibold">เลือกบริการ</h2>
        {services.length === 0 ? (
          <EmptyState title="ยังไม่มีบริการที่เปิดให้จอง" description="กรุณาติดต่อร้านโดยตรง" />
        ) : (
          <ul className="space-y-3">
            {services.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/s/${tenant.slug}/book/${s.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand hover:shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{s.name}</p>
                    {s.description && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{s.description}</p>}
                    <p className="mt-1 text-sm text-slate-500">{s.duration_minutes} นาที</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-slate-900">{Number(s.price) > 0 ? formatMoney(Number(s.price)) : "ฟรี"}</p>
                    <span className="mt-1 inline-block rounded-lg bg-brand px-3 py-1 text-sm text-white">จอง</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">สาขา</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            {branches.map((b) => (
              <li key={b.id}>
                <p className="font-medium text-slate-800">{b.name}</p>
                {b.address && <p>{b.address}</p>}
                {b.phone && <p>โทร {b.phone}</p>}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <h2 className="mb-2 font-semibold text-slate-900">ติดต่อร้าน</h2>
          {tenant.contact_phone && <p>โทร: {tenant.contact_phone}</p>}
          {tenant.contact_line && <p>LINE: {tenant.contact_line}</p>}
          {tenant.contact_email && <p>อีเมล: {tenant.contact_email}</p>}
          <p className="mt-2 text-xs text-slate-400">ยกเลิกได้ก่อนเวลานัด {tenant.cancel_cutoff_hours} ชั่วโมง</p>
        </div>
      </section>
    </div>
  );
}
