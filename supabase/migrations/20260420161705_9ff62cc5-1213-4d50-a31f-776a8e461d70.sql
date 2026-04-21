
-- Extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Helper: get github username from auth JWT (raw_user_meta_data.user_name)
create or replace function public.current_github_username()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'user_name'),
    (auth.jwt() -> 'user_metadata' ->> 'preferred_username'),
    (select raw_user_meta_data ->> 'user_name' from auth.users where id = auth.uid()),
    (select raw_user_meta_data ->> 'preferred_username' from auth.users where id = auth.uid())
  );
$$;

-- =========================
-- api_keys
-- =========================
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  owner_github text not null,
  key_name text not null,
  api_key text not null,
  provider text not null default 'OpenRouter',
  category text not null default 'AI',
  status text not null default 'unknown',
  credits_remaining numeric,
  credits_limit numeric,
  is_free_tier boolean default false,
  last_checked timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_api_keys_owner on public.api_keys(owner_github);
create index if not exists idx_api_keys_owner_provider on public.api_keys(owner_github, provider, status);
create unique index if not exists uniq_api_keys_owner_value on public.api_keys(owner_github, api_key);

alter table public.api_keys enable row level security;
create policy "select own api_keys" on public.api_keys for select
  using (owner_github = public.current_github_username());
create policy "insert own api_keys" on public.api_keys for insert
  with check (owner_github = public.current_github_username());
create policy "update own api_keys" on public.api_keys for update
  using (owner_github = public.current_github_username())
  with check (owner_github = public.current_github_username());
create policy "delete own api_keys" on public.api_keys for delete
  using (owner_github = public.current_github_username());

-- realtime
alter publication supabase_realtime add table public.api_keys;
alter table public.api_keys replica identity full;

-- =========================
-- key_events
-- =========================
create table if not exists public.key_events (
  id uuid primary key default gen_random_uuid(),
  key_id uuid not null references public.api_keys(id) on delete cascade,
  owner_github text not null,
  event_type text not null,
  message text,
  created_at timestamptz not null default now()
);

-- Ensure owner_github column exists if table was created without it
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'key_events' and column_name = 'owner_github'
  ) then
    alter table public.key_events add column owner_github text not null default '';
  end if;
end;
$$;

create index if not exists idx_key_events_owner_created on public.key_events(owner_github, created_at desc);
create index if not exists idx_key_events_key on public.key_events(key_id, created_at desc);

alter table public.key_events enable row level security;
create policy "select own key_events" on public.key_events for select
  using (owner_github = public.current_github_username());
create policy "insert own key_events" on public.key_events for insert
  with check (owner_github = public.current_github_username());

alter publication supabase_realtime add table public.key_events;
alter table public.key_events replica identity full;

-- =========================
-- repo_key_links
-- =========================
create table if not exists public.repo_key_links (
  id uuid primary key default gen_random_uuid(),
  owner_github text not null,
  repo_name text not null,
  key_id uuid references public.api_keys(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_github, repo_name)
);
alter table public.repo_key_links enable row level security;
create policy "select own repo_key_links" on public.repo_key_links for select
  using (owner_github = public.current_github_username());
create policy "insert own repo_key_links" on public.repo_key_links for insert
  with check (owner_github = public.current_github_username());
create policy "update own repo_key_links" on public.repo_key_links for update
  using (owner_github = public.current_github_username());
create policy "delete own repo_key_links" on public.repo_key_links for delete
  using (owner_github = public.current_github_username());

-- =========================
-- user_tokens
-- =========================
create table if not exists public.user_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_github text not null unique,
  access_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  health_check_minutes int not null default 30,
  webhook_urls jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.user_tokens enable row level security;
create policy "select own user_tokens" on public.user_tokens for select
  using (owner_github = public.current_github_username());
create policy "insert own user_tokens" on public.user_tokens for insert
  with check (owner_github = public.current_github_username());
create policy "update own user_tokens" on public.user_tokens for update
  using (owner_github = public.current_github_username())
  with check (owner_github = public.current_github_username());

-- =========================
-- notifications
-- =========================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_github text not null,
  key_id uuid references public.api_keys(id) on delete cascade,
  event_id uuid references public.key_events(id) on delete cascade,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_owner_created on public.notifications(owner_github, created_at desc);
alter table public.notifications enable row level security;
create policy "select own notifications" on public.notifications for select
  using (owner_github = public.current_github_username());
create policy "update own notifications" on public.notifications for update
  using (owner_github = public.current_github_username())
  with check (owner_github = public.current_github_username());
create policy "insert own notifications" on public.notifications for insert
  with check (owner_github = public.current_github_username());

alter publication supabase_realtime add table public.notifications;
alter table public.notifications replica identity full;

-- =========================
-- Auto-create user_tokens row on signup
-- =========================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gh_username text;
begin
  gh_username := coalesce(
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'preferred_username'
  );
  if gh_username is not null then
    insert into public.user_tokens (owner_github)
    values (gh_username)
    on conflict (owner_github) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================
-- Schedule health check every 30 minutes
-- =========================
do $$
begin
  perform cron.schedule(
    'check-key-health-every-30min',
    '*/30 * * * *',
    $cron$
    select net.http_post(
      url := 'https://hoojdsricmaqlssfsmjy.supabase.co/functions/v1/check-key-health',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhvb2pkc3JpY21hcWxzc2ZzbWp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTQ2NDgsImV4cCI6MjA5MjI3MDY0OH0.swGRfOxmZiJxlLI9Ip_sDLAVZ37qkZS-_RmiaKRz80c'
      ),
      body := jsonb_build_object('source', 'cron')
    ) as request_id;
    $cron$
  );
exception when unique_violation then
  null; -- job already scheduled
end;
$$;
