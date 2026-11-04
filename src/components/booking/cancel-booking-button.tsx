"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";

export function CancelBookingButton({ reference, token }: { reference: string; token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!window.confirm("ยืนยันการยกเลิกการจองนี้?")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/public/bookings/${encodeURIComponent(reference)}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error?.message ?? "ยกเลิกไม่สำเร็จ");
      setBusy(false);
      return;
    }
    router.replace(`/b/${reference}?t=${token}`);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {error && <Alert tone="error">{error}</Alert>}
      <Button variant="secondary" className="w-full text-red-600" onClick={cancel} disabled={busy}>
        {busy ? "กำลังยกเลิก..." : "ยกเลิกการจอง"}
      </Button>
    </div>
  );
}
