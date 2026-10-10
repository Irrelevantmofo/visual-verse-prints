-- Online ordering foundation: order links, bank-QR payment channels, and customer-uploaded payment proofs.
-- Customers have no accounts. They reach one order through an unguessable link; every customer action goes
-- through the app server (service role) after it checks that link, so nothing here is opened to anon.

-- ── Switch (off until the shop is ready) ──
alter table public.settings
  add column online_ordering_enabled boolean not null default false;

-- ── Orders: customer link + what the customer wrote ──
alter table public.orders
  add column public_token text unique,
  add column customer_notes text,
  -- salted hash of the submitter's IP, only used to rate-limit order creation
  add column created_ip_hash text;

create index orders_created_ip_idx on public.orders (created_ip_hash, created_at) where created_ip_hash is not null;

-- ── Where customers pay (GCash, Maya, a bank…), managed in Settings ──
create table public.payment_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  method public.payment_method not null default 'gcash',
  account_name text,
  account_number text,
  qr_url text,
  instructions text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.payment_channels enable row level security;

create policy "payment_channels: staff read" on public.payment_channels
  for select to authenticated using ((select private.is_active_member()));
create policy "payment_channels: admin insert" on public.payment_channels
  for insert to authenticated with check ((select private.is_admin()));
create policy "payment_channels: admin update" on public.payment_channels
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "payment_channels: admin delete" on public.payment_channels
  for delete to authenticated using ((select private.is_admin()));

-- ── Payment screenshots awaiting admin verification ──
create type public.proof_status as enum ('pending', 'approved', 'rejected');

create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  channel_id uuid references public.payment_channels (id) on delete set null,
  -- object path in the private payment-proofs bucket: <order id>/<file>
  storage_path text not null unique,
  claimed_amount numeric(12, 2) check (claimed_amount > 0),
  reference text,
  status public.proof_status not null default 'pending',
  -- shown to the customer when rejected
  review_note text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  -- the payment recorded when approved
  payment_id uuid references public.payments (id) on delete set null,
  created_at timestamptz not null default now()
);

create index payment_proofs_order_idx on public.payment_proofs (order_id);
create index payment_proofs_status_idx on public.payment_proofs (status);
create index payment_proofs_channel_idx on public.payment_proofs (channel_id);
create index payment_proofs_payment_idx on public.payment_proofs (payment_id);
create index payment_proofs_reviewed_by_idx on public.payment_proofs (reviewed_by);

alter table public.payment_proofs enable row level security;

-- Admin only. Customers upload and view through the server, never directly.
create policy "payment_proofs: admin read" on public.payment_proofs
  for select to authenticated using ((select private.is_admin()));
create policy "payment_proofs: admin insert" on public.payment_proofs
  for insert to authenticated with check ((select private.is_admin()));
create policy "payment_proofs: admin update" on public.payment_proofs
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "payment_proofs: admin delete" on public.payment_proofs
  for delete to authenticated using ((select private.is_admin()));

-- ── Storage ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- private: transaction screenshots
  ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  -- public: the shop's bank / e-wallet QR codes
  ('payment-qr', 'payment-qr', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "payment proofs: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs' and (select private.is_admin()));
create policy "payment proofs: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-proofs' and (select private.is_admin()));

create policy "payment qr: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-qr' and (select private.is_admin()));
create policy "payment qr: admin upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-qr' and (select private.is_admin()));
create policy "payment qr: admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'payment-qr' and (select private.is_admin()))
  with check (bucket_id = 'payment-qr' and (select private.is_admin()));
create policy "payment qr: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-qr' and (select private.is_admin()));

-- Make explicit a grant that previously relied on Supabase's default privileges: the order_items trigger calls this
-- function as the signed-in admin (and as the service role for website orders).
grant execute on function public.order_commission_total(uuid) to authenticated, service_role;
