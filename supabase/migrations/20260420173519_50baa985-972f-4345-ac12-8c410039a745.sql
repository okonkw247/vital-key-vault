-- 1. Enable pgsodium for encryption
create extension if not exists pgsodium;

-- 2. Add encrypted column + nonce to api_keys
alter table public.api_keys
  add column if not exists api_key_encrypted bytea,
  add column if not exists api_key_nonce bytea;

-- 3. Function to get the encryption key from pgsodium key store (creates one if missing)
create or replace function public.vault_get_key()
returns bytea
language plpgsql
security definer
set search_path = pgsodium, public
as $$
declare
  k_id uuid;
  k_raw bytea;
begin
  select id into k_id from pgsodium.valid_key where name = 'adams_vault_master' limit 1;
  if k_id is null then
    select pgsodium.create_key(name => 'adams_vault_master') into k_id;
  end if;
  select decrypted_raw_key into k_raw from pgsodium.decrypted_key where id = k_id;
  return k_raw;
end;
$$;

revoke all on function public.vault_get_key() from public, anon, authenticated;

-- 4. Encrypt/decrypt helpers
create or replace function public.encrypt_api_key(plain text)
returns table(ciphertext bytea, nonce bytea)
language plpgsql
security definer
set search_path = pgsodium, public
as $$
declare
  k bytea := public.vault_get_key();
  n bytea := pgsodium.crypto_secretbox_noncegen();
begin
  ciphertext := pgsodium.crypto_secretbox(convert_to(plain, 'utf8'), n, k);
  nonce := n;
  return next;
end;
$$;

create or replace function public.decrypt_api_key(ct bytea, n bytea)
returns text
language plpgsql
security definer
set search_path = pgsodium, public
as $$
declare
  k bytea := public.vault_get_key();
begin
  return convert_from(pgsodium.crypto_secretbox_open(ct, n, k), 'utf8');
end;
$$;

revoke all on function public.encrypt_api_key(text) from public, anon, authenticated;
revoke all on function public.decrypt_api_key(bytea, bytea) from public, anon, authenticated;

-- 5. Trigger: auto-encrypt api_key on insert/update, then null the plaintext column
create or replace function public.tg_encrypt_api_key()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  enc record;
begin
  if new.api_key is not null and new.api_key <> '' then
    select * into enc from public.encrypt_api_key(new.api_key);
    new.api_key_encrypted := enc.ciphertext;
    new.api_key_nonce := enc.nonce;
    new.api_key := '__encrypted__';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_encrypt_api_key on public.api_keys;
create trigger trg_encrypt_api_key
before insert or update of api_key on public.api_keys
for each row execute function public.tg_encrypt_api_key();

-- 6. Backfill existing rows
do $$
declare r record; enc record;
begin
  for r in select id, api_key from public.api_keys where api_key_encrypted is null and api_key is not null and api_key <> '__encrypted__' loop
    select * into enc from public.encrypt_api_key(r.api_key);
    update public.api_keys set api_key_encrypted = enc.ciphertext, api_key_nonce = enc.nonce, api_key = '__encrypted__' where id = r.id;
  end loop;
end $$;

-- 7. Daily credit snapshots table for burn-rate analytics
create table if not exists public.key_credit_snapshots (
  id uuid primary key default gen_random_uuid(),
  key_id uuid not null references public.api_keys(id) on delete cascade,
  owner_github text not null,
  provider text not null,
  snapshot_date date not null default current_date,
  credits_remaining numeric,
  credits_limit numeric,
  created_at timestamptz not null default now(),
  unique (key_id, snapshot_date)
);

create index if not exists idx_snapshots_owner_date on public.key_credit_snapshots(owner_github, snapshot_date);

alter table public.key_credit_snapshots enable row level security;

create policy "select own snapshots" on public.key_credit_snapshots
  for select using (owner_github = current_github_username());
create policy "insert own snapshots" on public.key_credit_snapshots
  for insert with check (owner_github = current_github_username());

-- 8. Tracking last cron-driven check on user_tokens (per-user scheduling)
alter table public.user_tokens
  add column if not exists last_cron_check timestamptz;