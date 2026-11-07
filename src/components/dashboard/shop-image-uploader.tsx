"use client";

import { useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/errors";
import { Button, cn } from "@/components/ui";
import { downscaleImage } from "@/lib/client-image";

/** Upload / replace / remove the shop logo or cover image. */
export function ShopImageUploader({
  label,
  kind,
  currentUrl,
  upload,
  remove,
  disabled,
}: {
  label: string;
  kind: "logo" | "cover";
  currentUrl: string | null;
  upload: (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;
  remove: () => Promise<ActionResult>;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    start(async () => {
      const prepared = await downscaleImage(f, kind === "logo" ? 800 : 2000, 0.9);
      const form = new FormData();
      form.set("file", prepared);
      const r = await upload(null, form);
      setMsg(r.ok ? { ok: true, text: r.message ?? "อัปโหลดแล้ว" } : { ok: false, text: r.error });
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-700">{label}</p>
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden bg-slate-100 text-slate-400 ring-2 ring-white shadow-sm",
            kind === "logo" ? "h-20 w-20 rounded-full" : "aspect-[3/1] w-40 rounded-2xl",
          )}
        >
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs">ยังไม่มีรูป</span>
          )}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <Button type="button" size="sm" variant="secondary" disabled={disabled || pending} onClick={() => inputRef.current?.click()}>
            {pending ? "กำลังอัปโหลด…" : currentUrl ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
          </Button>
          {currentUrl && (
            <button
              type="button"
              disabled={disabled || pending}
              className="text-xs text-slate-500 underline hover:text-slate-900 disabled:opacity-50"
              onClick={() =>
                start(async () => {
                  if (!window.confirm("ลบรูปนี้?")) return;
                  const r = await remove();
                  setMsg(r.ok ? { ok: true, text: r.message ?? "ลบแล้ว" } : { ok: false, text: r.error });
                })
              }
            >
              ลบรูป
            </button>
          )}
          <p className="text-xs text-slate-500">{kind === "logo" ? "แนะนำรูปสี่เหลี่ยมจัตุรัส" : "แนะนำสัดส่วน 3:1"} · JPG/PNG/WEBP</p>
        </div>
      </div>
      {msg && <p className={cn("mt-2 text-xs", msg.ok ? "text-emerald-700" : "text-red-600")}>{msg.text}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={label}
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}
