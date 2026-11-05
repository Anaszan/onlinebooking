import { BrandMark } from "@/components/icons";

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
      <BrandMark size={22} />
      SYSRENT <span className="-ml-1 font-normal text-slate-500">Booking</span>
    </span>
  );
}
