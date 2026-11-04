-- =====================================================================
-- SYSRENT Booking — RPC functions (Phase 3–4)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Default plans
-- ---------------------------------------------------------------------
insert into public.booking_plans (code, name, price_monthly, max_branches, max_staff, max_services, max_bookings_per_month, features)
values
  ('free',     'Free',     0,    1,    2,    5,    100,  '{"custom_domain": false, "reports": false}'),
  ('pro',      'Pro',      490,  3,    10,   50,   2000, '{"custom_domain": true,  "reports": true}'),
  ('business', 'Business', 1490, null, null, null, null, '{"custom_domain": true,  "reports": true}')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Onboarding: create tenant + owner membership + first branch
-- ---------------------------------------------------------------------
create or replace function public.booking_create_tenant(
  p_slug text, p_name text, p_timezone text default 'Asia/Bangkok', p_branch_name text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_tenant uuid;
  v_plan   uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if (select count(*) from public.booking_tenants where created_by = v_uid) >= 5 then
    raise exception 'QUOTA_EXCEEDED: maximum 5 shops per account' using errcode = 'P0001';
  end if;

  if lower(p_slug) in ('www', 'app', 'api', 'admin', 'platform', 'dashboard', 'login', 'signup', 'auth', 'static', 'mail', 'booking') then
    raise exception 'SLUG_RESERVED' using errcode = '22023';
  end if;

  select id into v_plan from public.booking_plans where code = 'free';

  insert into public.booking_tenants (slug, name, plan_id, created_by)
  values (lower(p_slug), p_name, v_plan, v_uid)
  returning id into v_tenant;

  insert into public.booking_members (tenant_id, user_id, role) values (v_tenant, v_uid, 'owner');

  insert into public.booking_branches (tenant_id, name, timezone)
  values (v_tenant, coalesce(nullif(p_branch_name, ''), 'สาขาหลัก'), coalesce(p_timezone, 'Asia/Bangkok'));

  return v_tenant;
end $$;

revoke execute on function public.booking_create_tenant(text, text, text, text) from public, anon;
grant execute on function public.booking_create_tenant(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Domain resolution (used by proxy). Only ACTIVE domains of live tenants.
-- ---------------------------------------------------------------------
create or replace function public.booking_resolve_domain(p_hostname text)
returns text
language sql stable security definer set search_path = public as $$
  select t.slug
    from public.booking_domains d
    join public.booking_tenants t on t.id = d.tenant_id
   where d.hostname = lower(p_hostname)
     and d.status = 'active'
     and t.status in ('trial', 'active')
   limit 1;
$$;
grant execute on function public.booking_resolve_domain(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Transactional booking creation.
-- Called ONLY by the server (service_role) after it has verified that the
-- slot is inside working hours. Overlaps are rejected by the exclusion
-- constraint on booking_allocations (SQLSTATE 23P01) — even under races.
-- ---------------------------------------------------------------------
create or replace function public.booking_create_appointment(
  p_tenant          uuid,
  p_branch          uuid,
  p_service         uuid,
  p_staff           uuid,
  p_starts_at       timestamptz,
  p_customer_name   text,
  p_customer_phone  text,
  p_customer_email  text default null,
  p_customer_note   text default null,
  p_idempotency_key text default null,
  p_source          text default 'online'
) returns table (
  appointment_id uuid, reference_code text, access_token text,
  status public.booking_appointment_status, starts_at timestamptz, ends_at timestamptz, created boolean
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_tenant    public.booking_tenants%rowtype;
  v_service   public.booking_services%rowtype;
  v_staff     public.booking_staff%rowtype;
  v_limit     int;
  v_used      int;
  v_customer  uuid;
  v_ends      timestamptz;
  v_ref       text;
  v_appt      public.booking_appointments%rowtype;
  v_status    public.booking_appointment_status;
begin
  -- Idempotent replay
  if p_idempotency_key is not null then
    select * into v_appt from public.booking_appointments a
     where a.tenant_id = p_tenant and a.idempotency_key = p_idempotency_key;
    if found then
      return query select v_appt.id, v_appt.reference_code, v_appt.access_token,
                          v_appt.status, v_appt.starts_at, v_appt.ends_at, false;
      return;
    end if;
  end if;

  select * into v_tenant from public.booking_tenants t where t.id = p_tenant;
  if not found then
    raise exception 'NOT_FOUND: tenant' using errcode = 'P0002';
  end if;
  if p_source = 'online' and v_tenant.status not in ('trial', 'active') then
    raise exception 'TENANT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select * into v_service from public.booking_services s
   where s.id = p_service and s.tenant_id = p_tenant and s.is_active
     and (p_source <> 'online' or s.is_online_bookable);
  if not found then
    raise exception 'NOT_FOUND: service' using errcode = 'P0002';
  end if;

  select * into v_staff from public.booking_staff st
   where st.id = p_staff and st.tenant_id = p_tenant and st.branch_id = p_branch and st.is_active;
  if not found then
    raise exception 'NOT_FOUND: staff' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.booking_staff_services ss where ss.staff_id = p_staff)
     and not exists (select 1 from public.booking_staff_services ss where ss.staff_id = p_staff and ss.service_id = p_service) then
    raise exception 'STAFF_CANNOT_PERFORM_SERVICE' using errcode = 'P0001';
  end if;

  if p_source = 'online' and p_starts_at < now() + make_interval(mins => v_tenant.min_advance_minutes) then
    raise exception 'TOO_LATE_TO_BOOK' using errcode = 'P0001';
  end if;

  -- Serialize quota checks per tenant
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text, 0));

  select p.max_bookings_per_month into v_limit from public.booking_plans p where p.id = v_tenant.plan_id;
  if v_limit is not null then
    select count(*) into v_used from public.booking_appointments a
     where a.tenant_id = p_tenant
       and a.created_at >= date_trunc('month', now())
       and a.status not in ('cancelled', 'expired');
    if v_used >= v_limit then
      raise exception 'QUOTA_EXCEEDED: monthly booking limit (%) reached', v_limit using errcode = 'P0001';
    end if;
  end if;

  -- Upsert customer by phone (tenant-scoped)
  insert into public.booking_customers (tenant_id, full_name, phone, email)
  values (p_tenant, p_customer_name, p_customer_phone, nullif(p_customer_email, ''))
  on conflict (tenant_id, phone) do update
     set full_name = excluded.full_name,
         email = coalesce(excluded.email, public.booking_customers.email)
  returning id into v_customer;

  v_ends := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_status := case when v_tenant.auto_confirm or p_source <> 'online' then 'confirmed' else 'pending' end;

  -- Unique, human-friendly reference e.g. BK-7KQ2MX
  loop
    v_ref := 'BK-' || substr(translate(upper(encode(gen_random_bytes(9), 'base64')), '+/=0O1I', ''), 1, 6);
    exit when length(v_ref) = 9
          and not exists (select 1 from public.booking_appointments a where a.reference_code = v_ref);
  end loop;

  begin
    insert into public.booking_appointments (
      tenant_id, branch_id, service_id, staff_id, customer_id, reference_code,
      starts_at, ends_at, status, price, customer_note, source, idempotency_key)
    values (
      p_tenant, p_branch, p_service, p_staff, v_customer, v_ref,
      p_starts_at, v_ends, v_status, v_service.price, nullif(p_customer_note, ''), p_source, p_idempotency_key)
    returning * into v_appt;
  exception when unique_violation then
    -- concurrent request with same idempotency key won the race
    select * into v_appt from public.booking_appointments a
     where a.tenant_id = p_tenant and a.idempotency_key = p_idempotency_key;
    if not found then
      raise;
    end if;
    return query select v_appt.id, v_appt.reference_code, v_appt.access_token,
                        v_appt.status, v_appt.starts_at, v_appt.ends_at, false;
    return;
  end;

  insert into public.booking_allocations (tenant_id, appointment_id, resource_kind, resource_id, during)
  values (p_tenant, v_appt.id, 'staff', p_staff,
          tstzrange(p_starts_at - make_interval(mins => v_service.buffer_before_min),
                    v_ends + make_interval(mins => v_service.buffer_after_min), '[)'));

  insert into public.booking_events (tenant_id, appointment_id, event_type, to_status, payload)
  values (p_tenant, v_appt.id, 'created', v_status, jsonb_build_object('source', p_source));

  return query select v_appt.id, v_appt.reference_code, v_appt.access_token,
                      v_appt.status, v_appt.starts_at, v_appt.ends_at, true;
end $$;

revoke execute on function public.booking_create_appointment(uuid, uuid, uuid, uuid, timestamptz, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.booking_create_appointment(uuid, uuid, uuid, uuid, timestamptz, text, text, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------
-- Merchant: change appointment status (validated state machine)
-- ---------------------------------------------------------------------
create or replace function public.booking_set_appointment_status(
  p_appointment uuid, p_status public.booking_appointment_status
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_appt public.booking_appointments%rowtype;
  v_ok   boolean;
begin
  select * into v_appt from public.booking_appointments where id = p_appointment for update;
  if not found or not public.booking_is_member(v_appt.tenant_id) then
    raise exception 'NOT_FOUND: appointment' using errcode = 'P0002';
  end if;

  v_ok := case v_appt.status
    when 'pending'    then p_status in ('confirmed', 'cancelled', 'expired')
    when 'confirmed'  then p_status in ('checked_in', 'completed', 'cancelled', 'no_show')
    when 'checked_in' then p_status in ('completed', 'no_show')
    else false
  end;
  if not v_ok then
    raise exception 'INVALID_TRANSITION: % -> %', v_appt.status, p_status using errcode = 'P0001';
  end if;

  update public.booking_appointments set status = p_status where id = p_appointment;
end $$;
revoke execute on function public.booking_set_appointment_status(uuid, public.booking_appointment_status) from public, anon;
grant execute on function public.booking_set_appointment_status(uuid, public.booking_appointment_status) to authenticated;

-- ---------------------------------------------------------------------
-- Merchant: reschedule (re-allocates; exclusion constraint guards overlap)
-- ---------------------------------------------------------------------
create or replace function public.booking_reschedule_appointment(
  p_appointment uuid, p_new_start timestamptz, p_new_staff uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_appt    public.booking_appointments%rowtype;
  v_service public.booking_services%rowtype;
  v_staff   uuid;
  v_ends    timestamptz;
begin
  select * into v_appt from public.booking_appointments where id = p_appointment for update;
  if not found or not public.booking_is_member(v_appt.tenant_id) then
    raise exception 'NOT_FOUND: appointment' using errcode = 'P0002';
  end if;
  if v_appt.status not in ('pending', 'confirmed') then
    raise exception 'INVALID_TRANSITION: cannot reschedule a % appointment', v_appt.status using errcode = 'P0001';
  end if;

  v_staff := coalesce(p_new_staff, v_appt.staff_id);
  if not exists (select 1 from public.booking_staff s
                  where s.id = v_staff and s.tenant_id = v_appt.tenant_id and s.branch_id = v_appt.branch_id and s.is_active) then
    raise exception 'NOT_FOUND: staff' using errcode = 'P0002';
  end if;

  select * into v_service from public.booking_services where id = v_appt.service_id;
  v_ends := p_new_start + make_interval(mins => v_service.duration_minutes);

  update public.booking_appointments
     set starts_at = p_new_start, ends_at = v_ends, staff_id = v_staff
   where id = p_appointment;

  update public.booking_allocations
     set resource_id = v_staff,
         during = tstzrange(p_new_start - make_interval(mins => v_service.buffer_before_min),
                            v_ends + make_interval(mins => v_service.buffer_after_min), '[)')
   where appointment_id = p_appointment and resource_kind = 'staff';
end $$;
revoke execute on function public.booking_reschedule_appointment(uuid, timestamptz, uuid) from public, anon;
grant execute on function public.booking_reschedule_appointment(uuid, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Customer: cancel with reference + secret token (server-side only)
-- ---------------------------------------------------------------------
create or replace function public.booking_cancel_by_customer(p_reference text, p_token text)
returns public.booking_appointment_status
language plpgsql security definer set search_path = public as $$
declare
  v_appt   public.booking_appointments%rowtype;
  v_cutoff int;
begin
  select * into v_appt from public.booking_appointments
   where reference_code = p_reference and access_token = p_token for update;
  if not found then
    raise exception 'NOT_FOUND: appointment' using errcode = 'P0002';
  end if;
  if v_appt.status not in ('pending', 'confirmed') then
    raise exception 'INVALID_TRANSITION: cannot cancel a % appointment', v_appt.status using errcode = 'P0001';
  end if;

  select cancel_cutoff_hours into v_cutoff from public.booking_tenants where id = v_appt.tenant_id;
  if v_appt.starts_at - make_interval(hours => v_cutoff) < now() then
    raise exception 'CANCEL_WINDOW_CLOSED' using errcode = 'P0001';
  end if;

  update public.booking_appointments set status = 'cancelled' where id = v_appt.id;
  return 'cancelled';
end $$;
revoke execute on function public.booking_cancel_by_customer(text, text) from public, anon, authenticated;
grant execute on function public.booking_cancel_by_customer(text, text) to service_role;

-- ---------------------------------------------------------------------
-- Expire unpaid holds (schedule with pg_cron: every minute)
--   select cron.schedule('booking-expire-holds', '* * * * *', 'select public.booking_expire_holds()');
-- ---------------------------------------------------------------------
create or replace function public.booking_expire_holds()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update public.booking_appointments
     set status = 'expired'
   where status = 'pending' and hold_expires_at is not null and hold_expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function public.booking_expire_holds() from public, anon, authenticated;
grant execute on function public.booking_expire_holds() to service_role;
