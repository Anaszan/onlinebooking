import { BrandMark } from "@/components/icons";

export function Wordmark({ name = "ร้านดูแลสัตว์เลี้ยง", logoUrl }: { name?: string; logoUrl?: string | null }) {
  return (
    <span className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
      ) : (
        <BrandMark size={22} />
      )}
      {name}
    </span>
  );
}
