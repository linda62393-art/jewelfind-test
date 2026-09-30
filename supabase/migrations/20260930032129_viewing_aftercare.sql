begin;
create table public.viewing_feedback (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references public.match_requests(id),
  viewed_on date not null, outcome text not null check(outcome in ('purchased','not_purchased','considering','more_options')),
  reasons text[] not null default '{}', budget_min bigint, budget_max bigint,
  contact_preference text not null check(contact_preference in ('recommend','revisit','later','none')),
  wanted_product text not null default '' check(length(wanted_product)<=200),
  note text not null default '' check(length(note)<=2000), source text not null check(source in ('customer','admin')),
  actor_id uuid references auth.users(id), created_at timestamptz not null default clock_timestamp(),
  check(reasons <@ array['style','over_budget','service','unclear','other']::text[]),
  check(budget_min between 0 and 100000000), check(budget_max between 0 and 100000000), check(budget_min<=budget_max)
);
create index viewing_feedback_request_idx on public.viewing_feedback(request_id,created_at desc,id desc);
create table public.request_followups (
  request_id uuid primary key references public.match_requests(id), status text not null default 'pending' check(status in ('awaiting_feedback','pending','contacted','closed')),
  next_contact_on date, version integer not null default 0, updated_at timestamptz not null default clock_timestamp(),
  check(status<>'closed' or next_contact_on is null)
);
create index request_followups_due_idx on public.request_followups(next_contact_on) where status<>'closed';
create table public.request_followup_events (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references public.match_requests(id),
  status text not null, next_contact_on date, note text not null check(length(note) between 1 and 2000),
  actor_id uuid references auth.users(id), created_at timestamptz not null default clock_timestamp()
);
create index request_followup_events_request_idx on public.request_followup_events(request_id,created_at desc);
create table public.request_admin_meta (
  request_id uuid primary key references public.match_requests(id), is_test boolean not null default false,
  display_label text not null default '' check(length(display_label)<=100), archived boolean not null default false,
  version integer not null default 0, check(not archived or is_test)
);
alter table public.viewing_feedback enable row level security;
alter table public.request_followups enable row level security;
alter table public.request_followup_events enable row level security;
alter table public.request_admin_meta enable row level security;
revoke all on public.viewing_feedback,public.request_followups,public.request_followup_events,public.request_admin_meta from anon,authenticated;
grant all on public.viewing_feedback,public.request_followups,public.request_followup_events,public.request_admin_meta to service_role;

-- Internal writers are callable only through the capability-checked wrappers below.
create function public.write_viewing_feedback(p_id uuid,p_expected uuid,p_fields jsonb,p_source text) returns void language plpgsql security definer set search_path='' as $$
declare latest uuid; d date; outcome text; rs text[]; lo bigint; hi bigint; pref text; note text; wanted text;
begin
  perform 1 from public.match_requests where id=p_id for update;
  if not found then raise exception 'not_found'; end if;
  if not exists(select 1 from public.request_notifications where request_id=p_id and kind='arrived') then raise exception 'feedback_not_ready'; end if;
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
revoke all on function public.write_viewing_feedback(uuid,uuid,jsonb,text) from public,anon,authenticated;
create function public.customer_save_feedback(p_id uuid,p_token text,p_expected uuid,p_fields jsonb) returns void language plpgsql security definer set search_path='' as $$
begin perform public.require_request_access(p_id,p_token); perform public.write_viewing_feedback(p_id,p_expected,p_fields,'customer'); end $$;
create function public.admin_save_feedback(p_id uuid,p_expected uuid,p_fields jsonb) returns void language plpgsql security definer set search_path='' as $$
begin if not public.is_jewelfind_admin() then raise exception 'admin_required' using errcode='42501'; end if; perform public.write_viewing_feedback(p_id,p_expected,p_fields,'admin'); end $$;
create function public.customer_aftercare(p_id uuid,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform public.require_request_access(p_id,p_token);
  return jsonb_build_object('eligible',exists(select 1 from public.request_notifications where request_id=p_id and kind='arrived'),
    'feedback',(select to_jsonb(v)-'actor_id'-'request_id' from public.viewing_feedback v where request_id=p_id order by created_at desc,id desc limit 1));
end $$;
create function public.admin_aftercare(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.is_jewelfind_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  return jsonb_build_object('eligible',exists(select 1 from public.request_notifications where request_id=p_id and kind='arrived'),
    'feedback',(select to_jsonb(v) from public.viewing_feedback v where request_id=p_id order by created_at desc,id desc limit 1),
    'history',coalesce((select jsonb_agg(to_jsonb(v) order by created_at desc,id desc) from public.viewing_feedback v where request_id=p_id),'[]'::jsonb),
    'followup',(select to_jsonb(f) from public.request_followups f where request_id=p_id),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by created_at desc,id desc) from public.request_followup_events e where request_id=p_id),'[]'::jsonb));
