import { z } from "zod";

const uuid = z.uuid();
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง");
const timeKey = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "รูปแบบเวลาไม่ถูกต้อง");
const thaiPhone = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\+?\d{9,15}$/, "เบอร์โทรไม่ถูกต้อง"));
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((s) => (s ? s : undefined));

export const availabilityQuery = z.object({
  tenant: z.string().min(1).max(40),
  service: uuid,
  branch: uuid,
  staff: uuid.optional(),
  date: dateKey,
});

export const createBookingBody = z.object({
  tenant: z.string().min(1).max(40), // slug — resolved server-side
  serviceId: uuid,
  branchId: uuid,
  staffId: uuid.optional(),
  start: z.iso.datetime({ offset: true }),
  customer: z.object({
    name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(120),
    phone: thaiPhone,
    email: z.union([z.email("อีเมลไม่ถูกต้อง"), z.literal("")]).optional(),
    note: optionalText(500),
  }),
  idempotencyKey: z.string().min(8).max(80),
  website: z.string().max(0).optional(), // honeypot: must stay empty
});

export const cancelBookingBody = z.object({ token: z.string().min(16).max(64) });

export const appointmentAction = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    status: z.enum(["confirmed", "checked_in", "completed", "cancelled", "no_show"]),
  }),
  z.object({
    action: z.literal("reschedule"),
    date: dateKey,
    time: timeKey,
    staffId: uuid.optional(),
  }),
  z.object({ action: z.literal("note"), internalNote: z.string().max(2000) }),
]);

// ---------- Merchant forms ----------
const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true");

export const tenantCreateForm = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อร้าน").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, "slug ต้องเป็น a-z, 0-9, - ยาว 3–40 ตัว"),
  timezone: z.string().min(1).default("Asia/Bangkok"),
});

export const tenantSettingsForm = z.object({
  name: z.string().trim().min(1).max(120),
  description: optionalText(1000),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logo_url: z.union([z.url(), z.literal("")]).optional(),
  contact_phone: optionalText(30),
  contact_email: z.union([z.email(), z.literal("")]).optional(),
  contact_line: optionalText(60),
  slot_interval_minutes: z.coerce.number().int().min(5).max(240),
  min_advance_minutes: z.coerce.number().int().min(0).max(60 * 24 * 30),
  max_advance_days: z.coerce.number().int().min(1).max(365),
  cancel_cutoff_hours: z.coerce.number().int().min(0).max(24 * 30),
  auto_confirm: checkbox,
});

export const branchForm = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อสาขา").max(120),
  address: optionalText(500),
  phone: optionalText(30),
  timezone: z.string().min(1),
  is_active: checkbox,
});

export const serviceForm = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อบริการ").max(120),
  description: optionalText(1000),
  duration_minutes: z.coerce.number().int().min(5).max(1440),
  buffer_before_min: z.coerce.number().int().min(0).max(240),
  buffer_after_min: z.coerce.number().int().min(0).max(240),
  price: z.coerce.number().min(0).max(10_000_000),
  is_online_bookable: checkbox,
  is_active: checkbox,
});

export const staffForm = z.object({
  display_name: z.string().trim().min(1, "กรุณากรอกชื่อพนักงาน").max(120),
  title: optionalText(120),
  branch_id: uuid,
  is_active: checkbox,
});

export const workingHoursForm = z.array(
  z.object({ weekday: z.number().int().min(0).max(6), start: timeKey, end: timeKey }).refine((v) => v.end > v.start, {
    message: "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม",
  }),
);

export const timeOffForm = z
  .object({
    staff_id: z.union([uuid, z.literal("")]).optional(),
    branch_id: uuid,
    start_date: dateKey,
    start_time: timeKey,
    end_date: dateKey,
    end_time: timeKey,
    reason: optionalText(200),
  })
  .refine((v) => `${v.end_date}T${v.end_time}` > `${v.start_date}T${v.start_time}`, {
    message: "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม",
  });

export const domainForm = z.object({
  hostname: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "โดเมนไม่ถูกต้อง"),
});
