-- NFC objects only: safe to apply to the existing shared Coaches and Consultants project.
-- All database access is server mediated. Browser/anonymous roles have no privileges.
grant usage on schema public to service_role;
create table public.nfc_reserved_ids (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{32}$'),
  reserved_at timestamptz not null default now()
);
create table public.nfc (
  id text primary key references public.nfc_reserved_ids(id),
  name text not null check (length(name) between 1 and 100),
  destination_url text not null check (length(destination_url) <= 2048 and destination_url like 'https://%'),
  description text not null default '' check (length(description) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_scanned_at timestamptz,
  scan_count bigint not null default 0 check (scan_count >= 0)
);
create index nfc_created_idx on public.nfc (created_at desc);
create index nfc_active_idx on public.nfc (active);
create table public.nfc_scan_events (
  id bigint generated always as identity primary key,
  tag_id text not null references public.nfc(id) on delete cascade,
  scanned_at timestamptz not null default now()
);
create index nfc_scan_events_tag_time_idx on public.nfc_scan_events(tag_id, scanned_at desc);
create index nfc_scan_events_time_idx on public.nfc_scan_events(scanned_at desc);
create table public.nfc_rate_limits (
  key text not null,
  window_start bigint not null,
  hits integer not null default 1,
  expires_at timestamptz not null,
  primary key (key, window_start)
);
create index nfc_rate_limits_expiry_idx on public.nfc_rate_limits(expires_at);

alter table public.nfc enable row level security;
alter table public.nfc_scan_events enable row level security;
alter table public.nfc_reserved_ids enable row level security;
alter table public.nfc_rate_limits enable row level security;
-- Explicit deny policies, in addition to revoked grants. service_role is server-only.
create policy nfc_deny_clients on public.nfc as restrictive for all to anon, authenticated using (false) with check (false);
create policy nfc_scans_deny_clients on public.nfc_scan_events as restrictive for all to anon, authenticated using (false) with check (false);
create policy nfc_reservations_deny_clients on public.nfc_reserved_ids as restrictive for all to anon, authenticated using (false) with check (false);
create policy nfc_limits_deny_clients on public.nfc_rate_limits as restrictive for all to anon, authenticated using (false) with check (false);
revoke all on public.nfc, public.nfc_scan_events, public.nfc_reserved_ids, public.nfc_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.nfc to service_role;
grant select, insert, delete on public.nfc_scan_events to service_role;
grant select, insert on public.nfc_reserved_ids to service_role;
grant select, insert, update, delete on public.nfc_rate_limits to service_role;
grant usage, select on sequence public.nfc_scan_events_id_seq to service_role;

create function public.nfc_reserve_id() returns trigger language plpgsql set search_path = '' as $$
begin
  -- A reused retired ID raises unique_violation even after the tag was deleted.
  insert into public.nfc_reserved_ids(id) values (new.id);
  return new;
end;
$$;
create trigger nfc_reserve before insert on public.nfc for each row execute function public.nfc_reserve_id();
create function public.nfc_touch_tag() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.created_at <> old.created_at then
    raise exception 'Tag identity is immutable';
  end if;
  -- Scan counters do not change the last-modified date of the tag configuration.
  if (new.name, new.destination_url, new.description, new.active) is distinct from (old.name, old.destination_url, old.description, old.active) then
    new.updated_at = now();
  else
    new.updated_at = old.updated_at;
  end if;
  return new;
end;
$$;
create trigger nfc_touch before update on public.nfc for each row execute function public.nfc_touch_tag();

-- A narrow lookup: no names, notes, counts, or other nfc returned.
create function public.nfc_resolve(p_id text) returns table(destination_url text)
language sql stable set search_path = '' as $$
  select t.destination_url from public.nfc t where t.id = p_id and t.active;
$$;
create function public.nfc_record_scan(p_id text) returns void
language plpgsql set search_path = '' as $$
begin
  update public.nfc set scan_count = scan_count + 1, last_scanned_at = now() where id = p_id and active;
  if found then insert into public.nfc_scan_events(tag_id) values (p_id); end if;
end;
$$;
create function public.nfc_stats() returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('total', count(*), 'active', count(*) filter (where active),
    'disabled', count(*) filter (where not active), 'scans', coalesce(sum(scan_count),0)) from public.nfc;
$$;
create function public.nfc_consume_rate_limit(p_key text, p_limit integer, p_seconds integer)
returns boolean language plpgsql set search_path = '' as $$
declare n integer; w bigint;
begin
  if p_seconds < 1 or p_limit < 1 then return false; end if;
  w := floor(extract(epoch from clock_timestamp()) / p_seconds)::bigint * p_seconds;
  insert into public.nfc_rate_limits(key, window_start, hits, expires_at)
  values (p_key, w, 1, to_timestamp(w + p_seconds))
  on conflict (key, window_start) do update set hits = public.nfc_rate_limits.hits + 1
  returning hits into n;
  return n <= p_limit;
end;
$$;
create function public.nfc_prune_history() returns void language plpgsql set search_path = '' as $$
begin
  delete from public.nfc_scan_events where scanned_at < now() - interval '90 days';
  delete from public.nfc_rate_limits where expires_at < now() - interval '1 day';
end;
$$;
-- Only this narrow helper needs definer access to the protected auth schema.
-- It cannot be called by browser roles and returns only a boolean.
create function public.nfc_is_live_session(p_session uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.sessions where id = p_session and user_id = p_user
    and (not_after is null or not_after > now()));
$$;
revoke all on function public.nfc_reserve_id(), public.nfc_touch_tag(), public.nfc_resolve(text), public.nfc_record_scan(text), public.nfc_stats(), public.nfc_consume_rate_limit(text,integer,integer), public.nfc_prune_history(), public.nfc_is_live_session(uuid,uuid) from public, anon, authenticated;
grant execute on function public.nfc_reserve_id(), public.nfc_touch_tag(), public.nfc_resolve(text), public.nfc_record_scan(text), public.nfc_stats(), public.nfc_consume_rate_limit(text,integer,integer), public.nfc_prune_history(), public.nfc_is_live_session(uuid,uuid) to service_role;

-- Public servers use only a publishable/anon key. All tag management stays service-only.
-- The two deliberately anonymous capabilities below accept a single random ID; neither
-- accepts a destination, returns private metadata, nor enumerates the tag table.
create schema if not exists nfc_private;
revoke all on schema nfc_private from public, anon, authenticated;
-- USAGE is required by the invoker wrappers. Do NOT expose nfc_private in the Data API.
grant usage on schema nfc_private to anon, service_role;

create function nfc_private.nfc_resolve(p_id text) returns table(destination_url text)
language sql stable security definer set search_path = '' as $$
  select t.destination_url from public.nfc t
  where p_id ~ '^[A-Za-z0-9_-]{32}$' and t.id = p_id and t.active;
$$;
create function nfc_private.nfc_record_scan(p_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{32}$' then return; end if;
  update public.nfc set scan_count = scan_count + 1, last_scanned_at = now()
    where id = p_id and active;
  if found then insert into public.nfc_scan_events(tag_id) values (p_id); end if;
end;
$$;
-- SECURITY DEFINER is intentionally limited to these fixed operations in an unexposed schema.
-- No auth.uid() requirement: physical stickers and their scans must work without sign-in.
revoke all on function nfc_private.nfc_resolve(text), nfc_private.nfc_record_scan(text) from public, anon, authenticated;
grant execute on function nfc_private.nfc_resolve(text), nfc_private.nfc_record_scan(text) to anon, service_role;

create or replace function public.nfc_resolve(p_id text) returns table(destination_url text)
language sql stable security invoker set search_path = '' as $$
  select * from nfc_private.nfc_resolve(p_id);
$$;
create or replace function public.nfc_record_scan(p_id text) returns void
language sql security invoker set search_path = '' as $$
  select nfc_private.nfc_record_scan(p_id);
$$;
revoke all on function public.nfc_resolve(text), public.nfc_record_scan(text) from public, anon, authenticated;
grant usage on schema public to anon;
grant execute on function public.nfc_resolve(text), public.nfc_record_scan(text) to anon, service_role;
-- Existing RLS policies and revoked table privileges remain in force. All other RPCs
-- (statistics, rate limits, session lookup, retention) remain service-only.
