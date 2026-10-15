-- Uses one existing request only inside this rolled-back transaction.
begin;
do $$
declare rid uuid; admin_id uuid; ver integer; result jsonb; first_token text; original_token text;
begin
  select a.user_id into admin_id from public.admin_users a limit 1;
  select a.request_id, f.version into rid, ver from public.request_access a
    join public.request_fulfillments f on f.request_id = a.request_id limit 1;
  if admin_id is null or rid is null then raise exception 'verification_fixture_missing'; end if;
  if has_function_privilege('anon','public.admin_prepare_request_line_notice(uuid,integer)','execute') then raise exception 'ANON_ALLOWED'; end if;
  if has_table_privilege('authenticated','jewelfind_private.request_line_access','select') then raise exception 'DIRECT_TABLE_ACCESS_ALLOWED'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  begin perform public.admin_prepare_request_line_notice(rid,ver); raise exception 'NON_ADMIN_ALLOWED'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  begin perform public.admin_prepare_request_line_notice(rid,ver+1); raise exception 'STALE_VERSION_ALLOWED'; exception when others then if sqlerrm <> 'version_conflict' then raise; end if; end;
  original_token := encode(extensions.gen_random_bytes(32),'hex');
  update public.request_access set token_hash=encode(extensions.digest(original_token,'sha256'),'hex') where request_id=rid;
  result := public.admin_prepare_request_line_notice(rid,ver);
  first_token := result->>'token';
  if first_token !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_TOKEN'; end if;
  perform public.require_request_access(rid,first_token);
  perform public.require_request_access(rid,original_token);
  perform public.customer_request_v8(rid,first_token);
  begin perform public.require_request_access(gen_random_uuid(),first_token); raise exception 'WRONG_REQUEST_ALLOWED'; exception when insufficient_privilege then null; end;
  result := public.admin_prepare_request_line_notice(rid,ver);
  begin perform public.require_request_access(rid,first_token); raise exception 'REPLACED_TOKEN_ALLOWED'; exception when insufficient_privilege then null; end;
  perform public.require_request_access(rid,original_token);
  update jewelfind_private.request_line_access set expires_at=now()-interval '1 second' where request_id=rid;
  begin perform public.require_request_access(rid,result->>'token'); raise exception 'EXPIRED_TOKEN_ALLOWED'; exception when insufficient_privilege then null; end;
  if (select version from public.request_fulfillments where request_id=rid) <> ver then raise exception 'STAGE_CHANGED'; end if;
end $$;
select 'PASS: admin-only issuance, stale-version rejection, private hashes, preserved original access, cross-device access, request isolation, replacement and expiry' as result;
rollback;
