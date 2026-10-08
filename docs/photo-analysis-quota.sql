-- Server-only, durable reservations. Count attempts before contacting the paid API.
create table public.photo_analysis_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  monthly_limit integer not null default 1000 check (monthly_limit between 1 and 1000),
  daily_limit integer not null default 100 check (daily_limit between 1 and 100),
  client_daily_limit integer not null default 5 check (client_daily_limit between 1 and 10)
);
insert into public.photo_analysis_settings(singleton) values (true);
create table public.photo_analysis_attempts (
  id uuid primary key default gen_random_uuid(),
  client_hash text not null check (client_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index photo_analysis_attempts_created on public.photo_analysis_attempts(created_at);
create index photo_analysis_attempts_client_created on public.photo_analysis_attempts(client_hash, created_at);
alter table public.photo_analysis_settings enable row level security;
alter table public.photo_analysis_attempts enable row level security;
revoke all on public.photo_analysis_settings, public.photo_analysis_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.photo_analysis_settings, public.photo_analysis_attempts to service_role;

create function public.reserve_photo_analysis(p_client_hash text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  limits public.photo_analysis_settings%rowtype;
  local_now timestamp := now() at time zone 'Asia/Taipei';
  day_start timestamptz := date_trunc('day', local_now) at time zone 'Asia/Taipei';
  month_start timestamptz := date_trunc('month', local_now) at time zone 'Asia/Taipei';
begin
  if p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_client');
  end if;
  perform pg_advisory_xact_lock(748310265);
  select * into limits from public.photo_analysis_settings where singleton;
  if not found or not limits.enabled then
    return jsonb_build_object('allowed', false, 'reason', 'disabled');
  end if;
  if (select count(*) from public.photo_analysis_attempts where created_at >= month_start) >= limits.monthly_limit
     or (select count(*) from public.photo_analysis_attempts where created_at >= day_start) >= limits.daily_limit
     or (select count(*) from public.photo_analysis_attempts where client_hash = p_client_hash and created_at >= day_start) >= limits.client_daily_limit
     or exists(select 1 from public.photo_analysis_attempts where client_hash = p_client_hash and created_at > now() - interval '20 seconds') then
    return jsonb_build_object('allowed', false, 'reason', 'quota');
  end if;
  delete from public.photo_analysis_attempts where created_at < now() - interval '35 days';
  insert into public.photo_analysis_attempts(client_hash) values (p_client_hash);
  return jsonb_build_object('allowed', true);
end;
$$;
revoke all on function public.reserve_photo_analysis(text) from public, anon, authenticated;
grant execute on function public.reserve_photo_analysis(text) to service_role;
