-- Public servers use only a publishable/anon key. All tag management stays service-only.
-- The two deliberately anonymous capabilities below accept a single random ID; neither
-- accepts a destination, returns private metadata, nor enumerates the tag table.
create schema if not exists nfc_private;
revoke all on schema nfc_private from public, anon, authenticated;
-- USAGE is required by the invoker wrappers. Do NOT expose nfc_private in the Data API.
grant usage on schema nfc_private to anon, service_role;

create function nfc_private.resolve_nfc(p_id text) returns table(destination_url text)
language sql stable security definer set search_path = '' as $$
  select t.destination_url from public.tags t
  where p_id ~ '^[A-Za-z0-9_-]{32}$' and t.id = p_id and t.active;
$$;
create function nfc_private.record_scan(p_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{32}$' then return; end if;
  update public.tags set scan_count = scan_count + 1, last_scanned_at = now()
    where id = p_id and active;
  if found then insert into public.scan_events(tag_id) values (p_id); end if;
end;
$$;
-- SECURITY DEFINER is intentionally limited to these fixed operations in an unexposed schema.
-- No auth.uid() requirement: physical stickers and their scans must work without sign-in.
revoke all on function nfc_private.resolve_nfc(text), nfc_private.record_scan(text) from public, anon, authenticated;
grant execute on function nfc_private.resolve_nfc(text), nfc_private.record_scan(text) to anon, service_role;

create or replace function public.resolve_nfc(p_id text) returns table(destination_url text)
language sql stable security invoker set search_path = '' as $$
  select * from nfc_private.resolve_nfc(p_id);
$$;
create or replace function public.record_scan(p_id text) returns void
language sql security invoker set search_path = '' as $$
  select nfc_private.record_scan(p_id);
$$;
revoke all on function public.resolve_nfc(text), public.record_scan(text) from public, anon, authenticated;
grant usage on schema public to anon;
grant execute on function public.resolve_nfc(text), public.record_scan(text) to anon, service_role;
-- Existing RLS policies and revoked table privileges remain in force. All other RPCs
-- (statistics, rate limits, session lookup, retention) remain service-only.
