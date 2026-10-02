-- Commission is set per order line, because each product has a different margin.
--   line rate default: product.commission_rate → agent's profiles.commission_rate → settings.default_commission_rate
--   orders.commission_total = Σ(line amount × line rate), 0 when the order has no agent
--   commission earned = commission_total × (paid / total), so it accrues as the client pays

-- ── Columns ──
alter table public.products
  add column commission_rate numeric(5, 4) check (commission_rate between 0 and 1);

alter table public.order_items
  add column commission_rate numeric(5, 4) check (commission_rate between 0 and 1);

alter table public.orders
  add column commission_total numeric(12, 2) not null default 0 check (commission_total >= 0);

-- Backfill existing lines from the old per-order snapshot
update public.order_items oi
   set commission_rate = o.commission_rate
  from public.orders o
 where o.id = oi.order_id;

alter table public.order_items alter column commission_rate set not null;

-- ── Line rate default ──
create or replace function public.order_items_commission_default()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.commission_rate is null then
    new.commission_rate := coalesce(
      (select p.commission_rate from public.products p where p.id = new.product_id),
      (select pr.commission_rate from public.orders o join public.profiles pr on pr.id = o.agent_id where o.id = new.order_id),
      (select default_commission_rate from public.settings limit 1),
      0
    );
  end if;
  return new;
end;
$$;

create trigger order_items_commission_default before insert or update on public.order_items
  for each row execute function public.order_items_commission_default();

