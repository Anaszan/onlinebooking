import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, fromDbError } from "@/lib/errors";
import { addDays, dayRangeUtc, toDateKey } from "@/lib/time";
import { computeAvailability, parseRange, type BusyInterval, type Slot } from "./availability";
import type { Branch, Service, Species, Staff, Tenant, WorkingHour } from "./types";

/**
 * BookingService — server-only. Uses the privileged client because
 * availability needs other customers' busy times (never returned to the
 * browser — only free slots are). Tenant is always resolved from the
 * public slug and must be live.
 */

export interface AvailabilityRequest {
  tenantSlug: string;
  serviceId: string;
  branchId: string;
  staffId?: string;
  date: string;
}

interface LoadedContext {
  tenant: Tenant;
  service: Service;
  branch: Branch;
  staff: Staff[];
  hours: WorkingHour[];
}

async function loadContext(db: SupabaseClient, req: Omit<AvailabilityRequest, "date">): Promise<LoadedContext> {
  const { data: tenant } = await db
    .from("booking_tenants")
    .select("*")
    .eq("slug", req.tenantSlug)
    .in("status", ["trial", "active"])
    .maybeSingle<Tenant>();
  if (!tenant) throw new AppError("NOT_FOUND", "ไม่พบร้าน", 404);

  const [{ data: service }, { data: branch }] = await Promise.all([
    db
      .from("booking_services")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("id", req.serviceId)
      .eq("is_active", true)
      .eq("is_online_bookable", true)
      .maybeSingle<Service>(),
    db
      .from("booking_branches")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("id", req.branchId)
      .eq("is_active", true)
      .maybeSingle<Branch>(),
  ]);
  if (!service) throw new AppError("NOT_FOUND", "ไม่พบบริการ", 404);
  if (!branch) throw new AppError("NOT_FOUND", "ไม่พบสาขา", 404);

  let staffQuery = db
    .from("booking_staff")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("branch_id", branch.id)
    .eq("is_active", true);
  if (req.staffId) staffQuery = staffQuery.eq("id", req.staffId);
  const { data: staffRows } = await staffQuery.returns<Staff[]>();
  const staffIds = (staffRows ?? []).map((s) => s.id);
  if (staffIds.length === 0) return { tenant, service, branch, staff: [], hours: [] };

  const [{ data: links }, { data: hours }] = await Promise.all([
    db
      .from("booking_staff_services")
      .select("staff_id, service_id")
      .eq("tenant_id", tenant.id)
      .in("staff_id", staffIds)
      .returns<{ staff_id: string; service_id: string }[]>(),
    db
      .from("booking_working_hours")
      .select("*")
      .eq("tenant_id", tenant.id)
      .in("staff_id", staffIds)
      .returns<WorkingHour[]>(),
  ]);

  // staff with no explicit service links can perform every service
  const linked = new Map<string, Set<string>>();
  for (const l of links ?? []) {
    if (!linked.has(l.staff_id)) linked.set(l.staff_id, new Set());
    linked.get(l.staff_id)!.add(l.service_id);
  }
  const staff = (staffRows ?? []).filter((s) => !linked.has(s.id) || linked.get(s.id)!.has(service.id));
  return { tenant, service, branch, staff, hours: hours ?? [] };
}

async function loadBusy(db: SupabaseClient, ctx: LoadedContext, date: string): Promise<BusyInterval[]> {
  const staffIds = ctx.staff.map((s) => s.id);
  if (staffIds.length === 0) return [];
  // pad by a day so buffers crossing midnight are respected
  const from = dayRangeUtc(addDays(date, -1), ctx.branch.timezone).start.toISOString();
  const to = dayRangeUtc(addDays(date, 1), ctx.branch.timezone).end.toISOString();

  const [{ data: allocs, error: e1 }, { data: offs, error: e2 }] = await Promise.all([
    db
      .from("booking_allocations")
      .select("resource_id, during")
      .eq("tenant_id", ctx.tenant.id)
      .eq("resource_kind", "staff")
      .eq("active", true)
      .in("resource_id", staffIds)
      .overlaps("during", `[${from},${to})`)
      .returns<{ resource_id: string; during: string }[]>(),
    db
      .from("booking_time_off")
      .select("staff_id, branch_id, starts_at, ends_at")
      .eq("tenant_id", ctx.tenant.id)
      .lt("starts_at", to)
      .gt("ends_at", from)
      .or(`staff_id.in.(${staffIds.join(",")}),and(staff_id.is.null,branch_id.eq.${ctx.branch.id})`)
      .returns<{ staff_id: string | null; branch_id: string | null; starts_at: string; ends_at: string }[]>(),
  ]);
  if (e1) throw fromDbError(e1);
  if (e2) throw fromDbError(e2);

  const busy: BusyInterval[] = [];
  for (const a of allocs ?? []) {
    const [start, end] = parseRange(a.during);
    busy.push({ staffId: a.resource_id, start, end });
  }
  for (const o of offs ?? []) {
    busy.push({ staffId: o.staff_id, start: new Date(o.starts_at), end: new Date(o.ends_at) });
  }
  return busy;
}

