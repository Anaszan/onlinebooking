-- =====================================================================
-- SYSRENT Booking — core schema (Phase 2)
-- Shared database / shared schema. Every tenant-owned row carries tenant_id
-- and is protected by RLS. Booking writes go through SECURITY DEFINER
-- functions that are only executable by service_role (server-side).
-- =====================================================================

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.booking_member_role as enum ('owner', 'admin', 'manager', 'staff');
create type public.booking_tenant_status as enum ('trial', 'active', 'past_due', 'suspended', 'cancelled');
create type public.booking_appointment_status as enum ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show', 'expired');
create type public.booking_domain_status as enum ('pending_verification', 'verified', 'provisioning', 'active', 'failed');

-- ---------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.booking_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Platform
-- ---------------------------------------------------------------------
create table public.booking_platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.booking_plans (
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null unique,
  name                    text not null,
  price_monthly           numeric(12,2) not null default 0,
  max_branches            int,          -- null = unlimited
  max_staff               int,
  max_services            int,
  max_bookings_per_month  int,
  features                jsonb not null default '{}'::jsonb,
  is_public               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger trg_plans_updated before update on public.booking_plans
  for each row execute function public.booking_touch_updated_at();

-- ---------------------------------------------------------------------
-- Tenants & membership
-- ---------------------------------------------------------------------
create table public.booking_tenants (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique
                           check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  name                   text not null check (char_length(name) between 1 and 120),
  description            text,
  logo_url               text,
  cover_url              text,
  primary_color          text not null default '#2563eb' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  contact_phone          text,
  contact_email          text,
  contact_line           text,
  status                 public.booking_tenant_status not null default 'trial',
  plan_id                uuid references public.booking_plans(id),
  trial_ends_at          timestamptz default (now() + interval '14 days'),
  -- booking policy
  slot_interval_minutes  int not null default 15 check (slot_interval_minutes between 5 and 240),
  min_advance_minutes    int not null default 60 check (min_advance_minutes >= 0),
  max_advance_days       int not null default 30 check (max_advance_days between 1 and 365),
  cancel_cutoff_hours    int not null default 2 check (cancel_cutoff_hours >= 0),
  auto_confirm           boolean not null default true,
  created_by             uuid references auth.users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create trigger trg_tenants_updated before update on public.booking_tenants
  for each row execute function public.booking_touch_updated_at();

create table public.booking_members (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.booking_tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.booking_member_role not null default 'staff',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index on public.booking_members (user_id);

create table public.booking_domains (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.booking_tenants(id) on delete cascade,
  hostname            text not null unique
                        check (hostname ~ '^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'),
  status              public.booking_domain_status not null default 'pending_verification',
  verification_token  text not null default encode(gen_random_bytes(16), 'hex'),
  verified_at         timestamptz,
  last_checked_at     timestamptz,
  last_error          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on public.booking_domains (tenant_id);
create trigger trg_domains_updated before update on public.booking_domains
  for each row execute function public.booking_touch_updated_at();

-- ---------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------
create table public.booking_branches (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.booking_tenants(id) on delete cascade,
  name        text not null,
  address     text,
  phone       text,
  timezone    text not null default 'Asia/Bangkok',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, id)
);
create index on public.booking_branches (tenant_id);
create trigger trg_branches_updated before update on public.booking_branches
  for each row execute function public.booking_touch_updated_at();

-- Validate IANA timezone names
create or replace function public.booking_check_timezone()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'invalid timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end $$;
create trigger trg_branches_tz before insert or update of timezone on public.booking_branches
  for each row execute function public.booking_check_timezone();

create table public.booking_services (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.booking_tenants(id) on delete cascade,
  name                text not null,
  description         text,
  image_url           text,
  duration_minutes    int not null check (duration_minutes between 5 and 1440),
  buffer_before_min   int not null default 0 check (buffer_before_min between 0 and 240),
  buffer_after_min    int not null default 0 check (buffer_after_min between 0 and 240),
  price               numeric(12,2) not null default 0 check (price >= 0),
  is_online_bookable  boolean not null default true,
  is_active           boolean not null default true,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, id)
);
create index on public.booking_services (tenant_id);
create trigger trg_services_updated before update on public.booking_services
  for each row execute function public.booking_touch_updated_at();

create table public.booking_staff (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.booking_tenants(id) on delete cascade,
  branch_id     uuid not null,
  user_id       uuid references auth.users(id) on delete set null,
  display_name  text not null,
  title         text,
  avatar_url    text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, branch_id) references public.booking_branches(tenant_id, id) on delete cascade
);
create index on public.booking_staff (tenant_id, branch_id);
create trigger trg_staff_updated before update on public.booking_staff
  for each row execute function public.booking_touch_updated_at();

-- Optional: rooms / equipment (allocated in a later phase)
create table public.booking_resources (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.booking_tenants(id) on delete cascade,
  branch_id   uuid not null,
  name        text not null,
  kind        text not null default 'room',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, branch_id) references public.booking_branches(tenant_id, id) on delete cascade
);
create index on public.booking_resources (tenant_id, branch_id);

