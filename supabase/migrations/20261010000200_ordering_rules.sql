-- Ordering rules from the shop: fixed-price checkout, fulfilment choice, artwork uploads, agent order links,
-- and an "attention" marker so admins notice new customer activity.

-- ── Fixed-price products: price × quantity, payable right away ──
alter table public.products
  add column fixed_price boolean not null default false;

-- Visitors read products through column-level grants (commission_rate stays hidden)
grant select (fixed_price) on public.products to anon;

-- ── How the customer receives the order ──
create type public.fulfilment_method as enum ('pickup', 'lalamove', 'courier');

alter table public.orders
  add column fulfilment public.fulfilment_method,
  add column delivery_name text,
  add column delivery_phone text,
  add column delivery_address text,
  -- last time the customer did something (ordered, uploaded artwork or a receipt)
  add column customer_activity_at timestamptz,
  -- last time an admin opened the order; activity after this needs attention
  add column admin_seen_at timestamptz;

create index orders_attention_idx on public.orders (customer_activity_at) where customer_activity_at is not null;

-- ── Artwork and other files the customer uploads for an order ──
create table public.order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  -- object path in the private order-files bucket: <order id>/<file>
  storage_path text not null unique,
  file_name text not null,
  size_bytes bigint,
  content_type text,
  created_at timestamptz not null default now()
);

create index order_files_order_idx on public.order_files (order_id);

alter table public.order_files enable row level security;

-- Admin only. Customers upload and list through the server after their order link is checked.
create policy "order_files: admin read" on public.order_files
  for select to authenticated using ((select private.is_admin()));
create policy "order_files: admin insert" on public.order_files
  for insert to authenticated with check ((select private.is_admin()));
create policy "order_files: admin delete" on public.order_files
  for delete to authenticated using ((select private.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-files',
  'order-files',
  false,
  20971520, -- 20 MB per file
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/postscript',          -- .ai / .eps
    'image/vnd.adobe.photoshop',       -- .psd
    'application/zip'
  ]
)
on conflict (id) do nothing;

create policy "order files: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'order-files' and (select private.is_admin()));
create policy "order files: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'order-files' and (select private.is_admin()));

-- ── Agent order links: /order?ref=<code> credits the order to that agent ──
alter table public.profiles
  add column referral_code text unique;

update public.profiles
   set referral_code = substr(md5(gen_random_uuid()::text), 1, 10)
 where referral_code is null;

alter table public.profiles
  alter column referral_code set default substr(md5(gen_random_uuid()::text), 1, 10),
  alter column referral_code set not null;

-- ── Referral progress: website orders that aren't in production yet count as "quoted", not "delivered" ──
create or replace view public.referral_summary with (security_invoker = true) as
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
        when os.delivered > 0 then 'delivered'
        else 'quoted'
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
    sum(s.commission_earned) as commission_earned,
    count(*) filter (where s.order_status = 'delivered') as delivered
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

-- ── Leaderboard: sales booked counts only orders that reached production ──
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
     where order_date between p_from and p_to
       and order_status in ('in_progress', 'ready', 'delivered')
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
