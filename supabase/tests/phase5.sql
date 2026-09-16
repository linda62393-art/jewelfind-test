-- Run against a disposable/staging project after migration. All fixtures roll back.
begin;
do $$
declare
  p jsonb := jsonb_build_object('name','Phase5 test','phone','0999999999','line_id','test_line','region','台北',
    'purpose','self','category','ring','material_preferences',jsonb_build_array('diamond'),'budget','60000-100000','style','minimal',
    'reference_photo_url',null,'selected_product_id','r-01','selected_product_name','晨曦單鑽戒','viewing_region','台北',
    'preferred_viewing_time',now() + interval '1 day');
  first_key uuid := gen_random_uuid(); second_key uuid := gen_random_uuid(); a jsonb; b jsonb; cid uuid; total integer;
begin
  if exists(select 1 from public.customers where phone = '0999999999') then raise exception 'Test phone already exists; use a fresh test phone'; end if;
  a := public.submit_viewing_request(first_key,p);
  if not (a->>'isNewCustomer')::boolean then raise exception 'Expected new customer'; end if;
  if public.submit_viewing_request(first_key,p) <> a then raise exception 'Retry changed receipt'; end if;
  select customer_id into cid from public.match_requests where submission_key=first_key;
  p := p || '{"name":"Updated test","line_id":"","region":"台中","viewing_region":"台中"}'::jsonb;
  b := public.submit_viewing_request(second_key,p);
  if (b->>'isNewCustomer')::boolean then raise exception 'Expected existing customer'; end if;
  select count(*) into total from public.customers where phone='0999999999';
  if total <> 1 then raise exception 'Duplicate customers'; end if;
  select count(*) into total from public.match_requests where customer_id=cid;
  if total <> 2 then raise exception 'Expected two requests, not three'; end if;
  if not exists(select 1 from public.customers where id=cid and name='Updated test' and line_id='test_line' and region='台中') then raise exception 'Update / blank LINE preservation failed'; end if;
  begin
    perform public.submit_viewing_request(first_key,p);
    raise exception 'Expected conflict';
  exception when others then if sqlerrm <> 'submission_conflict' then raise; end if; end;
  begin
    perform public.submit_viewing_request(gen_random_uuid(),p || '{"preferred_viewing_time":"2000-01-01T00:00:00Z"}');
    raise exception 'Expected invalid time';
  exception when others then if sqlerrm <> 'invalid_time' then raise; end if; end;
  if has_table_privilege('anon','public.customers','SELECT') or has_table_privilege('authenticated','public.match_requests','SELECT') then raise exception 'Private data exposed'; end if;
  if has_function_privilege('anon','public.submit_viewing_request(uuid,jsonb)','EXECUTE') then raise exception 'RPC exposed'; end if;
end $$;
rollback;
