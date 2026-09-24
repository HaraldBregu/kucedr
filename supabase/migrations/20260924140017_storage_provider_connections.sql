create table public.storage_provider_connections (
  owner_id uuid not null references auth.users(id),
  provider_id uuid not null,
  bucket text not null check (length(bucket) between 1 and 255),
  region text not null check (length(region) between 1 and 128),
  endpoint text check (endpoint is null or length(endpoint) between 1 and 2048),
  force_path_style boolean not null,
  prefix text not null default '',
  access_key_ciphertext text not null,
  secret_key_ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, provider_id),
  check (prefix = '' or (length(prefix) <= 512 and prefix ~ '^[a-zA-Z0-9_./-]+$'
    and prefix !~ '(^/|/$|//|(^|/)(\.|\.\.)(/|$))'))
);

alter table public.storage_provider_connections enable row level security;
revoke all on public.storage_provider_connections from public, anon, authenticated;
revoke all on public.storage_provider_connections from service_role;
grant select, insert, update on public.storage_provider_connections to service_role;

create function public.storage_provider_target_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (old.owner_id, old.provider_id, old.bucket, old.region, old.endpoint,
      old.force_path_style, old.prefix) is distinct from
     (new.owner_id, new.provider_id, new.bucket, new.region, new.endpoint,
      new.force_path_style, new.prefix) then
    raise exception 'Storage provider target cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger storage_provider_target_immutable_before_update
before update on public.storage_provider_connections
for each row execute function public.storage_provider_target_immutable();
revoke execute on function public.storage_provider_target_immutable() from public, anon, authenticated;

alter table public.storage_uploads add column provider_id uuid;
alter table public.storage_versions add column provider_id uuid;
alter table public.storage_uploads drop constraint storage_uploads_bucket_object_key_key;
create unique index storage_uploads_legacy_object_key on public.storage_uploads(bucket, object_key)
  where provider_id is null;
create unique index storage_uploads_provider_object_key on public.storage_uploads(owner_id, provider_id, bucket, object_key)
  where provider_id is not null;
alter table public.storage_uploads add constraint storage_uploads_provider_fk
  foreign key (owner_id, provider_id) references public.storage_provider_connections(owner_id, provider_id);
alter table public.storage_versions add constraint storage_versions_provider_fk
  foreign key (owner_id, provider_id) references public.storage_provider_connections(owner_id, provider_id);
create index storage_uploads_provider_idx on public.storage_uploads(owner_id, provider_id)
  where provider_id is not null;
create index storage_versions_provider_idx on public.storage_versions(owner_id, provider_id)
  where provider_id is not null;

create function public.storage_version_provider()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind in ('content', 'restore') then
    select u.provider_id into new.provider_id
    from public.storage_uploads u
    where u.workspace_id = new.workspace_id and u.owner_id = new.owner_id
      and u.version_id = new.id and u.bucket = new.bucket and u.object_key = new.object_key
      and u.sha256 = new.sha256 and u.size_bytes = new.size_bytes and u.verified_at is not null;
    if not found then raise exception 'Version upload has not been verified'; end if;
  elsif new.kind = 'rename' then
    select v.provider_id into new.provider_id
    from public.storage_versions v
    where v.workspace_id = new.workspace_id and v.file_id = new.file_id
      and v.bucket = new.bucket and v.object_key = new.object_key
      and v.sha256 = new.sha256 and v.size_bytes = new.size_bytes
    order by v.created_at desc limit 1;
    if not found then raise exception 'Rename content reference is unknown'; end if;
  else
    new.provider_id := null;
  end if;
  return new;
end $$;

create trigger storage_version_provider_before_insert
before insert on public.storage_versions
for each row execute function public.storage_version_provider();
revoke execute on function public.storage_version_provider() from public, anon, authenticated;

drop function public.storage_reserve_upload(uuid, uuid, uuid, uuid, text, text, text, bigint);

create function public.storage_reserve_upload(p_owner_id uuid, p_workspace_id uuid,
  p_operation_id uuid, p_version_id uuid, p_bucket text, p_prefix text, p_sha256 text,
  p_size_bytes bigint, p_provider_id uuid default null)
returns table (bucket text, object_key text, verified boolean)
language plpgsql security definer set search_path = '' as $$
declare v_key text := (case when p_prefix = '' then '' else p_prefix || '/' end) ||
  p_owner_id::text || '/' || p_workspace_id::text || '/' || p_version_id::text;
begin
  if p_bucket is null or p_bucket = '' or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$'
      or p_size_bytes is null or p_size_bytes not between 0 and 52428800 or p_prefix is null
      or p_prefix !~ '^[a-zA-Z0-9_./-]*$' then
    raise exception 'Invalid upload reservation';
  end if;
  if p_provider_id is not null and not exists (
    select 1 from public.storage_provider_connections p
    where p.owner_id = p_owner_id and p.provider_id = p_provider_id
      and p.bucket = p_bucket and p.prefix = p_prefix
  ) then
    raise exception 'Storage provider does not belong to account or target differs';
  end if;
  insert into public.storage_workspaces(id, owner_id) values (p_workspace_id, p_owner_id)
    on conflict (id) do nothing;
  if not exists (select 1 from public.storage_workspaces where id = p_workspace_id and owner_id = p_owner_id) then
    raise exception 'Workspace ownership mismatch';
  end if;
  insert into public.storage_uploads(workspace_id, owner_id, operation_id, version_id, bucket,
    prefix, object_key, sha256, size_bytes, provider_id)
    values (p_workspace_id, p_owner_id, p_operation_id, p_version_id, p_bucket,
      p_prefix, v_key, p_sha256, p_size_bytes, p_provider_id)
    on conflict (workspace_id, operation_id) do nothing;
  if not exists (select 1 from public.storage_uploads u where u.workspace_id = p_workspace_id
    and u.owner_id = p_owner_id and u.operation_id = p_operation_id and u.version_id = p_version_id
    and u.bucket = p_bucket and u.prefix = p_prefix and u.object_key = v_key
    and u.sha256 = p_sha256 and u.size_bytes = p_size_bytes
    and u.provider_id is not distinct from p_provider_id) then
    raise exception 'Upload operation was already reserved with different content or provider';
  end if;
  return query select u.bucket, u.object_key, u.verified_at is not null
    from public.storage_uploads u where u.workspace_id = p_workspace_id and u.operation_id = p_operation_id;
end $$;

revoke all on function public.storage_reserve_upload(uuid, uuid, uuid, uuid, text, text, text, bigint, uuid)
  from public, anon, authenticated;
grant execute on function public.storage_reserve_upload(uuid, uuid, uuid, uuid, text, text, text, bigint, uuid)
  to service_role;
