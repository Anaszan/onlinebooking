import { requireShopSlug } from "@/lib/shop";
import { notFound } from "next/navigation";
import { getStorefront } from "@/modules/booking/public-catalog";
import { BookingFlow } from "@/components/booking/booking-flow";
import { addDays, toDateKey } from "@/lib/time";

export default async function BookServicePage(props: PageProps<"/book/[serviceId]">) {
  const { serviceId } = await props.params;
  const slug = await requireShopSlug();
  const sf = await getStorefront(slug);
  if (!sf) notFound();
  const service = sf.services.find((s) => s.id === serviceId);
  if (!service) notFound();

  // staff without explicit links can do every service
  const linked = new Map<string, Set<string>>();
  for (const l of sf.staffServices) {
    if (!linked.has(l.staff_id)) linked.set(l.staff_id, new Set());
    linked.get(l.staff_id)!.add(l.service_id);
  }
  const staff = sf.staff.filter((s) => !linked.has(s.id) || linked.get(s.id)!.has(service.id));
  const branches = sf.branches.filter((b) => staff.some((s) => s.branch_id === b.id));

  const tz = branches[0]?.timezone ?? "Asia/Bangkok";
  const today = toDateKey(new Date(), tz);
  const days = Array.from({ length: Math.min(sf.tenant.max_advance_days + 1, 31) }, (_, i) => addDays(today, i));

  return (
    <BookingFlow
      tenantSlug={sf.tenant.slug}
      service={{
        id: service.id,
        name: service.name,
        duration: service.duration_minutes,
        price: Number(service.price),
        species: service.species ?? [],
      }}
      branches={branches.map((b) => ({ id: b.id, name: b.name, address: b.address, timezone: b.timezone }))}
      staff={staff.map((s) => ({ id: s.id, name: s.display_name, title: s.title, branchId: s.branch_id }))}
      days={days}
    />
  );
}
