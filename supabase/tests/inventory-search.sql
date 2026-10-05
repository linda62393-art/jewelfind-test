-- Synthetic fixtures only. The entire script rolls back.
begin;
insert into public.product_inventory(sku,model,product_name,consignment_store,source_status,stock,source_file)
select 'JFTEST' || n || '-PD837-X', 'PD837-X', '測試商品', '測試店家' || n, case when n=1 then '售出' else '寄店家' end, n, 'synthetic.xlsx'
from generate_series(1,8) n;
insert into public.product_inventory(sku,model,product_name,consignment_store,source_status,stock,source_file)
values ('JFTEST9-NO-SHOP','NO-SHOP','測試商品','','',null,'synthetic.xlsx');
select set_config('request.jwt.claim.sub',(select user_id::text from public.admin_users limit 1),true);
set local role authenticated;
do $$
declare a jsonb; b jsonb;
begin
  a := public.admin_inventory_search('JFTEST',0);
  b := public.admin_inventory_search('JFTEST',1);
  if (a->>'total')::int <> 9 or jsonb_array_length(a->'items') <> 6 or jsonb_array_length(b->'items') <> 3 then raise exception 'pagination_failed'; end if;
  if exists(select 1 from jsonb_array_elements(a->'items') x join jsonb_array_elements(b->'items') y on x->>'sku'=y->>'sku') then raise exception 'duplicate_page'; end if;
  a := public.admin_inventory_search(' pd-837-x ',0);
  if (a->>'total')::int < 8 or a->'items'->0->>'model' <> 'PD837-X' then raise exception 'model_lookup_failed'; end if;
  a := public.admin_inventory_search('jftest1-pd837-x',0);
  if (a->>'total')::int <> 1 or a->'items'->0->>'source_status' <> '售出' or a->'items'->0->>'sku' <> 'JFTEST1-PD837-X' then raise exception 'exact_sku_failed'; end if;
  a := public.admin_inventory_search('JFTEST9',0);
  if a->'items'->0->>'consignment_store' <> '' or a->'items'->0->'stock' <> 'null'::jsonb then raise exception 'missing_store_failed'; end if;
  if (public.admin_inventory_search('no-such-jftest',0)->>'total')::int <> 0 then raise exception 'empty_result_failed'; end if;
  begin perform public.admin_inventory_search('',-1); raise exception 'negative_page_allowed'; exception when others then if sqlerrm <> 'invalid_inventory_search' then raise; end if; end;
  begin insert into public.product_inventory(sku,model,source_file) values('JFTESTWRITE','WRITE','synthetic.xlsx'); raise exception 'admin_write_allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.product_inventory) then raise exception 'nonadmin_rows_exposed'; end if;
  begin perform public.admin_inventory_search('PD837',0); raise exception 'nonadmin_lookup_allowed'; exception when others then if sqlerrm <> 'admin_required' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
  begin perform public.admin_inventory_search('',0); raise exception 'anon_rpc_allowed'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.product_inventory; raise exception 'anon_table_allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
