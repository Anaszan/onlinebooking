-- =====================================================================
-- Explicit privileges (do not rely on Supabase default grants).
-- RLS policies still decide which ROWS each role can touch.
-- =====================================================================

-- anon: public storefront catalog only
grant select on public.booking_plans, public.booking_tenants, public.booking_branches,
                public.booking_services, public.booking_staff, public.booking_staff_services
  to anon;

-- authenticated: all booking tables, filtered by RLS
grant select, insert, update, delete on
  public.booking_plans, public.booking_tenants, public.booking_members, public.booking_domains,
  public.booking_branches, public.booking_services, public.booking_staff, public.booking_resources,
  public.booking_staff_services, public.booking_working_hours, public.booking_time_off,
  public.booking_customers
  to authenticated;
-- write paths for these go through SECURITY DEFINER functions only
grant select on public.booking_appointments, public.booking_allocations, public.booking_events,
                public.booking_audit_logs, public.booking_notifications, public.booking_platform_admins
  to authenticated;

-- service_role (server-side privileged client)
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- helper functions used inside RLS policies
grant execute on function public.booking_is_platform_admin() to anon, authenticated, service_role;
grant execute on function public.booking_has_role(uuid, public.booking_member_role[]) to anon, authenticated, service_role;
grant execute on function public.booking_is_member(uuid) to anon, authenticated, service_role;
grant execute on function public.booking_can_manage(uuid) to anon, authenticated, service_role;
grant execute on function public.booking_is_tenant_public(uuid) to anon, authenticated, service_role;
