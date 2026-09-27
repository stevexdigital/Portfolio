-- Site upgrade: FAQs, newsletter sign-ups, and "last updated" dates on projects.
-- Run once in Supabase: SQL Editor → New query → paste all → Run. Safe to re-run.
-- (Fresh installs don't need this — schema.sql already includes it.)

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
