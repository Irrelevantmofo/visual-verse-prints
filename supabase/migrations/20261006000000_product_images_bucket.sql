-- Public bucket for catalog photos. Anyone can view a file by its URL; only admins can upload, replace or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB (the editor resizes photos well below this before upload)
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

-- Public buckets serve files by URL without a policy. These policies cover the API operations admins need.
create policy "product images: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()));

create policy "product images: admin upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (select private.is_admin()));

create policy "product images: admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()))
  with check (bucket_id = 'product-images' and (select private.is_admin()));

create policy "product images: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()));
