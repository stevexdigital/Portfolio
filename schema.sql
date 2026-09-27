-- Run this once in Supabase: SQL Editor → New query → paste all → Run
-- Before running: create your own login under Authentication → Users → Add user.
-- That login is the only one that will be able to write/edit content.

create table if not exists public.site_content (
  key text primary key,
  value text not null
);

create table if not exists public.hero_badges (
  id serial primary key,
  sort_order int not null default 0,
  label text not null
);

create table if not exists public.solutions (
  id serial primary key,
  sort_order int not null default 0,
  title text not null,
  description text not null
);

create table if not exists public.about_stats (
  id serial primary key,
  sort_order int not null default 0,
  label text not null,
  value text not null
);

create table if not exists public.stack_items (
  id serial primary key,
  sort_order int not null default 0,
  label text not null,
  logo_url text
);

create table if not exists public.projects (
  id serial primary key,
  sort_order int not null default 0,
  title text not null,
  who text,
  status text not null default 'in progress', -- 'live' or 'in progress'
  description text not null,
  layout text not null default 'pipeline',     -- 'pipeline' or 'features'
  nodes jsonb,     -- for layout='pipeline': ["chat widget", "ai agent", "crm"]
  features jsonb,  -- for layout='features': [{"label":"search","desc":"..."}]
  tags text[] not null default '{}',
  link_url text
);

create table if not exists public.bookings (
  id serial primary key,
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  preferred_date date,
  preferred_time text,
  message text
);

create table if not exists public.contacts (
  id serial primary key,
  name text not null,
  email text not null unique,
  phone text,
  status text not null default 'new', -- 'new', 'contacted', 'qualified', 'booked', 'closed'
  notes text,
  source text default 'booking',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.availability_hours (
  day_of_week int primary key check (day_of_week between 0 and 6), -- 0=Sunday ... 6=Saturday
  enabled boolean not null default false,
  start_time text not null default '09:00',
  end_time text not null default '17:00'
);

-- ---------- Contacts CRM: sensitive, no public access at all ----------
alter table public.contacts enable row level security;

drop policy if exists "Authenticated full access" on public.contacts;
create policy "Authenticated full access" on public.contacts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Auto-create/update a contact whenever a booking comes in, from any source
create or replace function public.sync_contact_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.contacts (name, email, source)
  values (new.name, new.email, 'booking')
  on conflict (email) do update
    set name = excluded.name,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_contact_from_booking on public.bookings;
create trigger trg_sync_contact_from_booking
after insert on public.bookings
for each row execute function public.sync_contact_from_booking();

-- ---------- Security: public can read everything, only logged-in you can write ----------
alter table public.site_content enable row level security;
alter table public.hero_badges enable row level security;
alter table public.solutions enable row level security;
alter table public.about_stats enable row level security;
alter table public.stack_items enable row level security;
alter table public.projects enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array['site_content','hero_badges','solutions','about_stats','stack_items','projects'])
  loop
    execute format('drop policy if exists "Public read access" on public.%I', t);
    execute format('create policy "Public read access" on public.%I for select using (true)', t);
    execute format('drop policy if exists "Authenticated write" on public.%I', t);
    execute format('create policy "Authenticated write" on public.%I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')', t);
  end loop;
end $$;

-- ---------- Bookings: anyone can submit, only you can read/delete ----------
alter table public.bookings enable row level security;

drop policy if exists "Public can submit bookings" on public.bookings;
create policy "Public can submit bookings" on public.bookings
  for insert with check (true);

drop policy if exists "Only owner can read bookings" on public.bookings;
create policy "Only owner can read bookings" on public.bookings
  for select using (auth.role() = 'authenticated');

drop policy if exists "Only owner can delete bookings" on public.bookings;
create policy "Only owner can delete bookings" on public.bookings
  for delete using (auth.role() = 'authenticated');

-- ---------- Availability hours: public read, only you can edit ----------
alter table public.availability_hours enable row level security;

drop policy if exists "Public read access" on public.availability_hours;
create policy "Public read access" on public.availability_hours for select using (true);

