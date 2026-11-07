"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Input, cn } from "@/components/ui";
import type { AppointmentStatus } from "@/modules/booking/types";
import { REASON_LABELS, type StaffCandidate } from "@/modules/booking/eligibility";

const NEXT_ACTIONS: Partial<Record<AppointmentStatus, { status: string; label: string; variant?: "primary" | "secondary" | "danger" }[]>> = {
  pending: [
    { status: "confirmed", label: "ยืนยัน", variant: "primary" },
    { status: "cancelled", label: "ยกเลิก", variant: "secondary" },
  ],
  confirmed: [
    { status: "checked_in", label: "เช็กอิน", variant: "primary" },
    { status: "completed", label: "เสร็จสิ้น", variant: "secondary" },
    { status: "no_show", label: "ไม่มา", variant: "secondary" },
    { status: "cancelled", label: "ยกเลิก", variant: "secondary" },
  ],
  checked_in: [
    { status: "completed", label: "เสร็จสิ้น", variant: "primary" },
    { status: "no_show", label: "ไม่มา", variant: "secondary" },
  ],
};

export function AppointmentActions({
  id,
  status,
  internalNote,
  date,
  time,
  candidates = [],
  myStaffId = null,
}: {
  id: string;
  status: AppointmentStatus;
  internalNote: string | null;
  date: string;
  time: string;
  candidates?: StaffCandidate[];
  myStaffId?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"none" | "reschedule" | "note" | "assign">("none");
  const current = candidates.find((c) => c.current);
  const me = myStaffId ? candidates.find((c) => c.id === myStaffId) : undefined;
  const freeOthers = candidates.filter((c) => c.eligible && !c.current).length;

  function call(body: object, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    start(async () => {
      const res = await fetch(`/api/booking/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error?.message ?? "ทำรายการไม่สำเร็จ");
        return;
      }
      setMode("none");
      router.refresh();
    });
  }

  const actions = NEXT_ACTIONS[status] ?? [];
  const canReschedule = status === "pending" || status === "confirmed";

  return (
    <div className="mt-2 space-y-2">
      {internalNote && mode !== "note" && <p className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">โน้ตร้าน: {internalNote}</p>}
      <div className="flex flex-wrap gap-1.5">
        {actions.map((a) => (
          <Button
            key={a.status}
            size="sm"
            variant={a.variant}
            disabled={pending}
            onClick={() => call({ action: "status", status: a.status }, a.status === "cancelled" ? "ยืนยันยกเลิกนัดนี้?" : undefined)}
          >
            {a.label}
          </Button>
        ))}
        {me && !me.current && me.eligible && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => call({ action: "assign", staffId: me.id }, "รับงานนี้เป็นของคุณ?")}>
            รับงานนี้
          </Button>
        )}
        {candidates.length > 0 && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setMode(mode === "assign" ? "none" : "assign")}>
            ใครรับงานนี้ได้ ({freeOthers + (current?.eligible ? 1 : 0)})
          </Button>
        )}
        {canReschedule && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setMode(mode === "reschedule" ? "none" : "reschedule")}>
            เลื่อนนัด
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setMode(mode === "note" ? "none" : "note")}>
          โน้ต
        </Button>
      </div>

      {mode === "assign" && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
          <p className="px-1.5 pb-1.5 text-xs text-slate-500">พนักงานในสาขาที่รับงานนี้ได้ (ทำบริการนี้ + อยู่ในเวลางาน + ไม่มีคิวชน)</p>
          <ul className="space-y-1">
            {candidates.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", c.eligible ? "bg-emerald-500" : "bg-slate-300")} aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  {c.name}
                  {c.id === myStaffId && <span className="text-slate-500"> (คุณ)</span>}
                </span>
                {c.current ? (
                  <span className="text-xs font-medium text-slate-700">ผู้รับงานปัจจุบัน</span>
                ) : c.eligible ? (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => call({ action: "assign", staffId: c.id }, `มอบงานนี้ให้ ${c.name}?`)}>
                    มอบหมาย
                  </Button>
                ) : (
                  <span className="text-xs text-slate-500">{c.reason ? REASON_LABELS[c.reason] : "ไม่ว่าง"}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode === "reschedule" && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            call({ action: "reschedule", date: f.get("date"), time: f.get("time") });
          }}
        >
          <Input type="date" name="date" defaultValue={date} className="w-auto" required />
          <Input type="time" name="time" defaultValue={time} className="w-auto" step={300} required />
          <Button size="sm" disabled={pending}>
            บันทึก
          </Button>
        </form>
      )}

      {mode === "note" && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            call({ action: "note", internalNote: String(new FormData(e.currentTarget).get("note") ?? "") });
          }}
        >
          <Input name="note" defaultValue={internalNote ?? ""} placeholder="โน้ตภายในร้าน" maxLength={2000} />
          <Button size="sm" disabled={pending}>
            บันทึก
          </Button>
        </form>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
