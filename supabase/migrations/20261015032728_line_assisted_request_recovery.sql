-- Supplemental capability links for verified, administrator-assisted LINE replies.
-- Original customer capabilities remain valid. No LINE message is sent by this SQL.
create schema if not exists jewelfind_private;
revoke all on schema jewelfind_private from public, anon;
grant usage on schema jewelfind_private to authenticated, service_role;

create table jewelfind_private.request_line_access (
  request_id uuid primary key references public.match_requests(id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);
alter table jewelfind_private.request_line_access enable row level security;
revoke all on jewelfind_private.request_line_access from public, anon, authenticated;
grant all on jewelfind_private.request_line_access to service_role;

create function jewelfind_private.prepare_request_line_notice(p_id uuid, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_version integer; token text; expires timestamptz := now() + interval '180 days';
begin
  if auth.uid() is null or not public.is_jewelfind_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  select f.version into current_version from public.request_fulfillments f where f.request_id = p_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if p_version is null or current_version <> p_version then raise exception 'version_conflict'; end if;
  token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into jewelfind_private.request_line_access(request_id, token_hash, expires_at, created_by)
    values(p_id, encode(extensions.digest(token, 'sha256'), 'hex'), expires, auth.uid())
    on conflict(request_id) do update set token_hash = excluded.token_hash,
      expires_at = excluded.expires_at, created_at = now(), created_by = excluded.created_by;
  return jsonb_build_object('token', token, 'expiresAt', expires);
end $$;
revoke all on function jewelfind_private.prepare_request_line_notice(uuid, integer) from public, anon;
grant execute on function jewelfind_private.prepare_request_line_notice(uuid, integer) to authenticated;

create function public.admin_prepare_request_line_notice(p_id uuid, p_version integer)
returns jsonb language sql security invoker set search_path = '' as $$
  select jewelfind_private.prepare_request_line_notice(p_id, p_version);
$$;
revoke all on function public.admin_prepare_request_line_notice(uuid, integer) from public, anon;
grant execute on function public.admin_prepare_request_line_notice(uuid, integer) to authenticated;

create or replace function public.require_request_access(p_id uuid, p_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if not exists(select 1 from public.request_access a where a.request_id = p_id
      and a.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex'))
    and not exists(select 1 from jewelfind_private.request_line_access a where a.request_id = p_id
      and a.expires_at > now() and a.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
end $$;
revoke all on function public.require_request_access(uuid, text) from public, anon, authenticated;
