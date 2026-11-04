import "server-only";

import { createClient } from "@supabase/supabase-js";
import { assertPublicEnv, env } from "@/lib/env";

/**
 * PRIVILEGED client (bypasses RLS). Server-only.
 * Never import this from a Client Component and never pass its results to the
 * browser without filtering. Every call site must derive tenant_id from a
 * verified source (session membership or verified domain/slug) — never from
 * the request body alone.
 */
export function createAdminClient() {
  assertPublicEnv();
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing SUPABASE_SECRET_KEY (service role key) on the server.");
  return createClient(env.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
