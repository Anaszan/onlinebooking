import { requireShopSlug } from "@/lib/shop";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Label, PageHeader, StatusBadge, Textarea, formatMoney } from "@/components/ui";
import { getTenantContext } from "@/lib/auth";
import { formatDateTime } from "@/lib/time";
import { SPECIES_EMOJI, SPECIES_LABELS, type AppointmentStatus, type Customer, type Pet } from "@/modules/booking/types";
import { updateCustomer } from "../../actions";
import { IconArrowLeft } from "@/components/icons";

export default async function CustomerDetailPage(props: PageProps<"/dashboard/customers/[customerId]">) {
  const { customerId } = await props.params;
  const slug = await requireShopSlug();
  const { supabase, tenant, canManage } = await getTenantContext(slug);
  const { data: c } = await supabase.from("booking_customers").select("*").eq("tenant_id", tenant.id).eq("id", customerId).maybeSingle<Customer>();
  if (!c) notFound();

  const { data } = await supabase
    .from("booking_appointments")
    .select("id, starts_at, status, price, reference_code, service:booking_services(name), staff:booking_staff(display_name), branch:booking_branches(timezone)")
    .eq("tenant_id", tenant.id)
    .eq("customer_id", c.id)
    .order("starts_at", { ascending: false })
    .limit(100);
  const history = (data ?? []) as unknown as {
    id: string;
    starts_at: string;
    status: AppointmentStatus;
    price: number;
    reference_code: string;
    service: { name: string };
    staff: { display_name: string };
    branch: { timezone: string };
  }[];
  const { data: petRows } = await supabase
    .from("booking_pets")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("customer_id", c.id)
    .order("created_at");
  const pets = (petRows ?? []) as Pet[];
  const petPhotoPaths = pets.map((p) => p.photo_path).filter((p): p is string => !!p);
  const petPhotos = new Map<string, string>();
  if (petPhotoPaths.length) {
    const { data: signed } = await supabase.storage.from("pet-photos").createSignedUrls(petPhotoPaths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) petPhotos.set(s.path, s.signedUrl);
  }
  const completed = history.filter((h) => h.status === "completed");
  const noShows = history.filter((h) => h.status === "no_show").length;

  return (
    <div className="space-y-6">
      <Link href={`/dashboard/customers`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <IconArrowLeft size={14} />
        ลูกค้าทั้งหมด
      </Link>
      <PageHeader
        title={c.full_name}
        description={`${c.phone}${c.email ? ` · ${c.email}` : ""}`}
        actions={
          <a href={`tel:${c.phone}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            โทร
          </a>
        }
      />
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-sm text-slate-500">จองทั้งหมด</p>
          <p className="text-2xl font-semibold">{history.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">ยอดใช้บริการ</p>
          <p className="text-2xl font-semibold">{formatMoney(completed.reduce((s, h) => s + Number(h.price), 0))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">ไม่มาตามนัด</p>
          <p className="text-2xl font-semibold">{noShows}</p>
        </Card>
      </div>
      <section aria-labelledby="pets">
        <h2 id="pets" className="mb-3 font-semibold">สัตว์เลี้ยง</h2>
        {pets.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีข้อมูลสัตว์เลี้ยง</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pets.map((p) => {
              const url = p.photo_path ? petPhotos.get(p.photo_path) : undefined;
              return (
                <Card key={p.id} className="flex gap-3 p-4">
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`รูปของ ${p.name}`} className="h-20 w-20 rounded-2xl object-cover" />
                    </a>
                  ) : (
                    <span aria-hidden className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
                      {SPECIES_EMOJI[p.species]}
                    </span>
                  )}
                  <div className="min-w-0 text-sm">
                    <p className="font-display text-base text-slate-900">{p.name}</p>
                    <p className="text-slate-500">
                      {SPECIES_LABELS[p.species]}
                      {p.breed && ` · ${p.breed}`}
                      {p.weight_kg && ` · ${Number(p.weight_kg)} กก.`}
                    </p>
                    {p.notes && <p className="mt-1 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-800">{p.notes}</p>}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="mb-3 font-semibold">ประวัติการจอง</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="font-medium">{h.service.name}</p>
                  <p className="text-slate-500">
                    {formatDateTime(h.starts_at, h.branch.timezone)} · {h.staff.display_name} · {h.reference_code}
                  </p>
                </div>
                <StatusBadge status={h.status} />
              </li>
            ))}
          </ul>
        </Card>
        {canManage && (
          <Card className="lg:col-span-2">
            <h2 className="mb-4 font-semibold">ข้อมูลลูกค้า</h2>
            <ActionForm action={updateCustomer.bind(null, slug, c.id)}>
              <Field label="ชื่อ" name="full_name" defaultValue={c.full_name} required />
              <Field label="อีเมล" name="email" type="email" defaultValue={c.email ?? ""} />
              <div>
                <Label htmlFor="notes">หมายเหตุ (เห็นเฉพาะร้าน)</Label>
                <Textarea id="notes" name="notes" defaultValue={c.notes ?? ""} />
              </div>
            </ActionForm>
          </Card>
        )}
      </div>
    </div>
  );
}
