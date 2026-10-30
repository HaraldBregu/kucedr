begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.test');

-- Clients cannot reach the private schema or the backend-only functions.
select ok(not has_schema_privilege('authenticated', 'credentials', 'usage'), 'authenticated has no schema usage');
select ok(not has_schema_privilege('anon', 'credentials', 'usage'), 'anon has no schema usage');
select ok(not has_function_privilege('authenticated', 'public.credential_secret(uuid, uuid)', 'execute'),
  'authenticated cannot read secrets');
select ok(not has_function_privilege('anon', 'public.credential_create(uuid, text, text, text, uuid)', 'execute'),
  'anon cannot create credentials');
select ok(has_function_privilege('service_role', 'public.credential_secret(uuid, uuid)', 'execute'),
  'service_role can use secrets');

create temporary table ids (name text primary key, id uuid);
insert into ids select 'a1', id from public.credential_create('00000000-0000-4000-8000-00000000000a',
  'openai', 'Work', 'sk-user-a-first-key-1111');
insert into ids select 'a2', id from public.credential_create('00000000-0000-4000-8000-00000000000a',
  'openai', 'Personal', 'sk-user-a-second-key-2222');
insert into ids select 'b1', id from public.credential_create('00000000-0000-4000-8000-00000000000b',
  'anthropic', 'B', 'sk-user-b-key-3333333333');

select is((select count(*)::int from public.credential_list('00000000-0000-4000-8000-00000000000a')), 2,
  'multiple keys for the same service');
select ok(not exists (select 1 from credentials.credentials where vault_secret_id is null), 'every row has a vault secret');
select is((select last_four from public.credential_list('00000000-0000-4000-8000-00000000000a') where label = 'Work'),
  '1111', 'only masked metadata is listed');
select is((select secret from public.credential_secret('00000000-0000-4000-8000-00000000000a',
  (select id from ids where name = 'a1'))), 'sk-user-a-first-key-1111', 'secret decrypts for the owner');

-- User B cannot use, rename, replace, or delete user A's credential.
select is((select count(*)::int from public.credential_secret('00000000-0000-4000-8000-00000000000b',
  (select id from ids where name = 'a1'))), 0, 'other user cannot read secret');
select throws_ok(format($$select public.credential_rename('00000000-0000-4000-8000-00000000000b', %L, 'x')$$,
  (select id from ids where name = 'a1')), 'P0002', 'Credential not found', 'other user cannot rename');
select throws_ok(format($$select public.credential_replace('00000000-0000-4000-8000-00000000000b', %L, 'sk-forged-key-0000000')$$,
  (select id from ids where name = 'a1')), 'P0002', 'Credential not found', 'other user cannot replace');
select throws_ok(format($$select public.credential_delete('00000000-0000-4000-8000-00000000000b', %L)$$,
  (select id from ids where name = 'a1')), 'P0002', 'Credential not found', 'other user cannot delete');

-- Idempotent creation by request id.
select is(
  (select id from public.credential_create('00000000-0000-4000-8000-00000000000a', 'openai', 'Migrated',
    'sk-migrated-key-44444444', '00000000-0000-4000-8000-0000000000aa')),
  (select id from public.credential_create('00000000-0000-4000-8000-00000000000a', 'openai', 'Migrated',
    'sk-migrated-key-44444444', '00000000-0000-4000-8000-0000000000aa')),
  'retry with the same request id returns the same credential');

-- A failed insert leaves no orphaned Vault secret.
create temporary table before_count as select count(*) as n from vault.secrets;
select throws_ok($$select public.credential_create('00000000-0000-4000-8000-00000000000a', 'openai', '',
  'sk-invalid-label-key-5555')$$, '23514', null, 'invalid label is rejected');
select is((select count(*) from vault.secrets), (select n from before_count), 'no vault secret left behind');

-- Delete and account deletion remove Vault secrets.
create temporary table a_secrets as
  select vault_secret_id from credentials.credentials where user_id = '00000000-0000-4000-8000-00000000000a';
select public.credential_delete('00000000-0000-4000-8000-00000000000a', (select id from ids where name = 'a2'));
select is((select count(*)::int from vault.secrets where id = (select vault_secret_id from a_secrets
  except select vault_secret_id from credentials.credentials limit 1)), 0, 'delete removes the vault secret');
delete from auth.users where id = '00000000-0000-4000-8000-00000000000a';
select is((select count(*)::int from vault.secrets where id in (select vault_secret_id from a_secrets)), 0,
  'account deletion removes all vault secrets');
select is((select count(*)::int from public.credential_list('00000000-0000-4000-8000-00000000000b')), 1,
  'other accounts are unaffected');

select * from finish();
rollback;
