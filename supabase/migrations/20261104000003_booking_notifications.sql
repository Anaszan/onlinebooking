-- =====================================================================
-- SYSRENT Booking — internal notes + notification outbox (Phase 6/8)
-- =====================================================================

create or replace function public.booking_set_internal_note(p_appointment uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.booking_appointments where id = p_appointment;
  if v_tenant is null or not public.booking_is_member(v_tenant) then
    raise exception 'NOT_FOUND: appointment' using errcode = 'P0002';
  end if;
  update public.booking_appointments set internal_note = nullif(p_note, '') where id = p_appointment;
end $$;
revoke execute on function public.booking_set_internal_note(uuid, text) from public, anon;
grant execute on function public.booking_set_internal_note(uuid, text) to authenticated;

-- Outbox: one row per message. dedup_key prevents duplicate sends.
create table public.booking_notifications (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.booking_tenants(id) on delete cascade,
  appointment_id  uuid references public.booking_appointments(id) on delete cascade,
  channel         text not null check (channel in ('email', 'sms', 'line', 'webhook')),
  recipient       text not null,
  template        text not null,
  payload         jsonb not null default '{}'::jsonb,
  dedup_key       text not null unique,
  status          text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts        int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error      text,
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index on public.booking_notifications (status, next_attempt_at);
create index on public.booking_notifications (tenant_id, created_at desc);

alter table public.booking_notifications enable row level security;
create policy notifications_select on public.booking_notifications for select to authenticated
  using (public.booking_can_manage(tenant_id));

-- Claim a batch atomically (safe with multiple workers)
create or replace function public.booking_claim_notifications(p_limit int default 20)
returns setof public.booking_notifications
language sql security definer set search_path = public as $$
  update public.booking_notifications n
     set status = 'sending', attempts = attempts + 1
   where n.id in (
     select id from public.booking_notifications
      where status = 'pending' and next_attempt_at <= now()
      order by next_attempt_at
      limit p_limit
      for update skip locked)
  returning n.*;
$$;
revoke execute on function public.booking_claim_notifications(int) from public, anon, authenticated;
grant execute on function public.booking_claim_notifications(int) to service_role;
