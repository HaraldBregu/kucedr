create extension if not exists pgcrypto with schema extensions;

create table public.storage_workspaces (
  id uuid primary key,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.storage_files (
  workspace_id uuid not null,
  owner_id uuid not null,
  id uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  unique (workspace_id, id, owner_id),
  foreign key (workspace_id, owner_id) references public.storage_workspaces(id, owner_id)
);

create table public.storage_versions (
  workspace_id uuid not null,
  file_id uuid not null,
  owner_id uuid not null,
  id uuid not null,
  kind text not null check (kind in ('content', 'rename', 'tombstone', 'restore')),
  path text,
  bucket text,
  object_key text,
  sha256 text,
  size_bytes bigint,
  author_id uuid not null references auth.users(id),
  device_id text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, file_id, id),
  unique (workspace_id, id),
  foreign key (workspace_id, file_id, owner_id) references public.storage_files(workspace_id, id, owner_id),
  check (path is null or (length(path) between 1 and 4096 and path not like '/%'
    and position(E'\\' in path) = 0 and path !~ '(^|/)(\.|\.\.)(/|$)'
    and path !~* '(^|/)\.kucedr/storage(/|$)' and path !~ '//|/$')),
  check ((kind = 'tombstone' and path is null and bucket is null and object_key is null and sha256 is null and size_bytes is null)
      or (kind <> 'tombstone' and path is not null and bucket is not null and object_key is not null
          and sha256 ~ '^[0-9a-f]{64}$' and size_bytes between 0 and 52428800))
);

create table public.storage_version_parents (
  workspace_id uuid not null,
  file_id uuid not null,
  version_id uuid not null,
  parent_id uuid not null,
  primary key (workspace_id, file_id, version_id, parent_id),
  foreign key (workspace_id, file_id, version_id) references public.storage_versions(workspace_id, file_id, id),
  foreign key (workspace_id, file_id, parent_id) references public.storage_versions(workspace_id, file_id, id),
  check (version_id <> parent_id)
);

create table public.storage_heads (
  workspace_id uuid not null,
  file_id uuid not null,
  version_id uuid not null,
  primary key (workspace_id, file_id, version_id),
  foreign key (workspace_id, file_id, version_id) references public.storage_versions(workspace_id, file_id, id) on delete restrict
);

create table public.storage_uploads (
  workspace_id uuid not null,
  owner_id uuid not null,
  operation_id uuid not null,
  version_id uuid not null,
  bucket text not null,
  prefix text not null default '',
  object_key text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes bigint not null check (size_bytes between 0 and 52428800),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (workspace_id, operation_id),
  unique (workspace_id, version_id),
  unique (bucket, object_key),
  foreign key (workspace_id, owner_id) references public.storage_workspaces(id, owner_id),
  check (prefix = '' or (length(prefix) <= 512 and prefix !~ '(^/|/$|//|\\|(^|/)(\.|\.\.)(/|$))')),
  check (object_key = case when prefix = '' then '' else prefix || '/' end ||
    owner_id::text || '/' || workspace_id::text || '/' || version_id::text)
);

create table public.storage_operations (
  workspace_id uuid not null,
  owner_id uuid not null,
  id uuid not null,
  payload_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, owner_id) references public.storage_workspaces(id, owner_id)
);

create table public.storage_cursors (
  workspace_id uuid primary key references public.storage_workspaces(id),
  last_sequence bigint not null default 0
);

create table public.storage_changes (
  workspace_id uuid not null references public.storage_workspaces(id),
  sequence bigint not null,
  file_id uuid not null,
  version_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, sequence),
  foreign key (workspace_id, file_id, version_id) references public.storage_versions(workspace_id, file_id, id)
);

create index storage_versions_file_created on public.storage_versions(workspace_id, file_id, created_at);
create index storage_changes_version on public.storage_changes(workspace_id, version_id);

alter table public.storage_workspaces enable row level security;
alter table public.storage_files enable row level security;
alter table public.storage_versions enable row level security;
alter table public.storage_version_parents enable row level security;
alter table public.storage_heads enable row level security;
alter table public.storage_uploads enable row level security;
alter table public.storage_operations enable row level security;
alter table public.storage_cursors enable row level security;
alter table public.storage_changes enable row level security;

create policy storage_workspaces_read on public.storage_workspaces for select to authenticated using (owner_id = (select auth.uid()));
create policy storage_files_read on public.storage_files for select to authenticated using (owner_id = (select auth.uid()));
create policy storage_versions_read on public.storage_versions for select to authenticated using (owner_id = (select auth.uid()));
create policy storage_parents_read on public.storage_version_parents for select to authenticated using (exists (select 1 from public.storage_workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));
create policy storage_heads_read on public.storage_heads for select to authenticated using (exists (select 1 from public.storage_workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));
create policy storage_changes_read on public.storage_changes for select to authenticated using (exists (select 1 from public.storage_workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));

