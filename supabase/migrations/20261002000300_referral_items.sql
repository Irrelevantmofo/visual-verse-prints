-- Products an agent lists when referring a client. The admin turns them into quotation/order lines.
create table public.referral_items (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  description text not null check (length(trim(description)) > 0),
  qty numeric(12, 2) not null default 1 check (qty > 0),
  details text,
  position int not null default 0
);

create index referral_items_referral_idx on public.referral_items (referral_id);
create index referral_items_product_idx on public.referral_items (product_id);

alter table public.referral_items enable row level security;

-- Visible to whoever can see the referral (its agent, or an admin)
create policy "referral_items: read via referral" on public.referral_items
  for select to authenticated
  using (exists (
    select 1 from public.referrals r
     where r.id = referral_id and (r.agent_id = (select auth.uid()) or (select private.is_admin()))
  ));

-- Agents add items to their own referral only while it's awaiting review; admins anytime
create policy "referral_items: agent add while submitted" on public.referral_items
  for insert to authenticated
  with check (
    (select private.is_admin())
    or exists (
      select 1 from public.referrals r
       where r.id = referral_id
         and r.agent_id = (select auth.uid())
         and r.status = 'submitted'
         and (select private.is_active_member())
    )
  );

create policy "referral_items: admin update" on public.referral_items
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "referral_items: admin delete" on public.referral_items
  for delete to authenticated using ((select private.is_admin()));
