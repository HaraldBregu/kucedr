# Account and Cloud Architecture

Kucedr presents one provider-neutral account and cloud experience. People sign in, choose backup
folders, and restore files from the application UI. Infrastructure endpoints, buckets,
credentials, and vendor names are never user settings.

AI model, search, database, and messaging providers are a separate product concept. Users choose
those services deliberately; they do not choose the infrastructure behind a Kucedr account.

## Boundaries

The main process owns every credential and infrastructure SDK. Shared types, preload APIs, IPC,
and renderer code use Kucedr domain terms only.

| Capability                       | Application service | Port                 | Current adapter               |
| -------------------------------- | ------------------- | -------------------- | ----------------------------- |
| Account lifecycle and profile    | `cloud/service.ts`  | `AccountProvider`    | `cloud/supabase/auth.ts`      |
| Conversation records and files   | `cloud/data.ts`     | `CloudRepository`    | `cloud/supabase/records.ts`   |
| Folder backup objects            | `storage/*`         | `StorageObjectStore` | `cloud/supabase/objects.ts`   |

`bootstrap.ts` is the composition root. It creates the concrete client once and injects each
adapter independently. No application service constructs an SDK client or imports SDK types.

## Security and lifecycle rules

- Only `signedIn` grants a user ID or access token. Loading, signed-out, confirmation, recovery,
  and unconfigured states cannot read profiles, cloud records, or backup objects.
- Public auth state never contains access or refresh tokens. Provider error identifiers are mapped
  to stable `AuthError` or `CloudError` messages before crossing IPC.
- Sessions are encrypted with operating-system secure storage. Provider API keys are stored as
  entered in local provider settings and are not synchronized through the account service.
- The first fully signed-in account is bound to the local Kucedr profile. A different account is
  rejected to prevent accidental cross-account access.
- Scheduled backups exist only while signed in. Shutdown waits for active storage work before
  tearing down cloud and account services.

## Folder backup semantics

Cloud Backup is an incremental upload plus an explicit restore, not bidirectional file-system
synchronization. Backup overwrites matching remote objects and retains other remote objects.
Restore atomically replaces matching local files and retains other local files.

Kucedr rejects filesystem roots, symbolic-link crossings, sensitive settings/provider folders,
and files larger than 50 MiB. Traversal and transfer are sequential to keep memory and open-file
usage bounded. Operation revisions prevent delayed snapshots from overwriting newer UI status.

## Secure key sync

Model, database, and search API keys are encrypted locally with AES-256-GCM. Secure key sync wraps
the data key with a separate passphrase before storing it remotely. The passphrase and plaintext
keys are not sent to the account service.

Reconciliation uses client modification time plus device ID as a deterministic tie-breaker,
persists tombstones for deletions, retains dirty writes while offline, drains edits made during an
active upload, retries transient failures, and stops with an error if a pass makes no progress.

## Replacing an adapter

1. Implement the relevant port without changing renderer or shared API types.
2. Construct the adapter in `bootstrap.ts` and inject it into the existing application service.
3. Map infrastructure errors to provider-neutral public errors.
4. Run the port/service contract tests and add adapter-specific tests for rollback and event
   behavior.
5. Keep infrastructure configuration in the build/runtime environment, never in user settings.

The current infrastructure-specific setup is documented in [Supabase Adapter](SUPABASE.md).

## Verification

```sh
npm run typecheck:app
npm run test:main -- --runInBand
npm run test:renderer -- --runInBand
```
