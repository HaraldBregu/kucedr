# Cloud file synchronization design

## Existing data and rollout

The current Cloud Backup feature selects local paths, uploads to an S3-compatible bucket by
path, and restores by replacing matching local files. Its settings live under `~/.kucedr/settings`;
S3 credentials are encrypted with Electron `safeStorage`. These backups have no version ancestry
or Supabase metadata. The new sync protocol must not interpret existing backup objects as
published versions or remove old settings or objects. Keep the backup path available until an
explicit, verified import can assign file identities and hashes to each existing object. Existing
working files remain at their selected locations.

Assumptions: legacy backup remains available during rollout; version synchronization requires a
deployed Supabase schema and Edge Functions plus server-side AWS configuration. The desktop app
must not treat a configured project URL or an S3 bucket alone as proof that those services exist.

## Local ownership and durability

Resolve `storage/` under `userDataLocation()`, which normally returns `~/.kucedr` and supports
the existing E2E data-root override. Partition state and blobs by account and workspace; reject
an account mismatch before opening a partition. Never traverse `storage/` as selected user
content, even if its parent is selected.

| Path | Responsibility |
| --- | --- |
| `storage/config.json` | Versioned, nonsecret provider, bucket, region, prefix, Supabase URL, and sync settings; atomic replacement. |
| `storage/state.sqlite` | Transactional local versions, parents, heads, operations, upload progress, conflicts, retry state, and change cursor. |
| `storage/blobs/` | Immutable snapshots; pending snapshots are irreplaceable until publication is confirmed. |
| `storage/staging/` | Partial transfers and temporary files; safe to remove only after examining pending operations. |
| `storage/locks/` | Reserved for process coordination; the app currently holds a single-instance lock. |
| `storage/logs/` | Bounded event-count diagnostics without credentials, paths, or file content. |

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

## Service setup

Apply `supabase/migrations/20260923000000_storage_versions.sql` to the intended Supabase
project before enabling version sync. Deploy the `storage-upload`, `storage-publish`, and
`storage-download` Edge Functions from `supabase/functions/`. Configure function secrets
`S3_BUCKET`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` on the trusted
backend; Supabase supplies its own URL and API keys to the functions. The AWS identity needs
only object read/write access in the dedicated version prefix and must not be bundled into the
desktop app. Configure the bucket to reject overwrites, retain objects, and enable S3 Versioning.

The desktop build uses only the project's public Supabase URL and publishable key as described
in [Supabase Adapter](SUPABASE.md). Validate with two separate accounts: each account must be
unable to list or publish the other's workspace, versions, and objects. Keep the old backup
settings and S3 objects until an explicit import has checked the object bytes and installed the
corresponding metadata; the version-sync database migration does not convert them.
