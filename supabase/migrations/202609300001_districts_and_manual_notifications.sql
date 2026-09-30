begin;

-- Retain city-level regions for historical/older clients; add all 41 districts.
insert into public.service_regions(name) values
('台北市中正區'),
('台北市大同區'),
('台北市中山區'),
('台北市松山區'),
('台北市大安區'),
('台北市萬華區'),
('台北市信義區'),
('台北市士林區'),
('台北市北投區'),
('台北市內湖區'),
('台北市南港區'),
('台北市文山區'),
('新北市板橋區'),
('新北市三重區'),
('新北市中和區'),
('新北市永和區'),
('新北市新莊區'),
('新北市新店區'),
('新北市土城區'),
('新北市蘆洲區'),
('新北市樹林區'),
('新北市汐止區'),
('新北市鶯歌區'),
('新北市三峽區'),
('新北市淡水區'),
('新北市瑞芳區'),
('新北市五股區'),
('新北市泰山區'),
('新北市林口區'),
('新北市深坑區'),
('新北市石碇區'),
('新北市坪林區'),
('新北市三芝區'),
('新北市石門區'),
('新北市八里區'),
('新北市平溪區'),
('新北市雙溪區'),
('新北市貢寮區'),
('新北市金山區'),
('新北市萬里區'),
('新北市烏來區')
on conflict (name) do nothing;

alter table public.request_notifications drop constraint request_notifications_kind_check;
alter table public.request_notifications add constraint request_notifications_kind_check
  check (kind in ('in_transit','unavailable','arrived','rearranging','update'));

create function public.admin_publish_notification(p_id uuid, p_version integer, p_message text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare f public.request_fulfillments%rowtype; n uuid;
begin
  if not public.is_jewelfind_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if length(btrim(coalesce(p_message,''))) not between 1 and 1000 then raise exception 'notification_message_required'; end if;
  select * into f from public.request_fulfillments where request_id=p_id for update;
  if not found then raise exception 'not_found'; end if;
  if f.version is distinct from p_version then raise exception 'version_conflict'; end if;
  insert into public.request_notifications(request_id,kind,message)
    values(p_id,'update',btrim(p_message)) returning id into n;
  insert into public.request_activity(request_id,from_stage,to_stage,note,actor_id)
    values(p_id,f.stage,f.stage,'已發佈 App 通知：' || btrim(p_message),auth.uid());
  return n;
end $$;
revoke all on function public.admin_publish_notification(uuid,integer,text) from public,anon;
grant execute on function public.admin_publish_notification(uuid,integer,text) to authenticated;

commit;