revoke all on public.storage_workspaces, public.storage_files, public.storage_versions,
  public.storage_version_parents, public.storage_heads, public.storage_uploads,
  public.storage_operations, public.storage_cursors, public.storage_changes from anon, authenticated;
grant select on public.storage_workspaces, public.storage_files, public.storage_versions,
  public.storage_version_parents, public.storage_heads, public.storage_changes to authenticated;
grant all on public.storage_workspaces, public.storage_files, public.storage_versions,
  public.storage_version_parents, public.storage_heads, public.storage_uploads,
  public.storage_operations, public.storage_cursors, public.storage_changes to service_role;

create function public.storage_reserve_upload(p_owner_id uuid, p_workspace_id uuid,
  p_operation_id uuid, p_version_id uuid, p_bucket text, p_prefix text, p_sha256 text, p_size_bytes bigint)
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
  insert into public.storage_workspaces(id, owner_id) values (p_workspace_id, p_owner_id)
    on conflict (id) do nothing;
  if not exists (select 1 from public.storage_workspaces where id = p_workspace_id and owner_id = p_owner_id) then
    raise exception 'Workspace ownership mismatch';
  end if;
  insert into public.storage_uploads(workspace_id, owner_id, operation_id, version_id, bucket, prefix, object_key, sha256, size_bytes)
    values (p_workspace_id, p_owner_id, p_operation_id, p_version_id, p_bucket, p_prefix, v_key, p_sha256, p_size_bytes)
    on conflict (workspace_id, operation_id) do nothing;
  if not exists (select 1 from public.storage_uploads u where u.workspace_id = p_workspace_id and u.owner_id = p_owner_id
    and u.operation_id = p_operation_id and u.version_id = p_version_id and u.bucket = p_bucket
    and u.prefix = p_prefix
    and u.object_key = v_key and u.sha256 = p_sha256 and u.size_bytes = p_size_bytes) then
    raise exception 'Upload operation was already reserved with different content';
  end if;
  return query select u.bucket, u.object_key, u.verified_at is not null from public.storage_uploads u
    where u.workspace_id = p_workspace_id and u.operation_id = p_operation_id;
end $$;

