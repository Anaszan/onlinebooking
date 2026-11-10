import Link from "next/link";
import { Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { getTenantContext } from "@/lib/auth";
import type { Customer } from "@/modules/booking/types";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";

export const metadata = { title: "ลูกค้า" };
const PAGE_SIZE = 30;

export default async function CustomersPage(props: PageProps<"/dashboard/[slug]/customers">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { supabase, tenant } = await getTenantContext(slug);
  const q = typeof sp.q === "string" ? sp.q.trim().replace(/[%,()]/g, "") : "";
  const page = Math.max(1, Number(sp.page) || 1);

  let query = supabase
    .from("booking_customers")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  const { data, count } = await query;
  const customers = (data ?? []) as Customer[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <PageHeader title="ลูกค้า" description={`ทั้งหมด ${count ?? 0} ราย`} />
      <form method="get" className="flex max-w-md gap-2">
        <Input name="q" defaultValue={q} placeholder="ค้นหาชื่อ / เบอร์ / อีเมล" />
        <button className="rounded-lg bg-slate-900 px-4 text-sm font-medium text-white">ค้นหา</button>
      </form>
      {customers.length === 0 ? (
        <EmptyState title="ยังไม่มีลูกค้า" description="ลูกค้าจะถูกเพิ่มอัตโนมัติเมื่อมีการจอง" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">ชื่อ</th>
                <th className="px-4 py-2.5 font-medium">เบอร์โทร</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">อีเมล</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/${slug}/customers/${c.id}`} className="font-medium text-brand">
                      {c.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{c.phone}</td>
                  <td className="hidden px-4 py-2.5 sm:table-cell">{c.email ?? "—"}</td>
                  <td className="hidden max-w-xs truncate px-4 py-2.5 text-slate-500 md:table-cell">{c.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {pages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 && <Link href={`?q=${encodeURIComponent(q)}&page=${page - 1}`} className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900"><IconChevronLeft size={14} />ก่อนหน้า</Link>}
          <span className="text-slate-500">
            หน้า {page}/{pages}
          </span>
          {page < pages && <Link href={`?q=${encodeURIComponent(q)}&page=${page + 1}`} className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900">ถัดไป<IconChevronRight size={14} /></Link>}
        </div>
      )}
    </div>
  );
}
