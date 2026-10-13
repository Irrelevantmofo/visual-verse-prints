-- Developer platform fee: 1% of every payment recorded on an order placed through the website.
-- An append-only ledger written by triggers, readable only by developer accounts.

-- ── Who the developers are (no policies: not readable or writable through the API; managed with SQL) ──
create table public.platform_developers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_developers enable row level security;

-- ── Fee rate (private schema: not exposed through the API) ──
create table private.platform_config (
  id boolean primary key default true check (id),
  fee_rate numeric(6, 5) not null default 0.01 check (fee_rate >= 0 and fee_rate <= 1)
);
insert into private.platform_config (id) values (true);

create or replace function private.is_developer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_developers where user_id = (select auth.uid()));
$$;

revoke execute on function private.is_developer() from public;
grant execute on function private.is_developer() to authenticated;

-- ── The ledger ──
-- No foreign keys on purpose: an entry must survive the payment or order being deleted.
create table public.platform_fees (
  id uuid primary key default gen_random_uuid(),
  -- payment: a payment was recorded · adjustment: its amount changed · reversal: it (or its order) was deleted
  kind text not null check (kind in ('payment', 'adjustment', 'reversal')),
  payment_id uuid not null,
  order_id uuid not null,
  order_no bigint,
  client_name text,
  paid_on date not null,
  -- signed: negative on reversals and downward adjustments
  payment_amount numeric(12, 2) not null,
  fee_rate numeric(6, 5) not null,
  fee numeric(12, 2) not null,
  note text,
  created_at timestamptz not null default now()
);

create index platform_fees_payment_idx on public.platform_fees (payment_id);
create index platform_fees_paid_on_idx on public.platform_fees (paid_on);

alter table public.platform_fees enable row level security;

-- Read-only for developers. No insert/update/delete policies: only the trigger below writes, and nothing edits.
create policy "platform_fees: developer read" on public.platform_fees
  for select to authenticated using ((select private.is_developer()));

-- ── Writing the ledger ──
-- An order counts when it was placed through the website's order form, i.e. it has a customer order link
-- (public_token). That can't be changed from the admin screens, unlike the order's "source" label.
create or replace function private.record_platform_fee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate numeric;
  v_order record;
  v_net_amount numeric;
  v_net_fee numeric;
  v_diff numeric;
begin
  select fee_rate into v_rate from private.platform_config limit 1;
  v_rate := coalesce(v_rate, 0.01);

  if tg_op = 'INSERT' then
    select o.order_no, o.client_name, o.public_token into v_order from public.orders o where o.id = new.order_id;
    if v_order.public_token is not null then
      insert into public.platform_fees (kind, payment_id, order_id, order_no, client_name, paid_on, payment_amount, fee_rate, fee)
      values ('payment', new.id, new.order_id, v_order.order_no, v_order.client_name, new.paid_on, new.amount, v_rate, round(new.amount * v_rate, 2));
    end if;
    return new;
  end if;

  -- For updates and deletes, work from what the ledger already holds for this payment
  select coalesce(sum(payment_amount), 0), coalesce(sum(fee), 0)
    into v_net_amount, v_net_fee
    from public.platform_fees
   where payment_id = old.id;

  if tg_op = 'UPDATE' then
    if exists (select 1 from public.platform_fees where payment_id = old.id) then
      v_diff := new.amount - v_net_amount;
      if v_diff <> 0 then
        insert into public.platform_fees (kind, payment_id, order_id, order_no, client_name, paid_on, payment_amount, fee_rate, fee, note)
        select 'adjustment', f.payment_id, f.order_id, f.order_no, f.client_name, new.paid_on, v_diff, v_rate, round(v_diff * v_rate, 2),
               'Payment amount changed'
          from public.platform_fees f
         where f.payment_id = old.id
         order by f.created_at
         limit 1;
      end if;
    end if;
    return new;
  end if;

  -- DELETE (directly, or because its order was deleted)
  if v_net_amount <> 0 or v_net_fee <> 0 then
    insert into public.platform_fees (kind, payment_id, order_id, order_no, client_name, paid_on, payment_amount, fee_rate, fee, note)
    select 'reversal', f.payment_id, f.order_id, f.order_no, f.client_name, old.paid_on, -v_net_amount, f.fee_rate, -v_net_fee,
           case when exists (select 1 from public.orders o where o.id = old.order_id) then 'Payment deleted' else 'Order deleted' end
      from public.platform_fees f
     where f.payment_id = old.id
     order by f.created_at
     limit 1;
  end if;
  return old;
end;
$$;

revoke execute on function private.record_platform_fee() from public;

create trigger payments_platform_fee
  after insert or update of amount or delete on public.payments
  for each row execute function private.record_platform_fee();

-- ── Backfill: payments already recorded on website orders ──
insert into public.platform_fees (kind, payment_id, order_id, order_no, client_name, paid_on, payment_amount, fee_rate, fee, note)
select 'payment', pa.id, o.id, o.order_no, o.client_name, pa.paid_on, pa.amount, 0.01, round(pa.amount * 0.01, 2), 'Backfilled'
  from public.payments pa
  join public.orders o on o.id = pa.order_id
 where o.public_token is not null;
