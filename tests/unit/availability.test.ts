import { describe, expect, it } from "vitest";
import { computeAvailability, parseRange, type AvailabilityInput } from "@/modules/booking/availability";
import { dayRangeUtc, zonedToUtc } from "@/lib/time";

const TZ = "Asia/Bangkok"; // UTC+7, no DST

function base(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    date: "2030-01-07", // Monday
    timeZone: TZ,
    now: new Date("2030-01-01T00:00:00Z"),
    service: { durationMinutes: 60, bufferBeforeMin: 0, bufferAfterMin: 0 },
    policy: { slotIntervalMinutes: 30, minAdvanceMinutes: 60, maxAdvanceDays: 30 },
    staff: [{ id: "s1", hours: [{ weekday: 1, start: "09:00:00", end: "12:00:00" }] }],
    busy: [],
    ...overrides,
  };
}

describe("time helpers", () => {
  it("converts Bangkok wall time to UTC", () => {
    expect(zonedToUtc("2030-01-07", "09:00", TZ).toISOString()).toBe("2030-01-07T02:00:00.000Z");
  });
  it("handles DST in New York", () => {
    // 2030-03-10 is DST start in the US (clocks jump 02:00 -> 03:00)
    expect(zonedToUtc("2030-03-09", "09:00", "America/New_York").toISOString()).toBe("2030-03-09T14:00:00.000Z");
    expect(zonedToUtc("2030-03-11", "09:00", "America/New_York").toISOString()).toBe("2030-03-11T13:00:00.000Z");
    const r = dayRangeUtc("2030-03-10", "America/New_York");
    expect((r.end.getTime() - r.start.getTime()) / 3_600_000).toBe(23);
  });
});

describe("parseRange", () => {
  it("parses PostgREST tstzrange output", () => {
    const [a, b] = parseRange('["2030-01-07 02:00:00+00","2030-01-07 03:15:00+07")');
    expect(a.toISOString()).toBe("2030-01-07T02:00:00.000Z");
    expect(b.toISOString()).toBe("2030-01-06T20:15:00.000Z");
  });
});

describe("computeAvailability", () => {
  it("generates slots inside working hours", () => {
    const slots = computeAvailability(base());
    expect(slots.map((s) => s.time)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
    expect(slots[0].start).toBe("2030-01-07T02:00:00.000Z");
  });

  it("returns nothing on days without working hours", () => {
    expect(computeAvailability(base({ date: "2030-01-08" }))).toEqual([]);
  });

  it("removes slots overlapping existing bookings including buffers", () => {
    const slots = computeAvailability(
      base({
        service: { durationMinutes: 60, bufferBeforeMin: 0, bufferAfterMin: 15 },
        busy: [{ staffId: "s1", start: zonedToUtc("2030-01-07", "10:30", TZ), end: zonedToUtc("2030-01-07", "11:00", TZ) }],
      }),
    );
    // 09:00 block ends 10:15 OK; 09:30 block ends 10:45 overlaps; 11:00 block ok
    expect(slots.map((s) => s.time)).toEqual(["09:00", "11:00"]);
  });

  it("respects branch-wide closures", () => {
    const { start, end } = dayRangeUtc("2030-01-07", TZ);
    expect(computeAvailability(base({ busy: [{ staffId: null, start, end }] }))).toEqual([]);
  });

  it("respects min advance and max advance", () => {
    const now = zonedToUtc("2030-01-07", "09:10", TZ);
    expect(computeAvailability(base({ now })).map((s) => s.time)).toEqual(["10:30", "11:00"]);
    expect(computeAvailability(base({ date: "2030-03-04" }))).toEqual([]);
    expect(computeAvailability(base({ date: "2029-12-31" }))).toEqual([]);
  });

  it("merges staff into the same slot", () => {
    const slots = computeAvailability(
      base({
        staff: [
          { id: "s1", hours: [{ weekday: 1, start: "09:00", end: "10:00" }] },
          { id: "s2", hours: [{ weekday: 1, start: "09:00", end: "11:00" }] },
        ],
      }),
    );
    expect(slots).toEqual([
      { start: "2030-01-07T02:00:00.000Z", time: "09:00", staffIds: ["s1", "s2"] },
      { start: "2030-01-07T02:30:00.000Z", time: "09:30", staffIds: ["s2"] },
      { start: "2030-01-07T03:00:00.000Z", time: "10:00", staffIds: ["s2"] },
    ]);
  });
});
