"use server";

import { resolveTxt } from "node:dns/promises";
import { revalidatePath } from "next/cache";
import { assertTenantRole, ADMIN_ROLES } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionError, AppError, fromDbError, type ActionResult } from "@/lib/errors";
import {
  branchForm,
  domainForm,
  serviceForm,
  staffAccountForm,
  staffForm,
  tenantSettingsForm,
  timeOffForm,
  workingHoursForm,
} from "@/modules/booking/schemas";
import { zonedToUtc } from "@/lib/time";
import { ImageValidationError, MAX_SHOP_IMAGE_BYTES, readImage } from "@/lib/images";
import { SPECIES } from "@/modules/booking/types";
import { z } from "zod";

/*
 * Merchant server actions. Every action:
 *  1. derives tenant_id from the verified membership (assertTenantRole)
 *  2. writes with the user's session client, so RLS is a second guard
 *  3. always scopes queries by tenant_id (prevents IDOR)
 */

type Prev = ActionResult | null;
const fd = (f: FormData) => Object.fromEntries(f);

function done(slug: string, message = "บันทึกแล้ว", sub = ""): ActionResult {
  revalidatePath(`/dashboard/${slug}${sub}`, "layout");
  return { ok: true, message };
}

// ---------------------------------------------------------------- settings
export async function updateSettings(slug: string, _p: Prev, form: FormData): Promise<ActionResult> {
  try {
    const { supabase, tenantId } = await assertTenantRole(slug, ADMIN_ROLES);
    const v = tenantSettingsForm.parse(fd(form));
    const { error } = await supabase
      .from("booking_tenants")
      .update({
        ...v,
        description: v.description ?? null,
        contact_email: v.contact_email || null,
        contact_phone: v.contact_phone ?? null,
        contact_line: v.contact_line ?? null,
      })
      .eq("id", tenantId);
    if (error) throw fromDbError(error);
    return done(slug);
  } catch (e) {
    return actionError(e);
  }
}

// ---------------------------------------------------------------- branches
export async function saveBranch(slug: string, id: string | null, _p: Prev, form: FormData): Promise<ActionResult> {
  try {
    const { supabase, tenantId } = await assertTenantRole(slug);
    const v = branchForm.parse(fd(form));
    const row = { ...v, address: v.address ?? null, phone: v.phone ?? null };
    const { error } = id
      ? await supabase.from("booking_branches").update(row).eq("tenant_id", tenantId).eq("id", id)
      : await supabase.from("booking_branches").insert({ ...row, tenant_id: tenantId });
    if (error) throw fromDbError(error);
    return done(slug, id ? "บันทึกแล้ว" : "เพิ่มสาขาแล้ว");
  } catch (e) {
    return actionError(e);
  }
}

// ---------------------------------------------------------------- services
export async function saveService(slug: string, id: string | null, _p: Prev, form: FormData): Promise<ActionResult> {
  try {
    const { supabase, tenantId } = await assertTenantRole(slug);
    const v = serviceForm.parse({ ...fd(form), species: form.getAll("species") });
    const row = { ...v, description: v.description ?? null };
    const { error } = id
      ? await supabase.from("booking_services").update(row).eq("tenant_id", tenantId).eq("id", id)
      : await supabase.from("booking_services").insert({ ...row, tenant_id: tenantId });
    if (error) throw fromDbError(error);
    return done(slug, id ? "บันทึกแล้ว" : "เพิ่มบริการแล้ว");
  } catch (e) {
    return actionError(e);
  }
}

