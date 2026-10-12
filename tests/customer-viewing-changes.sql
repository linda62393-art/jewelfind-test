begin;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
begin
 begin execute command; exception when others then
  if sqlerrm=expected or (expected='permission_denied' and sqlstate='42501') then return; end if;
  raise exception 'unexpected error: %',sqlerrm;
 end;
 raise exception 'expected error % did not occur',expected;
end $$;
do $$
declare cid uuid; rid uuid; ar uuid; n uuid; t timestamptz;
begin
 insert into public.customers(name,phone,region) values('交易回滾測試','0999999988','測試') returning id into cid;
 t:=((now() at time zone 'Asia/Taipei')::date+2+time '12:00') at time zone 'Asia/Taipei';
 insert into public.match_requests(customer_id,purpose,category,budget,style,selected_product_id,selected_product_name,viewing_region,preferred_viewing_time,submission_key,submission_fingerprint,is_new_customer)
 values(cid,'self','ring','10000-30000','simple','test-appointment','交易回滾測試',(select name from public.service_regions where enabled limit 1),t,gen_random_uuid(),'{}',true) returning id into rid;
 insert into public.request_access(request_id,token_hash) values(rid,encode(extensions.digest(repeat('a',64),'sha256'),'hex'));
 insert into public.match_requests(customer_id,purpose,category,budget,style,selected_product_id,selected_product_name,viewing_region,preferred_viewing_time,submission_key,submission_fingerprint,is_new_customer)
 values(cid,'self','ring','10000-30000','simple','test-appointment','交易回滾測試',(select name from public.service_regions where enabled limit 1),t,gen_random_uuid(),'{}',true) returning id into ar;
 insert into public.request_access(request_id,token_hash) values(ar,encode(extensions.digest(repeat('b',64),'sha256'),'hex'));
 insert into public.request_notifications(request_id,kind,message) values(ar,'arrived','交易回滾測試') returning id into n;
 update public.request_fulfillments set stage='arrived',arrival_notification_id=n,arrived_on=(t at time zone 'Asia/Taipei')::date,viewing_deadline=(t at time zone 'Asia/Taipei')::date+6 where request_id=ar;
 perform set_config('jf_test.rid',rid::text,true);perform set_config('jf_test.arrived',ar::text,true);perform set_config('jf_test.notice',n::text,true);perform set_config('jf_test.time',t::text,true);
end $$;
set local role anon;
do $$
declare rid uuid:=current_setting('jf_test.rid')::uuid; ar uuid:=current_setting('jf_test.arrived')::uuid; n uuid:=current_setting('jf_test.notice')::uuid;
 t timestamptz:=current_setting('jf_test.time')::timestamptz; first_id uuid:=gen_random_uuid(); second_id uuid:=gen_random_uuid(); cancel_id uuid:=gen_random_uuid(); r jsonb;
