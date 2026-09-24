# File sync backend

Apply `migrations/20260923000000_storage_versions.sql` to the Supabase project before deploying the storage Edge Functions. This migration adds only `storage_*` objects; it does not change existing chat or backup tables. Deploy `storage-provider`, `storage-upload`, `storage-publish`, and `storage-download` with Supabase JWT verification enabled.

Set these secrets in the Edge Function environment:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project API URL |
| `SUPABASE_ANON_KEY` | Public key used to validate the caller's user JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for the restricted publication RPCs |
| `STORAGE_PROVIDER_ENCRYPTION_KEY` | Base64-encoded 32-byte AES-GCM key used to encrypt saved provider credentials on the server |
| `S3_BUCKET`, `S3_REGION`, `S3_PREFIX` | Legacy environment-backed versions with no provider ID; keep their original values while those versions remain accessible |
| `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` | Legacy endpoint and path-style settings, if used |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Legacy server-only S3 credentials, if legacy versions exist |

Generate a fresh backend encryption key with `openssl rand -base64 32` and set it through the
Supabase Dashboard's Edge Function Secrets or `supabase secrets set --env-file <ignored-file>`.
Keep the key outside Git, desktop builds, and `~/.kucedr/storage/config.json`. Back up the key
securely: losing it makes registered provider credentials unreadable. Rotate it only with a
coordinated re-encryption or provider re-registration procedure.

When a user enables version sync for a saved S3-compatible provider, the authenticated
`storage-provider` function registers that provider's bucket, region, endpoint, path-style
setting, prefix, and credentials. The backend encrypts the access-key fields with the key above
and stores them in `storage_provider_connections`; authenticated clients cannot read or write
that table directly. The same provider ID may rotate credentials, while its bucket, region,
endpoint, path style, and prefix remain fixed. A different target needs a new provider ID.
Each upload reservation records its provider ID, and published versions retain it so later
provider changes do not redirect historical downloads. Existing versions whose provider ID is
null continue to use their original global S3 environment settings.

Each provider's IAM principal needs `s3:PutObject` and `s3:GetObject` only for its bucket/prefix. Deny public access and normal overwrites. Upload URLs sign `If-None-Match: *` and SHA-256 checksum headers; clients must send the returned headers exactly. Configure S3 CORS for the application's upload origin if a browser-based caller is used. Enable S3 Versioning as an additional recovery layer.

The `storage-upload` function reserves `{providerId, operationId, versionId, sha256, sizeBytes}` for one account/workspace and returns a ten-minute conditional PUT URL. `storage-publish` reads the entire object back, verifies its size and SHA-256, and then calls the transactional `storage_publish_version` RPC. A rename reuses a parent's verified content reference; a tombstone has no object. `storage-download` grants a ten-minute GET URL only for a published version owned by the caller. All functions derive owner identity from the Supabase user JWT. Clients receive short-lived object URLs, never server-side keys.

`storage_changes.sequence` is allocated while locking the workspace row inside the publication transaction. Query changes by `workspace_id` and `sequence > last_seen`, ordered by sequence, and persist the cursor only after locally applying each result. Realtime can prompt this query but cannot replace it. `storage_heads` exposes concurrent versions; `storage_list_path_conflicts(workspace_id)` exposes current path collisions across file identities.

For coordinated disaster recovery, restore S3 content and Supabase metadata to mutually consistent points. Check every restored version's object key, size, and SHA-256 before resuming publication. Keep orphaned uploaded objects until their operation status and any recovered metadata have been reconciled. Never restore metadata that points to missing content without marking those versions unavailable for repair.

The migration and functions have not been applied to a live project by this repository. Run tenant-isolation, duplicate-operation, conflict, and object-integrity integration tests against the target project before release.

In Settings → Storage, select an existing saved S3 provider and folders, sign in, then enable
**Version history sync**. Kucedr stores only the provider ID and nonsecret target settings in
`~/.kucedr/storage/config.json`. Its saved desktop S3 credentials are sent to the authenticated
registration function for encrypted server storage. Keep the older backup mode available until
the new backend is deployed and tested. Newly selected folders get workspace IDs in `config.json`;
copy the corresponding ID when pairing the same workspace on another device.
