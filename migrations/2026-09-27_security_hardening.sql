-- Security hardening. Run in Supabase: SQL Editor → New query → paste all → Run. Safe to re-run.
--
-- What this does:
--   1. Only accounts listed in admin_users can change content or see private data. Before this,
--      ANY signed-in account could (and anyone can create an account if sign-ups are enabled).
--   2. Server-side input validation (length / format limits) on everything the public can submit.
--   3. Server-side rate limits on bookings and newsletter sign-ups, plus double-booking protection.
--   4. The booking notification webhook URL moves out of public site settings into an admin-only
--      table, and notifications are sent from the database with an HMAC-SHA256 signature.
--   5. Upload limits on the image bucket (images only, max 2 MB, no SVG).
--   6. A rate-limit store for the chat assistant (used by the portfolio-chat edge function).

-- ============================================================================
-- 1. ADMINS
-- ============================================================================
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- is_admin() runs as the caller, so callers need SELECT; RLS still limits them to their own row.
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to anon, authenticated;

drop policy if exists "Admins can see their own row" on public.admin_users;
create policy "Admins can see their own row" on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));
-- No insert/update/delete policies: admins can only be added from the SQL Editor.

-- First run only: make the site owner (the oldest login — schema.sql tells you to create it first) the admin.
-- To add or change admins later:  insert into public.admin_users (user_id) select id from auth.users where email = '...';
insert into public.admin_users (user_id)
select id from auth.users order by created_at limit 1
on conflict do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()));
$$;

