begin;

create table public.service_regions (name text primary key, enabled boolean not null default true);
insert into public.service_regions(name) values('台北市'),('新北市');
alter table public.service_regions enable row level security;
revoke all on public.service_regions from anon,authenticated;
grant select on public.service_regions to anon,authenticated;
grant all on public.service_regions to service_role;
create policy active_service_regions on public.service_regions for select to anon,authenticated using(enabled);
create function public.check_viewing_region() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.service_regions where name=new.viewing_region and enabled) then raise exception 'unsupported_viewing_region'; end if;
  return new;
end $$;
revoke all on function public.check_viewing_region() from public;
create trigger match_request_service_region before insert on public.match_requests for each row execute function public.check_viewing_region();

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create function public.is_jewelfind_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.is_jewelfind_admin() from public;
grant execute on function public.is_jewelfind_admin() to authenticated;

create table public.request_fulfillments (
  request_id uuid primary key references public.match_requests(id),
  stage text not null default 'new' check(stage in ('new','checking','transferring','in_transit','unavailable','arrived')),
  partner_store text not null default '',
  viewing_store text not null default '',
  store_address text not null default '',
  arrived_on date,
  viewing_deadline date,
  failure_code text,
  failure_detail text,
  arrival_notification_id uuid,
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  check (viewing_deadline is null or (arrived_on is not null and viewing_deadline between arrived_on and arrived_on + 6))
);
create table public.request_activity (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.match_requests(id),
  from_stage text not null,
  to_stage text not null,
  note text not null,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.request_notifications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.match_requests(id),
  kind text not null check(kind in ('in_transit','unavailable','arrived','rearranging')),
  channel text not null default 'app' check(channel = 'app'),
  message text not null,
  details jsonb not null default '{}',
  published_at timestamptz not null default now(),
  read_at timestamptz
);
create table public.viewing_responses (
  notification_id uuid primary key references public.request_notifications(id),
  request_id uuid not null references public.match_requests(id),
  choice text not null check(choice in ('yes','reschedule','declined')),
  proposed_date date,
  note text not null default '',
  updated_at timestamptz not null default now()
);
create table public.request_access (
  request_id uuid primary key references public.match_requests(id),
  token_hash text not null,
  created_at timestamptz not null default now()
);
create index request_notifications_request_idx on public.request_notifications(request_id, published_at desc);
create index request_activity_request_idx on public.request_activity(request_id, created_at desc);
create index request_fulfillments_stage_idx on public.request_fulfillments(stage);
alter table public.admin_users enable row level security;
alter table public.request_fulfillments enable row level security;
alter table public.request_activity enable row level security;
alter table public.request_notifications enable row level security;
alter table public.viewing_responses enable row level security;
alter table public.request_access enable row level security;
revoke all on public.admin_users, public.request_fulfillments, public.request_activity, public.request_notifications, public.viewing_responses, public.request_access from anon, authenticated;
grant all on public.admin_users, public.request_fulfillments, public.request_activity, public.request_notifications, public.viewing_responses, public.request_access to service_role;
insert into public.request_fulfillments(request_id) select id from public.match_requests;
create function public.initialize_fulfillment() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.request_fulfillments(request_id) values(new.id); return new; end $$;
revoke all on function public.initialize_fulfillment() from public;
create trigger match_request_fulfillment after insert on public.match_requests for each row execute function public.initialize_fulfillment();