-- If a staff member has NO rows here they can perform every service.
create table public.booking_staff_services (
  tenant_id   uuid not null,
  staff_id    uuid not null,
  service_id  uuid not null,
  primary key (staff_id, service_id),
  foreign key (tenant_id, staff_id)   references public.booking_staff(tenant_id, id) on delete cascade,
  foreign key (tenant_id, service_id) references public.booking_services(tenant_id, id) on delete cascade
);
create index on public.booking_staff_services (tenant_id);

-- Weekly working hours, interpreted in the branch's local timezone.
create table public.booking_working_hours (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  staff_id    uuid not null,
  weekday     smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time  time not null,
  end_time    time not null,
  check (end_time > start_time),
  foreign key (tenant_id, staff_id) references public.booking_staff(tenant_id, id) on delete cascade
);
create index on public.booking_working_hours (tenant_id, staff_id);

-- Time off: staff_id null => whole branch closed (holiday).
create table public.booking_time_off (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.booking_tenants(id) on delete cascade,
  branch_id   uuid,
  staff_id    uuid,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text,
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at),
  check (branch_id is not null or staff_id is not null),
  foreign key (tenant_id, branch_id) references public.booking_branches(tenant_id, id) on delete cascade,
  foreign key (tenant_id, staff_id)  references public.booking_staff(tenant_id, id) on delete cascade
);
create index on public.booking_time_off (tenant_id, starts_at);

-- ---------------------------------------------------------------------
-- Customers & appointments
-- ---------------------------------------------------------------------
create table public.booking_customers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.booking_tenants(id) on delete cascade,
  full_name   text not null,
  phone       text not null,
  email       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, phone),
  unique (tenant_id, id)
);
create trigger trg_customers_updated before update on public.booking_customers
  for each row execute function public.booking_touch_updated_at();

create table public.booking_appointments (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.booking_tenants(id) on delete cascade,
  branch_id        uuid not null,
  service_id       uuid not null,
  staff_id         uuid not null,
  customer_id      uuid not null,
  reference_code   text not null unique,
  access_token     text not null default encode(gen_random_bytes(16), 'hex'),
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  status           public.booking_appointment_status not null default 'confirmed',
  price            numeric(12,2) not null default 0,
  customer_note    text,
  internal_note    text,
  source           text not null default 'online', -- online | dashboard
  idempotency_key  text,
  hold_expires_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, branch_id)   references public.booking_branches(tenant_id, id),
  foreign key (tenant_id, service_id)  references public.booking_services(tenant_id, id),
  foreign key (tenant_id, staff_id)    references public.booking_staff(tenant_id, id),
  foreign key (tenant_id, customer_id) references public.booking_customers(tenant_id, id)
);
create index on public.booking_appointments (tenant_id, starts_at);
create index on public.booking_appointments (tenant_id, customer_id);
create index on public.booking_appointments (staff_id, starts_at);
create trigger trg_appointments_updated before update on public.booking_appointments
  for each row execute function public.booking_touch_updated_at();

