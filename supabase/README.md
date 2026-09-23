# File sync backend

Apply `migrations/20260923000000_storage_versions.sql` to the Supabase project before deploying the three Edge Functions. This migration adds only `storage_*` objects; it does not change existing chat or backup tables. Deploy `storage-upload`, `storage-publish`, and `storage-download` with Supabase JWT verification enabled.

Set these secrets in the Edge Function environment:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project API URL |
| `SUPABASE_ANON_KEY` | Public key used to validate the caller's user JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for the restricted publication RPCs |
| `S3_BUCKET` | Private immutable-content bucket |
| `S3_REGION` | Bucket region |
| `S3_PROVIDER_ID` | ID of the matching saved S3 provider selected in Kucedr |
| `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` | Optional S3-compatible endpoint and path-style flag matching that provider |
| `S3_PREFIX` | Optional server-controlled prefix, without surrounding slashes |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Server-only IAM credentials |

The IAM principal needs `s3:PutObject` and `s3:GetObject` only for the chosen bucket/prefix. Deny public access and normal overwrites. Upload URLs sign `If-None-Match: *` and SHA-256 checksum headers; clients must send the returned headers exactly. Configure S3 CORS for the application's upload origin if a browser-based caller is used. Enable S3 Versioning as an additional recovery layer.

The `storage-upload` function reserves `{operationId, versionId, sha256, sizeBytes}` for one account/workspace and returns a ten-minute conditional PUT URL. `storage-publish` reads the entire object back, verifies its size and SHA-256, and then calls the transactional `storage_publish_version` RPC. A rename reuses a parent's verified content reference; a tombstone has no object. `storage-download` grants a ten-minute GET URL only for a published version owned by the caller. All three functions derive owner identity from the Supabase user JWT. Clients never receive AWS or service-role credentials.

`storage_changes.sequence` is allocated while locking the workspace row inside the publication transaction. Query changes by `workspace_id` and `sequence > last_seen`, ordered by sequence, and persist the cursor only after locally applying each result. Realtime can prompt this query but cannot replace it. `storage_heads` exposes concurrent versions; `storage_list_path_conflicts(workspace_id)` exposes current path collisions across file identities.

For coordinated disaster recovery, restore S3 content and Supabase metadata to mutually consistent points. Check every restored version's object key, size, and SHA-256 before resuming publication. Keep orphaned uploaded objects until their operation status and any recovered metadata have been reconciled. Never restore metadata that points to missing content without marking those versions unavailable for repair.

The migration and functions have not been applied to a live project by this repository. Run tenant-isolation, duplicate-operation, conflict, and object-integrity integration tests against the target project before release.

In Settings → Storage, select the existing saved S3 provider and folders, sign in, then enable
**Version history sync**. Kucedr stores only the provider ID and nonsecret bucket, region, and
prefix in `~/.kucedr/storage/config.json`; its saved desktop AWS secret is not sent to the Edge
Functions. Configure the same provider on the server with the environment values above. The
server currently serves one provider per deployment. Keep the older backup mode available until
the new backend is deployed and tested. Newly selected folders get workspace IDs in `config.json`;
copy the corresponding ID when pairing the same workspace on another device.
