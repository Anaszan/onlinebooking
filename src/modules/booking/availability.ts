/**
 * Pure availability computation (no I/O) — Phase 4.
 *
 * A slot is offered for a staff member when:
 *  - [start, start + duration) lies inside one of their working-hour windows
 *    for that weekday (wall clock in the branch timezone)
 *  - the blocked window [start - bufferBefore, end + bufferAfter) does not
 *    overlap any existing allocation, staff time-off or branch closure
 *  - start >= now + minAdvance and the date is within maxAdvanceDays
 *
 * The database exclusion constraint remains the final authority: this
 * function only decides what to *show*; the server re-checks on submit.
 */
import { addDays, toDateKey, toTimeKey, weekdayOf, zonedToUtc } from "@/lib/time";

export interface WorkingWindow {
  weekday: number; // 0=Sun
  start: string; // "HH:mm" or "HH:mm:ss"
  end: string;
}

export interface BusyInterval {
  /** null = applies to the whole branch (holiday/closure) */
  staffId: string | null;
  start: Date;
  end: Date;
}

export interface AvailabilityInput {
  date: string; // "YYYY-MM-DD" in branch timezone
  timeZone: string;
  now: Date;
  service: { durationMinutes: number; bufferBeforeMin: number; bufferAfterMin: number };
  policy: { slotIntervalMinutes: number; minAdvanceMinutes: number; maxAdvanceDays: number };
  staff: Array<{ id: string; hours: WorkingWindow[] }>;
  busy: BusyInterval[];
}

export interface Slot {
  start: string; // ISO UTC
  time: string; // "HH:mm" in branch timezone
  staffIds: string[];
}

const MIN = 60_000;

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

/** Parse a Postgres timestamptz text value ("2030-01-07 02:00:00+00") into a Date. */
export function parsePgTimestamp(s: string): Date {
  const iso = s
    .trim()
    .replace(/^"|"$/g, "")
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00");
  return new Date(iso);
}

/** Parse a Postgres tstzrange literal like ["2030-01-07 02:00:00+00","2030-01-07 03:00:00+00") */
export function parseRange(range: string): [Date, Date] {
  const [a, b] = range.slice(1, -1).split(",");
  return [parsePgTimestamp(a), parsePgTimestamp(b)];
}

export function isDateBookable(date: string, timeZone: string, now: Date, maxAdvanceDays: number) {
  const today = toDateKey(now, timeZone);
  return date >= today && date <= addDays(today, maxAdvanceDays);
}

export function computeAvailability(input: AvailabilityInput): Slot[] {
  const { date, timeZone, now, service, policy } = input;
  if (!isDateBookable(date, timeZone, now, policy.maxAdvanceDays)) return [];

  const weekday = weekdayOf(date);
  const earliest = now.getTime() + policy.minAdvanceMinutes * MIN;
  const durationMs = service.durationMinutes * MIN;
  const beforeMs = service.bufferBeforeMin * MIN;
  const afterMs = service.bufferAfterMin * MIN;
  const stepMs = policy.slotIntervalMinutes * MIN;

  const branchBusy = input.busy.filter((b) => b.staffId === null);
  const byStart = new Map<number, Set<string>>();

  for (const staff of input.staff) {
    const staffBusy = input.busy
      .filter((b) => b.staffId === staff.id)
      .concat(branchBusy)
      .map((b) => [b.start.getTime(), b.end.getTime()] as const);

    for (const w of staff.hours.filter((h) => h.weekday === weekday)) {
      const winStart = zonedToUtc(date, w.start.slice(0, 5), timeZone).getTime();
      const winEnd = zonedToUtc(date, w.end.slice(0, 5), timeZone).getTime();

      for (let t = winStart; t + durationMs <= winEnd; t += stepMs) {
        if (t < earliest) continue;
        const blockStart = t - beforeMs;
        const blockEnd = t + durationMs + afterMs;
        if (staffBusy.some(([bs, be]) => overlaps(blockStart, blockEnd, bs, be))) continue;
        if (!byStart.has(t)) byStart.set(t, new Set());
        byStart.get(t)!.add(staff.id);
      }
    }
  }

  return [...byStart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, ids]) => {
      const d = new Date(t);
      return { start: d.toISOString(), time: toTimeKey(d, timeZone), staffIds: [...ids].sort() };
    });
}