/** Delete a service; if it has booking history, deactivate it instead. */
export async function deleteService(slug: string, id: string): Promise<ActionResult> {
  try {
    const { supabase, tenantId } = await assertTenantRole(slug);
    const { error } = await supabase.from("booking_services").delete().eq("tenant_id", tenantId).eq("id", id);
    if (error?.code === "23503") {
      const off = await supabase
        .from("booking_services")
        .update({ is_active: false, is_online_bookable: false })
        .eq("tenant_id", tenantId)
        .eq("id", id);
      if (off.error) throw fromDbError(off.error);
      revalidatePath(`/dashboard/${slug}`, "layout");
      return { ok: true, message: "บริการนี้มีประวัติการจอง จึงปิดใช้งานแทนการลบ" };
    }
    if (error) throw fromDbError(error);
    revalidatePath(`/dashboard/${slug}`, "layout");
    return { ok: true, message: "ลบบริการแล้ว" };
  } catch (e) {
    return actionError(e);
  }
}

// ---------------------------------------------------------------- shop images
const SHOP_ASSETS_BUCKET = "shop-assets";
const IMAGE_COLUMNS = { logo: "logo_url", cover: "cover_url" } as const;

export async function uploadShopImage(slug: string, kind: "logo" | "cover", _p: Prev, form: FormData): Promise<ActionResult> {
  try {
    const { tenantId } = await assertTenantRole(slug, ADMIN_ROLES);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new AppError("VALIDATION", "กรุณาเลือกรูป", 422);
    let img;
    try {
      img = await readImage(file, MAX_SHOP_IMAGE_BYTES);
    } catch (e) {
      if (e instanceof ImageValidationError) throw new AppError("VALIDATION", e.message, 422);
      throw e;
    }
    const admin = createAdminClient();
    const path = `${tenantId}/${kind}-${Date.now()}.${img.ext}`;
    const up = await admin.storage.from(SHOP_ASSETS_BUCKET).upload(path, img.bytes, { contentType: img.mime, cacheControl: "31536000" });
    if (up.error) throw new AppError("UPLOAD_FAILED", "อัปโหลดรูปไม่สำเร็จ", 502);
    const url = admin.storage.from(SHOP_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl;

    const { data: before } = await admin.from("booking_tenants").select(IMAGE_COLUMNS[kind]).eq("id", tenantId).single();
    const { error } = await admin.from("booking_tenants").update({ [IMAGE_COLUMNS[kind]]: url }).eq("id", tenantId);
    if (error) throw fromDbError(error);
    await removeOldAsset(admin, (before as Record<string, string | null> | null)?.[IMAGE_COLUMNS[kind]] ?? null, tenantId);
    return done(slug, kind === "logo" ? "อัปเดตโลโก้แล้ว" : "อัปเดตรูปหน้าปกแล้ว");
  } catch (e) {
    return actionError(e);
  }
}

export async function removeShopImage(slug: string, kind: "logo" | "cover"): Promise<ActionResult> {
  try {
    const { tenantId } = await assertTenantRole(slug, ADMIN_ROLES);
    const admin = createAdminClient();
    const { data: before } = await admin.from("booking_tenants").select(IMAGE_COLUMNS[kind]).eq("id", tenantId).single();
    const { error } = await admin.from("booking_tenants").update({ [IMAGE_COLUMNS[kind]]: null }).eq("id", tenantId);
    if (error) throw fromDbError(error);
    await removeOldAsset(admin, (before as Record<string, string | null> | null)?.[IMAGE_COLUMNS[kind]] ?? null, tenantId);
    return done(slug, "ลบรูปแล้ว");
  } catch (e) {
    return actionError(e);
  }
}

async function removeOldAsset(admin: ReturnType<typeof createAdminClient>, url: string | null, tenantId: string) {
  const marker = `/object/public/${SHOP_ASSETS_BUCKET}/`;
  const i = url?.indexOf(marker) ?? -1;
  if (!url || i < 0) return;
  const path = decodeURIComponent(url.slice(i + marker.length));
  if (path.startsWith(`${tenantId}/`)) await admin.storage.from(SHOP_ASSETS_BUCKET).remove([path]);
}

// ---------------------------------------------------------------- staff
export async function saveStaff(slug: string, id: string | null, _p: Prev, form: FormData): Promise<ActionResult> {
  try {
    const { supabase, tenantId } = await assertTenantRole(slug);
    const v = staffForm.parse(fd(form));
    const row = { ...v, title: v.title ?? null };
    if (id) {
      const { error } = await supabase.from("booking_staff").update(row).eq("tenant_id", tenantId).eq("id", id);
      if (error) throw fromDbError(error);
      return done(slug);
    }
    const { data, error } = await supabase
      .from("booking_staff")
      .insert({ ...row, tenant_id: tenantId })
      .select("id")
      .single<{ id: string }>();
    if (error) throw fromDbError(error);
    // sensible default: Mon–Sat 09:00–18:00
    await supabase.from("booking_working_hours").insert(
      [1, 2, 3, 4, 5, 6].map((weekday) => ({
        tenant_id: tenantId,
        staff_id: data.id,
        weekday,
        start_time: "09:00",
        end_time: "18:00",
      })),
    );
    return done(slug, "เพิ่มพนักงานแล้ว (ตั้งเวลาทำงานเริ่มต้น จ.–ส. 09:00–18:00)");
  } catch (e) {
    return actionError(e);
  }
}

export async function saveWorkingHours(slug: string, staffId: string, _p: Prev, form: FormData): Promise<ActionResult> {
  try {
    const { supabase, tenantId } = await assertTenantRole(slug);
    const windows = [];
    for (let d = 0; d < 7; d++) {
      if (form.get(`d${d}_on`) !== "on") continue;
      for (const n of [1, 2]) {
        const start = String(form.get(`d${d}_s${n}`) ?? "");
        const end = String(form.get(`d${d}_e${n}`) ?? "");
        if (start && end) windows.push({ weekday: d, start, end });
      }
    }
    const parsed = workingHoursForm.parse(windows);

    const { data: staff } = await supabase.from("booking_staff").select("id").eq("tenant_id", tenantId).eq("id", staffId).maybeSingle();
    if (!staff) throw new AppError("NOT_FOUND", "ไม่พบพนักงาน", 404);

    const del = await supabase.from("booking_working_hours").delete().eq("tenant_id", tenantId).eq("staff_id", staffId);
    if (del.error) throw fromDbError(del.error);
    if (parsed.length) {
      const ins = await supabase.from("booking_working_hours").insert(
        parsed.map((w) => ({ tenant_id: tenantId, staff_id: staffId, weekday: w.weekday, start_time: w.start, end_time: w.end })),
      );
      if (ins.error) throw fromDbError(ins.error);
    }
    return done(slug, "บันทึกเวลาทำงานแล้ว");
  } catch (e) {
    return actionError(e);
  }
}

export async function saveStaffServices(slug: string, staffId: string, _p: Prev, form: FormData): Promise<ActionResult> {
  try {
    const { supabase, tenantId } = await assertTenantRole(slug);
    const all = form.get("all_services") === "on";
    const ids = z.array(z.uuid()).parse(form.getAll("service_ids"));
    const del = await supabase.from("booking_staff_services").delete().eq("tenant_id", tenantId).eq("staff_id", staffId);
    if (del.error) throw fromDbError(del.error);
    if (!all && ids.length) {
      const ins = await supabase
        .from("booking_staff_services")
        .insert(ids.map((service_id) => ({ tenant_id: tenantId, staff_id: staffId, service_id })));
      if (ins.error) throw fromDbError(ins.error);
    }
    return done(slug, "บันทึกบริการของพนักงานแล้ว");
  } catch (e) {
    return actionError(e);
  }
}

// ---------------------------------------------------------------- staff login accounts
function tempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/**
 * Give a staff record a login. If the email has no account yet, one is
 * created with a one-time password that the admin hands over (the staff
 * member changes it at /account). The account becomes a tenant member with
 * the chosen role and is linked to this staff record ("my jobs").
 */
export async function grantStaffAccess(slug: string, staffId: string, _p: Prev, form: FormData): Promise<ActionResult> {
  try {
    const { supabase, tenantId, user } = await assertTenantRole(slug, ADMIN_ROLES);
    const v = staffAccountForm.parse(fd(form));
    const { data: staff } = await supabase
      .from("booking_staff")
      .select("id, user_id")
      .eq("tenant_id", tenantId)
      .eq("id", staffId)
      .maybeSingle<{ id: string; user_id: string | null }>();
    if (!staff) throw new AppError("NOT_FOUND", "ไม่พบพนักงาน", 404);

    const admin = createAdminClient();
    const { data: existingId, error: findErr } = await admin.rpc("booking_find_user_by_email", { p_email: v.email });
    if (findErr) throw fromDbError(findErr);

    let userId = existingId as string | null;
    let password: string | null = null;
    if (!userId) {
      password = tempPassword();
      const created = await admin.auth.admin.createUser({ email: v.email, password, email_confirm: true });
      if (created.error || !created.data.user) throw new AppError("AUTH_ERROR", created.error?.message ?? "สร้างบัญชีไม่สำเร็จ", 400);
      userId = created.data.user.id;
    }
    if (userId === user.id) throw new AppError("VALIDATION", "ไม่สามารถผูกบัญชีของตัวเองได้", 422);

    const { data: member } = await admin
      .from("booking_members")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle<{ role: string }>();
    if (member?.role === "owner") throw new AppError("FORBIDDEN", "ไม่สามารถเปลี่ยนสิทธิ์เจ้าของร้านได้", 403);

    const m = await admin
      .from("booking_members")
      .upsert({ tenant_id: tenantId, user_id: userId, role: v.role }, { onConflict: "tenant_id,user_id" });
    if (m.error) throw fromDbError(m.error);

    // one login ↔ one staff record per shop
    await admin.from("booking_staff").update({ user_id: null }).eq("tenant_id", tenantId).eq("user_id", userId).neq("id", staffId);
    const link = await admin.from("booking_staff").update({ user_id: userId }).eq("tenant_id", tenantId).eq("id", staffId);
    if (link.error) throw fromDbError(link.error);

    revalidatePath(`/dashboard/${slug}`, "layout");
    return {
      ok: true,
      message: password
        ? `สร้างบัญชีแล้ว — อีเมล: ${v.email} รหัสผ่านชั่วคราว: ${password} (แจ้งพนักงานและให้เปลี่ยนรหัสหลังเข้าสู่ระบบ ระบบจะไม่แสดงรหัสนี้อีก)`
        : `ผูกบัญชี ${v.email} เข้ากับพนักงานคนนี้แล้ว`,
    };
  } catch (e) {
    return actionError(e);
  }
}

export async function revokeStaffAccess(slug: string, staffId: string): Promise<ActionResult> {
  try {
    const { tenantId } = await assertTenantRole(slug, ADMIN_ROLES);
    const admin = createAdminClient();
    const { data: staff } = await admin
      .from("booking_staff")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("id", staffId)
      .maybeSingle<{ user_id: string | null }>();
    if (!staff?.user_id) return { ok: true, message: "พนักงานคนนี้ไม่มีบัญชีอยู่แล้ว" };
    const { data: member } = await admin
      .from("booking_members")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", staff.user_id)
      .maybeSingle<{ role: string }>();
    if (member?.role === "owner") throw new AppError("FORBIDDEN", "ไม่สามารถถอนสิทธิ์เจ้าของร้านได้", 403);
    await admin.from("booking_members").delete().eq("tenant_id", tenantId).eq("user_id", staff.user_id);
    await admin.from("booking_staff").update({ user_id: null }).eq("tenant_id", tenantId).eq("id", staffId);
    revalidatePath(`/dashboard/${slug}`, "layout");
    return { ok: true, message: "ถอนสิทธิ์เข้าระบบแล้ว" };
  } catch (e) {
    return actionError(e);
  }
}

// ---------------------------------------------------------------- time off
export async function addTimeOff(slug: string, _p: Prev, form: FormData): Promise<ActionResult> {
  try {
    const { supabase, tenantId } = await assertTenantRole(slug);
    const v = timeOffForm.parse(fd(form));
    const { data: branch } = await supabase
      .from("booking_branches")
      .select("timezone")
      .eq("tenant_id", tenantId)
      .eq("id", v.branch_id)
      .maybeSingle<{ timezone: string }>();
    if (!branch) throw new AppError("NOT_FOUND", "ไม่พบสาขา", 404);
    const { error } = await supabase.from("booking_time_off").insert({
      tenant_id: tenantId,
      branch_id: v.branch_id,
      staff_id: v.staff_id || null,
      starts_at: zonedToUtc(v.start_date, v.start_time, branch.timezone).toISOString(),
      ends_at: zonedToUtc(v.end_date, v.end_time, branch.timezone).toISOString(),
      reason: v.reason ?? null,
    });
    if (error) throw fromDbError(error);
    return done(slug, "เพิ่มวันหยุด/วันลาแล้ว");
  } catch (e) {
    return actionError(e);
  }
}

export async function deleteTimeOff(slug: string, id: string): Promise<ActionResult> {
  try {
    const { supabase, tenantId } = await assertTenantRole(slug);
    const { error } = await supabase.from("booking_time_off").delete().eq("tenant_id", tenantId).eq("id", id);
    if (error) throw fromDbError(error);
    return done(slug, "ลบแล้ว");
  } catch (e) {
    return actionError(e);
  }
}

// ---------------------------------------------------------------- customers
export async function updateCustomer(slug: string, id: string, _p: Prev, form: FormData): Promise<ActionResult> {
  try {
    const { supabase, tenantId } = await assertTenantRole(slug);
    const v = z
      .object({
        full_name: z.string().trim().min(1).max(120),
        email: z.union([z.email(), z.literal("")]).optional(),
        notes: z.string().max(2000).optional(),
      })
      .parse(fd(form));
    const { error } = await supabase
      .from("booking_customers")
      .update({ full_name: v.full_name, email: v.email || null, notes: v.notes || null })
      .eq("tenant_id", tenantId)
      .eq("id", id);
    if (error) throw fromDbError(error);
    return done(slug);
  } catch (e) {
    return actionError(e);
  }
}

// ---------------------------------------------------------------- manual booking
export async function createManualBooking(slug: string, _p: Prev, form: FormData): Promise<ActionResult> {
  try {
    // any member (incl. staff) may take walk-in / phone bookings
    const { supabase, tenantId } = await assertTenantRole(slug, ["owner", "admin", "manager", "staff"]);
    const v = z
      .object({
        service_id: z.uuid(),
        staff_id: z.uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/),
        name: z.string().trim().min(1, "กรุณากรอกชื่อลูกค้า").max(120),
        phone: z.string().trim().regex(/^\+?[\d\s-]{9,20}$/, "เบอร์โทรไม่ถูกต้อง"),
        note: z.string().max(500).optional(),
        pet_name: z.string().trim().max(60).optional(),
        pet_species: z.enum(SPECIES).optional(),
      })
      .parse(fd(form));

    const { data: staff } = await supabase
      .from("booking_staff")
      .select("id, branch_id, branch:booking_branches(timezone)")
      .eq("tenant_id", tenantId)
      .eq("id", v.staff_id)
      .maybeSingle<{ id: string; branch_id: string; branch: { timezone: string } }>();
    if (!staff) throw new AppError("NOT_FOUND", "ไม่พบพนักงาน", 404);

    const start = zonedToUtc(v.date, v.time, staff.branch.timezone);
    const admin = createAdminClient();
    const { error } = await admin.rpc("booking_create_appointment", {
      p_tenant: tenantId,
      p_branch: staff.branch_id,
      p_service: v.service_id,
      p_staff: staff.id,
      p_starts_at: start.toISOString(),
      p_customer_name: v.name,
      p_customer_phone: v.phone.replace(/[\s-]/g, ""),
      p_customer_email: null,
      p_customer_note: v.note ?? null,
      p_idempotency_key: null,
      p_source: "dashboard",
      p_pet_name: v.pet_name || null,
      p_pet_species: v.pet_name ? (v.pet_species ?? "other") : null,
    });
    if (error) throw fromDbError(error);
    return done(slug, "เพิ่มนัดหมายแล้ว");
  } catch (e) {
    return actionError(e);
  }
}