-- Time actually blocked on a staff member / resource (includes buffers).
-- The exclusion constraint is the final guard against double booking.
create table public.booking_allocations (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  appointment_id  uuid not null,
  resource_kind   text not null default 'staff' check (resource_kind in ('staff', 'resource')),
  resource_id     uuid not null,
  during          tstzrange not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  foreign key (tenant_id, appointment_id) references public.booking_appointments(tenant_id, id) on delete cascade,
  constraint booking_allocations_no_overlap
    exclude using gist (resource_kind with =, resource_id with =, during with &&) where (active)
);
create index on public.booking_allocations (tenant_id);
create index on public.booking_allocations using gist (resource_id, during) where (active);

create table public.booking_events (
  id              bigint generated always as identity primary key,
  tenant_id       uuid not null references public.booking_tenants(id) on delete cascade,
  appointment_id  uuid not null references public.booking_appointments(id) on delete cascade,
  event_type      text not null,
  from_status     public.booking_appointment_status,
  to_status       public.booking_appointment_status,
  payload         jsonb not null default '{}'::jsonb,
  actor_id        uuid,
  created_at      timestamptz not null default now()
);
create index on public.booking_events (tenant_id, appointment_id);

create table public.booking_audit_logs (
  id          bigint generated always as identity primary key,
  tenant_id   uuid references public.booking_tenants(id) on delete set null,
  actor_id    uuid,
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index on public.booking_audit_logs (tenant_id, created_at desc);

-- =====================================================================
-- Authorization helpers (SECURITY DEFINER so they bypass RLS safely)
-- =====================================================================
create or replace function public.booking_is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.booking_platform_admins where user_id = auth.uid());
$$;

create or replace function public.booking_has_role(p_tenant uuid, p_roles public.booking_member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.booking_members m
    where m.tenant_id = p_tenant and m.user_id = auth.uid() and m.role = any (p_roles)
  ) or public.booking_is_platform_admin();
$$;

