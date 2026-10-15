-- Employee profile photos in Supabase Storage
-- Path column remains vina_employees.photo_path (storage object path, not binary)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vina-employee-photos',
  'vina-employee-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vina_employee_photos_public_read" on storage.objects;
create policy "vina_employee_photos_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'vina-employee-photos');

drop policy if exists "vina_employee_photos_no_client_insert" on storage.objects;
create policy "vina_employee_photos_no_client_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (false);

drop policy if exists "vina_employee_photos_no_client_update" on storage.objects;
create policy "vina_employee_photos_no_client_update"
  on storage.objects
  for update
  to anon, authenticated
  using (false);

drop policy if exists "vina_employee_photos_no_client_delete" on storage.objects;
create policy "vina_employee_photos_no_client_delete"
  on storage.objects
  for delete
  to anon, authenticated
  using (false);
