-- Private bucket for each account's passphrase-encrypted API keys file: credentials/{user id}/keys.json.
-- The desktop app encrypts before upload; this bucket only ever holds ciphertext.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('credentials', 'credentials', false, 1048576, array['application/json'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy credentials_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'credentials' and name = (select auth.uid())::text || '/keys.json');
create policy credentials_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'credentials' and name = (select auth.uid())::text || '/keys.json');
create policy credentials_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'credentials' and name = (select auth.uid())::text || '/keys.json')
  with check (bucket_id = 'credentials' and name = (select auth.uid())::text || '/keys.json');
create policy credentials_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'credentials' and name = (select auth.uid())::text || '/keys.json');
