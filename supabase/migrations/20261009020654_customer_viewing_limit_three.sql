-- Enforce the same three-item allowance for submissions and reopening requests.
-- Existing requests are preserved; active-to-active updates remain allowed.
create or replace function public.enforce_customer_viewing_limit()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_customer_id uuid; v_phone text; v_count integer;
begin
  if new.stage not in ('new','checking','notified','transferring','in_transit','arrived') then return new; end if;
  if tg_op = 'UPDATE' then
    if old.stage in ('new','checking','notified','transferring','in_transit','arrived') then return new; end if;
  end if;
  select m.customer_id,c.phone into v_customer_id,v_phone
    from public.match_requests m join public.customers c on c.id=m.customer_id
    where m.id=new.request_id;
  if v_customer_id is null then raise exception 'invalid_request'; end if;
  -- Same lock as submit_viewing_request; serialize new requests and reopens.
  perform pg_advisory_xact_lock(hashtextextended(v_phone,1));
  select count(*) into v_count
    from public.match_requests m join public.request_fulfillments f on f.request_id=m.id
    where m.customer_id=v_customer_id and m.id<>new.request_id
      and f.stage in ('new','checking','notified','transferring','in_transit','arrived');
  if v_count >= 3 then raise exception 'viewing_request_limit'; end if;
  return new;
end $$;
revoke all on function public.enforce_customer_viewing_limit() from public,anon,authenticated;
grant execute on function public.enforce_customer_viewing_limit() to service_role;
create trigger customer_viewing_limit before insert or update of stage on public.request_fulfillments
for each row execute function public.enforce_customer_viewing_limit();