// ---------------------------------------------------------------- domains
export async function addDomain(slug: string, _p: Prev, form: FormData): Promise<ActionResult> {
  try {
    const { supabase, tenantId } = await assertTenantRole(slug, ADMIN_ROLES);
    const { hostname } = domainForm.parse(fd(form));
    const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").split(":")[0];
    if (root && (hostname === root || hostname.endsWith(`.${root}`))) {
      throw new AppError("VALIDATION", `ไม่สามารถใช้โดเมนย่อยของ ${root} ได้`, 422);
    }
    const { data: plan } = await supabase
      .from("booking_tenants")
      .select("plan:booking_plans(features)")
      .eq("id", tenantId)
      .single<{ plan: { features: Record<string, boolean> } | null }>();
    if (!plan?.plan?.features?.custom_domain) {
      throw new AppError("QUOTA_EXCEEDED", "แพ็กเกจปัจจุบันไม่รองรับ Custom Domain กรุณาอัปเกรด", 402);
    }
    const { error } = await supabase.from("booking_domains").insert({ tenant_id: tenantId, hostname });
    if (error) throw fromDbError(error);
    return done(slug, "เพิ่มโดเมนแล้ว — ตั้งค่า DNS ตามคำแนะนำ แล้วกดตรวจสอบ");
  } catch (e) {
    return actionError(e);
  }
}

