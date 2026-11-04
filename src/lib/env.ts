// Public (safe for the browser) configuration.
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  /** e.g. "sysrent.shop" — shops get <slug>.sysrent.shop */
  rootDomain: (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").toLowerCase(),
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

export function assertPublicEnv() {
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local.",
    );
  }
}

/** Public URL of a shop's booking page. */
export function shopUrl(slug: string) {
  return `${env.appUrl.replace(/\/$/, "")}/s/${slug}`;
}
