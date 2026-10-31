-- All database access is server mediated. Browser/anonymous roles have no privileges.
grant usage on schema public to service_role;
create table public.reserved_tag_ids (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{32}$'),
  reserved_at timestamptz not null default now()
);
create table public.tags (
  id text primary key references public.reserved_tag_ids(id),
  name text not null check (length(name) between 1 and 100),
  destination_url text not null check (length(destination_url) <= 2048 and destination_url like 'https://%'),
  description text not null default '' check (length(description) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_scanned_at timestamptz,
  scan_count bigint not null default 0 check (scan_count >= 0)
);
create index tags_created_idx on public.tags (created_at desc);
create index tags_active_idx on public.tags (active);
create table public.scan_events (
  id bigint generated always as identity primary key,
  tag_id text not null references public.tags(id) on delete cascade,
  scanned_at timestamptz not null default now()
);
create index scan_events_tag_time_idx on public.scan_events(tag_id, scanned_at desc);
create index scan_events_time_idx on public.scan_events(scanned_at desc);
create table public.rate_limits (
  key text not null,
  window_start bigint not null,
  hits integer not null default 1,
  expires_at timestamptz not null,
  primary key (key, window_start)
);
create index rate_limits_expiry_idx on public.rate_limits(expires_at);

alter table public.tags enable row level security;
alter table public.scan_events enable row level security;
alter table public.reserved_tag_ids enable row level security;
alter table public.rate_limits enable row level security;
-- Explicit deny policies, in addition to revoked grants. service_role is server-only.
create policy tags_deny_clients on public.tags as restrictive for all to anon, authenticated using (false) with check (false);
create policy scans_deny_clients on public.scan_events as restrictive for all to anon, authenticated using (false) with check (false);
create policy reservations_deny_clients on public.reserved_tag_ids as restrictive for all to anon, authenticated using (false) with check (false);
create policy limits_deny_clients on public.rate_limits as restrictive for all to anon, authenticated using (false) with check (false);
revoke all on public.tags, public.scan_events, public.reserved_tag_ids, public.rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.tags to service_role;
grant select, insert, delete on public.scan_events to service_role;
grant select, insert on public.reserved_tag_ids to service_role;
grant select, insert, update, delete on public.rate_limits to service_role;
grant usage, select on sequence public.scan_events_id_seq to service_role;

create function public.reserve_tag_id() returns trigger language plpgsql set search_path = '' as $$
begin
  -- A reused retired ID raises unique_violation even after the tag was deleted.
  insert into public.reserved_tag_ids(id) values (new.id);
  return new;
end;
$$;
create trigger tags_reserve before insert on public.tags for each row execute function public.reserve_tag_id();
create function public.touch_tag() returns trigger language plpgsql set search_path = '' as $$
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
create trigger tags_touch before update on public.tags for each row execute function public.touch_tag();

-- A narrow lookup: no names, notes, counts, or other tags returned.
create function public.resolve_nfc(p_id text) returns table(destination_url text)
language sql stable set search_path = '' as $$
  select t.destination_url from public.tags t where t.id = p_id and t.active;
$$;
create function public.record_scan(p_id text) returns void
language plpgsql set search_path = '' as $$
begin
  update public.tags set scan_count = scan_count + 1, last_scanned_at = now() where id = p_id and active;
  if found then insert into public.scan_events(tag_id) values (p_id); end if;
end;
$$;
create function public.tag_stats() returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('total', count(*), 'active', count(*) filter (where active),
    'disabled', count(*) filter (where not active), 'scans', coalesce(sum(scan_count),0)) from public.tags;
$$;
create function public.consume_rate_limit(p_key text, p_limit integer, p_seconds integer)
returns boolean language plpgsql set search_path = '' as $$
declare n integer; w bigint;
begin
  if p_seconds < 1 or p_limit < 1 then return false; end if;
  w := floor(extract(epoch from clock_timestamp()) / p_seconds)::bigint * p_seconds;
  insert into public.rate_limits(key, window_start, hits, expires_at)
  values (p_key, w, 1, to_timestamp(w + p_seconds))
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into n;
  return n <= p_limit;
end;
$$;
create function public.prune_history() returns void language plpgsql set search_path = '' as $$
begin
  delete from public.scan_events where scanned_at < now() - interval '90 days';
  delete from public.rate_limits where expires_at < now() - interval '1 day';
end;
$$;
-- Only this narrow helper needs definer access to the protected auth schema.
-- It cannot be called by browser roles and returns only a boolean.
create function public.is_live_session(p_session uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.sessions where id = p_session and user_id = p_user
    and (not_after is null or not_after > now()));
$$;
revoke all on function public.reserve_tag_id(), public.touch_tag(), public.resolve_nfc(text), public.record_scan(text), public.tag_stats(), public.consume_rate_limit(text,integer,integer), public.prune_history(), public.is_live_session(uuid,uuid) from public, anon, authenticated;
grant execute on function public.reserve_tag_id(), public.touch_tag(), public.resolve_nfc(text), public.record_scan(text), public.tag_stats(), public.consume_rate_limit(text,integer,integer), public.prune_history(), public.is_live_session(uuid,uuid) to service_role;
