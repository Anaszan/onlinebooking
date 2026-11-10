// Public (safe for the browser) configuration.
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

export function assertPublicEnv() {
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local.",
    );
  }
}

/** Public URL of the shop's booking page (the site root). */
export function shopUrl() {
  return `${env.appUrl.replace(/\/$/, "")}/`;
}
