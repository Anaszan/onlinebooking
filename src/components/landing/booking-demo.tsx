"use client";

import { useState } from "react";
import { cn } from "@/components/ui";
import { IconCheck, IconClock, IconPaw } from "@/components/icons";

/*
  Synthetic demo for the landing page — no network, no real shop.
  Left: what a customer sees on the shop's booking link.
  Right: the owner's queue for the same day. Booking a slot moves it
  from one side to the other; a taken slot can't be picked again.
*/

type Row = { time: string; name: string; service: string; staff: string; status: "confirmed" | "pending" | "completed"; fresh?: boolean };

const SLOTS = ["10:00", "10:45", "11:30", "13:00", "13:45", "14:30", "15:15", "16:00", "16:45"];
const DAYS = ["วันนี้", "พรุ่งนี้", "ส. 8", "อา. 9", "จ. 10"];
const GUESTS = ["คุณแพร", "คุณบอส", "คุณฝน", "คุณนัท", "คุณเจน", "คุณกอล์ฟ"];

const INITIAL: Row[] = [
  { time: "10:00", name: "คุณมิ้นท์", service: "ตัดผมชาย", staff: "ช่างเอ", status: "completed" },
  { time: "11:30", name: "คุณต้น", service: "ตัดผม + สระ", staff: "ช่างบี", status: "confirmed" },
  { time: "14:30", name: "คุณปุ้ย", service: "ตัดผมชาย", staff: "ช่างเอ", status: "confirmed" },
];

const STATUS: Record<Row["status"], { label: string; dot: string }> = {
  pending: { label: "รอยืนยัน", dot: "bg-amber-500" },
  confirmed: { label: "ยืนยันแล้ว", dot: "bg-sky-600" },
  completed: { label: "เสร็จสิ้น", dot: "bg-emerald-600" },
};

export function BookingDemo() {
  const [rows, setRows] = useState<Row[]>(INITIAL);
  const [day, setDay] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  const taken = new Set(rows.map((r) => r.time));
  const guestIndex = rows.length - INITIAL.length;

  function book(time: string) {
    if (taken.has(time) || day !== 0) return;
    const name = GUESTS[guestIndex % GUESTS.length];
    setRows((rs) =>
      [...rs.map((r) => ({ ...r, fresh: false })), { time, name, service: "ตัดผมชาย", staff: "ช่างบี", status: "pending" as const, fresh: true }].sort(
        (a, b) => a.time.localeCompare(b.time),
      ),
    );
    setLast(time);
  }

  const free = SLOTS.filter((s) => !taken.has(s)).length;

  return (
    <div className="relative">
      <div className="grid overflow-hidden rounded-[2.25rem] border-[3px] border-white bg-[#fffdf9] shadow-lg ring-1 ring-[#f6d3b5] md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Customer side */}
        <section aria-label="ตัวอย่างหน้าจองของลูกค้า" className="border-b-2 border-dashed border-slate-200 p-5 sm:p-7 md:border-b-0 md:border-r-2">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg btn-candy font-display text-sm text-white">บ</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">บ้านช่างบาร์เบอร์</p>
              <p className="text-xs text-slate-500">ตัดผมชาย · 45 นาที · ฿250</p>
            </div>
          </div>

          <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="เลือกวัน">
            {DAYS.map((d, i) => (
              <button
                key={d}
                role="tab"
                aria-selected={i === day}
                onClick={() => setDay(i)}
                className={cn(
                  "h-8 shrink-0 rounded-full border-2 px-3 font-display text-xs transition-colors",
                  i === day ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                )}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-1.5">
            {SLOTS.map((s) => {
              const isTaken = day === 0 && taken.has(s);
              const isMine = day === 0 && s === last;
              return (
                <button
                  key={s}
                  onClick={() => book(s)}
                  aria-disabled={isTaken || day !== 0}
                  aria-label={isTaken ? `${s} มีคนจองแล้ว` : `จองเวลา ${s}`}
                  className={cn(
                    "tnum relative h-11 rounded-full border-2 text-sm font-medium transition-[background-color,border-color,color] duration-200",
                    isMine
                      ? "btn-candy border-transparent text-white"
                      : isTaken
                        ? "cursor-not-allowed border-transparent bg-slate-100 text-slate-400 line-through decoration-slate-400"
                        : day !== 0
                          ? "cursor-default border-slate-200 text-slate-500"
                          : "border-slate-200 bg-white text-slate-800 hover:border-brand hover:bg-brand/5",
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500" aria-live="polite">
            {day !== 0 ? (
              "ลองกดที่ “วันนี้” เพื่อจอง"
            ) : last ? (
              <>
                <IconCheck size={14} className="text-emerald-600" />
                จอง {last} แล้ว — เวลานี้จะไม่ถูกจองซ้ำ
              </>
            ) : (
              <>
                <IconClock size={14} />
                ว่าง {free} ช่วงเวลา · กดเลือกเพื่อลองจอง
              </>
            )}
          </p>
        </section>

        {/* Shop side */}
        <section aria-label="ตัวอย่างคิวในหลังร้าน" className="bg-[#fff4ea] p-5 sm:p-7">
          <div className="flex items-baseline justify-between gap-3">
            <p className="inline-flex items-center gap-1.5 font-display text-[15px] text-slate-900"><IconPaw size={14} className="text-brand" />คิววันนี้</p>
            <p className="tnum text-xs text-slate-500">{rows.length} คิว</p>
          </div>
          <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-3xl border-2 border-white bg-white shadow-md">
            {rows.map((r) => (
              <li
                key={r.time}
                className={cn("flex items-center gap-3 px-3.5 py-3 text-sm sm:px-4", r.fresh && "animate-[row-in_600ms_cubic-bezier(0.16,1,0.3,1)] bg-amber-50")}
              >
                <time className="w-11 shrink-0 font-medium text-slate-900">{r.time}</time>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{r.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {r.service} · {r.staff}
                  </span>
                </span>
                <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700">
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS[r.status].dot)} />
                  {STATUS[r.status].label}
                </span>
              </li>
            ))}
          </ul>
          {rows.length > INITIAL.length && (
            <button onClick={() => (setRows(INITIAL), setLast(null))} className="mt-3 text-xs font-medium text-slate-500 underline hover:text-slate-900">
              เริ่มตัวอย่างใหม่
            </button>
          )}
        </section>
      </div>
      <p className="mt-3 text-xs text-slate-500">ตัวอย่างจำลอง — ร้านและรายชื่อในกรอบนี้ไม่ใช่ข้อมูลจริง</p>
    </div>
  );
}