create or replace function public.booking_is_member(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.booking_has_role(p_tenant, array['owner','admin','manager','staff']::public.booking_member_role[]);
$$;

create or replace function public.booking_can_manage(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.booking_has_role(p_tenant, array['owner','admin','manager']::public.booking_member_role[]);
$$;

create or replace function public.booking_is_tenant_public(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.booking_tenants t where t.id = p_tenant and t.status in ('trial','active'));
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.booking_platform_admins enable row level security;
alter table public.booking_plans           enable row level security;
alter table public.booking_tenants         enable row level security;
alter table public.booking_members         enable row level security;
alter table public.booking_domains         enable row level security;
alter table public.booking_branches        enable row level security;
alter table public.booking_services        enable row level security;
alter table public.booking_staff           enable row level security;
alter table public.booking_resources       enable row level security;
alter table public.booking_staff_services  enable row level security;
alter table public.booking_working_hours   enable row level security;
alter table public.booking_time_off        enable row level security;
alter table public.booking_customers       enable row level security;
alter table public.booking_appointments    enable row level security;
alter table public.booking_allocations     enable row level security;
alter table public.booking_events          enable row level security;
alter table public.booking_audit_logs      enable row level security;

-- platform admins: only platform admins can see the list
create policy pa_select on public.booking_platform_admins for select to authenticated
  using (public.booking_is_platform_admin());

-- plans: public plans readable by anyone, managed by platform admin
create policy plans_select on public.booking_plans for select to anon, authenticated
  using (is_public or public.booking_is_platform_admin());
create policy plans_admin on public.booking_plans for all to authenticated
  using (public.booking_is_platform_admin()) with check (public.booking_is_platform_admin());

-- tenants: public storefront fields readable while tenant is live; members see their own
create policy tenants_public_select on public.booking_tenants for select to anon, authenticated
  using (status in ('trial','active') or public.booking_is_member(id));
create policy tenants_update on public.booking_tenants for update to authenticated
  using (public.booking_has_role(id, array['owner','admin']::public.booking_member_role[]))
  with check (public.booking_has_role(id, array['owner','admin']::public.booking_member_role[]));
-- tenants are created through booking_create_tenant(); deletes are platform-only
create policy tenants_delete on public.booking_tenants for delete to authenticated
  using (public.booking_is_platform_admin());

-- members
create policy members_select on public.booking_members for select to authenticated
  using (user_id = auth.uid() or public.booking_is_member(tenant_id));
create policy members_write on public.booking_members for all to authenticated
  using (public.booking_has_role(tenant_id, array['owner']::public.booking_member_role[]))
  with check (public.booking_has_role(tenant_id, array['owner']::public.booking_member_role[]));

-- domains: members read; owner/admin add (always pending) & remove; status changes only server-side
create policy domains_select on public.booking_domains for select to authenticated
  using (public.booking_is_member(tenant_id));
create policy domains_insert on public.booking_domains for insert to authenticated
  with check (public.booking_has_role(tenant_id, array['owner','admin']::public.booking_member_role[])
              and status = 'pending_verification' and verified_at is null);
create policy domains_delete on public.booking_domains for delete to authenticated
  using (public.booking_has_role(tenant_id, array['owner','admin']::public.booking_member_role[]));

-- catalog tables: public read of active rows for live tenants; members read all; managers write
create policy branches_select on public.booking_branches for select to anon, authenticated
  using ((is_active and public.booking_is_tenant_public(tenant_id)) or public.booking_is_member(tenant_id));
create policy branches_write on public.booking_branches for all to authenticated
  using (public.booking_can_manage(tenant_id)) with check (public.booking_can_manage(tenant_id));

create policy services_select on public.booking_services for select to anon, authenticated
  using ((is_active and is_online_bookable and public.booking_is_tenant_public(tenant_id)) or public.booking_is_member(tenant_id));
create policy services_write on public.booking_services for all to authenticated
  using (public.booking_can_manage(tenant_id)) with check (public.booking_can_manage(tenant_id));

create policy staff_select on public.booking_staff for select to anon, authenticated
  using ((is_active and public.booking_is_tenant_public(tenant_id)) or public.booking_is_member(tenant_id));
create policy staff_write on public.booking_staff for all to authenticated
  using (public.booking_can_manage(tenant_id)) with check (public.booking_can_manage(tenant_id));

create policy resources_select on public.booking_resources for select to authenticated
  using (public.booking_is_member(tenant_id));
create policy resources_write on public.booking_resources for all to authenticated
  using (public.booking_can_manage(tenant_id)) with check (public.booking_can_manage(tenant_id));

create policy staff_services_select on public.booking_staff_services for select to anon, authenticated
  using (public.booking_is_tenant_public(tenant_id) or public.booking_is_member(tenant_id));
create policy staff_services_write on public.booking_staff_services for all to authenticated
  using (public.booking_can_manage(tenant_id)) with check (public.booking_can_manage(tenant_id));

create policy hours_select on public.booking_working_hours for select to authenticated
  using (public.booking_is_member(tenant_id));
create policy hours_write on public.booking_working_hours for all to authenticated
  using (public.booking_can_manage(tenant_id)) with check (public.booking_can_manage(tenant_id));

create policy time_off_select on public.booking_time_off for select to authenticated
  using (public.booking_is_member(tenant_id));
create policy time_off_write on public.booking_time_off for all to authenticated
  using (public.booking_can_manage(tenant_id)) with check (public.booking_can_manage(tenant_id));

-- customer PII: members only
create policy customers_select on public.booking_customers for select to authenticated
  using (public.booking_is_member(tenant_id));
create policy customers_write on public.booking_customers for all to authenticated
  using (public.booking_can_manage(tenant_id)) with check (public.booking_can_manage(tenant_id));

-- appointments: members read; status/notes changes go through booking_* functions
create policy appointments_select on public.booking_appointments for select to authenticated
  using (public.booking_is_member(tenant_id));

create policy allocations_select on public.booking_allocations for select to authenticated
  using (public.booking_is_member(tenant_id));

create policy events_select on public.booking_events for select to authenticated
  using (public.booking_is_member(tenant_id));

create policy audit_select on public.booking_audit_logs for select to authenticated
  using (public.booking_has_role(tenant_id, array['owner','admin']::public.booking_member_role[]));

-- =====================================================================
-- Plan quota enforcement (applies to UI, API and direct DB calls)
-- =====================================================================
create or replace function public.booking_enforce_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limit int;
  v_count int;
  v_col   text;
begin
  v_col := case tg_table_name
             when 'booking_branches' then 'max_branches'
             when 'booking_staff'    then 'max_staff'
             when 'booking_services' then 'max_services'
           end;

  execute format('select p.%I from public.booking_tenants t left join public.booking_plans p on p.id = t.plan_id where t.id = $1', v_col)
    into v_limit using new.tenant_id;

  if v_limit is null then
    return new;
  end if;

  execute format('select count(*) from public.%I where tenant_id = $1', tg_table_name)
    into v_count using new.tenant_id;

  if v_count >= v_limit then
    raise exception 'QUOTA_EXCEEDED: % limit (%) reached for your plan', v_col, v_limit
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger trg_quota_branches before insert on public.booking_branches
  for each row execute function public.booking_enforce_quota();
create trigger trg_quota_staff before insert on public.booking_staff
  for each row execute function public.booking_enforce_quota();
create trigger trg_quota_services before insert on public.booking_services
  for each row execute function public.booking_enforce_quota();

-- =====================================================================
-- Audit triggers
-- =====================================================================
create or replace function public.booking_audit_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status or new.plan_id is distinct from old.plan_id then
    insert into public.booking_audit_logs (tenant_id, actor_id, action, entity, entity_id, details)
    values (new.id, auth.uid(), 'tenant.subscription_changed', 'tenant', new.id::text,
            jsonb_build_object('from_status', old.status, 'to_status', new.status,
                               'from_plan', old.plan_id, 'to_plan', new.plan_id));
  end if;
  return new;
end $$;
create trigger trg_audit_tenant after update on public.booking_tenants
  for each row execute function public.booking_audit_tenant();

create or replace function public.booking_audit_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.booking_audit_logs (tenant_id, actor_id, action, entity, entity_id, details)
  values ((select t.id from public.booking_tenants t where t.id = coalesce(new.tenant_id, old.tenant_id)),
          auth.uid(), 'member.' || lower(tg_op), 'member',
          coalesce(new.user_id, old.user_id)::text,
          jsonb_build_object('old_role', old.role, 'new_role', new.role));
  return coalesce(new, old);
end $$;
create trigger trg_audit_member after insert or update or delete on public.booking_members
  for each row execute function public.booking_audit_member();

-- Platform admins may change plan/status; tenant owners may NOT change their own plan/status.
create or replace function public.booking_guard_tenant_billing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.status is distinct from old.status or new.plan_id is distinct from old.plan_id
      or new.trial_ends_at is distinct from old.trial_ends_at)
     and auth.role() = 'authenticated' and not public.booking_is_platform_admin() then
    raise exception 'FORBIDDEN: only platform admins can change plan or status' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_guard_tenant_billing before update on public.booking_tenants
  for each row execute function public.booking_guard_tenant_billing();

-- Appointment status -> allocation activity + event log
create or replace function public.booking_on_appointment_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    update public.booking_allocations
       set active = new.status not in ('cancelled', 'expired')
     where appointment_id = new.id;
    insert into public.booking_events (tenant_id, appointment_id, event_type, from_status, to_status, actor_id)
    values (new.tenant_id, new.id, 'status_changed', old.status, new.status, auth.uid());
  end if;
  if tg_op = 'UPDATE' and (new.starts_at <> old.starts_at or new.staff_id <> old.staff_id) then
    insert into public.booking_events (tenant_id, appointment_id, event_type, payload, actor_id)
    values (new.tenant_id, new.id, 'rescheduled',
            jsonb_build_object('from', old.starts_at, 'to', new.starts_at,
                               'from_staff', old.staff_id, 'to_staff', new.staff_id), auth.uid());
  end if;
  return new;
end $$;
create trigger trg_appointment_change after update on public.booking_appointments
  for each row execute function public.booking_on_appointment_change();
