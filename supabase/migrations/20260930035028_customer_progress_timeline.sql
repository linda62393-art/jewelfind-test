begin;
-- Keep every progress event within the same request. Never expose activity.note.
create function public.customer_request_v7(p_id uuid,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; timeline jsonb;
begin
  result:=public.customer_request(p_id,p_token);
  select coalesce(jsonb_agg(to_jsonb(e) order by e.occurred_at desc,e.id desc),'[]'::jsonb) into timeline from (
    select n.id::text,n.kind,n.published_at occurred_at,n.message from public.request_notifications n where n.request_id=p_id
    union all
    select a.id::text,a.to_stage kind,a.created_at occurred_at,
      case a.to_stage when 'checking' then '正在確認商品與合作店家。' when 'transferring' then '已進入調貨處理，正在確認店家安排。' end message
      from public.request_activity a where a.request_id=p_id and a.from_stage<>a.to_stage and a.to_stage in ('checking','transferring')
        and not (a.to_stage='checking' and a.from_stage in ('unavailable','arrived'))
  ) e;
  return result||jsonb_build_object('timeline',timeline);
end $$;
revoke all on function public.customer_request_v7(uuid,text) from public;
grant execute on function public.customer_request_v7(uuid,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
