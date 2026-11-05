"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Input, Label, Textarea, cn, formatMoney } from "@/components/ui";
import { IconArrowLeft, IconChevronRight, IconClock } from "@/components/icons";

interface Props {
  tenantSlug: string;
  service: { id: string; name: string; duration: number; price: number };
  branches: { id: string; name: string; address: string | null; timezone: string }[];
  staff: { id: string; name: string; title: string | null; branchId: string }[];
  days: string[];
}

interface Slot {
  start: string;
  time: string;
  staffIds: string[];
}

type Step = "branch" | "staff" | "time" | "details";

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function BookingFlow({ tenantSlug, service, branches, staff, days }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(branches.length > 1 ? "branch" : "staff");
  const [branchId, setBranchId] = useState<string | null>(branches.length === 1 ? branches[0].id : null);
  const [staffId, setStaffId] = useState<string | "any">("any");
  const [date, setDate] = useState(days[0]);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [idemKey, setIdemKey] = useState(newKey);
  const [reloadToken, setReloadToken] = useState(0);

  const branch = branches.find((b) => b.id === branchId) ?? null;
  const branchStaff = useMemo(() => staff.filter((s) => s.branchId === branchId), [staff, branchId]);
  const tz = branch?.timezone ?? "Asia/Bangkok";

  useEffect(() => {
    if (step !== "time" || !branchId) return;
    const ctrl = new AbortController();
    const params = new URLSearchParams({ tenant: tenantSlug, service: service.id, branch: branchId, date });
    if (staffId !== "any") params.set("staff", staffId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch below
    setLoadingSlots(true);
    fetch(`/api/public/availability?${params}`, { signal: ctrl.signal })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error?.message ?? "โหลดเวลาว่างไม่สำเร็จ");
        setSlots(json.data.slots);
        setError(null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoadingSlots(false));
    return () => ctrl.abort();
  }, [step, branchId, staffId, date, tenantSlug, service.id, reloadToken]);

  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }),
    [],
  );
  const fullFmt = useMemo(
    () => new Intl.DateTimeFormat("th-TH", { timeZone: tz, dateStyle: "full", timeStyle: "short" }),
    [tz],
  );

  async function submit(form: FormData) {
    if (!slot || !branchId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant: tenantSlug,
          serviceId: service.id,
          branchId,
          staffId: staffId === "any" ? undefined : staffId,
          start: slot.start,
          customer: {
            name: String(form.get("name") ?? ""),
            phone: String(form.get("phone") ?? ""),
            email: String(form.get("email") ?? ""),
            note: String(form.get("note") ?? ""),
          },
          idempotencyKey: idemKey,
          website: String(form.get("website") ?? ""),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setSlot(null);
          setIdemKey(newKey());
          setStep("time");
          setReloadToken((n) => n + 1);
        }
        const details = json.error?.details?.map?.((d: { message: string }) => d.message).join(", ");
        throw new Error(details || json.error?.message || "จองไม่สำเร็จ");
      }
      router.push(`/b/${json.data.reference}?t=${json.data.token}&new=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "จองไม่สำเร็จ");
      setSubmitting(false);
    }
  }

  const steps: { key: Step; label: string }[] = [
    ...(branches.length > 1 ? [{ key: "branch" as Step, label: "สาขา" }] : []),
    { key: "staff", label: "พนักงาน" },
    { key: "time", label: "วันเวลา" },
    { key: "details", label: "ข้อมูลติดต่อ" },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  if (branches.length === 0) {
    return <Alert tone="warning">บริการนี้ยังไม่พร้อมให้จอง (ยังไม่มีพนักงานที่ให้บริการ)</Alert>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[13px] text-slate-500">บริการ</p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-[-0.01em] text-slate-900">{service.name}</h1>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
          <IconClock size={14} />
          <span className="tnum">
            {service.duration} นาที · {service.price > 0 ? formatMoney(service.price) : "ฟรี"}
          </span>
        </p>
      </div>

      {/* Stepper */}
      <ol className="grid gap-2 pt-1" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="ขั้นตอนการจอง">
        {steps.map((s, i) => (
          <li key={s.key} aria-current={i === stepIndex ? "step" : undefined} className="min-w-0">
            <span
              className={cn(
                "block h-1 rounded-full transition-colors duration-300",
                i <= stepIndex ? "bg-brand" : "bg-slate-200",
              )}
            />
            <span
              className={cn(
                "mt-2 block truncate text-xs",
                i === stepIndex ? "font-medium text-slate-900" : i < stepIndex ? "text-slate-600" : "text-slate-400",
              )}
            >
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      {error && <Alert tone="error">{error}</Alert>}

      {step === "branch" && (
        <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                setBranchId(b.id);
                setStaffId("any");
                setStep("staff");
              }}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-slate-900">{b.name}</span>
                {b.address && <span className="block text-sm text-slate-500">{b.address}</span>}
              </span>
              <IconChevronRight size={18} className="shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      )}

      {step === "staff" && (
        <div className="space-y-3">
          <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <button
            onClick={() => {
              setStaffId("any");
              setStep("time");
            }}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-slate-900">ไม่ระบุพนักงาน</span>
              <span className="block text-sm text-slate-500">ระบบเลือกพนักงานที่ว่างให้อัตโนมัติ</span>
            </span>
            <IconChevronRight size={18} className="shrink-0 text-slate-400" />
          </button>
          {branchStaff.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setStaffId(s.id);
                setStep("time");
              }}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                {s.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-slate-900">{s.name}</span>
                {s.title && <span className="block text-sm text-slate-500">{s.title}</span>}
              </span>
              <IconChevronRight size={18} className="shrink-0 text-slate-400" />
            </button>
          ))}
          </div>
          {branches.length > 1 && (
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setStep("branch")}>
              <IconArrowLeft />
              เปลี่ยนสาขา
            </Button>
          )}
        </div>
      )}

      {step === "time" && (
        <div className="space-y-4">
          <div className="-mx-4 overflow-x-auto px-4">
            <div className="flex gap-2 pb-1">
              {days.map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDate(d);
                    setSlot(null);
                  }}
                  className={cn(
                    "h-10 shrink-0 rounded-lg border px-3 text-sm transition-colors",
                    d === date
                      ? "border-brand bg-brand font-medium text-[var(--brand-fg)]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-400",
                  )}
                >
                  {dayFmt.format(new Date(`${d}T00:00:00Z`))}
                </button>
              ))}
            </div>
          </div>

          {loadingSlots ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-busy="true">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-11 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : slots && slots.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-500">
              ไม่มีเวลาว่างในวันนี้ ลองเลือกวันอื่น
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {(slots ?? []).map((s) => (
                <button
                  key={s.start}
                  onClick={() => {
                    setSlot(s);
                    setIdemKey(newKey());
                    setStep("details");
                  }}
                  className={cn(
                    "tnum h-11 rounded-lg border text-sm font-medium transition-colors",
                    slot?.start === s.start
                      ? "border-brand bg-brand text-[var(--brand-fg)]"
                      : "border-slate-200 bg-white text-slate-800 hover:border-brand hover:bg-brand/5",
                  )}
                >
                  {s.time}
                </button>
              ))}
            </div>
          )}
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setStep("staff")}>
            <IconArrowLeft />
            เปลี่ยนพนักงาน
          </Button>
        </div>
      )}

      {step === "details" && slot && (
        <form action={submit} className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p className="font-medium text-slate-900">{fullFmt.format(new Date(slot.start))}</p>
            <p className="text-slate-600">
              {branch?.name} · {staffId === "any" ? "ไม่ระบุพนักงาน" : branchStaff.find((s) => s.id === staffId)?.name}
            </p>
          </div>
          <div>
            <Label htmlFor="name">ชื่อ-นามสกุล *</Label>
            <Input id="name" name="name" required maxLength={120} autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="phone">เบอร์โทรศัพท์ *</Label>
            <Input id="phone" name="phone" type="tel" required inputMode="tel" autoComplete="tel" placeholder="08x-xxx-xxxx" />
          </div>
          <div>
            <Label htmlFor="email" hint="(รับอีเมลยืนยัน)">
              อีเมล
            </Label>
            <Input id="email" name="email" type="email" autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="note">หมายเหตุถึงร้าน</Label>
            <Textarea id="note" name="note" maxLength={500} />
          </div>
          {/* honeypot — hidden from humans */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep("time")} disabled={submitting}>
              <IconArrowLeft />
              ย้อนกลับ
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "กำลังจอง..." : "ยืนยันการจอง"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
