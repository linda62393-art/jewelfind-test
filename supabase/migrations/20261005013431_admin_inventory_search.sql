begin;

-- Private store assignments are imported separately, never committed to GitHub.
create table public.product_inventory (
  sku text primary key check (length(sku) between 1 and 200),
  model text not null check (length(model) between 1 and 200),
  product_name text not null default '',
  consignment_store text not null default '',
  source_status text not null default '',
  stock numeric,
  source_file text not null,
  imported_at timestamptz not null default now()
);
alter table public.product_inventory enable row level security;
revoke all on public.product_inventory from public, anon, authenticated;
grant select on public.product_inventory to authenticated;
grant all on public.product_inventory to service_role;
create policy product_inventory_admin_read on public.product_inventory
  for select to authenticated using ((select public.is_jewelfind_admin()));

create function public.admin_inventory_search(p_search text default '', p_page integer default 0)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  q text := lower(btrim(coalesce(p_search, '')));
  compact text;
  result jsonb;
begin
  if auth.uid() is null or not public.is_jewelfind_admin() then raise exception 'admin_required'; end if;
  if length(q) > 100 or p_page is null or p_page < 0 or p_page > 100000 then raise exception 'invalid_inventory_search'; end if;
  compact := regexp_replace(q, '[^a-z0-9]', '', 'g');
  with matched as materialized (
    select i.*, regexp_replace(lower(i.sku), '[^a-z0-9]', '', 'g') as sku_key,
      regexp_replace(lower(i.model), '[^a-z0-9]', '', 'g') as model_key
    from public.product_inventory i
    where q = '' or strpos(lower(i.sku), q) > 0 or strpos(lower(i.model), q) > 0
      or (compact <> '' and (strpos(regexp_replace(lower(i.sku), '[^a-z0-9]', '', 'g'), compact) > 0
        or strpos(regexp_replace(lower(i.model), '[^a-z0-9]', '', 'g'), compact) > 0))
  ), page as (
    select *, case when compact <> '' and sku_key = compact then 0 when compact <> '' and model_key = compact then 1 else 2 end as rank
    from matched order by rank, model, sku limit 6 offset p_page * 6
  )
  select jsonb_build_object(
    'total', (select count(*) from matched),
    'items', coalesce((select jsonb_agg(jsonb_build_object('sku', sku, 'model', model, 'product_name', product_name,
      'consignment_store', consignment_store, 'source_status', source_status, 'stock', stock) order by rank, model, sku) from page), '[]'::jsonb),
    'imported_at', (select max(imported_at) from public.product_inventory),
    'source_file', (select source_file from public.product_inventory order by imported_at desc, sku limit 1)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_inventory_search(text, integer) from public, anon, authenticated;
grant execute on function public.admin_inventory_search(text, integer) to authenticated;

commit;