/**
 * Ownership check: TXT record  _sysrent-verify.<hostname>  =  <verification_token>
 * Status is changed with the privileged client (merchants cannot set it).
 */
export async function verifyDomain(slug: string, id: string): Promise<ActionResult> {
  try {
    const { supabase, tenantId } = await assertTenantRole(slug, ADMIN_ROLES);
    const { data: d } = await supabase
      .from("booking_domains")
      .select("id, hostname, verification_token")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle<{ id: string; hostname: string; verification_token: string }>();
    if (!d) throw new AppError("NOT_FOUND", "ไม่พบโดเมน", 404);

    let found = false;
    let lastError: string | null = null;
    try {
      const records = await resolveTxt(`_sysrent-verify.${d.hostname}`);
      found = records.some((chunks) => chunks.join("") === d.verification_token);
      if (!found) lastError = "พบ TXT record แต่ค่าไม่ตรงกับ token";
    } catch {
      lastError = "ไม่พบ TXT record (DNS อาจยังไม่อัปเดต รอสักครู่แล้วลองใหม่)";
    }

    const admin = createAdminClient();
    await admin
      .from("booking_domains")
      .update({
        // TLS provisioning hook: call your hosting provider's domain API here
        // (e.g. Vercel "add domain to project") and move verified -> active on success.
        status: found ? "active" : "failed",
        verified_at: found ? new Date().toISOString() : null,
        last_checked_at: new Date().toISOString(),
        last_error: found ? null : lastError,
      })
      .eq("id", d.id)
      .eq("tenant_id", tenantId);
    revalidatePath(`/dashboard/${slug}/settings`);
    return found ? { ok: true, message: "ยืนยันโดเมนสำเร็จ" } : { ok: false, error: lastError ?? "ยืนยันไม่สำเร็จ" };
  } catch (e) {
    return actionError(e);
  }
}

export async function removeDomain(slug: string, id: string): Promise<ActionResult> {
  try {
    const { supabase, tenantId } = await assertTenantRole(slug, ADMIN_ROLES);
    const { error } = await supabase.from("booking_domains").delete().eq("tenant_id", tenantId).eq("id", id);
    if (error) throw fromDbError(error);
    return done(slug, "ลบโดเมนแล้ว");
  } catch (e) {
    return actionError(e);
  }
}
