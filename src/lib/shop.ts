import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tenant } from "@/modules/booking/types";

/**
 * Single-shop mode: the site runs exactly one shop (the first/only row in
 * booking_tenants). Every page resolves it here instead of from the URL.
 */
export const getShop = cache(async (): Promise<Tenant | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("booking_tenants").select("*").order("created_at").limit(1).maybeSingle<Tenant>();
  return data ?? null;
});

/** The shop, or redirect to the one-time setup page if it doesn't exist yet. */
export async function requireShop(): Promise<Tenant> {
  const shop = await getShop();
  if (!shop) redirect("/setup");
  return shop;
}

export async function requireShopSlug(): Promise<string> {
  return (await requireShop()).slug;
}
