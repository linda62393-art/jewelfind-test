-- Synthetic requests only; every row and notification is rolled back.
begin;
do $$
declare a uuid; rid uuid; receipt jsonb; token text:=encode(extensions.gen_random_bytes(32),'hex'); tag text:=gen_random_uuid()::text; v integer; d jsonb; original jsonb; s text; fields jsonb; oldest uuid; newest uuid; ids uuid[]:='{}'; i integer;
begin
 select user_id into a from public.admin_users limit 1;
 for i in 1..7 loop
  receipt:=public.submit_viewing_request_v6(gen_random_uuid(),jsonb_build_object('name','流程分頁驗證','phone','09916626'||lpad(i::text,2,'0'),'region','台北市','purpose','self','category','ring','material_preferences',jsonb_build_array('diamond'),'budget','10000-30000','style','minimal','selected_product_id','r-01','selected_product_name','流程測試商品','viewing_region','台北市中正區','preferred_viewing_time',now()+interval '20 days'),token);
  ids:=array_append(ids,(receipt->>'id')::uuid);
  insert into public.request_admin_meta(request_id,display_label) values(ids[i],tag);
  update public.match_requests set created_at=now()-(8-i)*interval '1 day' where id=ids[i];
 end loop;
 rid:=ids[1]; oldest:=ids[1]; newest:=ids[7];
 select to_jsonb(m) into original from public.match_requests m where id=rid;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin perform public.admin_process_request(rid,0,'cancelled','{}','取消'); raise exception 'UNAUTHORIZED_PROCESS'; exception when insufficient_privilege then null; end;
 begin perform public.admin_archive_request(rid,0,true); raise exception 'UNAUTHORIZED_ARCHIVE'; exception when insufficient_privilege then null; end;
 begin perform public.admin_requests_v8(); raise exception 'UNAUTHORIZED_LIST'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',a::text,true);
 begin perform public.admin_process_request(rid,0,'cancelled','{}',''); raise exception 'CANCEL_NOTE_MISSING_ALLOWED'; exception when others then if sqlerrm<>'note_required' then raise; end if; end;
 begin perform public.admin_process_request(rid,0,'purchased','{}','incorrect'); raise exception 'PRE_VIEW_PURCHASE_ALLOWED'; exception when others then if sqlerrm<>'invalid_transition' then raise; end if; end;
 foreach s in array array['cancelled','checking','notified','transferring','cancelled','checking','sold','checking','unavailable','checking','transferring','in_transit','arrived','no_show','viewed','not_purchased','purchased','checking','transferring','in_transit','arrived','cancelled'] loop
  select version into v from public.request_fulfillments where request_id=rid;
  fields:=case when s='unavailable' then '{"failure_code":"price_high","failure_detail":"INTERNAL_HIGH_PRICE"}'::jsonb when s='arrived' then jsonb_build_object('arrived_on',(now() at time zone 'Asia/Taipei')::date,'viewing_store','流程測試店','store_address','測試地址') else '{"partner_store":"流程測試店"}'::jsonb end;
  perform public.admin_process_request(rid,v,s,fields,'INTERNAL_TEST_NOTE');
  if (select stage from public.request_fulfillments where request_id=rid)<>s then raise exception 'STAGE_NOT_SAVED: %',s; end if;
 end loop;
 begin perform public.admin_process_request(rid,v,'checking','{}','stale'); raise exception 'STALE_VERSION_ALLOWED'; exception when others then if sqlerrm<>'version_conflict' then raise; end if; end;
 d:=public.customer_request_v7(rid,token);
 if d->>'stage'<>'cancelled' or d->>'arrivalNotificationId' is not null or d::text like '%INTERNAL_%' then raise exception 'CANCELLATION_PRIVACY_OR_ARRIVAL_BROKEN'; end if;
 if not exists(select 1 from jsonb_array_elements(d->'timeline') t where t->>'message' like '%已取消%') then raise exception 'CANCEL_TIMELINE_MISSING'; end if;
 begin perform public.customer_request_v7(rid,repeat('0',64)); raise exception 'BAD_TOKEN_ALLOWED'; exception when insufficient_privilege then null; end;
 d:=public.admin_requests_v8(tag,'','',0,false,'newest');
 if (d->>'total')::int<>7 or jsonb_array_length(d->'items')<>6 or (d->'items'->0->>'id')::uuid<>newest then raise exception 'NEWEST_OR_PAGE_BROKEN'; end if;
 if jsonb_array_length(public.admin_requests_v8(tag,'','',1,false,'newest')->'items')<>1 then raise exception 'SECOND_PAGE_BROKEN'; end if;
 if (public.admin_requests_v8(tag,'','',0,false,'oldest')->'items'->0->>'id')::uuid<>oldest then raise exception 'OLDEST_BROKEN'; end if;
 update public.request_fulfillments set updated_at=clock_timestamp()+interval '1 minute' where request_id=rid;
 if (public.admin_requests_v8(tag,'','',0,false,'updated')->'items'->0->>'id')::uuid<>rid then raise exception 'UPDATED_BROKEN'; end if;
 if public.admin_requests_v8(tag,'','',0,false,'stage')->'items'->0->>'stage'<>'new' then raise exception 'STAGE_SORT_BROKEN'; end if;
 perform public.admin_archive_request(rid,0,true);
 if public.admin_requests_v8(tag,'cancelled','',0,false,'newest')->>'total'<>'0' or public.admin_requests_v8(tag,'cancelled','',0,true,'newest')->>'total'<>'1' then raise exception 'REGULAR_ARCHIVE_BROKEN'; end if;
 if public.customer_request_v7(rid,token)->>'stage'<>'cancelled' then raise exception 'ARCHIVE_CHANGED_CUSTOMER'; end if;
 begin perform public.admin_archive_request(rid,0,false); raise exception 'STALE_ARCHIVE_ALLOWED'; exception when others then if sqlerrm<>'version_conflict' then raise; end if; end;
 perform public.admin_archive_request(rid,1,false);
 if public.admin_requests_v8(tag,'cancelled','',0,false,'newest')->>'total'<>'1' then raise exception 'RESTORE_BROKEN'; end if;
 if original is distinct from (select to_jsonb(m) from public.match_requests m where id=rid) then raise exception 'ORIGINAL_CHANGED'; end if;
 if has_function_privilege('anon','public.admin_archive_request(uuid,integer,boolean)','execute') or has_function_privilege('anon','public.admin_requests_v8(text,text,text,integer,boolean,text)','execute') then raise exception 'PUBLIC_ADMIN_ACCESS'; end if;
end $$;
select 'PASS: cancellation, reopening, notification, unavailable reason privacy, viewing outcomes, admin/token/version guards, six-item pagination, four sorts, reversible regular-request archive' as lifecycle_test_result;
rollback;
