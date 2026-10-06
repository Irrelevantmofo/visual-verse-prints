-- A product can show several photos of finished work. The first is the cover.
alter table public.products
  add column image_urls text[] not null default '{}';

-- Carry over an existing photo, but only one that's a real file in our bucket
update public.products
   set image_urls = array[image_url]
 where image_url like '%/storage/v1/object/public/product-images/%';

-- Visitors read products through column-level grants (commission_rate stays hidden), so the new column needs one
grant select (image_urls) on public.products to anon;
