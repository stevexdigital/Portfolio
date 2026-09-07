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
  label text not null
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
