"use client";

import { useState } from "react";
import { Label, brandForeground, cn } from "@/components/ui";

const PRESETS = [
  { name: "ส้มพีช", primary: "#ea6f1f", accent: "#fbbf24" },
  { name: "ชมพูซากุระ", primary: "#d9487a", accent: "#f9a8d4" },
  { name: "ฟ้าทะเล", primary: "#2a7fd0", accent: "#7dd3fc" },
  { name: "เขียวมิ้นต์", primary: "#0f9a7a", accent: "#6ee7b7" },
  { name: "ม่วงลาเวนเดอร์", primary: "#7559d1", accent: "#c4b5fd" },
  { name: "น้ำตาลคุกกี้", primary: "#9a5b34", accent: "#fcd34d" },
];

/** Primary + accent colour inputs with presets and a live preview. */
export function ThemePicker({ primary, accent, disabled }: { primary: string; accent: string; disabled?: boolean }) {
  const [p, setP] = useState(primary);
  const [a, setA] = useState(accent);

  return (
    <div className="space-y-4">
      <div>
        <Label>ชุดสีสำเร็จรูป</Label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((x) => {
            const active = x.primary === p && x.accent === a;
            return (
              <button
                key={x.name}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setP(x.primary);
                  setA(x.accent);
                }}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border-2 bg-white pl-1.5 pr-3 text-[13px] transition-colors disabled:opacity-50",
                  active ? "border-slate-900" : "border-slate-200 hover:border-slate-400",
                )}
              >
                <span className="flex">
                  <span className="h-5 w-5 rounded-full ring-2 ring-white" style={{ background: x.primary }} />
                  <span className="-ml-1.5 h-5 w-5 rounded-full ring-2 ring-white" style={{ background: x.accent }} />
                </span>
                {x.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ColorInput label="สีหลัก (ปุ่ม/ไฮไลต์)" name="primary_color" value={p} onChange={setP} disabled={disabled} />
        <ColorInput label="สีรอง (พื้นหลังหน้าร้าน)" name="accent_color" value={a} onChange={setA} disabled={disabled} />
      </div>

      <div
        className="rounded-3xl p-4"
        style={{ background: `color-mix(in srgb, ${a} 18%, #fffaf5)` }}
        aria-label="ตัวอย่างธีม"
      >
        <p className="mb-2 text-xs text-slate-500">ตัวอย่าง</p>
        <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
          <span className="text-2xl" aria-hidden>
            🐶
          </span>
          <span className="flex-1 text-sm font-medium text-slate-800">อาบน้ำ + ตัดขน</span>
          <span className="rounded-full px-4 py-1.5 text-[13px] font-medium" style={{ background: p, color: brandForeground(p) }}>
            จอง
          </span>
        </div>
      </div>
    </div>
  );
}

function ColorInput({
  label,
  name,
  value,
  onChange,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <div className="flex h-12 items-center gap-2 rounded-full border-2 border-slate-200 bg-white pl-1.5 pr-4">
        <input
          id={name}
          name={name}
          type="color"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <span className="font-mono text-sm uppercase text-slate-600">{value}</span>
      </div>
    </div>
  );
}