drop policy if exists "Authenticated write" on public.availability_hours;
create policy "Authenticated write" on public.availability_hours for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into public.availability_hours (day_of_week, enabled, start_time, end_time) values
  (0, false, '09:00', '17:00'),
  (1, true,  '09:00', '17:00'),
  (2, true,  '09:00', '17:00'),
  (3, true,  '09:00', '17:00'),
  (4, true,  '09:00', '17:00'),
  (5, true,  '09:00', '17:00'),
  (6, false, '09:00', '17:00')
on conflict (day_of_week) do nothing;

-- ---------- Storage: a public bucket for your hero photo, only you can upload ----------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "Authenticated write avatars" on storage.objects;
create policy "Authenticated write avatars" on storage.objects
  for all using (bucket_id = 'avatars' and auth.role() = 'authenticated')
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- ---------- Seed content (edit any of this later via the admin panel instead) ----------
insert into public.site_content (key, value) values
  ('brand_name', 'Your Name'),
  ('hero_name', 'Your Name'),
  ('hero_role', 'Automation Builder'),
  ('hero_location', 'Based in Davao, Philippines'),
  ('hero_sub', 'I build AI agents and automations that answer questions, sort leads, and keep the pipeline moving.'),
  ('hero_photo_url', ''),
  ('favicon_url', ''),
  ('header_logo_url', ''),
  ('booking_calendar_url', ''),
  ('whatsapp_number', ''),
  ('n8n_availability_webhook_url', ''),
  ('n8n_booking_webhook_url', ''),
  ('chat_endpoint_url', 'https://vqthioychxlqknfwboqk.supabase.co/functions/v1/portfolio-chat'),
  ('notification_webhook_url', ''),
  ('about_heading', 'Who''s behind this?'),
  ('about_bio', 'I''m a self-taught automation builder learning by shipping — wiring together AI agents, CRMs, and workflow tools into systems that actually run without me.'),
  ('cta_primary_label', 'See my work'),
  ('cta_secondary_label', 'Get in touch'),
  ('contact_heading', 'Have something that needs wiring together?'),
  ('contact_email', 'you@example.com'),
  ('contact_linkedin_url', 'https://www.linkedin.com'),
  ('footer_name', 'Your Name'),
  ('footer_location', 'Davao, Philippines')
on conflict (key) do nothing;

insert into public.hero_badges (sort_order, label) values
  (1, 'n8n Builder'),
  (2, 'GHL Specialist'),
  (3, 'Problem Solver')
on conflict do nothing;

insert into public.solutions (sort_order, title, description) values
  (1, 'AI Chat Agents', 'Conversational front-desk agents that answer questions and check real calendars before booking.'),
  (2, 'Lead Triage Systems', 'Automations that read new leads, classify urgency, and alert the right person.'),
  (3, 'Automation Pipelines', 'Scheduled workflows that generate, assemble, and publish content with no manual steps.'),
  (4, 'CRM Integrations', 'Wiring GoHighLevel calendars, contacts, and pipelines into whatever front-end a client uses.')
on conflict do nothing;

insert into public.about_stats (sort_order, label, value) values
  (1, 'Systems built', '4'),
  (2, 'Tools learned', '8'),
  (3, 'Building since', '2026')
on conflict do nothing;

insert into public.stack_items (sort_order, label) values
  (1, 'GoHighLevel'), (2, 'n8n'), (3, 'Supabase'), (4, 'Lovable'),
  (5, 'Groq'), (6, 'Claude API'), (7, 'Gemini'), (8, 'Vercel')
on conflict do nothing;

