import { describe, expect, it } from "vitest";
import { evaluateStaff, type EligibilityInput } from "@/modules/booking/eligibility";
import { sniffImage } from "@/lib/images";

const TZ = "Asia/Bangkok";
const at = (hhmm: string) => new Date(`2030-01-07T${hhmm}:00+07:00`); // Monday

function input(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  const hours = [{ weekday: 1, start: "09:00:00", end: "18:00:00" }];
  return {
    appointment: {
      id: "appt",
      serviceId: "groom",
      branchId: "b1",
      staffId: "s1",
      start: at("10:00"),
      end: at("11:00"),
      blockStart: at("10:00"),
      blockEnd: at("11:15"),
    },
    timeZone: TZ,
    staff: [
      { id: "s1", name: "เอ", branchId: "b1", isActive: true, serviceIds: null, hours },
      { id: "s2", name: "บี", branchId: "b1", isActive: true, serviceIds: null, hours },
      { id: "s3", name: "ซี", branchId: "b1", isActive: true, serviceIds: new Set(["bath"]), hours },
      { id: "s4", name: "ดี", branchId: "b1", isActive: true, serviceIds: null, hours: [{ weekday: 1, start: "13:00", end: "18:00" }] },
      { id: "s5", name: "อี", branchId: "b1", isActive: false, serviceIds: null, hours },
      { id: "s6", name: "เอฟ", branchId: "b2", isActive: true, serviceIds: null, hours },
    ],
    busy: [
      // the appointment itself — must not block its own assignee
      { staffId: "s1", start: at("10:00"), end: at("11:15"), appointmentId: "appt" },
    ],
    ...overrides,
  };
}

describe("evaluateStaff", () => {
  it("classifies every staff member in the branch", () => {
    const r = evaluateStaff(input());
    const by = Object.fromEntries(r.map((c) => [c.id, c]));
    expect(r[0].id).toBe("s1"); // current assignee first
    expect(by.s1).toMatchObject({ current: true, eligible: true });
    expect(by.s2).toMatchObject({ eligible: true });
    expect(by.s3).toMatchObject({ eligible: false, reason: "service" });
    expect(by.s4).toMatchObject({ eligible: false, reason: "off_shift" });
    expect(by.s5).toMatchObject({ eligible: false, reason: "inactive" });
    expect(by.s6).toBeUndefined(); // other branch
  });

  it("detects overlapping jobs including buffers", () => {
    const r = evaluateStaff(
      input({
        busy: [
          { staffId: "s1", start: at("10:00"), end: at("11:15"), appointmentId: "appt" },
          { staffId: "s2", start: at("11:10"), end: at("12:00"), appointmentId: "other" }, // hits the 15-min after-buffer
        ],
      }),
    );
    expect(r.find((c) => c.id === "s2")).toMatchObject({ eligible: false, reason: "busy" });
  });

  it("treats leave and branch closures as off-shift", () => {
    const r = evaluateStaff(
      input({
        busy: [
          { staffId: "s2", start: at("00:00"), end: at("23:59") },
          { staffId: null, start: at("10:30"), end: at("10:45") },
        ],
      }),
    );
    expect(r.filter((c) => c.eligible)).toEqual([]);
  });
});

describe("sniffImage", () => {
  it("detects real image types from magic bytes", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe("png");
    expect(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))?.ext).toBe("webp");
  });
  it("rejects anything else (e.g. HTML/SVG disguised as an image)", () => {
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<html>"))).toBeNull();
  });
});
