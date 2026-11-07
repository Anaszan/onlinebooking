-- =====================================================================
-- Pet-care specialisation
--  - shop theme: accent colour (primary_color already exists)
--  - services: category + which species they accept
--  - pets (per customer) with photo stored in Supabase Storage
--  - appointments reference the pet
--  - storage buckets: pet-photos (private), shop-assets (public logos/covers)
-- =====================================================================

-- ---------------------------------------------------------------- theme
alter table public.booking_tenants
  add column if not exists accent_color text not null default '#fbbf24'
    check (accent_color ~ '^#[0-9a-fA-F]{6}$');
alter table public.booking_tenants alter column primary_color set default '#ea6f1f';

-- ---------------------------------------------------------------- services
alter table public.booking_services
  add column if not exists category text not null default 'other'
    check (category in ('grooming', 'bath', 'spa', 'boarding', 'daycare', 'vet', 'vaccine', 'training', 'other')),
  add column if not exists species text[] not null default '{}'
    check (species <@ array['dog', 'cat', 'rabbit', 'bird', 'other']::text[]);

-- ---------------------------------------------------------------- pets
create table public.booking_pets (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.booking_tenants(id) on delete cascade,
  customer_id  uuid not null,
  name         text not null check (char_length(name) between 1 and 60),
  species      text not null check (species in ('dog', 'cat', 'rabbit', 'bird', 'other')),
  breed        text check (char_length(breed) <= 80),
  weight_kg    numeric(5,2) check (weight_kg > 0 and weight_kg < 200),
  notes        text check (char_length(notes) <= 1000),
  photo_path   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references public.booking_customers(tenant_id, id) on delete cascade
);
create unique index booking_pets_customer_name_species on public.booking_pets (customer_id, lower(name), species);
create index on public.booking_pets (tenant_id);
create trigger trg_pets_updated before update on public.booking_pets
  for each row execute function public.booking_touch_updated_at();

alter table public.booking_pets enable row level security;
create policy pets_select on public.booking_pets for select to authenticated
  using (public.booking_is_member(tenant_id));
create policy pets_write on public.booking_pets for all to authenticated
  using (public.booking_can_manage(tenant_id)) with check (public.booking_can_manage(tenant_id));
grant select, insert, update, delete on public.booking_pets to authenticated;
grant all on public.booking_pets to service_role;

alter table public.booking_appointments add column if not exists pet_id uuid;
alter table public.booking_appointments
  add constraint booking_appointments_pet_fk
  foreign key (tenant_id, pet_id) references public.booking_pets(tenant_id, id) on delete set null (pet_id);
create index on public.booking_appointments (pet_id);

-- ---------------------------------------------------------------- helpers
create or replace function public.booking_try_uuid(p text)
returns uuid language sql immutable as $$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p::uuid end;
$$;
grant execute on function public.booking_try_uuid(text) to anon, authenticated, service_role;

-- Look up an auth user by email (server-side only, used to add staff logins)
create or replace function public.booking_find_user_by_email(p_email text)
returns uuid language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
revoke execute on function public.booking_find_user_by_email(text) from public, anon, authenticated;
grant execute on function public.booking_find_user_by_email(text) to service_role;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pet-photos', 'pet-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('shop-assets', 'shop-assets', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Pet photos: private. Shop members may read their own tenant's folder
-- (<tenant_id>/...). Uploads happen server-side with the service role.
create policy "booking pet photos: members read" on storage.objects for select to authenticated
  using (bucket_id = 'pet-photos'
         and public.booking_is_member(public.booking_try_uuid((storage.foldername(name))[1])));

-- ---------------------------------------------------------------- reschedule / reassign
-- Same as before, plus: the new assignee must be able to perform the service.
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
  if exists (select 1 from public.booking_staff_services ss where ss.staff_id = v_staff)
     and not exists (select 1 from public.booking_staff_services ss where ss.staff_id = v_staff and ss.service_id = v_appt.service_id) then
    raise exception 'STAFF_CANNOT_PERFORM_SERVICE' using errcode = 'P0001';
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

-- ---------------------------------------------------------------- booking RPC (adds pet)
drop function if exists public.booking_create_appointment(uuid, uuid, uuid, uuid, timestamptz, text, text, text, text, text, text);

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
  p_source          text default 'online',
  p_pet_name        text default null,
  p_pet_species     text default null,
  p_pet_breed       text default null,
  p_pet_weight_kg   numeric default null,
  p_pet_notes       text default null,
  p_pet_photo_path  text default null
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
  v_pet       uuid;
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

  -- Pet rules
  if p_source = 'online' and (nullif(trim(p_pet_name), '') is null or p_pet_species is null) then
    raise exception 'PET_REQUIRED' using errcode = 'P0001';
  end if;
  if p_pet_species is not null and cardinality(v_service.species) > 0
     and not (p_pet_species = any (v_service.species)) then
    raise exception 'SPECIES_NOT_SUPPORTED' using errcode = 'P0001';
  end if;
  if p_pet_photo_path is not null and split_part(p_pet_photo_path, '/', 1) <> p_tenant::text then
    raise exception 'INVALID_PHOTO' using errcode = 'P0001';
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

  -- Upsert pet by (customer, name, species); keep the latest photo/details
  if nullif(trim(p_pet_name), '') is not null and p_pet_species is not null then
    insert into public.booking_pets (tenant_id, customer_id, name, species, breed, weight_kg, notes, photo_path)
    values (p_tenant, v_customer, trim(p_pet_name), p_pet_species, nullif(trim(p_pet_breed), ''),
            p_pet_weight_kg, nullif(trim(p_pet_notes), ''), p_pet_photo_path)
    on conflict (customer_id, lower(name), species) do update
       set breed      = coalesce(excluded.breed, public.booking_pets.breed),
           weight_kg  = coalesce(excluded.weight_kg, public.booking_pets.weight_kg),
           notes      = coalesce(excluded.notes, public.booking_pets.notes),
           photo_path = coalesce(excluded.photo_path, public.booking_pets.photo_path)
    returning id into v_pet;
  end if;

  v_ends := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_status := case when v_tenant.auto_confirm or p_source <> 'online' then 'confirmed' else 'pending' end;

  loop
    v_ref := 'BK-' || substr(translate(upper(encode(gen_random_bytes(9), 'base64')), '+/=0O1I', ''), 1, 6);
    exit when length(v_ref) = 9
          and not exists (select 1 from public.booking_appointments a where a.reference_code = v_ref);
  end loop;

  begin
    insert into public.booking_appointments (
      tenant_id, branch_id, service_id, staff_id, customer_id, pet_id, reference_code,
      starts_at, ends_at, status, price, customer_note, source, idempotency_key)
    values (
      p_tenant, p_branch, p_service, p_staff, v_customer, v_pet, v_ref,
      p_starts_at, v_ends, v_status, v_service.price, nullif(p_customer_note, ''), p_source, p_idempotency_key)
    returning * into v_appt;
  exception when unique_violation then
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
  values (p_tenant, v_appt.id, 'created', v_status, jsonb_build_object('source', p_source, 'pet_id', v_pet));

  return query select v_appt.id, v_appt.reference_code, v_appt.access_token,
                      v_appt.status, v_appt.starts_at, v_appt.ends_at, true;
end $$;

revoke execute on function public.booking_create_appointment(uuid, uuid, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.booking_create_appointment(uuid, uuid, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, text, numeric, text, text) to service_role;
