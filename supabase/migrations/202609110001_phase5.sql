begin;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  phone text not null unique check (phone ~ '^09[0-9]{8}$'),
  line_id text,
  region text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.match_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  purpose text not null,
  category text not null,
  material_preferences text[] not null default '{}',
  budget text not null,
  style text not null,
  reference_photo_url text,
  selected_product_id text not null,
  selected_product_name text not null,
  viewing_region text not null,
  preferred_viewing_time timestamptz not null,
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'contacted', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  -- Same logical submission is safe to retry after a lost HTTP response.
  submission_key uuid not null unique,
  submission_fingerprint jsonb not null,
  is_new_customer boolean not null
);
create index match_requests_customer_created_idx on public.match_requests(customer_id, created_at desc);

create function public.set_customer_updated_at() returns trigger language plpgsql
set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
create trigger customers_updated_at before update on public.customers
for each row execute function public.set_customer_updated_at();

alter table public.customers enable row level security;
alter table public.match_requests enable row level security;
-- No anonymous or authenticated read/write policies. A phone number is NOT login proof.
revoke all on public.customers, public.match_requests from anon, authenticated;
grant select, insert, update, delete on public.customers, public.match_requests to service_role;

create function public.submit_viewing_request(p_submission_key uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_customer_id uuid;
  v_new boolean := false;
  v_request public.match_requests%rowtype;
  v_phone text := p_payload->>'phone';
begin
  if v_phone is null or v_phone !~ '^09[0-9]{8}$' then raise exception 'invalid_phone'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_submission_key::text, 0));
  select * into v_request from public.match_requests where submission_key = p_submission_key;
  if found then
    if v_request.submission_fingerprint <> p_payload then raise exception 'submission_conflict'; end if;
  else
    -- Serialize same-phone submissions, including concurrent first-time visitors.
    perform pg_advisory_xact_lock(hashtextextended(v_phone, 1));
    select id into v_customer_id from public.customers where phone = v_phone;
    if v_customer_id is not null and (select count(*) from public.match_requests where customer_id = v_customer_id and created_at > now() - interval '1 minute') >= 5 then
      raise exception 'rate_limited';
    end if;
    if (p_payload->>'preferred_viewing_time')::timestamptz <= now() then raise exception 'invalid_time'; end if;
    if v_customer_id is null then
      insert into public.customers(name, phone, line_id, region)
      values (p_payload->>'name', v_phone, nullif(p_payload->>'line_id', ''), p_payload->>'region')
      on conflict (phone) do nothing returning id into v_customer_id;
      v_new := v_customer_id is not null;
      if not v_new then select id into v_customer_id from public.customers where phone = v_phone; end if;
    end if;
    if not v_new then
      update public.customers set name = p_payload->>'name',
        line_id = coalesce(nullif(p_payload->>'line_id', ''), line_id), region = p_payload->>'region'
      where id = v_customer_id;
    end if;
    insert into public.match_requests(customer_id, purpose, category, material_preferences, budget, style,
      reference_photo_url, selected_product_id, selected_product_name, viewing_region, preferred_viewing_time,
      submission_key, submission_fingerprint, is_new_customer)
    values (v_customer_id, p_payload->>'purpose', p_payload->>'category',
      array(select jsonb_array_elements_text(p_payload->'material_preferences')),
      p_payload->>'budget', p_payload->>'style', p_payload->>'reference_photo_url',
      p_payload->>'selected_product_id', p_payload->>'selected_product_name', p_payload->>'viewing_region',
      (p_payload->>'preferred_viewing_time')::timestamptz, p_submission_key, p_payload, v_new)
    returning * into v_request;
  end if;
  -- Never expose the customer row, phone, or previous requests to an unauthenticated caller.
  return jsonb_build_object('id', v_request.id, 'productId', v_request.selected_product_id,
    'preferredTime', v_request.preferred_viewing_time, 'createdAt', v_request.created_at,
    'status', v_request.status, 'isNewCustomer', v_request.is_new_customer);
end $$;
revoke all on function public.submit_viewing_request(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.submit_viewing_request(uuid, jsonb) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('reference-photos', 'reference-photos', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Admission control runs before file uploads. Global cap still applies if an IP header is forged.
create table public.viewing_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);
alter table public.viewing_rate_limits enable row level security;
revoke all on public.viewing_rate_limits from anon, authenticated;
create function public.allow_viewing_submission(p_key text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_hits integer; v_global integer;
begin
  delete from public.viewing_rate_limits where window_start < now() - interval '1 day';
  insert into public.viewing_rate_limits as limits(key, window_start, hits) values ('global', date_trunc('minute', now()), 1)
    on conflict (key) do update set window_start = excluded.window_start,
      hits = case when limits.window_start = excluded.window_start then limits.hits + 1 else 1 end
    returning hits into v_global;
  insert into public.viewing_rate_limits as limits(key, window_start, hits) values ('ip:' || p_key, date_trunc('minute', now()), 1)
    on conflict (key) do update set window_start = excluded.window_start,
      hits = case when limits.window_start = excluded.window_start then limits.hits + 1 else 1 end
    returning hits into v_hits;
  return v_global <= 120 and v_hits <= 10;
end $$;
revoke all on function public.allow_viewing_submission(text) from public, anon, authenticated;
grant execute on function public.allow_viewing_submission(text) to service_role;
commit;
