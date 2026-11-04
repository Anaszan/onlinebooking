/**
 * Timezone helpers built on Intl (no external deps).
 * All instants are stored as timestamptz (UTC); wall-clock values are
 * interpreted in the branch's IANA timezone.
 */

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAYS[get("weekday")] ?? 0,
  };
}

/** Offset (ms) of `timeZone` from UTC at instant `date`. */
export function tzOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Convert a wall-clock time in `timeZone` to a UTC Date. DST-safe. */
export function zonedToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  let result = guess - tzOffsetMs(new Date(guess), timeZone);
  // second pass handles the case where the offset changes between guess and result
  const offset2 = tzOffsetMs(new Date(result), timeZone);
  result = guess - offset2;
  return new Date(result);
}

/** "YYYY-MM-DD" of `date` in `timeZone`. */
export function toDateKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** "HH:mm" of `date` in `timeZone`. */
export function toTimeKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** Weekday (0=Sun) for a "YYYY-MM-DD" calendar date. */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** UTC range [start, end) covering the calendar day `dateStr` in `timeZone`. */
export function dayRangeUtc(dateStr: string, timeZone: string): { start: Date; end: Date } {
  return {
    start: zonedToUtc(dateStr, "00:00", timeZone),
    end: zonedToUtc(addDays(dateStr, 1), "00:00", timeZone),
  };
}

export function formatDateTime(iso: string | Date, timeZone: string, locale = "th-TH") {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}

export function formatDate(iso: string | Date, timeZone: string, locale = "th-TH") {
  return new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "full" }).format(
    typeof iso === "string" ? new Date(iso) : iso,
  );
}

export function formatTime(iso: string | Date, timeZone: string, locale = "th-TH") {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    typeof iso === "string" ? new Date(iso) : iso,
  );
}

export const WEEKDAY_LABELS_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
