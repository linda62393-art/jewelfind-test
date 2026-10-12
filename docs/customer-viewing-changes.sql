-- Capability-authorized changes. Original submitted preferences remain unchanged.
alter table public.request_fulfillments
  add column customer_reschedule_count integer not null default 0 check (customer_reschedule_count between 0 and 2),
  add column customer_requested_time timestamptz,
  add column customer_change_pending boolean not null default false,
  add column last_customer_change_id uuid,
  add column last_customer_change_payload jsonb;
create schema if not exists jewelfind_private;
revoke all on schema jewelfind_private from public;
grant usage on schema jewelfind_private to anon, authenticated;

create function jewelfind_private.customer_request_v8(p_id uuid,p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f public.request_fulfillments%rowtype;
begin
  perform public.require_request_access(p_id,p_token);
  select * into f from public.request_fulfillments where request_id=p_id for share;
  if not found then raise exception 'not_found'; end if;
  return public.customer_request_v7(p_id,p_token) || jsonb_build_object('appointment',jsonb_build_object(
    'version',f.version,'rescheduleCount',f.customer_reschedule_count,'limit',2,
    'requestedTime',f.customer_requested_time,'pending',f.customer_change_pending,
    'canChange',f.stage in ('new','checking','notified','transferring','in_transit','arrived')));
end $$;

create function jewelfind_private.customer_change_viewing(p_id uuid,p_token text,p_version integer,p_action_id uuid,p_action text,p_time timestamptz default null) returns void
language plpgsql security definer set search_path='' as $$
declare f public.request_fulfillments%rowtype; original_time timestamptz; local_time timestamp; message text; payload jsonb;
begin
  perform public.require_request_access(p_id,p_token);
  if p_action_id is null or p_action is null or p_action not in ('cancel','reschedule') then raise exception 'invalid_appointment_action'; end if;
  if p_action='cancel' and p_time is not null then raise exception 'invalid_appointment_action'; end if;
  payload:=jsonb_build_object('action',p_action,'time',p_time);
  select * into f from public.request_fulfillments where request_id=p_id for update;
  if not found then raise exception 'not_found'; end if;
  if f.last_customer_change_id=p_action_id then
    if f.last_customer_change_payload is distinct from payload then raise exception 'appointment_retry_conflict'; end if;
    return;
  end if;
  if f.version is distinct from p_version then raise exception 'appointment_conflict'; end if;
  if f.stage not in ('new','checking','notified','transferring','in_transit','arrived') then raise exception 'appointment_closed'; end if;
  select preferred_viewing_time into original_time from public.match_requests where id=p_id;
  if p_action='reschedule' then
    if f.customer_reschedule_count>=2 then raise exception 'reschedule_limit'; end if;
    local_time:=p_time at time zone 'Asia/Taipei';
    if p_time is null or p_time<=now() or extract(hour from local_time) not between 9 and 23
      or extract(minute from local_time) not in (0,30) or extract(second from local_time)<>0 then raise exception 'invalid_viewing_time'; end if;
    if p_time=coalesce(f.customer_requested_time,original_time) then raise exception 'appointment_unchanged'; end if;
    message:='您已提出第'||(f.customer_reschedule_count+1)||'次改約，希望時間為'||to_char(local_time,'YYYY/MM/DD HH24:MI')||'（台灣時間）。待店家確認後通知，尚未完成新預約。';
    update public.request_fulfillments set customer_reschedule_count=customer_reschedule_count+1,
      customer_requested_time=p_time,customer_change_pending=true,
      version=version+1,updated_at=now(),updated_by=null,last_customer_change_id=p_action_id,last_customer_change_payload=payload where request_id=p_id;
  else
    message:='您已取消本次看貨需求，我們會停止後續預約安排；如商品已調出，將由管理員協調後續處理。';
    update public.request_fulfillments set stage='cancelled',arrival_notification_id=null,arrived_on=null,viewing_deadline=null,
      customer_change_pending=false,version=version+1,updated_at=now(),updated_by=null,
      last_customer_change_id=p_action_id,last_customer_change_payload=payload where request_id=p_id;
  end if;
  insert into public.request_notifications(request_id,kind,message,details) values(p_id,'update',message,
    jsonb_build_object('action',p_action,'source','customer','previousTime',coalesce(f.customer_requested_time,original_time),'requestedTime',p_time));
  insert into public.request_activity(request_id,from_stage,to_stage,note,actor_id)
    values(p_id,f.stage,case when p_action='cancel' then 'cancelled' else f.stage end,'客戶操作：'||message,null);
end $$;

create function jewelfind_private.admin_confirm_viewing_change(p_id uuid,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare f public.request_fulfillments%rowtype; message text;
begin
  if not public.is_jewelfind_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  select * into f from public.request_fulfillments where request_id=p_id for update;
  if not found then raise exception 'not_found'; end if;
  if f.version is distinct from p_version then raise exception 'appointment_conflict'; end if;
  if not f.customer_change_pending or f.stage not in ('new','checking','notified','transferring','in_transit','arrived') then raise exception 'appointment_closed'; end if;
  if f.customer_requested_time is null or f.customer_requested_time<=now() then raise exception 'invalid_viewing_time'; end if;
  if f.stage='arrived' and (f.customer_requested_time at time zone 'Asia/Taipei')::date>f.viewing_deadline then raise exception 'appointment_deadline'; end if;
  message:='已確認新的希望看貨時間：'||to_char(f.customer_requested_time at time zone 'Asia/Taipei','YYYY/MM/DD HH24:MI')||'（台灣時間）。實際到店安排請以最新商品到店通知為準。';
  update public.request_fulfillments set customer_change_pending=false,version=version+1,updated_at=now(),updated_by=auth.uid() where request_id=p_id;
  insert into public.request_notifications(request_id,kind,message,details) values(p_id,'update',message,jsonb_build_object('source','admin','action','confirm_time','requestedTime',f.customer_requested_time));
  insert into public.request_activity(request_id,from_stage,to_stage,note,actor_id) values(p_id,f.stage,f.stage,message,auth.uid());
end $$;

-- Legacy yes/reschedule/declined API cannot bypass the counted appointment actions.
create function jewelfind_private.customer_reply(p_id uuid,p_token text,p_notification uuid,p_choice text,p_date date default null,p_note text default '') returns void
language plpgsql security definer set search_path='' as $$
declare f public.request_fulfillments%rowtype;
begin
  perform public.require_request_access(p_id,p_token);
  select * into f from public.request_fulfillments where request_id=p_id for update;
  if f.stage<>'arrived' or f.arrival_notification_id is distinct from p_notification then raise exception 'stale_arrival'; end if;
  if p_choice is distinct from 'yes' then raise exception 'appointment_action_required'; end if;
  if f.customer_change_pending then raise exception 'appointment_pending'; end if;
  if f.viewing_deadline < (now() at time zone 'Asia/Taipei')::date then raise exception 'deadline_passed'; end if;
  insert into public.viewing_responses(notification_id,request_id,choice,proposed_date,note) values(p_notification,p_id,'yes',null,'')
    on conflict(notification_id) do update set choice='yes',proposed_date=null,note='',updated_at=now();
end $$;

revoke all on function jewelfind_private.customer_request_v8(uuid,text),jewelfind_private.customer_change_viewing(uuid,text,integer,uuid,text,timestamptz),jewelfind_private.customer_reply(uuid,text,uuid,text,date,text) from public;
grant execute on function jewelfind_private.customer_request_v8(uuid,text),jewelfind_private.customer_change_viewing(uuid,text,integer,uuid,text,timestamptz),jewelfind_private.customer_reply(uuid,text,uuid,text,date,text) to anon,authenticated;
revoke all on function jewelfind_private.admin_confirm_viewing_change(uuid,integer) from public,anon;
grant execute on function jewelfind_private.admin_confirm_viewing_change(uuid,integer) to authenticated;
create function public.customer_request_v8(p_id uuid,p_token text) returns jsonb language sql security invoker set search_path='' as $$select jewelfind_private.customer_request_v8(p_id,p_token);$$;
create function public.customer_change_viewing(p_id uuid,p_token text,p_version integer,p_action_id uuid,p_action text,p_time timestamptz default null) returns void language sql security invoker set search_path='' as $$select jewelfind_private.customer_change_viewing(p_id,p_token,p_version,p_action_id,p_action,p_time);$$;
create function public.admin_confirm_viewing_change(p_id uuid,p_version integer) returns void language sql security invoker set search_path='' as $$select jewelfind_private.admin_confirm_viewing_change(p_id,p_version);$$;
create or replace function public.customer_reply(p_id uuid,p_token text,p_notification uuid,p_choice text,p_date date default null,p_note text default '') returns void language sql security invoker set search_path='' as $$select jewelfind_private.customer_reply(p_id,p_token,p_notification,p_choice,p_date,p_note);$$;
revoke all on function public.customer_request_v8(uuid,text),public.customer_change_viewing(uuid,text,integer,uuid,text,timestamptz),public.customer_reply(uuid,text,uuid,text,date,text) from public;
grant execute on function public.customer_request_v8(uuid,text),public.customer_change_viewing(uuid,text,integer,uuid,text,timestamptz),public.customer_reply(uuid,text,uuid,text,date,text) to anon,authenticated;
revoke all on function public.admin_confirm_viewing_change(uuid,integer) from public,anon;
grant execute on function public.admin_confirm_viewing_change(uuid,integer) to authenticated;
notify pgrst,'reload schema';
