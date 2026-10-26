# Cloud file synchronization design

## Existing data and rollout

The Storage backup feature selects local paths, uploads to an S3-compatible bucket by path, and
restores by replacing matching local files. Its folder, provider selection, and schedule settings
live in `~/.kucedr/storage/settings.json`; S3 credentials are encrypted with Electron
`safeStorage`. Version history sync is a separate, opt-in path. It does not interpret existing
backup objects as published versions or remove them. Backup settings are migrated from the former
`settings/app.json` `cloud` field into the dedicated store. The legacy backup path remains available
until an explicit, verified import assigns file identities and hashes to existing objects. Existing
working files remain at their selected locations.

Version synchronization requires a deployed Supabase schema and Edge Functions plus server-side
storage configuration. The desktop app must not treat a configured project URL or an S3 bucket
alone as proof that those services exist.

## Local ownership and durability

Resolve `storage/` under `userDataLocation()`, which normally returns `~/.kucedr` and supports
the existing E2E data-root override. Partition state and blobs by account and workspace; reject
an account mismatch before opening a partition. Never traverse `storage/` as selected user
content, even if its parent is selected.

| Path                    | Responsibility                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `storage/settings.json` | Selected backup folders, provider ID, and schedule. Migrated from the former `settings/app.json` `cloud` field.       |
| `storage/config.json`   | Versioned, nonsecret provider, bucket, region, prefix, Supabase URL, and sync settings; atomic replacement.           |
| `storage/state.sqlite`  | Transactional local versions, parents, heads, operations, upload progress, conflicts, retry state, and change cursor. |
| `storage/blobs/`        | Immutable snapshots; pending snapshots are irreplaceable until publication is confirmed.                              |
| `storage/staging/`      | Partial transfers and temporary files; safe to remove only after examining pending operations.                        |
| `storage/locks/`        | Reserved for process coordination; the app currently holds a single-instance lock.                                    |
| `storage/logs/`         | Bounded event-count diagnostics without credentials, paths, or file content.                                          |

An edit is saved to a staged file, flushed, atomically installed in `blobs/`, then recorded with
its pending operation in one SQLite transaction. The UI can then report “Saved locally / Pending
upload.” A local save is durable on that device; it cannot survive loss of the only device before
cloud publication. Keep unconfirmed blobs through failed and interrupted transfers. Treat disk
full, corrupt SQLite, and newer schema/config versions as explicit errors; preserve files for
repair rather than creating empty replacement state.

## Remote metadata and authorization

S3 stores immutable content only. Supabase Postgres is the sole version database. Required
records are tenant-owned file identities, immutable versions with SHA-256/size/S3 reference and
author/device, version-parent edges, possibly multiple current heads, tombstones, versioned
paths, idempotent publication operations, and a durable change feed. Application version IDs
are separate from S3 object version IDs. Parent edges decide concurrency, never timestamps.

The desktop client authenticates as a user and receives narrowly scoped upload authorization
from a trusted backend. The backend verifies the object hash, size, reference, and ownership
before calling a transactional publication RPC. The RPC checks tenant access, operation identity,
parents, content reference, file state, and path constraints. One Postgres transaction inserts the
version and parents, updates heads, and appends a discoverable change. Its operation ID makes a
lost response safe to retry. RLS protects reads; direct client writes to these tables are denied.
AWS and service-role credentials stay on the backend. S3 keys cannot be overwritten after
publication; ETag is not a full-file checksum.

## Sync and recovery

After enabling Version history sync in Settings → Storage, the main process watches selected
folders and snapshots added, changed, and removed files. It retries after sign-in and on a
one-minute timer, including after missed filesystem or network notifications. A snapshot is
durable locally before upload; until publication succeeds, loss of that device loses the only
copy. The watcher and retry loop require the app to be running. Existing working files are kept
during catch-up; new cloud files are installed only when the destination does not exist.

An upload may succeed while publication fails. On restart, retry pending operations by stable
operation ID, check publication status after an uncertain response, and reuse or verify the
already uploaded immutable object. Mark local work synced only after confirmed publication.
Catch up from the durable change feed after every reconnect; Realtime only triggers an earlier
catch-up. Feed sequence allocation must follow commit visibility so a cursor cannot skip a
transaction that commits late.

Concurrent edits remain separate heads. A merge creates a new version with both parents;
edit/delete and rename/path collisions remain explicit conflicts. Deletions are tombstones and
history restoration creates a new version. Download to `staging/`, verify SHA-256, and install
new working files atomically when the destination is absent. Existing working files are never
overwritten by catch-up, preserving edits made during download for conflict review. Preserve
newer local edits and pending snapshots. Evict only recoverable cached blobs; retain cloud history
by default. Enable S3 Versioning for additional object recovery. Recovering the service requires
coordinating a Supabase metadata backup with the corresponding S3 objects; restoring either one
alone can leave published versions without content or content without discoverable metadata.

