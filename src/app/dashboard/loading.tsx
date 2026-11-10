export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2 border-b border-slate-200 pb-5">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200/70" />
        <div className="h-3.5 w-64 animate-pulse rounded bg-slate-200/70" />
      </div>
      <div className="h-20 animate-pulse rounded-xl bg-slate-200/50" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-200/50" />
    </div>
  );
}
