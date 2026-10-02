-- Move RLS helper functions out of the API-exposed public schema so they aren't callable via /rest/v1/rpc.
-- Policies reference functions by OID, so they keep working after the move.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

alter function public.is_admin() set schema private;
alter function public.is_active_member() set schema private;

revoke execute on function private.is_admin() from public;
revoke execute on function private.is_active_member() from public;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.is_active_member() to anon, authenticated;

-- The leaderboard body referenced public.is_active_member(); point it at the new location.
create or replace function public.agent_leaderboard(p_from date, p_to date)
returns table (
  agent_id uuid,
  agent_name text,
  commission_earned numeric,
  sales_booked numeric,
  orders_count bigint,
  referrals_count bigint,
  rank bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with agents as (
    select id, full_name from public.profiles where role = 'agent' and active
  ),
  earned as (
    select o.agent_id, sum(round(pa.amount * o.commission_rate, 2)) as commission
      from public.payments pa
      join public.orders o on o.id = pa.order_id
     where pa.paid_on between p_from and p_to and o.order_status <> 'cancelled'
     group by o.agent_id
  ),
  booked as (
    select agent_id, sum(total_amount) as sales, count(*) as n
      from public.orders
     where order_date between p_from and p_to and order_status <> 'cancelled'
     group by agent_id
  ),
  refs as (
    select agent_id, count(*) as n
      from public.referrals
     where (created_at at time zone 'Asia/Manila')::date between p_from and p_to
       and status <> 'rejected'
     group by agent_id
  )
  select
    a.id,
    a.full_name,
    coalesce(e.commission, 0),
    coalesce(b.sales, 0),
    coalesce(b.n, 0),
    coalesce(r.n, 0),
    rank() over (order by coalesce(e.commission, 0) desc, coalesce(b.sales, 0) desc)
  from agents a
  left join earned e on e.agent_id = a.id
  left join booked b on b.agent_id = a.id
  left join refs r on r.agent_id = a.id
  where (select private.is_active_member())
  order by 7, 2;
$$;

revoke execute on function public.agent_leaderboard(date, date) from public, anon;
grant execute on function public.agent_leaderboard(date, date) to authenticated;