-- The existing Phase 5 transaction remains the only customer-deduplication writer.
create function public.submit_viewing_request_v6(p_submission_key uuid, p_payload jsonb, p_access_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; rid uuid; hashed text;
begin
  if p_access_token is null or p_access_token !~ '^[a-f0-9]{64}$' then raise exception 'invalid_access_token'; end if;
  result := public.submit_viewing_request(p_submission_key,p_payload);
  rid := (result->>'id')::uuid;
  hashed := encode(extensions.digest(p_access_token,'sha256'),'hex');
  insert into public.request_access(request_id,token_hash) values(rid,hashed) on conflict do nothing;
  if not exists(select 1 from public.request_access where request_id=rid and token_hash=hashed) then raise exception 'submission_conflict'; end if;
  return result;
end $$;
revoke all on function public.submit_viewing_request_v6(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.submit_viewing_request_v6(uuid,jsonb,text) to service_role;

create function public.require_request_access(p_id uuid,p_token text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or length(p_token) <> 64 or not exists(select 1 from public.request_access where request_id=p_id and token_hash=encode(extensions.digest(p_token,'sha256'),'hex')) then
    raise exception 'access_denied' using errcode='42501';
  end if;
end $$;
revoke all on function public.require_request_access(uuid,text) from public,anon,authenticated;

create function public.customer_request(p_id uuid,p_token text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.require_request_access(p_id,p_token);
  -- Explicit allow-list: no customer contact details, supplier, notes or failure reasons.
  select jsonb_build_object('id',m.id,'productId',m.selected_product_id,'productName',m.selected_product_name,
    'createdAt',m.created_at,'preferredTime',m.preferred_viewing_time,'stage',f.stage,
    'arrivalNotificationId',f.arrival_notification_id,
    'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n.published_at desc) from public.request_notifications n where n.request_id=m.id),'[]'::jsonb),
    'responses',coalesce((select jsonb_agg(to_jsonb(r)) from public.viewing_responses r where r.request_id=m.id),'[]'::jsonb)) into result
    from public.match_requests m join public.request_fulfillments f on f.request_id=m.id where m.id=p_id;
  return result;
end $$;
create function public.customer_read_notification(p_id uuid,p_token text,p_notification uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_request_access(p_id,p_token);
  update public.request_notifications set read_at=coalesce(read_at,now()) where id=p_notification and request_id=p_id;
end $$;
create function public.customer_reply(p_id uuid,p_token text,p_notification uuid,p_choice text,p_date date default null,p_note text default '') returns void language plpgsql security definer set search_path = '' as $$
declare f public.request_fulfillments%rowtype;
begin
  perform public.require_request_access(p_id,p_token);
  select * into f from public.request_fulfillments where request_id=p_id for update;
  if f.stage <> 'arrived' or f.arrival_notification_id is distinct from p_notification then raise exception 'stale_arrival'; end if;
  if p_choice is null or p_choice not in ('yes','reschedule','declined') or length(coalesce(p_note,''))>1000 then raise exception 'invalid_reply'; end if;
  if p_choice='yes' and f.viewing_deadline < (now() at time zone 'Asia/Taipei')::date then raise exception 'deadline_passed'; end if;
  if p_date is not null and p_date < (now() at time zone 'Asia/Taipei')::date then raise exception 'invalid_date'; end if;
  insert into public.viewing_responses(notification_id,request_id,choice,proposed_date,note)
    values(p_notification,p_id,p_choice,case when p_choice='reschedule' then p_date end,case when p_choice='reschedule' then btrim(coalesce(p_note,'')) else '' end)
    on conflict(notification_id) do update set choice=excluded.choice,proposed_date=excluded.proposed_date,note=excluded.note,updated_at=now();
end $$;
revoke all on function public.customer_request(uuid,text),public.customer_read_notification(uuid,text,uuid),public.customer_reply(uuid,text,uuid,text,date,text) from public;
grant execute on function public.customer_request(uuid,text),public.customer_read_notification(uuid,text,uuid),public.customer_reply(uuid,text,uuid,text,date,text) to anon,authenticated;

create function public.admin_requests(p_search text default '',p_stage text default '',p_region text default '',p_page integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_jewelfind_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  with rows as (
    select m.id,m.created_at,m.selected_product_name,m.viewing_region,m.preferred_viewing_time,
      c.name,c.phone,c.line_id,c.region,f.stage,f.version,
      (select r.choice from public.viewing_responses r where r.notification_id=f.arrival_notification_id) as reply
    from public.match_requests m join public.customers c on c.id=m.customer_id join public.request_fulfillments f on f.request_id=m.id
    where (coalesce(p_search,'')='' or c.name ilike '%'||left(p_search,100)||'%' or c.phone ilike '%'||left(p_search,100)||'%')
      and (coalesce(p_stage,'')='' or f.stage=p_stage)
      and (coalesce(p_region,'')='' or m.viewing_region ilike '%'||left(p_region,100)||'%')
  ) select jsonb_build_object('total',(select count(*) from rows),'items',coalesce((select jsonb_agg(to_jsonb(page)) from (select * from rows order by created_at desc,id limit 30 offset greatest(0,least(coalesce(p_page,0),100000))*30) page),'[]'::jsonb)) into result;
  return result;
end $$;
create function public.admin_request(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_jewelfind_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  return (select jsonb_build_object('request',to_jsonb(m)-'submission_key','customer',to_jsonb(c),'fulfillment',to_jsonb(f),
    'activity',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.request_activity a where a.request_id=m.id),'[]'::jsonb),
    'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n.published_at desc) from public.request_notifications n where n.request_id=m.id),'[]'::jsonb),
    'responses',coalesce((select jsonb_agg(to_jsonb(r) order by r.updated_at desc) from public.viewing_responses r where r.request_id=m.id),'[]'::jsonb))
    from public.match_requests m join public.customers c on c.id=m.customer_id join public.request_fulfillments f on f.request_id=m.id where m.id=p_id);
end $$;

create function public.admin_process_request(p_id uuid,p_version integer,p_stage text,p_fields jsonb default '{}',p_note text default '')
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
    if not ((f.stage='new' and p_stage='checking') or (f.stage='checking' and p_stage in ('transferring','unavailable'))
      or (f.stage='transferring' and p_stage in ('in_transit','unavailable')) or (f.stage='in_transit' and p_stage in ('arrived','unavailable'))
      or (f.stage in ('unavailable','arrived') and p_stage='checking')) then raise exception 'invalid_transition'; end if;
    f.stage := p_stage;
    if p_stage in ('transferring','in_transit') then
      f.partner_store := btrim(coalesce(p_fields->>'partner_store',f.partner_store));
      if length(f.partner_store) not between 1 and 200 then raise exception 'partner_required'; end if;
    end if;
    if p_stage='unavailable' then
      f.failure_code := p_fields->>'failure_code'; f.failure_detail := btrim(coalesce(p_fields->>'failure_detail',''));
      if f.failure_code is null or f.failure_code not in ('precious','store_unavailable','sold','not_transferable','no_partner','other') or length(f.failure_detail) not between 1 and 2000 then raise exception 'failure_reason_required'; end if;
      msg := '目前此商品暫時無法安排至您選擇的地點看貨，我們可以繼續協助您確認其他看貨地點或適合的商品。';
    elsif p_stage='in_transit' then
      msg := '您的商品已成功安排調貨，目前正在送往指定看貨地點。';
    elsif p_stage='arrived' then
      f.arrived_on := (p_fields->>'arrived_on')::date;
      f.viewing_deadline := coalesce((p_fields->>'viewing_deadline')::date,f.arrived_on+6);
      f.viewing_store := btrim(coalesce(p_fields->>'viewing_store','')); f.store_address := btrim(coalesce(p_fields->>'store_address',''));
      if f.arrived_on is null or f.arrived_on>(now() at time zone 'Asia/Taipei')::date or f.viewing_deadline<f.arrived_on or f.viewing_deadline>f.arrived_on+6 or length(f.viewing_store) not between 1 and 200 or length(f.store_address) not between 1 and 500 then raise exception 'arrival_fields_required'; end if;
      msg := '您想看的商品已送達指定店家，請於到貨後一週內前往看貨。';
      details := jsonb_build_object('store',f.viewing_store,'address',f.store_address,'arrivedOn',f.arrived_on,'deadline',f.viewing_deadline);
    elsif p_stage='checking' and old_stage in ('unavailable','arrived') then
      if btrim(coalesce(p_note,''))='' then raise exception 'rearrange_note_required'; end if;
      msg := '我們正在重新確認商品與看貨安排，請以後續最新到店通知為準。';
      f.arrival_notification_id := null; f.arrived_on := null; f.viewing_deadline := null;
    end if;
    if msg is not null then
      insert into public.request_notifications(request_id,kind,message,details) values(p_id,case when p_stage='checking' then 'rearranging' else p_stage end,msg,details) returning id into n;
      if p_stage='arrived' then f.arrival_notification_id := n; end if;
    end if;
  end if;
  update public.request_fulfillments set stage=f.stage,partner_store=f.partner_store,viewing_store=f.viewing_store,store_address=f.store_address,
    arrived_on=f.arrived_on,viewing_deadline=f.viewing_deadline,failure_code=f.failure_code,failure_detail=f.failure_detail,
    arrival_notification_id=f.arrival_notification_id,version=version+1,updated_at=now(),updated_by=auth.uid() where request_id=p_id;
  insert into public.request_activity(request_id,from_stage,to_stage,note,actor_id) values(p_id,old_stage,p_stage,
    btrim(coalesce(p_note,'')) || case when p_stage='unavailable' and old_stage<>p_stage then E'\n原因：'||f.failure_code||' / '||f.failure_detail else '' end,auth.uid());
end $$;
revoke all on function public.admin_requests(text,text,text,integer),public.admin_request(uuid),public.admin_process_request(uuid,integer,text,jsonb,text) from public,anon;
grant execute on function public.admin_requests(text,text,text,integer),public.admin_request(uuid),public.admin_process_request(uuid,integer,text,jsonb,text) to authenticated;
create policy reference_photos_admin_read on storage.objects for select to authenticated using(bucket_id='reference-photos' and public.is_jewelfind_admin());
commit;