end $$;
create function public.admin_invite_feedback(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_jewelfind_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  perform 1 from public.match_requests where id=p_id for update;
  if not exists(select 1 from public.request_notifications where request_id=p_id and kind='arrived') then raise exception 'feedback_not_ready'; end if;
  if exists(select 1 from public.request_notifications where request_id=p_id and details->>'purpose'='viewing_feedback' and published_at>now()-interval '1 day') then return; end if;
  insert into public.request_notifications(request_id,kind,message,details) values(p_id,'update','看貨後歡迎在本需求頁填寫「看貨後回饋」，告訴我們是否購買、預算及希望的後續協助。','{"purpose":"viewing_feedback"}');
  insert into public.request_followups(request_id,status) values(p_id,'awaiting_feedback') on conflict do nothing;
  insert into public.request_followup_events(request_id,status,note,actor_id) select p_id,status,'已發佈 App 看貨後回饋邀請。',auth.uid() from public.request_followups where request_id=p_id;
end $$;
create function public.admin_save_followup(p_id uuid,p_version integer,p_status text,p_next date,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare v integer;
begin
  if not public.is_jewelfind_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  perform 1 from public.match_requests where id=p_id for update;
  if not found then raise exception 'not_found'; end if;
  select version into v from public.request_followups where request_id=p_id;
  if coalesce(v,-1) is distinct from p_version then raise exception 'version_conflict'; end if;
  if p_status is null or p_status not in ('awaiting_feedback','pending','contacted','closed') or length(btrim(coalesce(p_note,''))) not between 1 and 2000
    or (p_status<>'closed' and p_next<(now() at time zone 'Asia/Taipei')::date) then raise exception 'invalid_followup'; end if;
  if p_status='closed' then p_next:=null; end if;
  if p_next is not null and (select contact_preference from public.viewing_feedback where request_id=p_id order by created_at desc,id desc limit 1)='none' then raise exception 'invalid_followup'; end if;
  insert into public.request_followups(request_id,status,next_contact_on) values(p_id,p_status,p_next)
    on conflict(request_id) do update set status=excluded.status,next_contact_on=excluded.next_contact_on,version=public.request_followups.version+1,updated_at=clock_timestamp();
  insert into public.request_followup_events(request_id,status,next_contact_on,note,actor_id) values(p_id,p_status,p_next,btrim(p_note),auth.uid());
end $$;
create function public.admin_followup_queue(p_filter text default 'due',p_page integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.is_jewelfind_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  with rows as (
    select m.id,c.name,m.selected_product_name product,f.status,f.next_contact_on,v.outcome,v.contact_preference
    from public.request_followups f join public.match_requests m on m.id=f.request_id join public.customers c on c.id=m.customer_id
    left join public.request_admin_meta a on a.request_id=m.id
    left join lateral (select outcome,contact_preference from public.viewing_feedback where request_id=m.id order by created_at desc,id desc limit 1) v on true
    where not coalesce(a.archived,false) and ((p_filter='due' and f.status<>'closed' and f.next_contact_on<=(now() at time zone 'Asia/Taipei')::date)
      or (p_filter='open' and f.status<>'closed') or f.status=p_filter)
  ) select jsonb_build_object('total',(select count(*) from rows),'items',coalesce((select jsonb_agg(to_jsonb(page)) from (select * from rows order by next_contact_on nulls last,id limit 30 offset greatest(0,least(coalesce(p_page,0),100000))*30) page),'[]'::jsonb)) into result;
  return result;
end $$;
create function public.admin_request_meta(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.is_jewelfind_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  return coalesce((select to_jsonb(a) from public.request_admin_meta a where request_id=p_id),'{"is_test":false,"display_label":"","archived":false,"version":-1}'::jsonb);
end $$;
create function public.admin_save_request_meta(p_id uuid,p_version integer,p_is_test boolean,p_label text,p_archived boolean) returns void language plpgsql security definer set search_path='' as $$
declare v integer; fstage text;
begin
  if not public.is_jewelfind_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  perform 1 from public.match_requests where id=p_id for update;
  if not found then raise exception 'not_found'; end if;
  select version into v from public.request_admin_meta where request_id=p_id;
  if coalesce(v,-1) is distinct from p_version then raise exception 'version_conflict'; end if;
  if p_is_test is null or p_archived is null or p_label is null or length(p_label)>100 or (p_archived and not p_is_test) then raise exception 'invalid_request_meta'; end if;
  insert into public.request_admin_meta(request_id,is_test,display_label,archived) values(p_id,p_is_test,btrim(p_label),p_archived)
    on conflict(request_id) do update set is_test=excluded.is_test,display_label=excluded.display_label,archived=excluded.archived,version=public.request_admin_meta.version+1;
  select stage into fstage from public.request_fulfillments where request_id=p_id;
  insert into public.request_activity(request_id,from_stage,to_stage,note,actor_id) values(p_id,fstage,fstage,
    case when p_archived then '刪除測試需求（可復原）' else '更新需求標記／復原：'||btrim(p_label) end,auth.uid());
end $$;
create function public.admin_requests_v7(p_search text default '',p_stage text default '',p_region text default '',p_page integer default 0,p_archived boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.is_jewelfind_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  with rows as (
    select m.id,m.created_at,m.selected_product_name,m.viewing_region,c.name,c.phone,c.line_id,c.region,f.stage,
      coalesce(a.is_test,false) is_test,coalesce(a.display_label,'') display_label,
      (select r.choice from public.viewing_responses r where r.notification_id=f.arrival_notification_id) reply
    from public.match_requests m join public.customers c on c.id=m.customer_id join public.request_fulfillments f on f.request_id=m.id left join public.request_admin_meta a on a.request_id=m.id
    where coalesce(a.archived,false)=coalesce(p_archived,false)
      and (coalesce(p_search,'')='' or c.name ilike '%'||left(p_search,100)||'%' or c.phone ilike '%'||left(p_search,100)||'%' or a.display_label ilike '%'||left(p_search,100)||'%')
      and (coalesce(p_stage,'')='' or f.stage=p_stage) and (coalesce(p_region,'')='' or m.viewing_region ilike '%'||left(p_region,100)||'%')
  ) select jsonb_build_object('total',(select count(*) from rows),'items',coalesce((select jsonb_agg(to_jsonb(page)) from (select * from rows order by created_at desc,id limit 30 offset greatest(0,least(coalesce(p_page,0),100000))*30) page),'[]'::jsonb)) into result;
  return result;
end $$;
revoke all on function public.customer_aftercare(uuid,text),public.customer_save_feedback(uuid,text,uuid,jsonb) from public;
grant execute on function public.customer_aftercare(uuid,text),public.customer_save_feedback(uuid,text,uuid,jsonb) to anon,authenticated;
revoke all on function public.admin_aftercare(uuid),public.admin_save_feedback(uuid,uuid,jsonb),public.admin_invite_feedback(uuid),public.admin_save_followup(uuid,integer,text,date,text),public.admin_followup_queue(text,integer),public.admin_request_meta(uuid),public.admin_save_request_meta(uuid,integer,boolean,text,boolean),public.admin_requests_v7(text,text,text,integer,boolean) from public,anon;
grant execute on function public.admin_aftercare(uuid),public.admin_save_feedback(uuid,uuid,jsonb),public.admin_invite_feedback(uuid),public.admin_save_followup(uuid,integer,text,date,text),public.admin_followup_queue(text,integer),public.admin_request_meta(uuid),public.admin_save_request_meta(uuid,integer,boolean,text,boolean),public.admin_requests_v7(text,text,text,integer,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