export async function getAvailability(req: AvailabilityRequest) {
  const db = createAdminClient();
  const ctx = await loadContext(db, req);
  const busy = await loadBusy(db, ctx, req.date);
  const slots = computeAvailability({
    date: req.date,
    timeZone: ctx.branch.timezone,
    now: new Date(),
    service: {
      durationMinutes: ctx.service.duration_minutes,
      bufferBeforeMin: ctx.service.buffer_before_min,
      bufferAfterMin: ctx.service.buffer_after_min,
    },
    policy: {
      slotIntervalMinutes: ctx.tenant.slot_interval_minutes,
      minAdvanceMinutes: ctx.tenant.min_advance_minutes,
      maxAdvanceDays: ctx.tenant.max_advance_days,
    },
    staff: ctx.staff.map((s) => ({
      id: s.id,
      hours: ctx.hours
        .filter((h) => h.staff_id === s.id)
        .map((h) => ({ weekday: h.weekday, start: h.start_time, end: h.end_time })),
    })),
    busy,
  });
  return { ctx, slots };
}

export interface CreateBookingInput {
  tenantSlug: string;
  serviceId: string;
  branchId: string;
  staffId?: string;
  start: string; // ISO
  customer: { name: string; phone: string; email?: string; note?: string };
  pet: { name: string; species: Species; breed?: string; weightKg?: number; notes?: string };
  /** already validated with readImage() */
  petPhoto?: { bytes: Uint8Array; mime: string; ext: string };
  idempotencyKey: string;
}

export interface CreatedBooking {
  appointmentId: string;
  referenceCode: string;
  accessToken: string;
  status: string;
  startsAt: string;
  endsAt: string;
  created: boolean;
}

/**
 * Re-validates the requested slot against live availability, then creates
 * the appointment + allocation in one DB transaction (RPC). If "any staff"
 * was chosen and the first candidate loses a race, the next one is tried.
 */
export async function createPublicBooking(input: CreateBookingInput): Promise<CreatedBooking> {
  const db = createAdminClient();
  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) throw new AppError("VALIDATION", "เวลาไม่ถูกต้อง", 422);

  const ctx0 = await loadContext(db, input);
  const date = toDateKey(start, ctx0.branch.timezone);
  const { slots } = await getAvailability({ ...input, date });
  const slot: Slot | undefined = slots.find((s) => s.start === start.toISOString());
  if (!slot) throw new AppError("SLOT_TAKEN", "ช่วงเวลานี้ไม่ว่างแล้ว กรุณาเลือกเวลาอื่น", 409);

  const candidates = input.staffId ? slot.staffIds.filter((id) => id === input.staffId) : shuffle(slot.staffIds);
  if (candidates.length === 0) throw new AppError("SLOT_TAKEN", "พนักงานไม่ว่างในเวลานี้", 409);

  const accepted = ctx0.service.species ?? [];
  if (accepted.length > 0 && !accepted.includes(input.pet.species)) {
    throw new AppError("SPECIES_NOT_SUPPORTED", "บริการนี้ไม่รองรับสัตว์เลี้ยงประเภทนี้", 422);
  }

  // Upload the pet photo only after the slot is known to be free.
  // Path is always <tenant_id>/<uuid>.<ext> — derived server-side, never from the client.
  let photoPath: string | null = null;
  if (input.petPhoto) {
    photoPath = `${ctx0.tenant.id}/${crypto.randomUUID()}.${input.petPhoto.ext}`;
    const up = await db.storage.from(PET_PHOTO_BUCKET).upload(photoPath, input.petPhoto.bytes, {
      contentType: input.petPhoto.mime,
      upsert: false,
    });
    if (up.error) {
      console.error("[pet-photo] upload failed", up.error.message);
      throw new AppError("UPLOAD_FAILED", "อัปโหลดรูปสัตว์เลี้ยงไม่สำเร็จ กรุณาลองใหม่", 502);
    }
  }
  const discardPhoto = async () => {
    if (photoPath) await db.storage.from(PET_PHOTO_BUCKET).remove([photoPath]);
  };

  let lastErr: unknown;
  for (const [i, staffId] of candidates.entries()) {
    const { data, error } = await db
      .rpc("booking_create_appointment", {
        p_tenant: ctx0.tenant.id,
        p_branch: ctx0.branch.id,
        p_service: ctx0.service.id,
        p_staff: staffId,
        p_starts_at: start.toISOString(),
        p_customer_name: input.customer.name,
        p_customer_phone: input.customer.phone,
        p_customer_email: input.customer.email ?? null,
        p_customer_note: input.customer.note ?? null,
        // per-attempt key so a retry with another staff isn't treated as a replay
        p_idempotency_key: i === 0 ? input.idempotencyKey : `${input.idempotencyKey}:${i}`,
        p_source: "online",
        p_pet_name: input.pet.name,
        p_pet_species: input.pet.species,
        p_pet_breed: input.pet.breed ?? null,
        p_pet_weight_kg: input.pet.weightKg ?? null,
        p_pet_notes: input.pet.notes ?? null,
        p_pet_photo_path: photoPath,
      })
      .single<{
        appointment_id: string;
        reference_code: string;
        access_token: string;
        status: string;
        starts_at: string;
        ends_at: string;
        created: boolean;
      }>();
    if (!error && data) {
      if (!data.created) await discardPhoto(); // idempotent replay: keep the original
      return {
        appointmentId: data.appointment_id,
        referenceCode: data.reference_code,
        accessToken: data.access_token,
        status: data.status,
        startsAt: data.starts_at,
        endsAt: data.ends_at,
        created: data.created,
      };
    }
    lastErr = error;
    if (error?.code !== "23P01") break; // only retry on overlap
  }
  await discardPhoto();
  throw fromDbError(lastErr as { code?: string; message?: string });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Customer-facing booking lookup by reference + secret token. */
