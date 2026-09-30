begin;
create or replace function public.admin_process_request(p_id uuid,p_version integer,p_stage text,p_fields jsonb default '{}',p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare f public.request_fulfillments%rowtype; old_stage text; n uuid; msg text; details jsonb := '{}';
begin
  if not public.is_jewelfind_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if length(coalesce(p_note,''))>2000 or length(p_fields::text)>8000 then raise exception 'invalid_fields'; end if;
  select * into f from public.request_fulfillments where request_id=p_id for update;
  if not found then raise exception 'not_found'; end if;
  if f.version is distinct from p_version then raise exception 'version_conflict'; end if;
  old_stage := f.stage;
  if p_stage is null then raise exception 'invalid_transition'; end if;
  if p_stage=f.stage then
    if btrim(coalesce(p_note,''))='' then raise exception 'note_required'; end if;
  else
    if p_stage not in ('checking','notified','transferring','in_transit','unavailable','cancelled','sold','arrived','viewed','purchased','not_purchased','no_show') then raise exception 'invalid_transition'; end if;
    if p_stage in ('cancelled','sold','viewed','purchased','not_purchased','no_show') and btrim(coalesce(p_note,''))='' then raise exception 'note_required'; end if;
    f.stage := p_stage;
    if p_stage in ('notified','transferring','in_transit') then
      f.partner_store := btrim(coalesce(p_fields->>'partner_store',f.partner_store));
      if length(f.partner_store) not between 1 and 200 then raise exception 'partner_required'; end if;
    end if;
    if p_stage in ('viewed','purchased','not_purchased','no_show') and f.arrived_on is null then
      f.arrived_on := (p_fields->>'arrived_on')::date;
      f.viewing_deadline := coalesce((p_fields->>'viewing_deadline')::date,f.arrived_on+6);
      f.viewing_store := btrim(coalesce(p_fields->>'viewing_store','')); f.store_address := btrim(coalesce(p_fields->>'store_address',''));
      if f.arrived_on is null or f.arrived_on>(now() at time zone 'Asia/Taipei')::date or f.viewing_deadline<f.arrived_on or f.viewing_deadline>f.arrived_on+6 or length(f.viewing_store) not between 1 and 200 or length(f.store_address) not between 1 and 500 then raise exception 'arrival_fields_required'; end if;
    end if;
    if p_stage='unavailable' then
      f.failure_code := p_fields->>'failure_code'; f.failure_detail := btrim(coalesce(p_fields->>'failure_detail',''));
      if f.failure_code is null or f.failure_code not in ('price_high','precious','store_unavailable','sold','not_transferable','no_partner','other') or length(f.failure_detail) not between 1 and 2000 then raise exception 'failure_reason_required'; end if;
      msg := '目前此商品暫時無法安排至您選擇的地點看貨，我們可以繼續協助您確認其他看貨地點或適合的商品。';
    elsif p_stage='notified' then
      msg := '已通知合作店家確認您的看貨需求，正在等待店家回覆。';
    elsif p_stage='cancelled' then
      msg := '本次調貨／看貨安排已取消。如仍需要協助，可以再提出需求。';
      f.arrival_notification_id := null; f.arrived_on := null; f.viewing_deadline := null;
    elsif p_stage='sold' then
      msg := '此商品已售出，目前無法提供本次看貨安排。您可選擇其他商品。';
      f.arrival_notification_id := null; f.arrived_on := null; f.viewing_deadline := null;
    elsif p_stage='viewed' then
      details := jsonb_build_object('store',f.viewing_store,'address',f.store_address,'arrivedOn',f.arrived_on);
      msg := '管理員已登記您到店看貨，歡迎在本需求內留下看貨回饋。';
    elsif p_stage='purchased' then
      details := jsonb_build_object('store',f.viewing_store,'address',f.store_address,'arrivedOn',f.arrived_on);
      msg := '管理員已登記本次看貨結果為已購買，感謝您的回饋。';
    elsif p_stage='not_purchased' then
      details := jsonb_build_object('store',f.viewing_store,'address',f.store_address,'arrivedOn',f.arrived_on);
      msg := '管理員已登記本次看貨結果為未購買，歡迎補充願付價格與想找的款式。';
    elsif p_stage='no_show' then
      msg := '管理員已登記您尚未赴店。如需重新安排，請與我們聯繫。';
    elsif p_stage='in_transit' then
      msg := '您的商品已成功安排調貨，目前正在送往指定看貨地點。';
    elsif p_stage='arrived' then
      f.arrived_on := (p_fields->>'arrived_on')::date;
      f.viewing_deadline := coalesce((p_fields->>'viewing_deadline')::date,f.arrived_on+6);
      f.viewing_store := btrim(coalesce(p_fields->>'viewing_store','')); f.store_address := btrim(coalesce(p_fields->>'store_address',''));
      if f.arrived_on is null or f.arrived_on>(now() at time zone 'Asia/Taipei')::date or f.viewing_deadline<f.arrived_on or f.viewing_deadline>f.arrived_on+6 or length(f.viewing_store) not between 1 and 200 or length(f.store_address) not between 1 and 500 then raise exception 'arrival_fields_required'; end if;
      msg := '您想看的商品已送達指定店家，請於到貨後一週內前往看貨。';
      details := jsonb_build_object('store',f.viewing_store,'address',f.store_address,'arrivedOn',f.arrived_on,'deadline',f.viewing_deadline);
    elsif p_stage='checking' and old_stage<>'new' then
      if btrim(coalesce(p_note,''))='' then raise exception 'rearrange_note_required'; end if;
      msg := '我們正在重新確認商品與看貨安排，請以後續最新到店通知為準。';
      f.arrival_notification_id := null; f.arrived_on := null; f.viewing_deadline := null;
    end if;
    if p_stage in ('viewed','purchased','not_purchased','no_show') then f.arrival_notification_id := null; end if;
    if p_stage in ('checking','notified','transferring','in_transit','unavailable') then
      f.arrival_notification_id := null; f.arrived_on := null; f.viewing_deadline := null; f.viewing_store := ''; f.store_address := '';
    end if;
    if msg is not null then
      insert into public.request_notifications(request_id,kind,message,details) values(p_id,case when p_stage='checking' then 'rearranging' when p_stage in ('notified','cancelled','sold','viewed','purchased','not_purchased','no_show') then 'update' else p_stage end,msg,details || jsonb_build_object('stage',p_stage)) returning id into n;
      if p_stage='arrived' then f.arrival_notification_id := n; end if;
    end if;
  end if;
  update public.request_fulfillments set stage=f.stage,partner_store=f.partner_store,viewing_store=f.viewing_store,store_address=f.store_address,
    arrived_on=f.arrived_on,viewing_deadline=f.viewing_deadline,failure_code=f.failure_code,failure_detail=f.failure_detail,
    arrival_notification_id=f.arrival_notification_id,version=version+1,updated_at=clock_timestamp(),updated_by=auth.uid() where request_id=p_id;
  insert into public.request_activity(request_id,from_stage,to_stage,note,actor_id) values(p_id,old_stage,p_stage,
    btrim(coalesce(p_note,'')) || case when p_stage='unavailable' and old_stage<>p_stage then E'\n原因：'||f.failure_code||' / '||f.failure_detail else '' end,auth.uid());
end $$;

create or replace function public.write_viewing_feedback(p_id uuid,p_expected uuid,p_fields jsonb,p_source text) returns void language plpgsql security definer set search_path='' as $$
declare latest uuid; d date; outcome text; rs text[]; lo bigint; hi bigint; pref text; note text; wanted text;
begin
  perform 1 from public.match_requests where id=p_id for update;
  if not found then raise exception 'not_found'; end if;
  if not exists(select 1 from public.request_notifications where request_id=p_id and (kind='arrived' or (details->>'stage' in ('viewed','purchased','not_purchased') and details->>'arrivedOn' is not null))) then raise exception 'feedback_not_ready'; end if;
  select id into latest from public.viewing_feedback where request_id=p_id order by created_at desc,id desc limit 1;
  if latest is distinct from p_expected then raise exception 'feedback_conflict'; end if;
  if p_fields is null or jsonb_typeof(p_fields)<>'object' or length(p_fields::text)>8000 then raise exception 'invalid_feedback'; end if;
  begin
    d:=(p_fields->>'viewed_on')::date; outcome:=p_fields->>'outcome';
    select coalesce(array_agg(distinct v),'{}'::text[]) into rs from jsonb_array_elements_text(p_fields->'reasons') v;
    lo:=(p_fields->>'budget_min')::bigint; hi:=(p_fields->>'budget_max')::bigint;
    pref:=p_fields->>'contact_preference'; note:=btrim(coalesce(p_fields->>'note','')); wanted:=btrim(coalesce(p_fields->>'wanted_product',''));
  exception when others then raise exception 'invalid_feedback'; end;
  if d is null or d>(now() at time zone 'Asia/Taipei')::date or d<(select (created_at at time zone 'Asia/Taipei')::date from public.match_requests where id=p_id)
    or outcome is null or outcome not in ('purchased','not_purchased','considering','more_options')
    or pref is null or pref not in ('recommend','revisit','later','none') or p_source not in ('customer','admin')
    or not (rs <@ array['style','over_budget','service','unclear','other']::text[]) or array_position(rs,null) is not null
    or (outcome='not_purchased' and cardinality(rs)=0) or (outcome='purchased' and cardinality(rs)>0)
    or lo<0 or hi<0 or lo>100000000 or hi>100000000 or lo>hi or length(note)>2000 or length(wanted)>200 then raise exception 'invalid_feedback'; end if;
  insert into public.viewing_feedback(request_id,viewed_on,outcome,reasons,budget_min,budget_max,contact_preference,note,wanted_product,source,actor_id)
    values(p_id,d,outcome,rs,lo,hi,pref,note,wanted,p_source,case when p_source='admin' then auth.uid() else null end);
  insert into public.request_followups(request_id) values(p_id)
    on conflict(request_id) do update set status=case when public.request_followups.status='closed' or public.request_followups.status='awaiting_feedback' then 'pending' else public.request_followups.status end,
      next_contact_on=case when pref='none' then null else public.request_followups.next_contact_on end,version=public.request_followups.version+1,updated_at=clock_timestamp();
end $$;

create or replace function public.customer_aftercare(p_id uuid,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform public.require_request_access(p_id,p_token);
  return jsonb_build_object('eligible',exists(select 1 from public.request_notifications where request_id=p_id and (kind='arrived' or (details->>'stage' in ('viewed','purchased','not_purchased') and details->>'arrivedOn' is not null))),
    'feedback',(select to_jsonb(v)-'actor_id'-'request_id' from public.viewing_feedback v where request_id=p_id order by created_at desc,id desc limit 1));
end $$;

create or replace function public.admin_aftercare(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.is_jewelfind_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  return jsonb_build_object('eligible',exists(select 1 from public.request_notifications where request_id=p_id and (kind='arrived' or (details->>'stage' in ('viewed','purchased','not_purchased') and details->>'arrivedOn' is not null))),
    'feedback',(select to_jsonb(v) from public.viewing_feedback v where request_id=p_id order by created_at desc,id desc limit 1),
    'history',coalesce((select jsonb_agg(to_jsonb(v) order by created_at desc,id desc) from public.viewing_feedback v where request_id=p_id),'[]'::jsonb),
    'followup',(select to_jsonb(f) from public.request_followups f where request_id=p_id),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by created_at desc,id desc) from public.request_followup_events e where request_id=p_id),'[]'::jsonb));
