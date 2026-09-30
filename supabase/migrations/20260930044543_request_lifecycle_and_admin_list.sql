begin;
alter table public.request_fulfillments drop constraint request_fulfillments_stage_check;
alter table public.request_fulfillments add constraint request_fulfillments_stage_check check(stage in ('new','checking','notified','transferring','in_transit','unavailable','cancelled','sold','arrived','viewed','purchased','not_purchased','no_show'));
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
    if not (
      (f.stage='new' and p_stage in ('checking','notified','unavailable','cancelled','sold')) or
      (f.stage='checking' and p_stage in ('notified','transferring','unavailable','cancelled','sold')) or
      (f.stage='notified' and p_stage in ('transferring','unavailable','cancelled','sold')) or
      (f.stage='transferring' and p_stage in ('in_transit','unavailable','cancelled','sold')) or
      (f.stage='in_transit' and p_stage in ('arrived','unavailable','cancelled','sold')) or
      (f.stage='arrived' and p_stage in ('viewed','no_show','cancelled','checking')) or
      (f.stage='viewed' and p_stage in ('purchased','not_purchased','checking')) or
      (f.stage='no_show' and p_stage in ('viewed','cancelled','checking')) or
      (f.stage='not_purchased' and p_stage in ('purchased','checking')) or
      (f.stage='unavailable' and p_stage in ('checking','cancelled')) or
      (f.stage in ('cancelled','sold','purchased') and p_stage='checking')
    ) then raise exception 'invalid_transition'; end if;
    if p_stage in ('cancelled','sold','viewed','purchased','not_purchased','no_show') and btrim(coalesce(p_note,''))='' then raise exception 'note_required'; end if;
    f.stage := p_stage;
    if p_stage in ('notified','transferring','in_transit') then
      f.partner_store := btrim(coalesce(p_fields->>'partner_store',f.partner_store));
      if length(f.partner_store) not between 1 and 200 then raise exception 'partner_required'; end if;
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
      msg := '管理員已登記您到店看貨，歡迎在本需求內留下看貨回饋。';
    elsif p_stage='purchased' then
      msg := '管理員已登記本次看貨結果為已購買，感謝您的回饋。';
    elsif p_stage='not_purchased' then
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
    elsif p_stage='checking' and old_stage in ('unavailable','arrived','cancelled','sold','viewed','purchased','not_purchased','no_show') then
      if btrim(coalesce(p_note,''))='' then raise exception 'rearrange_note_required'; end if;
      msg := '我們正在重新確認商品與看貨安排，請以後續最新到店通知為準。';
      f.arrival_notification_id := null; f.arrived_on := null; f.viewing_deadline := null;
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

create function public.admin_archive_request(p_id uuid,p_version integer,p_archived boolean) returns void language plpgsql security definer set search_path='' as $$
declare v integer; s text;
begin
 if not public.is_jewelfind_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 perform 1 from public.match_requests where id=p_id for update;
 if not found then raise exception 'not_found'; end if;
 select version into v from public.request_admin_meta where request_id=p_id;
 if coalesce(v,-1) is distinct from p_version then raise exception 'version_conflict'; end if;
 if p_archived is null then raise exception 'invalid_request_meta'; end if;
 insert into public.request_admin_meta(request_id,archived) values(p_id,p_archived)
 on conflict(request_id) do update set archived=excluded.archived,version=public.request_admin_meta.version+1;
 select stage into s from public.request_fulfillments where request_id=p_id;
 insert into public.request_activity(request_id,from_stage,to_stage,note,actor_id) values(p_id,s,s,case when p_archived then '移出管理清單（可復原，安排未取消）' else '復原至管理清單' end,auth.uid());
end $$;
create function public.admin_requests_v8(p_search text default '',p_stage text default '',p_region text default '',p_page integer default 0,p_archived boolean default false,p_sort text default 'newest') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.is_jewelfind_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  with rows as (
    select m.id,m.created_at,m.selected_product_name,m.viewing_region,c.name,c.phone,c.line_id,c.region,f.stage,
      f.updated_at,coalesce(a.version,-1) meta_version,coalesce(a.archived,false) archived,coalesce(a.is_test,false) is_test,coalesce(a.display_label,'') display_label,
      (select r.choice from public.viewing_responses r where r.notification_id=f.arrival_notification_id) reply
    from public.match_requests m join public.customers c on c.id=m.customer_id join public.request_fulfillments f on f.request_id=m.id left join public.request_admin_meta a on a.request_id=m.id
    where coalesce(a.archived,false)=coalesce(p_archived,false)
      and (coalesce(p_search,'')='' or c.name ilike '%'||left(p_search,100)||'%' or c.phone ilike '%'||left(p_search,100)||'%' or a.display_label ilike '%'||left(p_search,100)||'%')
      and (coalesce(p_stage,'')='' or f.stage=p_stage) and (coalesce(p_region,'')='' or m.viewing_region ilike '%'||left(p_region,100)||'%')
  ) select jsonb_build_object('total',(select count(*) from rows),'items',coalesce((select jsonb_agg(to_jsonb(page)) from (select * from rows order by case when p_sort='stage' then array_position(array['new','checking','notified','transferring','in_transit','arrived','viewed','no_show','not_purchased','purchased','unavailable','sold','cancelled'],stage) end,case when p_sort='oldest' then created_at end asc,case when p_sort='updated' then updated_at end desc,case when p_sort<>'oldest' then created_at end desc,id limit 6 offset greatest(0,least(coalesce(p_page,0),100000))*6) page),'[]'::jsonb)) into result;
  return result;
end $$;
revoke all on function public.admin_archive_request(uuid,integer,boolean),public.admin_requests_v8(text,text,text,integer,boolean,text) from public,anon;
grant execute on function public.admin_archive_request(uuid,integer,boolean),public.admin_requests_v8(text,text,text,integer,boolean,text) to authenticated;
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
        and not (a.to_stage='checking' and a.from_stage in ('unavailable','arrived','cancelled','sold','viewed','purchased','not_purchased','no_show'))
  ) e;
  return result||jsonb_build_object('timeline',timeline);
end $$;
notify pgrst,'reload schema';
commit;
