
-- 1. Per-user key rotation: re-encrypts all of caller's keys with fresh nonces
create or replace function public.rotate_my_keys()
returns integer
language plpgsql
security definer
set search_path = public, pgsodium
as $$
declare
  me text := public.current_github_username();
  r record;
  enc record;
  plain text;
  n integer := 0;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  for r in
    select id, api_key_encrypted, api_key_nonce
    from public.api_keys
    where owner_github = me
      and api_key_encrypted is not null
      and api_key_nonce is not null
  loop
    plain := public.decrypt_api_key(r.api_key_encrypted, r.api_key_nonce);
    select * into enc from public.encrypt_api_key(plain);
    update public.api_keys
      set api_key_encrypted = enc.ciphertext,
          api_key_nonce = enc.nonce
      where id = r.id;
    n := n + 1;
  end loop;

  insert into public.key_events (key_id, owner_github, event_type, message)
  select id, owner_github, 'rotated', 'Re-encrypted with fresh nonce'
  from public.api_keys
  where owner_github = me
  limit 1;

  return n;
end;
$$;

revoke all on function public.rotate_my_keys() from public;
grant execute on function public.rotate_my_keys() to authenticated;

-- 2. Daily digest generator (runs as service role via cron)
create or replace function public.generate_daily_digests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  u record;
  total_burn numeric;
  exhausted_count integer;
  top_key text;
  top_consumed numeric;
  body_text text;
  n integer := 0;
begin
  for u in select distinct owner_github from public.api_keys loop
    -- 7-day total burn
    with deltas as (
      select s1.key_id,
             greatest(0, coalesce(s1.credits_remaining,0) - coalesce(s2.credits_remaining,0)) as d
      from public.key_credit_snapshots s1
      join public.key_credit_snapshots s2
        on s1.key_id = s2.key_id
       and s2.snapshot_date = s1.snapshot_date - 1
      where s1.owner_github = u.owner_github
        and s1.snapshot_date >= current_date - 7
    )
    select coalesce(sum(d),0) into total_burn from deltas;

    select count(*) into exhausted_count
    from public.api_keys
    where owner_github = u.owner_github and status = 'exhausted';

    -- top consumer (last 7d)
    with deltas as (
      select s1.key_id,
             sum(greatest(0, coalesce(s1.credits_remaining,0) - coalesce(s2.credits_remaining,0))) as d
      from public.key_credit_snapshots s1
      join public.key_credit_snapshots s2
        on s1.key_id = s2.key_id
       and s2.snapshot_date = s1.snapshot_date - 1
      where s1.owner_github = u.owner_github
        and s1.snapshot_date >= current_date - 7
      group by s1.key_id
      order by d desc
      limit 1
    )
    select k.key_name, d.d into top_key, top_consumed
    from deltas d join public.api_keys k on k.id = d.key_id;

    body_text := format(
      'Last 7 days: burned %s credits across all keys. %s exhausted. Top consumer: %s (%s credits).',
      round(total_burn::numeric, 4),
      exhausted_count,
      coalesce(top_key, '—'),
      coalesce(round(top_consumed::numeric, 4)::text, '0')
    );

    insert into public.notifications (owner_github, title, body)
    values (u.owner_github, 'Daily digest', body_text);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- 3. Schedule daily at 08:00 UTC
do $$
declare jid integer;
begin
  select jobid into jid from cron.job where jobname = 'daily-digest';
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
end $$;

select cron.schedule(
  'daily-digest',
  '0 8 * * *',
  $$ select public.generate_daily_digests(); $$
);