-- ============================================================================
-- 2. ROW LEVEL SECURITY: public can read site content, only admins can change it
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['site_content','hero_badges','solutions','about_stats','stack_items','projects','availability_hours','faqs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Authenticated write" on public.%I', t);
    execute format('drop policy if exists "Public read access" on public.%I', t);
    execute format('drop policy if exists "Admin insert" on public.%I', t);
    execute format('drop policy if exists "Admin update" on public.%I', t);
    execute format('drop policy if exists "Admin delete" on public.%I', t);
    execute format('create policy "Public read access" on public.%I for select using (true)', t);
    execute format('create policy "Admin insert" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "Admin update" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "Admin delete" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

-- Bookings: anyone can submit one; only admins can see, edit or remove them
alter table public.bookings enable row level security;
drop policy if exists "Only owner can read bookings" on public.bookings;
drop policy if exists "Only owner can delete bookings" on public.bookings;
drop policy if exists "Admin read bookings" on public.bookings;
drop policy if exists "Admin update bookings" on public.bookings;
drop policy if exists "Admin delete bookings" on public.bookings;
create policy "Admin read bookings" on public.bookings for select to authenticated using ((select public.is_admin()));
create policy "Admin update bookings" on public.bookings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admin delete bookings" on public.bookings for delete to authenticated using ((select public.is_admin()));
-- ("Public can submit bookings" insert policy from schema.sql stays; the guard trigger below validates + rate-limits it.)

-- Contacts CRM: admins only
alter table public.contacts enable row level security;
drop policy if exists "Authenticated full access" on public.contacts;
drop policy if exists "Admin full access" on public.contacts;
create policy "Admin full access" on public.contacts for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Newsletter: anyone can sign up; only admins can see or remove sign-ups
alter table public.newsletter_subscribers enable row level security;
drop policy if exists "Only owner can read subscribers" on public.newsletter_subscribers;
drop policy if exists "Only owner can delete subscribers" on public.newsletter_subscribers;
drop policy if exists "Admin read subscribers" on public.newsletter_subscribers;
drop policy if exists "Admin delete subscribers" on public.newsletter_subscribers;
create policy "Admin read subscribers" on public.newsletter_subscribers for select to authenticated using ((select public.is_admin()));
create policy "Admin delete subscribers" on public.newsletter_subscribers for delete to authenticated using ((select public.is_admin()));

-- ============================================================================
-- 3. SERVER-SIDE INPUT VALIDATION
-- ============================================================================
alter table public.bookings drop constraint if exists bookings_name_check;
alter table public.bookings drop constraint if exists bookings_email_check;
alter table public.bookings drop constraint if exists bookings_time_check;
alter table public.bookings drop constraint if exists bookings_message_check;
alter table public.bookings
  add constraint bookings_name_check check (char_length(btrim(name)) between 1 and 200),
  add constraint bookings_email_check check (char_length(email) <= 320 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  add constraint bookings_time_check check (preferred_time is null or char_length(preferred_time) <= 40),
  add constraint bookings_message_check check (message is null or char_length(message) <= 5000);

alter table public.contacts drop constraint if exists contacts_name_check;
alter table public.contacts drop constraint if exists contacts_email_check;
alter table public.contacts drop constraint if exists contacts_phone_check;
alter table public.contacts drop constraint if exists contacts_notes_check;
alter table public.contacts drop constraint if exists contacts_status_check;
alter table public.contacts
  add constraint contacts_name_check check (char_length(btrim(name)) between 1 and 200),
  add constraint contacts_email_check check (char_length(email) <= 320 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  add constraint contacts_phone_check check (phone is null or char_length(phone) <= 40),
  add constraint contacts_notes_check check (notes is null or char_length(notes) <= 10000),
  add constraint contacts_status_check check (status in ('new','contacted','qualified','booked','closed'));

alter table public.newsletter_subscribers drop constraint if exists newsletter_subscribers_email_format_check;
alter table public.newsletter_subscribers
  add constraint newsletter_subscribers_email_format_check check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

-- ============================================================================
-- 4. RATE LIMITS + DOUBLE-BOOKING PROTECTION (public submissions only; admins are exempt)
--    Errors use PostgREST's PTxxx codes, so the browser receives a real 429 / 409 status.
-- ============================================================================
create or replace function public.guard_booking_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  new.name := btrim(new.name);
  new.email := lower(btrim(new.email));
  new.created_at := now(); -- clients can't backdate or future-date a booking

  if new.preferred_date is not null
     and (new.preferred_date < current_date - 1 or new.preferred_date > current_date + 180) then
    raise exception 'Please pick a date within the next 6 months.' using errcode = '22023';
  end if;

  if (select count(*) from public.bookings b
      where b.email = new.email and b.created_at > now() - interval '1 day') >= 3 then
    raise exception 'Too many booking requests from this email today. Please try again tomorrow.' using errcode = 'PT429';
  end if;

  if (select count(*) from public.bookings b where b.created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'The booking form is busy right now. Please try again in a few minutes.' using errcode = 'PT429';
  end if;

  if new.preferred_date is not null and new.preferred_time is not null and exists (
       select 1 from public.bookings b
       where b.preferred_date = new.preferred_date and b.preferred_time = new.preferred_time) then
    raise exception 'That time was just booked by someone else. Please pick another slot.' using errcode = 'PT409';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_booking_insert on public.bookings;
create trigger trg_guard_booking_insert
before insert on public.bookings
for each row execute function public.guard_booking_insert();

create or replace function public.guard_newsletter_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  new.email := lower(btrim(new.email));
  new.source := 'site';
  new.created_at := now();

  if (select count(*) from public.newsletter_subscribers s where s.created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Too many sign-ups right now. Please try again in a few minutes.' using errcode = 'PT429';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_newsletter_insert on public.newsletter_subscribers;
create trigger trg_guard_newsletter_insert
before insert on public.newsletter_subscribers
for each row execute function public.guard_newsletter_insert();

-- The public calendar needs to know which times are taken — but not who booked them.
create or replace function public.booked_slots()
returns table (preferred_date date, preferred_time text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.preferred_date, b.preferred_time
  from public.bookings b
  where b.preferred_date >= current_date - 1 and b.preferred_time is not null;
$$;
revoke all on function public.booked_slots() from public;
grant execute on function public.booked_slots() to anon, authenticated;

-- ============================================================================
-- 5. PRIVATE SETTINGS + SIGNED BOOKING NOTIFICATIONS (sent server-side, never from the browser)
-- ============================================================================
create table if not exists public.private_settings (
  key text primary key,
  value text not null default ''
);
alter table public.private_settings enable row level security;
revoke all on public.private_settings from anon;
grant select, insert, update, delete on public.private_settings to authenticated;
drop policy if exists "Admin full access" on public.private_settings;
create policy "Admin full access" on public.private_settings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Move the notification webhook out of the publicly readable site_content table
insert into public.private_settings (key, value)
select 'notification_webhook_url', value from public.site_content where key = 'notification_webhook_url'
on conflict (key) do nothing;
insert into public.private_settings (key, value) values ('notification_webhook_url', '') on conflict (key) do nothing;
delete from public.site_content where key = 'notification_webhook_url';

insert into public.private_settings (key, value)
values ('webhook_signing_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

create extension if not exists pg_net with schema extensions; -- its functions live in the "net" schema

-- Receivers verify with: HMAC-SHA256(secret, "<X-Webhook-Timestamp>.<raw request body>") == X-Webhook-Signature (hex, after "sha256=")
create or replace function public.notify_new_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hook_url text;
  secret text;
  payload jsonb;
  ts text;
begin
  select value into hook_url from public.private_settings where key = 'notification_webhook_url';
  if coalesce(hook_url, '') !~ '^https://' then
    return new;
  end if;
  select value into secret from public.private_settings where key = 'webhook_signing_secret';

  payload := jsonb_build_object(
    'event', 'new_booking',
    'booking_id', new.id,
    'name', new.name,
    'email', new.email,
    'date', new.preferred_date,
    'time', new.preferred_time,
    'notes', coalesce(new.message, ''),
    'created_at', new.created_at
  );
  ts := floor(extract(epoch from now()))::bigint::text;

  perform net.http_post(
    url := hook_url,
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Timestamp', ts,
      'X-Webhook-Signature', 'sha256=' || encode(extensions.hmac(ts || '.' || payload::text, coalesce(secret, ''), 'sha256'), 'hex')
    )
  );
  return new;
exception when others then
  return new; -- a failed notification must never block a booking
end;
$$;

drop trigger if exists trg_notify_new_booking on public.bookings;
create trigger trg_notify_new_booking
after insert on public.bookings
for each row execute function public.notify_new_booking();

-- ============================================================================
-- 6. UPLOADS: images only, 2 MB max, no SVG (SVGs can carry scripts); only admins can write or list
-- ============================================================================
update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','image/x-icon','image/vnd.microsoft.icon']
where id = 'avatars';

drop policy if exists "Public read avatars" on storage.objects;
drop policy if exists "Authenticated write avatars" on storage.objects;
drop policy if exists "Admin read avatars" on storage.objects;
drop policy if exists "Admin write avatars" on storage.objects;
-- The bucket is public, so image URLs still load for everyone; this only stops outsiders listing files.
create policy "Admin read avatars" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (select public.is_admin()));
create policy "Admin write avatars" on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (select public.is_admin()))
  with check (bucket_id = 'avatars' and (select public.is_admin()));

-- ============================================================================
-- 7. CHAT ASSISTANT RATE LIMITS (only the edge function, using the service role, can touch these)
-- ============================================================================
create table if not exists public.chat_rate_limits (
  bucket text primary key,          -- 'global' or a SHA-256 hash of the visitor's IP (never the raw IP)
  window_start timestamptz not null,
  hits int not null
);
alter table public.chat_rate_limits enable row level security; -- no policies: invisible to anon/authenticated
revoke all on public.chat_rate_limits from anon, authenticated;

create or replace function public.chat_rate_limit_hit(p_bucket text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits int;
begin
  insert into public.chat_rate_limits as r (bucket, window_start, hits)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;

  if random() < 0.01 then
    delete from public.chat_rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

-- ============================================================================
-- 8. Nobody calls internal functions through the API
-- ============================================================================
revoke execute on function public.guard_booking_insert() from public, anon, authenticated;
revoke execute on function public.guard_newsletter_insert() from public, anon, authenticated;
revoke execute on function public.notify_new_booking() from public, anon, authenticated;
revoke execute on function public.sync_contact_from_booking() from public, anon, authenticated;
revoke execute on function public.touch_project_updated_at() from public, anon, authenticated;
revoke execute on function public.chat_rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.chat_rate_limit_hit(text, int, int) to service_role;