## Two-way sync across devices

Planned changes so every desktop on an account converges on the same workspace, transferring
only changed files. The design above already provides content-addressed blobs, parent edges,
heads, and a per-device change cursor; these items close the gaps in the current code.

### Fast-forward apply in catch-up

Today `cloud/catchup.ts` installs a working file only when its path is absent
(`cloud/install_working.ts` links and gives up on `EEXIST`), so edits, deletions, and renames
made on another device never reach existing files. Replace that with a fast-forward rule per
incoming change:

- **Unchanged locally.** The local file is unchanged since the last sync when
  `working_files.content_hash` equals the content hash of one of the incoming version's parents
  (from `remote_parents` joined to `remote_versions`) and that parent is in `local_heads`.
- **`content` / `restore`.** If unchanged locally, write the content to `staging/`, fsync, and
  `rename` over the working file. Then update `working_files` (hash, `modified_ns`, `size_bytes`)
  and replace the file's `local_heads` row with the incoming version.
- **`tombstone`.** If unchanged locally, remove the working file, delete its `working_files` row,
  and record the tombstone as the local head.
- **`rename`.** If unchanged locally and the new path is free, move the file and update
  `relative_path` in `local_files` and `working_files`. An occupied destination stays a path
  conflict.
- **Changed locally.** Leave the working file untouched. The existing multiple-head conflict row
  from `local/change.ts` keeps both versions for review.
- **Edit during download.** Re-hash the working file immediately before the `rename` or removal.
  If it no longer matches the expected parent hash, abort the apply and leave a conflict. This
  check runs while the main process holds the storage lock, which also serializes it with
  `scanWorkspace`.

New paths keep the current behavior: they are installed only when the destination is absent.

### Stat-based change detection

`cloud/scan.ts` reads and hashes every file on every scan. Compare `lstat` `mtimeNs` and `size`
against `working_files.modified_ns` and `size_bytes` first, and read and hash only on a mismatch.
Write both columns whenever a hash is recorded, including after a fast-forward install, so the
next scan does not re-upload content the device just received. A scan that finds a changed
file still uses the existing snapshot and pending-operation path.

### Reuse local blobs

Catch-up downloads content for every change, including versions this device published. Before
calling `cloud.download`, check `storage/blobs/<scope hash>/<sha256>`. If the blob exists and
verifies, use it and skip the transfer.

### Not planned yet

- Chunked or delta transfer. Add it when files above the 50 MiB object limit are needed.
- Conflict-resolution controls in Settings. The merge primitives exist; see the limitations below.

## Service setup

Apply both migrations under `supabase/migrations/` in filename order to the intended Supabase
project before enabling version sync. Deploy the `storage-provider`, `storage-upload`,
`storage-publish`, and `storage-download` Edge Functions from `supabase/functions/`. Configure
`STORAGE_PROVIDER_ENCRYPTION_KEY` as a base64-encoded 32-byte server secret; generate it with
`openssl rand -base64 32`, keep a secure backup, and never put it in a desktop build or local
storage config. The backend registers each saved S3-compatible provider and encrypts its S3
credentials at rest. Scope each provider's IAM credentials to its own bucket and prefix, reject
overwrites, and enable S3 Versioning. See [File sync backend](../supabase/README.md) for the
legacy global S3 settings retained for older versions.

The desktop build uses only the project's public Supabase URL and publishable key as described
in [Supabase Adapter](SUPABASE.md). Validate with two separate accounts: each account must be
unable to list or publish the other's workspace, versions, and objects. Keep the old backup
settings and S3 objects until an explicit import has checked the object bytes and installed the
corresponding metadata; the version-sync database migration does not convert them.

## Current limitations

- The backend migrations and Edge Functions require deployment to the target Supabase project and
  a configured S3-compatible provider before version history sync can operate.
- Existing S3 backup objects remain intact but are not automatically converted to immutable
  versions. Their old backup and restore path remains available when version history sync is off.
- The first sync registers the selected saved provider's credentials with the trusted backend,
  after saving local edits. The backend encrypts them with its server-only key. Existing legacy versions with no
  provider ID continue to use their original global S3 environment configuration.
- Catch-up installs only new working files. Existing paths stay in place even when a newer cloud
  version is available; the local cache and conflict list retain the alternative version. The
  merge and historical-restore primitives are present in main-process code but have no conflict
  resolution controls in Settings yet.
- `maxCacheBytes` is reserved for future cache eviction. No immutable blob is automatically
  deleted, so pending local work is never evicted, but the storage directory can grow.
- Custom S3-compatible endpoints require backend network egress controls. URL validation rejects
  local addresses and unsafe URL fields, but it cannot prevent a public hostname from later
  resolving to a private address.
