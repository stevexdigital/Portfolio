-- Security fix: sync_contact_from_booking() is SECURITY DEFINER, and it was callable by anyone
-- through /rest/v1/rpc/sync_contact_from_booking. It only needs to run as the bookings trigger,
-- which keeps working without this grant (Postgres checks EXECUTE only when the trigger is created).
-- Flagged by the Supabase security advisor. Safe to re-run.
revoke execute on function public.sync_contact_from_booking() from public, anon, authenticated;
