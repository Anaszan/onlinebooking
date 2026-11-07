"use client";

import { useId, useRef, useState } from "react";
import { Button, Label } from "@/components/ui";
import { downscaleImage } from "@/lib/client-image";

const MAX_BYTES = 5 * 1024 * 1024;

export function PetPhotoPicker({
  file,
  preview,
  onChange,
  onError,
}: {
  file: File | null;
  preview: string | null;
  onChange: (file: File | null, preview: string | null) => void;
  onError: (message: string | null) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      onError("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    setBusy(true);
    try {
      const prepared = await downscaleImage(f);
      if (prepared.size > MAX_BYTES) {
        onError("รูปใหญ่เกินไป (สูงสุด 5 MB)");
        return;
      }
      onError(null);
      onChange(prepared, URL.createObjectURL(prepared));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <Label htmlFor={id} hint="(ไม่บังคับ · JPG/PNG/WEBP ไม่เกิน 5 MB)">
        รูปสัตว์เลี้ยง
      </Label>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-slate-300 bg-white text-3xl text-slate-400 transition-colors hover:border-brand"
          aria-label={file ? "เปลี่ยนรูปสัตว์เลี้ยง" : "เลือกรูปสัตว์เลี้ยง"}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="ตัวอย่างรูปสัตว์เลี้ยง" className="h-full w-full object-cover" />
          ) : busy ? (
            <span className="text-xs">กำลังโหลด…</span>
          ) : (
            <span aria-hidden>📷</span>
          )}
        </button>
        <div className="flex flex-col items-start gap-1.5 text-sm">
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
            {file ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
          </Button>
          {file && (
            <button type="button" className="text-xs text-slate-500 underline hover:text-slate-900" onClick={() => onChange(null, null)}>
              ลบรูป
            </button>
          )}
          <p className="text-xs text-slate-500">ช่วยให้พนักงานจำน้องได้ตอนมาถึงร้าน</p>
        </div>
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        onChange={(e) => handle(e.target.files?.[0])}
      />
    </div>
  );
}
