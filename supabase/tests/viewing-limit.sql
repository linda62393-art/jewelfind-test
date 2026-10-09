-- Transactional fixture test: leaves no orders, customers or notifications behind.
begin;
do $$
declare
  test_phone text; other_phone text; payload jsonb; first_key uuid:=gen_random_uuid();
  first_receipt jsonb; receipt jsonb; ids uuid[] := '{}'; rid uuid; cid uuid;
  next_key uuid:=gen_random_uuid(); outcome text;
begin
  loop
    test_phone := '099'||lpad(floor(random()*10000000)::text,7,'0');
    exit when not exists(select 1 from public.customers c where c.phone=test_phone);
  end loop;
  payload := jsonb_build_object('name','VIEWING_LIMIT_TEST','phone',test_phone,'region','台北市',
    'purpose','self','category','ring','material_preferences',jsonb_build_array('diamond'),
    'budget','60000-100000','style','minimal','selected_product_id','r-01',
    'selected_product_name','LIMIT_TEST_PRODUCT','viewing_region','台北市中正區',
    'preferred_viewing_time',(date_trunc('hour',now())+interval '2 days')::text);
  first_receipt := public.submit_viewing_request(first_key,payload);
  ids := array_append(ids,(first_receipt->>'id')::uuid);
  for i in 1..2 loop
    receipt := public.submit_viewing_request(gen_random_uuid(),payload);
    ids := array_append(ids,(receipt->>'id')::uuid);
  end loop;
  select customer_id into cid from public.match_requests where id=ids[1];
  if (select count(*) from public.match_requests where customer_id=cid)<>3 then raise exception 'FIRST_THREE_FAILED'; end if;
  receipt := public.submit_viewing_request(first_key,payload);
  if receipt->>'id'<>first_receipt->>'id' then raise exception 'RETRY_CHANGED_RECEIPT'; end if;
  begin
    perform public.submit_viewing_request(next_key,payload);
    raise exception 'FOURTH_ALLOWED';
  exception when others then
    if sqlerrm<>'viewing_request_limit' then raise; end if;
  end;
  if exists(select 1 from public.match_requests where submission_key=next_key) then raise exception 'REJECTED_REQUEST_PERSISTED'; end if;
  -- Changing requested date cannot bypass the resource allowance.
  begin
    perform public.submit_viewing_request(gen_random_uuid(),payload||jsonb_build_object('preferred_viewing_time',(now()+interval '3 days')::text));
    raise exception 'DATE_BYPASS_ALLOWED';
  exception when others then
    if sqlerrm<>'viewing_request_limit' then raise; end if;
  end;
  -- Hiding a request does not cancel its resource reservation.
  insert into public.request_admin_meta(request_id,archived,is_test) values(ids[1],true,true)
    on conflict(request_id) do update set archived=true;
  begin
    perform public.submit_viewing_request(gen_random_uuid(),payload);
    raise exception 'ARCHIVE_BYPASS_ALLOWED';
  exception when others then
    if sqlerrm<>'viewing_request_limit' then raise; end if;
  end;
  -- Every terminal outcome releases one slot, without deleting its request.
  foreach outcome in array array['cancelled','unavailable','sold','viewed','purchased','not_purchased','no_show'] loop
    update public.request_fulfillments set stage=outcome where request_id=ids[1];
    update public.match_requests set created_at=now()-interval '2 minutes' where customer_id=cid;
    receipt := public.submit_viewing_request(gen_random_uuid(),payload);
    rid := (receipt->>'id')::uuid;
    begin
      update public.request_fulfillments set stage='checking' where request_id=ids[1];
      raise exception 'REOPEN_OVER_LIMIT_ALLOWED';
    exception when others then
      if sqlerrm<>'viewing_request_limit' then raise; end if;
    end;
    update public.request_fulfillments set stage='cancelled' where request_id=rid;
    update public.request_fulfillments set stage='checking' where request_id=ids[1];
    if not exists(select 1 from public.match_requests where id=rid) then raise exception 'HISTORY_DELETED'; end if;
  end loop;
  loop
    other_phone := '099'||lpad(floor(random()*10000000)::text,7,'0');
    exit when not exists(select 1 from public.customers c where c.phone=other_phone);
  end loop;
  perform public.submit_viewing_request(gen_random_uuid(),payload||jsonb_build_object('phone',other_phone));
  -- Normal processing of an existing active request keeps its reserved slot.
  update public.request_fulfillments set stage='transferring' where request_id=ids[2];
end $$;
rollback;
