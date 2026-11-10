-- =====================================================================
-- Single-shop mode
-- The app now runs ONE pet-grooming shop. The schema stays tenant-aware
-- (RLS keeps working as defence in depth), but:
--   * the shop is created once, server-side, by booking_setup_shop()
--   * users can no longer create shops through the API
--   * the shop is on an unlimited plan and always active
-- =====================================================================

-- Users may not create shops directly any more (server/service role only)
revoke execute on function public.booking_create_tenant(text, text, text, text) from authenticated;
grant execute on function public.booking_create_tenant(text, text, text, text) to service_role;

-- Unlimited plan for the shop
insert into public.booking_plans (code, name, price_monthly, features, is_public)
values ('shop', 'Shop', 0, '{"custom_domain": true, "reports": true}', false)
on conflict (code) do nothing;

update public.booking_tenants
   set plan_id = (select id from public.booking_plans where code = 'shop'),
       status = 'active',
       trial_ends_at = null;

-- One-time setup: creates the shop, its owner membership and first branch.
-- Refuses if a shop already exists.
create or replace function public.booking_setup_shop(
  p_owner uuid, p_name text, p_timezone text default 'Asia/Bangkok'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
begin
  -- serialize concurrent setup attempts
  perform pg_advisory_xact_lock(hashtext('booking_setup_shop'));
  if exists (select 1 from public.booking_tenants) then
    raise exception 'SHOP_EXISTS' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users where id = p_owner) then
    raise exception 'NOT_FOUND: owner' using errcode = 'P0002';
  end if;

  insert into public.booking_tenants (slug, name, plan_id, status, trial_ends_at, created_by, primary_color, accent_color)
  values ('shop', p_name, (select id from public.booking_plans where code = 'shop'), 'active', null, p_owner, '#ea6f1f', '#fbbf24')
  returning id into v_tenant;

  insert into public.booking_members (tenant_id, user_id, role) values (v_tenant, p_owner, 'owner');
  insert into public.booking_branches (tenant_id, name, timezone)
  values (v_tenant, 'หน้าร้าน', coalesce(p_timezone, 'Asia/Bangkok'));

  return v_tenant;
end $$;
revoke execute on function public.booking_setup_shop(uuid, text, text) from public, anon, authenticated;
grant execute on function public.booking_setup_shop(uuid, text, text) to service_role;
