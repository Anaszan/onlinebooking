import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (Next.js 16 replacement for middleware):
 *  1. Refreshes the Supabase auth session cookie.
 *  2. Maps tenant hostnames to the public storefront:
 *       <slug>.ROOT_DOMAIN       -> /s/<slug>/...
 *       verified custom domain   -> /s/<slug>/...   (status = active only)
 *     Unknown hosts get 404 (Host header injection / takeover protection).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").toLowerCase();
const EXTRA_HOSTS = (process.env.ALLOWED_APP_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const PLATFORM_HOSTS = new Set([ROOT_DOMAIN, `www.${ROOT_DOMAIN}`, ...EXTRA_HOSTS]);

function isPlatformHost(host: string) {
  const hostname = host.split(":")[0];
  return PLATFORM_HOSTS.has(host) || PLATFORM_HOSTS.has(hostname) || hostname === "localhost" || hostname === "127.0.0.1";
}
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin", "platform", "dashboard", "static", "mail"]);
const PASS_THROUGH = /^\/(s|b|api|_next|login|signup|auth|favicon\.ico|robots\.txt)(\/|$)/;

const domainCache = new Map<string, { slug: string | null; expires: number }>();

async function resolveCustomDomain(host: string): Promise<string | null> {
  const hit = domainCache.get(host);
  if (hit && hit.expires > Date.now()) return hit.slug;
  let slug: string | null = null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/booking_resolve_domain`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_hostname: host }),
      cache: "no-store",
    });
    if (res.ok) slug = (await res.json()) as string | null;
  } catch {
    slug = null;
  }
  domainCache.set(host, { slug, expires: Date.now() + (slug ? 60_000 : 15_000) });
  return slug;
}

function hostOf(request: NextRequest) {
  return (request.headers.get("host") ?? "").toLowerCase();
}

export async function proxy(request: NextRequest) {
  const host = hostOf(request);
  const { pathname } = request.nextUrl;

  // ---- tenant host routing ----
  let tenantSlug: string | null = null;
  if (!isPlatformHost(host)) {
    const hostname = host.split(":")[0];
    const rootHostname = ROOT_DOMAIN.split(":")[0];
    if (hostname.endsWith(`.${rootHostname}`)) {
      const sub = hostname.slice(0, -(rootHostname.length + 1));
      if (/^[a-z0-9-]{3,40}$/.test(sub) && !RESERVED_SUBDOMAINS.has(sub)) tenantSlug = sub;
    } else if (/^[a-z0-9.-]+$/.test(hostname) && SUPABASE_URL) {
      tenantSlug = await resolveCustomDomain(hostname);
    }
    if (!tenantSlug) {
      return new NextResponse("Not found", { status: 404 });
    }
    if (/^\/(dashboard|platform)(\/|$)/.test(pathname)) {
      // merchant/admin areas live on the platform domain only
      return new NextResponse("Not found", { status: 404 });
    }
  }

  let response: NextResponse;
  if (tenantSlug && !PASS_THROUGH.test(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/s/${tenantSlug}${pathname === "/" ? "" : pathname}`;
    response = NextResponse.rewrite(url);
  } else {
    response = NextResponse.next({ request });
  }

  // ---- session refresh (only where auth matters) ----
  if (SUPABASE_URL && SUPABASE_KEY && /^\/(dashboard|platform|login|signup|auth|api\/booking|api\/platform)/.test(pathname)) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          const next = tenantSlug ? response : NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => next.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => next.headers.set(k, v));
          response = next;
        },
      },
    });
    const { data } = await supabase.auth.getClaims();
    const isProtected = /^\/(dashboard|platform)(\/|$)/.test(pathname);
    if (isProtected && !data?.claims) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
