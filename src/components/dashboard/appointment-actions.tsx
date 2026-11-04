"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import type { AppointmentStatus } from "@/modules/booking/types";

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
}: {
  id: string;
  status: AppointmentStatus;
  internalNote: string | null;
  date: string;
  time: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"none" | "reschedule" | "note">("none");

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
        {canReschedule && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setMode(mode === "reschedule" ? "none" : "reschedule")}>
            เลื่อนนัด
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setMode(mode === "note" ? "none" : "note")}>
          โน้ต
        </Button>
      </div>

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
