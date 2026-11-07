/**
 * "Who can take this job?" — for an existing appointment, evaluate every
 * staff member of the branch:
 *   canPerform : offers this service (no explicit links = offers everything)
 *   onShift    : the appointment fits inside one of their working windows
 *                and they are not on leave / the branch is not closed
 *   free       : no other active allocation overlaps the blocked time
 * Pure function — the DB exclusion constraint still makes the final call
 * when the job is reassigned.
 */
import { toDateKey, weekdayOf, zonedToUtc } from "@/lib/time";
import type { WorkingWindow } from "./availability";

export interface EligibilityStaff {
  id: string;
  name: string;
  branchId: string;
  isActive: boolean;
  /** null = no explicit links → can perform every service */
  serviceIds: Set<string> | null;
  hours: WorkingWindow[];
}

export interface EligibilityBusy {
  /** null = whole-branch closure */
  staffId: string | null;
  start: Date;
  end: Date;
  /** set for allocations; used to ignore the appointment being evaluated */
  appointmentId?: string;
}

export interface EligibilityInput {
  appointment: {
    id: string;
    serviceId: string;
    branchId: string;
    staffId: string;
    start: Date;
    end: Date;
    /** blocked range incl. buffers */
    blockStart: Date;
    blockEnd: Date;
  };
  timeZone: string;
  staff: EligibilityStaff[];
  busy: EligibilityBusy[];
}

export type IneligibleReason = "inactive" | "service" | "off_shift" | "busy";

export interface StaffCandidate {
  id: string;
  name: string;
  current: boolean;
  eligible: boolean;
  reason: IneligibleReason | null;
}

export const REASON_LABELS: Record<IneligibleReason, string> = {
  inactive: "ปิดใช้งาน",
  service: "ไม่ได้ทำบริการนี้",
  off_shift: "ไม่อยู่ในเวลางาน / ลา",
  busy: "มีคิวชนช่วงนี้",
};

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

export function evaluateStaff(input: EligibilityInput): StaffCandidate[] {
  const { appointment: a, timeZone } = input;
  const date = toDateKey(a.start, timeZone);
  const weekday = weekdayOf(date);
  const s0 = a.start.getTime();
  const s1 = a.end.getTime();
  const b0 = a.blockStart.getTime();
  const b1 = a.blockEnd.getTime();

  const result = input.staff
    .filter((st) => st.branchId === a.branchId)
    .map((st): StaffCandidate => {
      const base = { id: st.id, name: st.name, current: st.id === a.staffId };
      if (!st.isActive) return { ...base, eligible: false, reason: "inactive" };
      if (st.serviceIds && !st.serviceIds.has(a.serviceId)) return { ...base, eligible: false, reason: "service" };

      const inWindow = st.hours
        .filter((h) => h.weekday === weekday)
        .some((h) => {
          const w0 = zonedToUtc(date, h.start.slice(0, 5), timeZone).getTime();
          const w1 = zonedToUtc(date, h.end.slice(0, 5), timeZone).getTime();
          return s0 >= w0 && s1 <= w1;
        });
      const onLeave = input.busy.some(
        (x) => !x.appointmentId && (x.staffId === null || x.staffId === st.id) && overlaps(s0, s1, x.start.getTime(), x.end.getTime()),
      );
      if (!inWindow || onLeave) return { ...base, eligible: false, reason: "off_shift" };

      const busy = input.busy.some(
        (x) =>
          x.appointmentId &&
          x.appointmentId !== a.id &&
          x.staffId === st.id &&
          overlaps(b0, b1, x.start.getTime(), x.end.getTime()),
      );
      if (busy) return { ...base, eligible: false, reason: "busy" };
      return { ...base, eligible: true, reason: null };
    });

  // current assignee first, then eligible, then the rest
  return result.sort((x, y) => Number(y.current) - Number(x.current) || Number(y.eligible) - Number(x.eligible) || x.name.localeCompare(y.name, "th"));
}