export async function getBookingByToken(reference: string, token: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("booking_appointments")
    .select(
      `id, reference_code, access_token, starts_at, ends_at, status, price, customer_note,
       tenant:booking_tenants!inner(slug, name, primary_color, contact_phone, contact_line, cancel_cutoff_hours, logo_url),
       service:booking_services(name, duration_minutes),
       branch:booking_branches(name, address, timezone),
       staff:booking_staff(display_name),
       customer:booking_customers(full_name, phone),
       pet:booking_pets(name, species, breed, photo_path)`,
    )
    .eq("reference_code", reference)
    .maybeSingle();
  // constant-time-ish compare to avoid token oracle
  if (!data || !safeEqual(String(data.access_token), token)) return null;
  const { access_token: _omit, ...rest } = data;
  void _omit;
  const booking = rest as unknown as PublicBooking;
  booking.pet_photo_url = booking.pet?.photo_path ? await signPetPhoto(booking.pet.photo_path) : null;
  return booking;
}

export interface PublicBooking {
  id: string;
  reference_code: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price: number;
  customer_note: string | null;
  tenant: {
    slug: string;
    name: string;
    primary_color: string;
    contact_phone: string | null;
    contact_line: string | null;
    cancel_cutoff_hours: number;
    logo_url: string | null;
  };
  service: { name: string; duration_minutes: number };
  branch: { name: string; address: string | null; timezone: string };
  staff: { display_name: string };
  customer: { full_name: string; phone: string };
  pet: { name: string; species: Species; breed: string | null; photo_path: string | null } | null;
  pet_photo_url: string | null;
}

export const PET_PHOTO_BUCKET = "pet-photos";

/** Short-lived signed URL for a private pet photo (server-side). */
export async function signPetPhoto(path: string, expiresIn = 3600) {
  const { data } = await createAdminClient().storage.from(PET_PHOTO_BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

/** Mirrors the DB rule in booking_cancel_by_customer (the DB remains authoritative). */
export function canCustomerCancel(b: Pick<PublicBooking, "status" | "starts_at" | "tenant">, now = new Date()) {
  const cutoff = new Date(b.starts_at).getTime() - b.tenant.cancel_cutoff_hours * 3_600_000;
  return ["pending", "confirmed"].includes(b.status) && now.getTime() < cutoff;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function cancelBookingByCustomer(reference: string, token: string) {
  const db = createAdminClient();
  const { error } = await db.rpc("booking_cancel_by_customer", { p_reference: reference, p_token: token });
  if (error) throw fromDbError(error);
}
