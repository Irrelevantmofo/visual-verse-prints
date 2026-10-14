-- Lets the app's server show who receives the platform fee and at what rate (e.g. on the order form).
-- Callable only with the service role: not by visitors or signed-in users through the API.
create or replace function public.platform_fee_terms()
returns table (fee_rate numeric, developer_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select c.fee_rate from private.platform_config c limit 1),
    (select string_agg(nullif(p.full_name, ''), ', ' order by d.created_at)
       from public.platform_developers d
       join public.profiles p on p.id = d.user_id);
$$;

revoke execute on function public.platform_fee_terms() from public, anon, authenticated;
grant execute on function public.platform_fee_terms() to service_role;
