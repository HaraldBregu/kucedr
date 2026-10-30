create extension if not exists supabase_vault with schema vault;

create schema credentials;
revoke all on schema credentials from public, anon, authenticated, service_role;

create table credentials.credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service text not null check (service ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  label text not null check (char_length(label) between 1 and 100),
  vault_secret_id uuid not null unique,
  last_four text check (last_four is null or char_length(last_four) = 4),
  request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_id)
);
create index credentials_user_id_idx on credentials.credentials(user_id);

create table credentials.rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null,
  primary key (user_id, bucket)
);

create table credentials.leases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
create index credentials_leases_user_id_idx on credentials.leases(user_id);

alter table credentials.credentials enable row level security;
alter table credentials.rate_limits enable row level security;
alter table credentials.leases enable row level security;
revoke all on all tables in schema credentials from public, anon, authenticated, service_role;

-- Every deletion path (explicit delete or auth.users cascade) removes the Vault secret in the same transaction.
create function credentials.delete_vault_secret()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id = old.vault_secret_id;
  return old;
end $$;

create trigger credentials_delete_vault_secret
after delete on credentials.credentials
for each row execute function credentials.delete_vault_secret();

create function public.credential_list(p_user_id uuid)
returns table (id uuid, service text, label text, last_four text, created_at timestamptz, updated_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select c.id, c.service, c.label, c.last_four, c.created_at, c.updated_at
  from credentials.credentials c
  where c.user_id = p_user_id
  order by c.service, c.created_at;
$$;

create function public.credential_create(p_user_id uuid, p_service text, p_label text,
  p_secret text, p_request_id uuid default null)
returns table (id uuid, service text, label text, last_four text, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
  v_secret_id uuid;
begin
  if p_user_id is null or p_secret is null or char_length(p_secret) not between 8 and 16384 then
    raise exception 'Invalid credential' using errcode = '22023';
  end if;
  if p_request_id is not null and exists (select 1 from credentials.credentials c
      where c.user_id = p_user_id and c.request_id = p_request_id) then
    return query select c.id, c.service, c.label, c.last_four, c.created_at, c.updated_at
      from credentials.credentials c where c.user_id = p_user_id and c.request_id = p_request_id;
    return;
  end if;
  if (select count(*) from credentials.credentials c where c.user_id = p_user_id) >= 200 then
    raise exception 'Credential limit reached' using errcode = '22023';
  end if;
  v_secret_id := vault.create_secret(p_secret, 'credential:' || v_id::text, '');
  insert into credentials.credentials (id, user_id, service, label, vault_secret_id, last_four, request_id)
  values (v_id, p_user_id, p_service, p_label, v_secret_id,
    case when char_length(p_secret) >= 16 then right(p_secret, 4) end, p_request_id);
  return query select c.id, c.service, c.label, c.last_four, c.created_at, c.updated_at
    from credentials.credentials c where c.id = v_id;
end $$;

create function public.credential_replace(p_user_id uuid, p_id uuid, p_secret text)
returns table (id uuid, service text, label text, last_four text, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_secret_id uuid;
begin
  if p_secret is null or char_length(p_secret) not between 8 and 16384 then
    raise exception 'Invalid credential' using errcode = '22023';
  end if;
  select c.vault_secret_id into v_secret_id from credentials.credentials c
    where c.id = p_id and c.user_id = p_user_id for update;
  if not found then raise exception 'Credential not found' using errcode = 'P0002'; end if;
  perform vault.update_secret(v_secret_id, p_secret);
  update credentials.credentials c
    set last_four = case when char_length(p_secret) >= 16 then right(p_secret, 4) end, updated_at = now()
    where c.id = p_id and c.user_id = p_user_id;
  return query select c.id, c.service, c.label, c.last_four, c.created_at, c.updated_at
    from credentials.credentials c where c.id = p_id;
end $$;

create function public.credential_rename(p_user_id uuid, p_id uuid, p_label text)
returns table (id uuid, service text, label text, last_four text, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  update credentials.credentials c set label = p_label, updated_at = now()
    where c.id = p_id and c.user_id = p_user_id;
  if not found then raise exception 'Credential not found' using errcode = 'P0002'; end if;
  return query select c.id, c.service, c.label, c.last_four, c.created_at, c.updated_at
    from credentials.credentials c where c.id = p_id;
end $$;

create function public.credential_delete(p_user_id uuid, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from credentials.credentials c where c.id = p_id and c.user_id = p_user_id;
  if not found then raise exception 'Credential not found' using errcode = 'P0002'; end if;
end $$;

-- Backend-only: decrypts a secret for one provider call. Never exposed to desktop clients.
create function public.credential_secret(p_user_id uuid, p_id uuid)
returns table (service text, secret text)
language sql security definer set search_path = '' stable as $$
  select c.service, d.decrypted_secret
  from credentials.credentials c
  join vault.decrypted_secrets d on d.id = c.vault_secret_id
  where c.id = p_id and c.user_id = p_user_id;
$$;

create function public.credential_rate_limit(p_user_id uuid, p_bucket text, p_limit integer,
  p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_hits integer;
begin
  insert into credentials.rate_limits as r (user_id, bucket, window_start, hits)
  values (p_user_id, p_bucket, now(), 1)
  on conflict (user_id, bucket) do update set
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds)
      then now() else r.window_start end,
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds)
      then 1 else r.hits + 1 end
  returning hits into v_hits;
  return v_hits <= p_limit;
end $$;

create function public.credential_acquire(p_user_id uuid, p_max integer, p_ttl_seconds integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('credential_lease:' || p_user_id::text));
  delete from credentials.leases l where l.user_id = p_user_id and l.expires_at < now();
  if (select count(*) from credentials.leases l where l.user_id = p_user_id) >= p_max then
    return null;
  end if;
  insert into credentials.leases (user_id, expires_at)
  values (p_user_id, now() + make_interval(secs => p_ttl_seconds))
  returning id into v_id;
  return v_id;
end $$;

create function public.credential_release(p_lease uuid)
returns void language sql security definer set search_path = '' as $$
  delete from credentials.leases where id = p_lease;
$$;

revoke all on function credentials.delete_vault_secret() from public, anon, authenticated, service_role;
revoke all on function public.credential_list(uuid) from public, anon, authenticated;
revoke all on function public.credential_create(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.credential_replace(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.credential_rename(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.credential_delete(uuid, uuid) from public, anon, authenticated;
revoke all on function public.credential_secret(uuid, uuid) from public, anon, authenticated;
revoke all on function public.credential_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.credential_acquire(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.credential_release(uuid) from public, anon, authenticated;
grant execute on function public.credential_list(uuid) to service_role;
grant execute on function public.credential_create(uuid, text, text, text, uuid) to service_role;
grant execute on function public.credential_replace(uuid, uuid, text) to service_role;
grant execute on function public.credential_rename(uuid, uuid, text) to service_role;
grant execute on function public.credential_delete(uuid, uuid) to service_role;
grant execute on function public.credential_secret(uuid, uuid) to service_role;
grant execute on function public.credential_rate_limit(uuid, text, integer, integer) to service_role;
grant execute on function public.credential_acquire(uuid, integer, integer) to service_role;
grant execute on function public.credential_release(uuid) to service_role;