create function public.storage_confirm_upload(p_owner_id uuid, p_workspace_id uuid,
  p_operation_id uuid, p_version_id uuid, p_sha256 text, p_size_bytes bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.storage_uploads set verified_at = now()
    where workspace_id = p_workspace_id and owner_id = p_owner_id and operation_id = p_operation_id
      and version_id = p_version_id and sha256 = p_sha256 and size_bytes = p_size_bytes;
  if not found then raise exception 'Upload reservation does not match verified object'; end if;
end $$;

create function public.storage_publish_version(p_owner_id uuid, p_workspace_id uuid,
  p_operation_id uuid, p_file_id uuid, p_version_id uuid, p_kind text, p_path text,
  p_parent_ids uuid[], p_device_id text, p_bucket text default null, p_object_key text default null,
  p_sha256 text default null, p_size_bytes bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_stored_hash text;
  v_result jsonb;
  v_sequence bigint;
  v_parents uuid[] := array(select x from unnest(coalesce(p_parent_ids, '{}'::uuid[])) x order by x);
  v_exists boolean;
begin
  if p_kind is null or p_kind not in ('content', 'rename', 'tombstone', 'restore')
      or p_device_id is null or length(p_device_id) not between 1 and 200 then
    raise exception 'Invalid version';
  end if;
  v_hash := encode(extensions.digest(jsonb_build_array(p_owner_id, p_workspace_id, p_file_id, p_version_id,
    p_kind, p_path, v_parents, p_device_id, p_bucket, p_object_key, p_sha256, p_size_bytes)::text, 'sha256'), 'hex');
  perform 1 from public.storage_workspaces where id = p_workspace_id and owner_id = p_owner_id for update;
  if not found then raise exception 'Workspace ownership mismatch'; end if;
  select o.result, o.payload_hash into v_result, v_stored_hash from public.storage_operations o
    where o.workspace_id = p_workspace_id and o.id = p_operation_id;
  if found then
    if v_hash <> v_stored_hash then
      raise exception 'Operation identity was reused with different data';
    end if;
    return v_result;
  end if;
  select exists(select 1 from public.storage_files where workspace_id = p_workspace_id and id = p_file_id) into v_exists;
  if v_exists and cardinality(v_parents) = 0 then raise exception 'Existing file requires a parent'; end if;
  if not v_exists and cardinality(v_parents) <> 0 then raise exception 'New file cannot reference parents'; end if;
  if cardinality(v_parents) <> (select count(distinct x) from unnest(v_parents) x) then
    raise exception 'Duplicate parent';
  end if;
  if cardinality(v_parents) <> (select count(*) from public.storage_versions v
      where v.workspace_id = p_workspace_id and v.file_id = p_file_id and v.id = any(v_parents)) then
    raise exception 'Parent does not belong to file';
  end if;
  if p_kind = 'tombstone' then
    if p_path is not null or p_bucket is not null or p_object_key is not null or p_sha256 is not null or p_size_bytes is not null then
      raise exception 'Tombstone cannot reference content';
    end if;
  elsif p_kind = 'rename' then
    if not exists(select 1 from public.storage_versions v where v.workspace_id = p_workspace_id
      and v.file_id = p_file_id and v.id = any(v_parents) and v.bucket = p_bucket
      and v.object_key = p_object_key and v.sha256 = p_sha256 and v.size_bytes = p_size_bytes) then
      raise exception 'Rename must preserve content from a parent';
    end if;
  elsif not exists(select 1 from public.storage_uploads u where u.workspace_id = p_workspace_id
      and u.owner_id = p_owner_id and u.operation_id = p_operation_id and u.version_id = p_version_id
      and u.bucket = p_bucket and u.object_key = p_object_key and u.sha256 = p_sha256
      and u.size_bytes = p_size_bytes and u.verified_at is not null) then
    raise exception 'Uploaded content has not been verified';
  end if;
  if not v_exists then
    insert into public.storage_files(workspace_id, owner_id, id) values (p_workspace_id, p_owner_id, p_file_id);
  end if;
  insert into public.storage_versions(workspace_id, file_id, owner_id, id, kind, path, bucket,
    object_key, sha256, size_bytes, author_id, device_id)
    values (p_workspace_id, p_file_id, p_owner_id, p_version_id, p_kind, p_path, p_bucket,
      p_object_key, p_sha256, p_size_bytes, p_owner_id, p_device_id);
  insert into public.storage_version_parents(workspace_id, file_id, version_id, parent_id)
    select p_workspace_id, p_file_id, p_version_id, x from unnest(v_parents) x;
  delete from public.storage_heads where workspace_id = p_workspace_id and file_id = p_file_id and version_id = any(v_parents);
  insert into public.storage_heads(workspace_id, file_id, version_id) values (p_workspace_id, p_file_id, p_version_id);
  insert into public.storage_cursors(workspace_id, last_sequence) values (p_workspace_id, 0) on conflict do nothing;
  update public.storage_cursors set last_sequence = last_sequence + 1 where workspace_id = p_workspace_id returning last_sequence into v_sequence;
  insert into public.storage_changes(workspace_id, sequence, file_id, version_id)
    values (p_workspace_id, v_sequence, p_file_id, p_version_id);
  v_result := jsonb_build_object('sequence', v_sequence, 'fileId', p_file_id, 'versionId', p_version_id,
    'heads', (select coalesce(jsonb_agg(h.version_id order by h.version_id), '[]'::jsonb)
      from public.storage_heads h where h.workspace_id = p_workspace_id and h.file_id = p_file_id));
  insert into public.storage_operations(workspace_id, owner_id, id, payload_hash, result)
    values (p_workspace_id, p_owner_id, p_operation_id, v_hash, v_result);
  return v_result;
end $$;

revoke all on function public.storage_reserve_upload(uuid, uuid, uuid, uuid, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.storage_confirm_upload(uuid, uuid, uuid, uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.storage_publish_version(uuid, uuid, uuid, uuid, uuid, text, text, uuid[], text, text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.storage_reserve_upload(uuid, uuid, uuid, uuid, text, text, text, bigint) to service_role;
grant execute on function public.storage_confirm_upload(uuid, uuid, uuid, uuid, text, bigint) to service_role;
grant execute on function public.storage_publish_version(uuid, uuid, uuid, uuid, uuid, text, text, uuid[], text, text, text, text, bigint) to service_role;

create function public.storage_list_path_conflicts(p_workspace_id uuid)
returns table (path text, file_ids uuid[])
language sql security invoker set search_path = '' as $$
  select v.path, array_agg(distinct h.file_id order by h.file_id)
  from public.storage_heads h
  join public.storage_versions v on v.workspace_id = h.workspace_id
    and v.file_id = h.file_id and v.id = h.version_id
  where h.workspace_id = p_workspace_id and v.path is not null
  group by v.path
  having count(distinct h.file_id) > 1
$$;
revoke all on function public.storage_list_path_conflicts(uuid) from public, anon;
grant execute on function public.storage_list_path_conflicts(uuid) to authenticated;
