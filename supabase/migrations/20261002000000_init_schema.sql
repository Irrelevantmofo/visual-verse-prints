-- Visual Verse Prints: core schema (profiles, referrals, quotations, orders, payments, commissions, catalog)

-- ───────────────────────── Enums ─────────────────────────
create type public.user_role as enum ('admin', 'agent');
create type public.referral_status as enum ('submitted', 'approved', 'rejected');
create type public.quote_status as enum ('pending', 'follow_up_scheduled', 'won', 'lost');
create type public.order_status as enum ('in_progress', 'ready', 'delivered', 'cancelled');
create type public.delivery_status as enum ('in_progress', 'ready', 'delivered');
create type public.order_source as enum ('referral', 'direct', 'website');
create type public.payment_method as enum ('cash', 'gcash', 'maya', 'bank_transfer', 'card', 'other');

-- ───────────────────────── Helpers ─────────────────────────
create or replace function public.manila_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Manila')::date $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ───────────────────────── Tables ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  role public.user_role not null default 'agent',
  -- null = use settings.default_commission_rate
  commission_rate numeric(5, 4) check (commission_rate between 0 and 1),
  -- accounts start inactive; an admin activates invited agents
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.settings (
  id boolean primary key default true check (id),
  default_commission_rate numeric(5, 4) not null default 0.05 check (default_commission_rate between 0 and 1),
  quote_validity_days int not null default 14 check (quote_validity_days > 0),
  due_soon_days int not null default 3 check (due_soon_days >= 0),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null default 'Print',
  description text,
  starting_price numeric(12, 2) check (starting_price >= 0),
  unit text,
  image_url text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint generated always as identity unique,
  agent_id uuid not null default auth.uid() references public.profiles (id),
  client_name text not null check (length(trim(client_name)) > 0),
  client_contact text not null check (length(trim(client_contact)) > 0),
  client_company text,
  interested_in text,
  estimated_budget numeric(12, 2) check (estimated_budget >= 0),
  notes text,
  status public.referral_status not null default 'submitted',
  review_notes text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  quote_no bigint generated always as identity unique,
  date_sent date not null default public.manila_today(),
  agent_id uuid references public.profiles (id),
  referral_id uuid references public.referrals (id) on delete set null,
  client_name text not null,
  client_contact text,
  description text,
  quoted_amount numeric(12, 2) not null check (quoted_amount >= 0),
  expires_on date not null,
  status public.quote_status not null default 'pending',
  follow_up_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint generated always as identity unique,
  order_date date not null default public.manila_today(),
  source public.order_source not null default 'referral',
  agent_id uuid references public.profiles (id),
  referral_id uuid references public.referrals (id) on delete set null,
  quotation_id uuid references public.quotations (id) on delete set null,
  client_name text not null,
  client_contact text,
  -- maintained from order_items by trigger
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  -- snapshot at creation so later rate changes don't rewrite history
  commission_rate numeric(5, 4) not null default 0 check (commission_rate between 0 and 1),
  order_status public.order_status not null default 'in_progress',
  delivery_status public.delivery_status not null default 'in_progress',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  description text not null,
  qty numeric(12, 2) not null default 1 check (qty > 0),
  -- line total (spreadsheet records totals, not unit prices)
  amount numeric(12, 2) not null check (amount >= 0),
  position int not null default 0
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  paid_on date not null default public.manila_today(),
  method public.payment_method not null default 'cash',
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.commission_payouts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id),
  amount numeric(12, 2) not null check (amount > 0),
  paid_on date not null default public.manila_today(),
  period_label text,
  notes text,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Indexes ─────────────────────────
create index referrals_agent_idx on public.referrals (agent_id);
create index referrals_status_idx on public.referrals (status);
create index referrals_reviewed_by_idx on public.referrals (reviewed_by);
create index quotations_agent_idx on public.quotations (agent_id);
create index quotations_referral_idx on public.quotations (referral_id);
create index quotations_date_idx on public.quotations (date_sent);
create index orders_agent_idx on public.orders (agent_id);
create index orders_referral_idx on public.orders (referral_id);
create index orders_quotation_idx on public.orders (quotation_id);
create index orders_date_idx on public.orders (order_date);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);
create index payments_order_idx on public.payments (order_id);
create index payments_paid_on_idx on public.payments (paid_on);
create index commission_payouts_agent_idx on public.commission_payouts (agent_id);

-- ───────────────────────── Triggers ─────────────────────────
create trigger referrals_updated_at before update on public.referrals
  for each row execute function public.set_updated_at();
