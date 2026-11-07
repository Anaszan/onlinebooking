import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Branch, Service, Staff, Tenant } from "./types";

/**
 * Public storefront data. Uses the session-bound client so RLS decides what
 * is public (live tenants, active/bookable rows only). No PII here.
 */
export const getStorefront = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("booking_tenants")
    .select(
      "id, slug, name, description, logo_url, cover_url, primary_color, accent_color, contact_phone, contact_email, contact_line, status, max_advance_days, cancel_cutoff_hours",
    )
    .eq("slug", slug)
    .in("status", ["trial", "active"])
    .maybeSingle<Tenant>();
  if (!tenant) return null;

  const [{ data: branches }, { data: services }, { data: staff }, { data: links }] = await Promise.all([
    supabase.from("booking_branches").select("id, name, address, phone, timezone").eq("tenant_id", tenant.id).eq("is_active", true).order("created_at"),
    supabase
      .from("booking_services")
      .select("id, name, description, image_url, duration_minutes, price, sort_order, category, species")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true)
      .eq("is_online_bookable", true)
      .order("sort_order")
      .order("name"),
    supabase.from("booking_staff").select("id, branch_id, display_name, title, avatar_url").eq("tenant_id", tenant.id).eq("is_active", true).order("display_name"),
    supabase.from("booking_staff_services").select("staff_id, service_id").eq("tenant_id", tenant.id),
  ]);

  return {
    tenant,
    branches: (branches ?? []) as Branch[],
    services: (services ?? []) as Service[],
    staff: (staff ?? []) as Staff[],
    staffServices: (links ?? []) as { staff_id: string; service_id: string }[],
  };
});

export type Storefront = NonNullable<Awaited<ReturnType<typeof getStorefront>>>;
