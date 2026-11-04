import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, Tenant } from "@/modules/booking/types";
import { AppError } from "@/lib/errors";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export async function requireUser(next?: string) {
  const user = await getUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

export const isPlatformAdmin = cache(async () => {
  const user = await getUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("booking_is_platform_admin");
  return data === true;
});

export const MANAGE_ROLES: MemberRole[] = ["owner", "admin", "manager"];
export const ADMIN_ROLES: MemberRole[] = ["owner", "admin"];

/**
 * Resolve the tenant for a dashboard route and verify membership on the
 * server. Tenant id is derived from the verified membership — never from
 * client input. Platform admins may access any tenant (support).
 */
export const getTenantContext = cache(async (slug: string) => {
  const user = await requireUser(`/dashboard/${slug}`);
  const supabase = await createClient();

  const { data: tenant } = await supabase.from("booking_tenants").select("*").eq("slug", slug).maybeSingle<Tenant>();
  if (!tenant) notFound();

  const { data: member } = await supabase
    .from("booking_members")
    .select("role")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .maybeSingle<{ role: MemberRole }>();

  let role: MemberRole | "platform_admin" | null = member?.role ?? null;
  if (!role && (await isPlatformAdmin())) role = "platform_admin";
  if (!role) notFound(); // do not reveal existence of other tenants

  const canManage = role === "platform_admin" || MANAGE_ROLES.includes(role);
  const canAdmin = role === "platform_admin" || ADMIN_ROLES.includes(role);
  return { user, supabase, tenant, role, canManage, canAdmin };
});

/** Use inside server actions / route handlers (throws instead of redirecting). */
export async function assertTenantRole(slug: string, roles: MemberRole[] = MANAGE_ROLES) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new AppError("UNAUTHENTICATED", "กรุณาเข้าสู่ระบบ", 401);

  const { data: tenant } = await supabase
    .from("booking_tenants")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle<{ id: string; slug: string }>();
  if (!tenant) throw new AppError("NOT_FOUND", "ไม่พบร้าน", 404);

  const { data: ok } = await supabase.rpc("booking_has_role", { p_tenant: tenant.id, p_roles: roles });
  if (ok !== true) throw new AppError("FORBIDDEN", "คุณไม่มีสิทธิ์ทำรายการนี้", 403);
  return { supabase, user: auth.user, tenantId: tenant.id };
}
