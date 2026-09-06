-- Run this once in Supabase: SQL Editor → New query → paste all → Run

create table public.site_content (
  key text primary key,
  value text not null
);

create table public.stack_items (
  id serial primary key,
  sort_order int not null default 0,
  label text not null
);

create table public.projects (
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

-- Public can read; nothing else is allowed without your service key
alter table public.site_content enable row level security;
alter table public.stack_items enable row level security;
alter table public.projects enable row level security;

create policy "Public read access" on public.site_content for select using (true);
create policy "Public read access" on public.stack_items for select using (true);
create policy "Public read access" on public.projects for select using (true);

-- Seed: site text
insert into public.site_content (key, value) values
  ('brand_name', 'Your Name'),
  ('hero_title', 'I build the systems behind the front desk.'),
  ('hero_sub', 'AI agents and automations that answer questions, sort leads by urgency, and hand real work to the right calendar, contact record, or teammate — built with GoHighLevel, n8n, and Supabase.'),
  ('cta_primary_label', 'See the projects'),
  ('cta_secondary_label', 'Get in touch'),
  ('contact_heading', 'Have something that needs wiring together?'),
  ('contact_email', 'you@example.com'),
  ('contact_linkedin_url', 'https://www.linkedin.com'),
  ('footer_name', 'Your Name'),
  ('footer_location', 'Davao, Philippines');

-- Seed: tools/stack list
insert into public.stack_items (sort_order, label) values
  (1, 'GoHighLevel'),
  (2, 'n8n'),
  (3, 'Supabase'),
  (4, 'Lovable'),
  (5, 'Groq'),
  (6, 'Claude API'),
  (7, 'Gemini'),
  (8, 'Vercel');

-- Seed: projects
insert into public.projects (sort_order, title, who, status, description, layout, nodes, features, tags, link_url) values
(
  1,
  'Sam — AI Front Desk',
  'Bright Smile Dental, Tampa FL',
  'live',
  'An AI receptionist that talks to patients like a real front-desk employee — answering questions, checking the actual calendar before promising a slot, and collecting contact info so staff can call back on same-day requests.',
  'pipeline',
  '["chat widget", "groq ai agent", "n8n intent detection", "GHL calendar + contacts"]',
  null,
  array['Lovable','Supabase','n8n','Groq','GoHighLevel'],
  'https://brightsmiletampa.lovable.app'
),
(
  2,
  'Lead Triage System',
  'Medisense Laboratory Center, Davao',
  'in progress',
  'A lead-capture funnel for a medical diagnostics clinic handling pre-employment and OFW exams. An AI agent reads every new inquiry, classifies how urgent it is, and alerts staff directly when someone needs a same-day response.',
  'pipeline',
  '["3-page funnel", "webhook", "urgency classifier", "GHL pipeline", "slack alert"]',
  null,
  array['GoHighLevel','n8n','Claude API','Slack'],
  'https://medisense-davao-portfolio.vercel.app'
),
(
  3,
  'Short-Form Video Pipeline',
  'Personal automation project',
  'in progress',
  'A scheduled pipeline that writes a script, generates matching images and video, adds a voiceover, and assembles the final clip — running on its own, every day, without anyone touching it.',
  'pipeline',
  '["schedule trigger", "script gen", "image gen", "video gen", "voiceover", "assembly"]',
  null,
  array['n8n','Gemini','Veo','ElevenLabs'],
  null
),
(
  4,
  'Karaoke Night',
  'Family queue app',
  'in progress',
  'A queue-based karaoke app for family game nights. Search a song by number while another one is playing, stack up to ten, and it never interrupts what''s currently on.',
  'features',
  null,
  '[{"label":"search","desc":"Find a song by number, even mid-playback."},{"label":"queue","desc":"Stack up to ten songs without cutting off the current one."},{"label":"auto-advance","desc":"A five-second up-next gap between songs, with a skip option."}]',
  array['Lovable','Supabase','Vercel'],
  null
);
