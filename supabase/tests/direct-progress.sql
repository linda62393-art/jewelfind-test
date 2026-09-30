begin;
do $$
declare a uuid; rid uuid; receipt jsonb; token text:=encode(extensions.gen_random_bytes(32),'hex'); target text; fields jsonb; d jsonb; v integer; i integer:=0;
begin
 select user_id into a from public.admin_users limit 1;
 foreach target in array array['transferring','arrived','viewed','purchased','not_purchased','no_show'] loop
  i:=i+1;
  receipt:=public.submit_viewing_request_v6(gen_random_uuid(),jsonb_build_object('name','直接進度驗證','phone','099166267'||i::text,'region','台北市','purpose','self','category','ring','material_preferences',jsonb_build_array('diamond'),'budget','10000-30000','style','minimal','selected_product_id','r-01','selected_product_name','直接進度測試商品','viewing_region','台北市中正區','preferred_viewing_time',now()+interval '20 days'),token);
  rid:=(receipt->>'id')::uuid;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  begin perform public.admin_process_request(rid,0,target,'{}','test'); raise exception 'UNAUTHORIZED_DIRECT'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',a::text,true);
  if target='transferring' then
   begin perform public.admin_process_request(rid,0,target,'{}','test'); raise exception 'MISSING_STORE_ALLOWED'; exception when others then if sqlerrm<>'partner_required' then raise; end if; end;
  else
   begin perform public.admin_process_request(rid,0,target,'{}','test'); raise exception 'MISSING_ARRIVAL_ALLOWED'; exception when others then if sqlerrm<>'arrival_fields_required' then raise; end if; end;
  end if;
  fields:=jsonb_build_object('partner_store','測試來源店','arrived_on',(now() at time zone 'Asia/Taipei')::date,'viewing_store','測試看貨店','store_address','測試地址');
  perform public.admin_process_request(rid,0,target,fields,'PRIVATE_DIRECT_NOTE');
  if (select version from public.request_fulfillments where request_id=rid)<>1 or (select count(*) from public.request_activity where request_id=rid)<>1 then raise exception 'INTERMEDIATE_EVENTS_INVENTED'; end if;
  d:=public.customer_request_v7(rid,token);
  if d->>'stage'<>target or jsonb_array_length(d->'timeline')<>1 or d::text like '%PRIVATE_DIRECT%' then raise exception 'DIRECT_CUSTOMER_TIMELINE_BROKEN: %',target; end if;
  if target in ('arrived','viewed','purchased','not_purchased') and not (public.customer_aftercare(rid,token)->>'eligible')::boolean then raise exception 'DIRECT_FEEDBACK_NOT_READY: %',target; end if;
  if target in ('transferring','no_show') and (public.customer_aftercare(rid,token)->>'eligible')::boolean then raise exception 'EARLY_FEEDBACK_ALLOWED'; end if;
  if target='arrived' then
   perform public.admin_process_request(rid,1,'transferring','{"partner_store":"重新安排店"}','重新安排');
   d:=public.customer_request_v7(rid,token);
   if d->>'arrivalNotificationId' is not null or (select arrived_on from public.request_fulfillments where request_id=rid) is not null then raise exception 'OLD_ARRIVAL_STILL_ACTIVE'; end if;
  end if;
  begin perform public.admin_process_request(rid,0,'cancelled','{}','stale'); raise exception 'STALE_DIRECT_ALLOWED'; exception when others then if sqlerrm<>'version_conflict' then raise; end if; end;
 end loop;
end $$;
select 'PASS: direct progress, no invented intermediate events, required venue/date, feedback readiness, superseded arrangements, admin and version guards, private notes' as direct_progress_result;
rollback;