insert into public.projects (sort_order, title, who, status, description, layout, nodes, features, tags, link_url) values
(
  1, 'Sam — AI Front Desk', 'Bright Smile Dental, Tampa FL', 'live',
  'An AI receptionist that talks to patients like a real front-desk employee — answering questions, checking the actual calendar before promising a slot, and collecting contact info so staff can call back on same-day requests.',
  'pipeline',
  '["chat widget", "groq ai agent", "n8n intent detection", "GHL calendar + contacts"]',
  null,
  array['Lovable','Supabase','n8n','Groq','GoHighLevel'],
  'https://brightsmiletampa.lovable.app'
),
(
  2, 'Lead Triage System', 'Medisense Laboratory Center, Davao', 'in progress',
  'A lead-capture funnel for a medical diagnostics clinic handling pre-employment and OFW exams. An AI agent reads every new inquiry, classifies how urgent it is, and alerts staff directly when someone needs a same-day response.',
  'pipeline',
  '["3-page funnel", "webhook", "urgency classifier", "GHL pipeline", "slack alert"]',
  null,
  array['GoHighLevel','n8n','Claude API','Slack'],
  'https://medisense-davao-portfolio.vercel.app'
),
(
  3, 'Short-Form Video Pipeline', 'Personal automation project', 'in progress',
  'A scheduled pipeline that writes a script, generates matching images and video, adds a voiceover, and assembles the final clip — running on its own, every day, without anyone touching it.',
  'pipeline',
  '["schedule trigger", "script gen", "image gen", "video gen", "voiceover", "assembly"]',
  null,
  array['n8n','Gemini','Veo','ElevenLabs'],
  null
),
(
  4, 'Karaoke Night', 'Family queue app', 'in progress',
  'A queue-based karaoke app for family game nights. Search a song by number while another one is playing, stack up to ten, and it never interrupts what''s currently on.',
  'features',
  null,
  '[{"label":"search","desc":"Find a song by number, even mid-playback."},{"label":"queue","desc":"Stack up to ten songs without cutting off the current one."},{"label":"auto-advance","desc":"A five-second up-next gap between songs, with a skip option."}]',
  array['Lovable','Supabase','Vercel'],
  null
)
on conflict do nothing;

-- ==========================================================================
-- Added 2026-09-27 (also in migrations/2026-09-27_faqs_newsletter_last_updated.sql for existing installs)
-- ==========================================================================

-- ---------- Projects: track when each one was last edited ----------
alter table public.projects add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_project_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only bump the date when real content changed, so "Save all" and reordering
  -- don't mark every project as freshly updated.
  if (to_jsonb(new) - 'updated_at' - 'sort_order') is distinct from (to_jsonb(old) - 'updated_at' - 'sort_order') then
    new.updated_at = now();
  else
    new.updated_at = old.updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_touch_project_updated_at on public.projects;
create trigger trg_touch_project_updated_at
before update on public.projects
for each row execute function public.touch_project_updated_at();

-- ---------- FAQs: public read, only you can edit ----------
create table if not exists public.faqs (
  id serial primary key,
  sort_order int not null default 0,
  question text not null,
  answer text not null
);

alter table public.faqs enable row level security;

drop policy if exists "Public read access" on public.faqs;
create policy "Public read access" on public.faqs for select using (true);

drop policy if exists "Authenticated write" on public.faqs;
create policy "Authenticated write" on public.faqs for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Starter questions — only inserted if the table is empty. Edit them in the admin panel.
insert into public.faqs (sort_order, question, answer)
select * from (values
  (1, 'What kind of work do you take on?',
      'AI chat agents, lead triage, automation pipelines, and CRM integrations — mostly built with n8n, GoHighLevel, and Supabase. If a task is repetitive and involves moving information between tools, it''s probably a good fit.'),
  (2, 'How does a project usually start?',
      'With a short call. You walk me through how the process works today, I map out where automation would save the most time, and we agree on a first version before anything gets built.'),
  (3, 'Can you work with the tools I already use?',
      'Usually, yes. Most builds connect to what you already have — your CRM, calendar, forms, and inbox — instead of replacing them.'),
  (4, 'What happens once it''s live?',
      'You get a walkthrough of how it works and what each piece does, so nothing is a black box. If your process changes later, the automation can change with it.')
) as seed(sort_order, question, answer)
where not exists (select 1 from public.faqs);

-- ---------- Newsletter: anyone can sign up, only you can see/remove sign-ups ----------
create table if not exists public.newsletter_subscribers (
  id serial primary key,
  email text not null unique
    check (email = lower(email) and position('@' in email) > 1 and length(email) <= 320),
  source text not null default 'site',
  created_at timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "Public can subscribe" on public.newsletter_subscribers;
create policy "Public can subscribe" on public.newsletter_subscribers
  for insert with check (source = 'site');

drop policy if exists "Only owner can read subscribers" on public.newsletter_subscribers;
create policy "Only owner can read subscribers" on public.newsletter_subscribers
  for select using (auth.role() = 'authenticated');

drop policy if exists "Only owner can delete subscribers" on public.newsletter_subscribers;
create policy "Only owner can delete subscribers" on public.newsletter_subscribers
  for delete using (auth.role() = 'authenticated');