end $$;

create or replace function public.admin_invite_feedback(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_jewelfind_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  perform 1 from public.match_requests where id=p_id for update;
  if not exists(select 1 from public.request_notifications where request_id=p_id and (kind='arrived' or (details->>'stage' in ('viewed','purchased','not_purchased') and details->>'arrivedOn' is not null))) then raise exception 'feedback_not_ready'; end if;
  if exists(select 1 from public.request_notifications where request_id=p_id and details->>'purpose'='viewing_feedback' and published_at>now()-interval '1 day') then return; end if;
  insert into public.request_notifications(request_id,kind,message,details) values(p_id,'update','看貨後歡迎在本需求頁填寫「看貨後回饋」，告訴我們是否購買、預算及希望的後續協助。','{"purpose":"viewing_feedback"}');
  insert into public.request_followups(request_id,status) values(p_id,'awaiting_feedback') on conflict do nothing;
  insert into public.request_followup_events(request_id,status,note,actor_id) select p_id,status,'已發佈 App 看貨後回饋邀請。',auth.uid() from public.request_followups where request_id=p_id;
end $$;
create or replace function public.customer_request_v7(p_id uuid,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; timeline jsonb;
begin
  result:=public.customer_request(p_id,p_token);
  select coalesce(jsonb_agg(to_jsonb(e) order by e.occurred_at desc,e.id desc),'[]'::jsonb) into timeline from (
    select n.id::text,n.kind,n.published_at occurred_at,n.message from public.request_notifications n where n.request_id=p_id
    union all
    select a.id::text,a.to_stage kind,a.created_at occurred_at,
      case a.to_stage when 'checking' then '正在確認商品與合作店家。' when 'transferring' then '已進入調貨處理，正在確認店家安排。' end message
      from public.request_activity a where a.request_id=p_id and a.from_stage<>a.to_stage and a.to_stage in ('checking','transferring')
        and not (a.to_stage='checking' and a.from_stage<>'new')
  ) e;
  return result||jsonb_build_object('timeline',timeline);
end $$;
notify pgrst,'reload schema';
commit;
