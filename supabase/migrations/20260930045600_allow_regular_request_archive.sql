begin;
-- Admin-only archive RPC supports reversible organization of real requests too.
-- Keep the legacy test deletion RPC's explicit test-only guard.
alter table public.request_admin_meta drop constraint request_admin_meta_check;
commit;
