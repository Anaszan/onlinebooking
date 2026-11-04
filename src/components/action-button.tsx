"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/errors";
import { Button } from "@/components/ui";

/** Small button that runs a bound server action (no form fields). */
export function ActionButton({
  action,
  label,
  confirm,
  variant = "secondary",
}: {
  action: () => Promise<ActionResult>;
  label: string;
  confirm?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant={variant}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const r = await action();
            setMsg(r.ok ? (r.message ? { ok: true, text: r.message } : null) : { ok: false, text: r.error });
          });
        }}
      >
        {pending ? "..." : label}
      </Button>
      {msg && <span className={msg.ok ? "text-xs text-emerald-700" : "text-xs text-red-600"}>{msg.text}</span>}
    </span>
  );
}
