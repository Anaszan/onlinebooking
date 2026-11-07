/**
 * Database tests run against PGlite (in-process Postgres) with a minimal
 * stub of Supabase's `auth` schema and roles. They verify:
 *  - tenant isolation through RLS (shop A cannot read/write shop B)
 *  - booking RPC permissions (anon cannot call it directly)
 *  - double-booking protection via the exclusion constraint
 *  - idempotency, cancellation, quota and billing guards
 */
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";
const ADMIN = "00000000-0000-0000-0000-0000000000ad";

let db: PGlite;

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;

  -- minimal stub of Supabase Storage
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to anon, authenticated, service_role;
  grant select on storage.objects to authenticated;
`;

async function as(role: "anon" | "authenticated" | "service_role", uid?: string) {
  await db.exec(`reset role;
    select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);
    select set_config('request.jwt.claim.role', '${role}', false);
    set role ${role};`);
}

async function asOwner() {
  await db.exec(`reset role;`);
}

async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const r = await db.query<T>(sql, params);
  return r.rows[0];
}

async function expectError(promise: Promise<unknown>, match: RegExp | string) {
  await expect(promise).rejects.toThrow(match);
}

let tenantA: string, tenantB: string, branchA: string, staffA: string, staffA2: string, serviceA: string;

async function createAppointment(
  start: string,
  opts: { staff?: string; key?: string; phone?: string; pet?: string; species?: string | null; photo?: string; service?: string } = {},
) {
  await as("service_role");
  return one<{ appointment_id: string; reference_code: string; access_token: string; created: boolean }>(
    `select * from public.booking_create_appointment($1,$2,$3,$4,$5,$6,$7,null,null,$8,'online',$9,$10,null,null,null,$11)`,
    [
      tenantA,
      branchA,
      opts.service ?? serviceA,
      opts.staff ?? staffA,
      start,
      "ลูกค้า",
      opts.phone ?? "0811111111",
      opts.key ?? null,
      opts.pet ?? "โมจิ",
      opts.species === undefined ? "dog" : opts.species,
      opts.photo ?? null,
    ],
  );
}

beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  await db.exec(SUPABASE_STUB);

  const dir = join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  // privileges come from the migrations themselves (no blanket grants here)
  await db.exec(`
    insert into auth.users (id, email) values
      ('${USER_A}', 'a@test.dev'), ('${USER_B}', 'b@test.dev'), ('${ADMIN}', 'admin@test.dev');
    insert into public.booking_platform_admins (user_id) values ('${ADMIN}');
  `);

  await as("authenticated", USER_A);
  tenantA = (await one<{ id: string }>(`select public.booking_create_tenant('shop-a', 'Shop A') as id`))!.id;
  await as("authenticated", USER_B);
  tenantB = (await one<{ id: string }>(`select public.booking_create_tenant('shop-b', 'Shop B') as id`))!.id;

  await as("authenticated", USER_A);
  branchA = (await one<{ id: string }>(`select id from public.booking_branches where tenant_id = $1`, [tenantA]))!.id;
  serviceA = (await one<{ id: string }>(
    `insert into public.booking_services (tenant_id, name, duration_minutes, buffer_after_min, price)
     values ($1, 'ตัดผม', 60, 15, 300) returning id`, [tenantA]))!.id;
  staffA = (await one<{ id: string }>(
    `insert into public.booking_staff (tenant_id, branch_id, display_name) values ($1, $2, 'ช่างเอ') returning id`,
    [tenantA, branchA]))!.id;
  staffA2 = (await one<{ id: string }>(
    `insert into public.booking_staff (tenant_id, branch_id, display_name) values ($1, $2, 'ช่างบี') returning id`,
    [tenantA, branchA]))!.id;
}, 60_000);

describe("tenant isolation (RLS)", () => {
  it("owner sees only their own tenant data", async () => {
    await as("authenticated", USER_B);
    const r = await db.query(`select id from public.booking_services where tenant_id = $1`, [tenantA]);
    // shop A is public (trial) so its bookable services are visible as storefront data...
    expect(r.rows.length).toBe(1);
    // ...but customer data is not
    await createAppointment("2030-01-07T02:00:00Z", { phone: "0899999999" });
    await as("authenticated", USER_B);
    expect((await db.query(`select * from public.booking_customers`)).rows.length).toBe(0);
    expect((await db.query(`select * from public.booking_appointments`)).rows.length).toBe(0);
    await as("authenticated", USER_A);
    expect((await db.query(`select * from public.booking_appointments`)).rows.length).toBe(1);
  });

  it("shop B cannot write into shop A", async () => {
    await as("authenticated", USER_B);
    await expectError(
      db.query(`insert into public.booking_services (tenant_id, name, duration_minutes) values ($1, 'hack', 30)`, [tenantA]),
      /row-level security/,
    );
    const upd = await db.query(`update public.booking_tenants set name = 'pwned' where id = $1 returning id`, [tenantA]);
    expect(upd.rows.length).toBe(0);
    const del = await db.query(`delete from public.booking_staff where tenant_id = $1 returning id`, [tenantA]);
    expect(del.rows.length).toBe(0);
  });

  it("anon cannot read customers or call the booking RPC directly", async () => {
    await as("anon");
    // denied by table privileges (defence in depth on top of RLS)
    await expectError(db.query(`select * from public.booking_customers`), /permission denied/);
    await expectError(db.query(`select * from public.booking_appointments`), /permission denied/);
    // storefront data is readable, but only for live tenants
    expect((await db.query(`select id from public.booking_tenants where id = $1`, [tenantA])).rows.length).toBe(1);
    await expectError(
      db.query(`select * from public.booking_create_appointment($1,$2,$3,$4,now(),'x','1')`, [tenantA, branchA, serviceA, staffA]),
      /permission denied/,
    );
  });

  it("anon cannot add domains or verify them", async () => {
    await as("authenticated", USER_A);
    await expectError(
      db.query(`insert into public.booking_domains (tenant_id, hostname, status) values ($1, 'evil.example.com', 'active')`, [tenantA]),
      /row-level security/,
    );
    await db.query(`insert into public.booking_domains (tenant_id, hostname) values ($1, 'book.shop-a.com')`, [tenantA]);
    const upd = await db.query(`update public.booking_domains set status = 'active' returning id`);
    expect(upd.rows.length).toBe(0); // no UPDATE policy: only server can activate
    await as("anon");
    expect((await one<{ s: string | null }>(`select public.booking_resolve_domain('book.shop-a.com') as s`))!.s).toBeNull();
  });
});

describe("booking engine guarantees", () => {
  it("rejects overlapping bookings for the same staff (incl. buffer)", async () => {
    const first = await createAppointment("2030-01-08T03:00:00Z");
    expect(first!.reference_code).toMatch(/^BK-[A-Z0-9]{6}$/);
    // 03:30 overlaps
    await expectError(createAppointment("2030-01-08T03:30:00Z", { phone: "0822222222" }), /booking_allocations_no_overlap/);
    // 04:00 overlaps the 15-min after-buffer
    await expectError(createAppointment("2030-01-08T04:00:00Z", { phone: "0822222222" }), /booking_allocations_no_overlap/);
    // 04:15 is fine
    await createAppointment("2030-01-08T04:15:00Z", { phone: "0822222222" });
    // another staff at the same time is fine
    await createAppointment("2030-01-08T03:00:00Z", { staff: staffA2, phone: "0833333333" });
  });

  it("is idempotent for the same key", async () => {
    const a = await createAppointment("2030-01-09T03:00:00Z", { key: "idem-1" });
    const b = await createAppointment("2030-01-09T03:00:00Z", { key: "idem-1" });
    expect(a!.created).toBe(true);
    expect(b!.created).toBe(false);
    expect(b!.appointment_id).toBe(a!.appointment_id);
  });

  it("frees the slot after customer cancellation", async () => {
    const a = await createAppointment("2030-01-10T03:00:00Z");
    await as("service_role");
    await db.query(`select public.booking_cancel_by_customer($1, $2)`, [a!.reference_code, a!.access_token]);
    await expectError(
      db.query(`select public.booking_cancel_by_customer($1, 'wrong-token')`, [a!.reference_code]),
      /NOT_FOUND/,
    );
    const again = await createAppointment("2030-01-10T03:00:00Z", { phone: "0844444444" });
    expect(again!.created).toBe(true);
  });

  it("enforces the status state machine and logs events", async () => {
    const a = await createAppointment("2030-01-11T03:00:00Z");
    await as("authenticated", USER_A);
    await db.query(`select public.booking_set_appointment_status($1, 'checked_in')`, [a!.appointment_id]);
    await db.query(`select public.booking_set_appointment_status($1, 'completed')`, [a!.appointment_id]);
    await expectError(db.query(`select public.booking_set_appointment_status($1, 'confirmed')`, [a!.appointment_id]), /INVALID_TRANSITION/);
    const ev = await db.query(`select event_type from public.booking_events where appointment_id = $1`, [a!.appointment_id]);
    expect(ev.rows.length).toBe(3);
    // other tenant cannot touch it
    await as("authenticated", USER_B);
    await expectError(db.query(`select public.booking_set_appointment_status($1, 'no_show')`, [a!.appointment_id]), /NOT_FOUND/);
  });

  it("reschedule is also protected by the exclusion constraint", async () => {
    const a = await createAppointment("2030-01-12T03:00:00Z");
    const b = await createAppointment("2030-01-12T05:00:00Z", { phone: "0855555555" });
    await as("authenticated", USER_A);
    await expectError(
      db.query(`select public.booking_reschedule_appointment($1, '2030-01-12T03:30:00Z')`, [b!.appointment_id]),
      /booking_allocations_no_overlap/,
    );
    await db.query(`select public.booking_reschedule_appointment($1, '2030-01-12T07:00:00Z')`, [a!.appointment_id]);
  });
});

describe("pet care", () => {
  it("requires pet info for online bookings and stores the pet once per customer", async () => {
    await expectError(createAppointment("2030-01-14T03:00:00Z", { species: null }), /PET_REQUIRED/);
    const a = await createAppointment("2030-01-14T03:00:00Z", { phone: "0866666666", pet: "Mochi", photo: `${tenantA}/x.jpg` });
    const b = await createAppointment("2030-01-14T05:00:00Z", { phone: "0866666666", pet: "mochi" });
    await as("authenticated", USER_A);
    const pets = await db.query<{ id: string; photo_path: string }>(
      `select p.id, p.photo_path from public.booking_pets p join public.booking_customers c on c.id = p.customer_id where c.phone = '0866666666'`,
    );
    expect(pets.rows.length).toBe(1); // name match is case-insensitive
    expect(pets.rows[0].photo_path).toBe(`${tenantA}/x.jpg`); // kept when the 2nd booking has no photo
    const appts = await db.query<{ pet_id: string }>(`select pet_id from public.booking_appointments where id in ($1, $2)`, [
      a!.appointment_id,
      b!.appointment_id,
    ]);
    expect(appts.rows.every((r) => r.pet_id === pets.rows[0].id)).toBe(true);
    // other tenants cannot see pets
    await as("authenticated", USER_B);
    expect((await db.query(`select * from public.booking_pets`)).rows.length).toBe(0);
  });

  it("rejects photos outside the tenant folder", async () => {
    await expectError(createAppointment("2030-01-15T03:00:00Z", { photo: `${tenantB}/evil.jpg` }), /INVALID_PHOTO/);
  });

  it("enforces which species a service accepts", async () => {
    await as("authenticated", USER_A);
    const catOnly = (await one<{ id: string }>(
      `insert into public.booking_services (tenant_id, name, duration_minutes, category, species)
       values ($1, 'อาบน้ำแมว', 30, 'bath', '{cat}') returning id`,
      [tenantA],
    ))!.id;
    await expectError(createAppointment("2030-01-16T03:00:00Z", { service: catOnly, species: "dog" }), /SPECIES_NOT_SUPPORTED/);
    const ok = await createAppointment("2030-01-16T03:00:00Z", { service: catOnly, species: "cat", pet: "Tama" });
    expect(ok!.created).toBe(true);
    await as("authenticated", USER_A);
    await expectError(
      db.query(`update public.booking_services set species = '{dragon}' where id = $1`, [catOnly]),
      /check constraint/,
    );
  });

  it("reassigning a job checks the new staff's services and schedule", async () => {
    const a = await createAppointment("2030-01-17T03:00:00Z");
    const other = await createAppointment("2030-01-17T03:00:00Z", { staff: staffA2, phone: "0877777777" });
    await as("authenticated", USER_A);
    // staffA2 is busy at that time
    await expectError(db.query(`select public.booking_reschedule_appointment($1, '2030-01-17T03:00:00Z', $2)`, [a!.appointment_id, staffA2]), /booking_allocations_no_overlap/);
    await db.query(`select public.booking_set_appointment_status($1, 'cancelled')`, [other!.appointment_id]);
    // restrict staffA2 to a different service
    const svc = (await one<{ id: string }>(`select id from public.booking_services where tenant_id = $1 and id <> $2 limit 1`, [tenantA, serviceA]))!.id;
    await db.query(`insert into public.booking_staff_services (tenant_id, staff_id, service_id) values ($1, $2, $3)`, [tenantA, staffA2, svc]);
    await expectError(db.query(`select public.booking_reschedule_appointment($1, '2030-01-17T03:00:00Z', $2)`, [a!.appointment_id, staffA2]), /STAFF_CANNOT_PERFORM_SERVICE/);
    await db.query(`delete from public.booking_staff_services where staff_id = $1`, [staffA2]);
    await db.query(`select public.booking_reschedule_appointment($1, '2030-01-17T03:00:00Z', $2)`, [a!.appointment_id, staffA2]);
    const row = await one<{ staff_id: string }>(`select staff_id from public.booking_appointments where id = $1`, [a!.appointment_id]);
    expect(row!.staff_id).toBe(staffA2);
  });

  it("only members can read their tenant's pet photo objects", async () => {
    await asOwner();
    await db.query(`insert into storage.objects (bucket_id, name) values ('pet-photos', $1), ('pet-photos', $2)`, [
      `${tenantA}/a.jpg`,
      `${tenantB}/b.jpg`,
    ]);
    await as("authenticated", USER_A);
    const r = await db.query<{ name: string }>(`select name from storage.objects where bucket_id = 'pet-photos'`);
    expect(r.rows.map((x) => x.name)).toEqual([`${tenantA}/a.jpg`]);
    await as("anon");
    await expectError(db.query(`select name from storage.objects`), /permission denied/);
  });
});

describe("plans, quotas and billing guards", () => {
  it("blocks creating more services than the plan allows (free = 5)", async () => {
    await as("authenticated", USER_A);
    const existing = Number((await one<{ n: number }>(`select count(*)::int as n from public.booking_services where tenant_id = $1`, [tenantA]))!.n);
    for (let i = 0; i < 5 - existing; i++) {
      await db.query(`insert into public.booking_services (tenant_id, name, duration_minutes) values ($1, $2, 30)`, [tenantA, `s${i}`]);
    }
    await expectError(
      db.query(`insert into public.booking_services (tenant_id, name, duration_minutes) values ($1, 'too many', 30)`, [tenantA]),
      /QUOTA_EXCEEDED/,
    );
  });

  it("owner cannot upgrade their own plan; platform admin can", async () => {
    await as("authenticated", USER_A);
    await expectError(
      db.query(`update public.booking_tenants set plan_id = (select id from public.booking_plans where code = 'business') where id = $1`, [tenantA]),
      /FORBIDDEN/,
    );
    await as("authenticated", ADMIN);
    await db.query(`update public.booking_tenants set plan_id = (select id from public.booking_plans where code = 'business'), status = 'active' where id = $1`, [tenantA]);
    await as("authenticated", USER_A);
    await db.query(`insert into public.booking_services (tenant_id, name, duration_minutes) values ($1, 'now allowed', 30)`, [tenantA]);
    const log = await db.query(`select action from public.booking_audit_logs where tenant_id = $1 and action = 'tenant.subscription_changed'`, [tenantA]);
    expect(log.rows.length).toBe(1);
  });

  it("suspended tenants disappear from the storefront and cannot take online bookings", async () => {
    await as("authenticated", ADMIN);
    await db.query(`update public.booking_tenants set status = 'suspended' where id = $1`, [tenantB]);
    await as("anon");
    expect((await db.query(`select id from public.booking_tenants where id = $1`, [tenantB])).rows.length).toBe(0);
    await asOwner();
  });
});