create trigger quotations_updated_at before update on public.quotations
  for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- New auth user → profile (role/active are never taken from user-supplied metadata)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Quotation expiry defaults to date_sent + settings.quote_validity_days
create or replace function public.quotations_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.expires_on is null then
    new.expires_on := new.date_sent + coalesce((select quote_validity_days from public.settings limit 1), 14);
  end if;
  return new;
end;
$$;

create trigger quotations_defaults before insert on public.quotations
  for each row execute function public.quotations_defaults();

-- Orders snapshot the agent's commission rate on insert (or when the agent changes)
create or replace function public.orders_commission_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.agent_id is null then
    new.commission_rate := 0;
  elsif tg_op = 'INSERT' or new.agent_id is distinct from old.agent_id then
    new.commission_rate := coalesce(
      (select commission_rate from public.profiles where id = new.agent_id),
      (select default_commission_rate from public.settings limit 1),
      0
    );
  end if;
  return new;
end;
$$;

create trigger orders_commission_snapshot before insert or update of agent_id on public.orders
  for each row execute function public.orders_commission_snapshot();

-- Keep orders.total_amount = sum(order_items.amount)
create or replace function public.orders_recalc_total()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target uuid := coalesce(new.order_id, old.order_id);
begin
  update public.orders
     set total_amount = coalesce((select sum(amount) from public.order_items where order_id = target), 0)
   where id = target;
  if tg_op = 'UPDATE' and new.order_id is distinct from old.order_id then
    update public.orders
       set total_amount = coalesce((select sum(amount) from public.order_items where order_id = old.order_id), 0)
     where id = old.order_id;
  end if;
  return null;
end;
$$;

create trigger order_items_recalc after insert or update or delete on public.order_items
  for each row execute function public.orders_recalc_total();

-- ───────────────────────── Role helpers ─────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where id = (select auth.uid()) and role = 'admin' and active
  );
$$;

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and active);
$$;

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.products enable row level security;
alter table public.referrals enable row level security;
alter table public.quotations enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.commission_payouts enable row level security;

-- profiles: self read; admin all
create policy "profiles: read self or admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: admin update" on public.profiles
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- settings: members read; admin update
create policy "settings: members read" on public.settings
  for select to authenticated using ((select public.is_active_member()));
create policy "settings: admin update" on public.settings
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- products: public catalog
create policy "products: public read active" on public.products
  for select to anon, authenticated using (active or (select public.is_admin()));
create policy "products: admin insert" on public.products
  for insert to authenticated with check ((select public.is_admin()));
create policy "products: admin update" on public.products
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "products: admin delete" on public.products
  for delete to authenticated using ((select public.is_admin()));

-- referrals: agents read + submit their own; admin everything
create policy "referrals: read own or admin" on public.referrals
  for select to authenticated
  using (agent_id = (select auth.uid()) or (select public.is_admin()));
create policy "referrals: agent submit" on public.referrals
  for insert to authenticated
  with check (
    (select public.is_admin())
    or (
      agent_id = (select auth.uid())
      and (select public.is_active_member())
      and status = 'submitted'
      and reviewed_by is null
      and reviewed_at is null
      and review_notes is null
    )
  );
create policy "referrals: admin update" on public.referrals
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "referrals: admin delete" on public.referrals
  for delete to authenticated using ((select public.is_admin()));

-- quotations / orders / commission_payouts: agent reads own; admin writes
create policy "quotations: read own or admin" on public.quotations
  for select to authenticated
  using (agent_id = (select auth.uid()) or (select public.is_admin()));
create policy "quotations: admin insert" on public.quotations
  for insert to authenticated with check ((select public.is_admin()));
create policy "quotations: admin update" on public.quotations
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "quotations: admin delete" on public.quotations
  for delete to authenticated using ((select public.is_admin()));

create policy "orders: read own or admin" on public.orders
  for select to authenticated
  using (agent_id = (select auth.uid()) or (select public.is_admin()));
create policy "orders: admin insert" on public.orders
  for insert to authenticated with check ((select public.is_admin()));
create policy "orders: admin update" on public.orders
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "orders: admin delete" on public.orders
  for delete to authenticated using ((select public.is_admin()));

create policy "commission_payouts: read own or admin" on public.commission_payouts
  for select to authenticated
  using (agent_id = (select auth.uid()) or (select public.is_admin()));
create policy "commission_payouts: admin insert" on public.commission_payouts
  for insert to authenticated with check ((select public.is_admin()));