begin
 perform pg_temp.expect_error(format('select public.customer_change_viewing(%L,%L,0,%L,%L,%L)',rid,repeat('f',64),first_id,'reschedule',t+interval '30 minutes'),'access_denied');
 perform pg_temp.expect_error(format('select public.customer_change_viewing(%L,%L,0,%L,%L,%L)',rid,repeat('a',64),first_id,'reschedule',t),'appointment_unchanged');
 perform pg_temp.expect_error(format('select public.customer_change_viewing(%L,%L,0,%L,%L,%L)',rid,repeat('a',64),first_id,'reschedule',t+interval '15 minutes'),'invalid_viewing_time');
 perform pg_temp.expect_error(format('select public.customer_change_viewing(%L,%L,0,%L,%L,%L)',rid,repeat('a',64),first_id,'reschedule',now()-interval '1 day'),'invalid_viewing_time');
 perform public.customer_change_viewing(rid,repeat('a',64),0,first_id,'reschedule',t+interval '30 minutes');
 perform public.customer_change_viewing(rid,repeat('a',64),0,first_id,'reschedule',t+interval '30 minutes');
 r:=public.customer_request_v8(rid,repeat('a',64));
 assert (r#>>'{appointment,rescheduleCount}')::integer=1,'retry consumed extra count';
 assert (r->>'preferredTime')::timestamptz=t,'original preference changed';
 assert (r#>>'{appointment,pending}')::boolean,'pending confirmation missing';
 perform pg_temp.expect_error(format('select public.customer_change_viewing(%L,%L,0,%L,%L,%L)',rid,repeat('a',64),first_id,'reschedule',t+interval '1 hour'),'appointment_retry_conflict');
 perform pg_temp.expect_error(format('select public.customer_change_viewing(%L,%L,0,%L,%L,%L)',rid,repeat('a',64),second_id,'reschedule',t+interval '1 hour'),'appointment_conflict');
 perform public.customer_change_viewing(rid,repeat('a',64),1,second_id,'reschedule',t+interval '1 hour');
 perform pg_temp.expect_error(format('select public.customer_change_viewing(%L,%L,2,%L,%L,%L)',rid,repeat('a',64),gen_random_uuid(),'reschedule',t+interval '2 hours'),'reschedule_limit');
 perform public.customer_change_viewing(rid,repeat('a',64),2,cancel_id,'cancel',null);
 perform public.customer_change_viewing(rid,repeat('a',64),2,cancel_id,'cancel',null);
 r:=public.customer_request_v8(rid,repeat('a',64));assert r->>'stage'='cancelled';
 assert not (r#>>'{appointment,canChange}')::boolean;
 assert (r#>>'{appointment,rescheduleCount}')::integer=2,'cancel consumed a reschedule';
 assert jsonb_array_length(r->'timeline')=3,'duplicate or missing notifications';
 perform pg_temp.expect_error(format('select public.customer_change_viewing(%L,%L,3,%L,%L,%L)',rid,repeat('a',64),gen_random_uuid(),'reschedule',t+interval '2 hours'),'appointment_closed');
 perform pg_temp.expect_error(format('select public.customer_reply(%L,%L,%L,%L)',ar,repeat('b',64),n,'reschedule'),'appointment_action_required');
 perform pg_temp.expect_error(format('select public.customer_reply(%L,%L,%L,%L)',ar,repeat('b',64),n,'declined'),'appointment_action_required');
 perform public.customer_change_viewing(ar,repeat('b',64),0,gen_random_uuid(),'reschedule',t+interval '30 minutes');
 perform pg_temp.expect_error(format('select public.customer_reply(%L,%L,%L,%L)',ar,repeat('b',64),n,'yes'),'appointment_pending');
 perform pg_temp.expect_error(format('select public.admin_confirm_viewing_change(%L,1)',ar),'permission_denied');
 perform pg_temp.expect_error(format('select public.customer_request_v8(%L,%L)',ar,repeat('a',64)),'access_denied');
end $$;
set local role authenticated;
select pg_temp.expect_error(format('select public.admin_confirm_viewing_change(%L,1)',current_setting('jf_test.arrived')::uuid),'admin_required');
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from public.admin_users order by created_at limit 1),true);
set local role authenticated;
select public.admin_confirm_viewing_change(current_setting('jf_test.arrived')::uuid,1);
set local role anon;
do $$
declare ar uuid:=current_setting('jf_test.arrived')::uuid; n uuid:=current_setting('jf_test.notice')::uuid; t timestamptz:=current_setting('jf_test.time')::timestamptz; r jsonb;
begin
 r:=public.customer_request_v8(ar,repeat('b',64));
 assert not (r#>>'{appointment,pending}')::boolean,'admin confirmation did not clear pending';
 assert (r#>>'{appointment,rescheduleCount}')::integer=1,'admin confirmation reset count';
 perform public.customer_reply(ar,repeat('b',64),n,'yes');
 perform public.customer_change_viewing(ar,repeat('b',64),2,gen_random_uuid(),'reschedule',t+interval '7 days');
end $$;
set local role authenticated;
select pg_temp.expect_error(format('select public.admin_confirm_viewing_change(%L,2)',current_setting('jf_test.arrived')::uuid),'appointment_conflict');
select pg_temp.expect_error(format('select public.admin_confirm_viewing_change(%L,3)',current_setting('jf_test.arrived')::uuid),'appointment_deadline');
reset role;
select 'PASS: capability isolation, slots, unchanged time, two-change cap, idempotency, stale versions, cancellation, timeline, legacy bypass and admin authorization' as result;
rollback;