-- ── Totals: amount and commission, recomputed from lines ──
create or replace function public.order_commission_total(p_order_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case
    when (select agent_id from public.orders where id = p_order_id) is null then 0
    else coalesce((select round(sum(amount * commission_rate), 2) from public.order_items where order_id = p_order_id), 0)
  end
$$;

create or replace function public.orders_recalc_total()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target uuid := coalesce(new.order_id, old.order_id);
begin
  update public.orders
     set total_amount = coalesce((select sum(amount) from public.order_items where order_id = target), 0),
         commission_total = public.order_commission_total(target)
   where id = target;
  if tg_op = 'UPDATE' and new.order_id is distinct from old.order_id then
    update public.orders
       set total_amount = coalesce((select sum(amount) from public.order_items where order_id = old.order_id), 0),
           commission_total = public.order_commission_total(old.order_id)
     where id = old.order_id;
  end if;
  return null;
end;
$$;

-- Agent added/removed on an order → commission total follows
create or replace function public.orders_agent_changed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.agent_id is null then
    new.commission_total := 0;
  else
    new.commission_total := coalesce(
      (select round(sum(amount * commission_rate), 2) from public.order_items where order_id = new.id), 0);
  end if;
  return new;
end;
$$;

drop trigger orders_commission_snapshot on public.orders;
drop function public.orders_commission_snapshot();

create trigger orders_agent_changed before update of agent_id on public.orders
  for each row execute function public.orders_agent_changed();

update public.orders o set commission_total = public.order_commission_total(o.id);

-- ── Views: drop dependents, drop old column, recreate ──
drop view public.referral_summary;
drop view public.commission_earnings;
drop view public.order_summary;

alter table public.orders drop column commission_rate;

create view public.order_summary with (security_invoker = true) as
select
  o.*,
  pr.full_name as agent_name,
  coalesce(i.items_text, '') as items,
  coalesce(i.total_qty, 0) as total_qty,
  coalesce(p.paid, 0)::numeric(12, 2) as paid_amount,
  (o.total_amount - coalesce(p.paid, 0))::numeric(12, 2) as balance,
  case
    when o.total_amount - coalesce(p.paid, 0) <= 0 then 'paid'
    when coalesce(p.paid, 0) > 0 then 'partial'
    else 'unpaid'
  end as payment_status,
  -- effective rate across all lines, for display
  case when o.total_amount > 0 then round(o.commission_total / o.total_amount, 4) else 0 end::numeric(5, 4) as commission_rate,
  case
    when o.order_status = 'cancelled' or o.total_amount <= 0 then 0
    else round(o.commission_total * least(coalesce(p.paid, 0) / o.total_amount, 1), 2)
  end::numeric(12, 2) as commission_earned,
  case
    when o.order_status = 'cancelled' or o.total_amount <= 0 then 0
    else o.commission_total - round(o.commission_total * least(coalesce(p.paid, 0) / o.total_amount, 1), 2)
  end::numeric(12, 2) as commission_pending
from public.orders o
left join public.profiles pr on pr.id = o.agent_id
left join lateral (
  select
    string_agg(
      oi.description || case when oi.qty <> 1 then ' ×' || trim(trailing '.' from trim(trailing '0' from oi.qty::text)) else '' end,
      ', ' order by oi.position
    ) as items_text,
    sum(oi.qty) as total_qty
  from public.order_items oi
  where oi.order_id = o.id
) i on true
left join lateral (
  select sum(pa.amount) as paid from public.payments pa where pa.order_id = o.id
) p on true;

-- One row per payment with the commission it earned: payment × (commission_total / total)
create view public.commission_earnings with (security_invoker = true) as
select
  pa.id as payment_id,
  pa.paid_on,
  pa.amount as payment_amount,
  o.id as order_id,
  o.order_no,
  o.client_name,
  o.agent_id,
  case when o.total_amount > 0 then round(o.commission_total / o.total_amount, 4) else 0 end::numeric(5, 4) as commission_rate,
  case
    when o.order_status = 'cancelled' or o.total_amount <= 0 then 0
    else round(pa.amount * o.commission_total / o.total_amount, 2)
  end::numeric(12, 2) as commission
from public.payments pa
join public.orders o on o.id = pa.order_id
where o.agent_id is not null;

create view public.referral_summary with (security_invoker = true) as
select
  r.*,
  pr.full_name as agent_name,
  coalesce(os.order_count, 0) as order_count,
  coalesce(os.total_ordered, 0)::numeric(12, 2) as total_ordered,
  coalesce(os.total_paid, 0)::numeric(12, 2) as total_paid,
  coalesce(os.commission_earned, 0)::numeric(12, 2) as commission_earned,
  coalesce(qs.quote_count, 0) as quote_count,
  coalesce(qs.open_quote_value, 0)::numeric(12, 2) as open_quote_value,
  case
    when r.status = 'rejected' then 'rejected'
    when r.status = 'submitted' then 'submitted'
    when coalesce(os.active_orders, 0) > 0 then
      case
        when os.in_progress > 0 then 'in_production'
        when os.ready > 0 then 'ready'
        else 'delivered'
      end
    when coalesce(qs.open_quotes, 0) > 0 then 'quoted'
    when coalesce(qs.quote_count, 0) > 0 and qs.lost = qs.quote_count then 'lost'
    else 'approved'
  end as stage
from public.referrals r
left join public.profiles pr on pr.id = r.agent_id
left join lateral (
  select
    count(*) as order_count,
    count(*) filter (where s.order_status <> 'cancelled') as active_orders,
    count(*) filter (where s.order_status = 'in_progress') as in_progress,
    count(*) filter (where s.order_status = 'ready') as ready,
    sum(s.total_amount) filter (where s.order_status <> 'cancelled') as total_ordered,
    sum(s.paid_amount) filter (where s.order_status <> 'cancelled') as total_paid,
    sum(s.commission_earned) as commission_earned
  from public.order_summary s
  where s.referral_id = r.id
) os on true
left join lateral (
  select
    count(*) as quote_count,
    count(*) filter (where q.status in ('pending', 'follow_up_scheduled')) as open_quotes,
    count(*) filter (where q.status = 'lost') as lost,
    sum(q.quoted_amount) filter (where q.status in ('pending', 'follow_up_scheduled')) as open_quote_value
  from public.quotations q
  where q.referral_id = r.id
) qs on true;

-- ── Leaderboard: same per-payment formula ──
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
    select o.agent_id, sum(round(pa.amount * o.commission_total / o.total_amount, 2)) as commission
      from public.payments pa
      join public.orders o on o.id = pa.order_id
     where pa.paid_on between p_from and p_to
       and o.order_status <> 'cancelled'
       and o.total_amount > 0
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
revoke execute on function public.order_commission_total(uuid) from public, anon;

-- ── Hide commission rates from the public catalog ──
-- Visitors (anon) may read only the display columns; signed-in staff still see commission_rate (RLS unchanged).
revoke select on public.products from anon;
grant select (id, name, slug, category, description, starting_price, unit, image_url, active, sort_order, created_at)
  on public.products to anon;