create policy "commission_payouts: admin update" on public.commission_payouts
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "commission_payouts: admin delete" on public.commission_payouts
  for delete to authenticated using ((select public.is_admin()));

-- order_items / payments: visible when the parent order is visible; admin writes
create policy "order_items: read via order" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.id = order_id and (o.agent_id = (select auth.uid()) or (select public.is_admin()))
  ));
create policy "order_items: admin insert" on public.order_items
  for insert to authenticated with check ((select public.is_admin()));
create policy "order_items: admin update" on public.order_items
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "order_items: admin delete" on public.order_items
  for delete to authenticated using ((select public.is_admin()));

create policy "payments: read via order" on public.payments
  for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.id = order_id and (o.agent_id = (select auth.uid()) or (select public.is_admin()))
  ));
create policy "payments: admin insert" on public.payments
  for insert to authenticated with check ((select public.is_admin()));
create policy "payments: admin update" on public.payments
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "payments: admin delete" on public.payments
  for delete to authenticated using ((select public.is_admin()));

-- ───────────────────────── Views (respect caller's RLS) ─────────────────────────
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
  case
    when o.order_status = 'cancelled' then 0
    else round(coalesce(p.paid, 0) * o.commission_rate, 2)
  end::numeric(12, 2) as commission_earned,
  case
    when o.order_status = 'cancelled' then 0
    else round(greatest(o.total_amount - coalesce(p.paid, 0), 0) * o.commission_rate, 2)
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

create view public.quotation_summary with (security_invoker = true) as
select
  q.*,
  pr.full_name as agent_name,
  (q.expires_on - public.manila_today()) as days_to_expiry
from public.quotations q
left join public.profiles pr on pr.id = q.agent_id;

-- One row per payment with the commission it earned (for ledgers / period totals)
create view public.commission_earnings with (security_invoker = true) as
select
  pa.id as payment_id,
  pa.paid_on,
  pa.amount as payment_amount,
  o.id as order_id,
  o.order_no,
  o.client_name,
  o.agent_id,
  o.commission_rate,
  case when o.order_status = 'cancelled' then 0 else round(pa.amount * o.commission_rate, 2) end::numeric(12, 2) as commission
from public.payments pa
join public.orders o on o.id = pa.order_id
where o.agent_id is not null;

-- Referral pipeline with order totals and a derived progress stage
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

-- ───────────────────────── Leaderboard (aggregates only) ─────────────────────────
-- Agents can't read each other's rows; this returns only per-agent totals for the period.
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
  where (select public.is_active_member())
  order by 7, 2;
$$;

revoke execute on function public.agent_leaderboard(date, date) from public, anon;
grant execute on function public.agent_leaderboard(date, date) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ───────────────────────── Seed ─────────────────────────
insert into public.settings (id) values (true);

insert into public.products (name, slug, category, description, starting_price, unit, sort_order) values
  ('Stickers', 'stickers', 'Labels & Stickers', 'Die-cut, kiss-cut, transparent and laminated sticker sheets in matte or glossy.', 80, 'per sheet', 10),
  ('Business Cards', 'business-cards', 'Stationery', 'Laminated calling cards on premium stock, printed sharp and cut clean.', 5, 'per card', 20),
  ('Flyers', 'flyers', 'Marketing', 'Full-color flyers and leaflets for promos, menus and events.', null, null, 30),
  ('Invitations', 'invitations', 'Events', 'Wedding, birthday and corporate invitations with elegant finishes.', null, null, 40),
  ('Book Binding', 'book-binding', 'Binding', 'Thesis, manuals, brand books and photo books — bound to last.', null, null, 50),
  ('Calendars', 'calendars', 'Stationery', 'Desk and wall calendars customized with your brand or photos.', null, null, 60),
  ('Cup Sleeves', 'cup-sleeves', 'Packaging', 'Branded cup sleeves for cafés and events.', 13, 'per piece', 70),
  ('Pads', 'pads', 'Stationery', 'Notepads, order pads and receipt pads with your logo.', null, null, 80),
  ('Labels', 'labels', 'Labels & Stickers', 'Product labels for bottles, jars and packaging.', null, null, 90),
  ('Packaging', 'packaging', 'Packaging', 'Custom boxes and sleeves that make unboxing memorable.', null, null, 100),
  ('Customized Tumblers', 'customized-tumblers', 'Merch', 'Personalized 500ml tumblers for giveaways and gifts.', 210, 'per piece', 110),
  ('Print & Laminate', 'print-and-laminate', 'Print', 'Document printing with lamination while you wait.', null, null, 120);
