# Account and Cloud Architecture

Kucedr separates account services from folder backup. Accounts use a build-configured backend;
folder backup uses an S3-compatible storage provider selected in Settings → Cloud. Backup users
configure the bucket, region, optional endpoint, access key, and secret key themselves.

AI model, search, database, storage, and messaging providers are user-configured services.
The infrastructure behind a Kucedr account is configured by the application distributor.

## Boundaries

The main process owns infrastructure SDKs and persistent credential stores. Typed IPC connects
the renderer to application services; trusted settings views can edit provider credentials.

| Capability                     | Application service | Port                 | Current adapter             |
| ------------------------------ | ------------------- | -------------------- | --------------------------- |
| Account lifecycle and profile  | `cloud/service.ts`  | `AccountProvider`    | `cloud/supabase/auth.ts`    |
| Conversation records and files | `cloud/data.ts`     | `CloudRepository`    | `cloud/supabase/records.ts` |
| Folder backup objects          | `storage/*`         | `StorageObjectStore` | `storage/s3/store.ts`       |

`bootstrap.ts` is the composition root. It creates the Supabase client for account and cloud
record services. Folder transfers resolve the selected storage provider and create an S3 client
for each transfer through `storage/s3/transfer.ts`.

## Security and lifecycle rules

- Only `signedIn` grants a user ID or access token. Loading, signed-out, confirmation, recovery,
  and unconfigured states cannot read account profiles or cloud records. Folder backups use
  separate storage credentials and do not require account sign-in.
- Public auth state never contains access or refresh tokens. Provider error identifiers are mapped
  to stable `AuthError` or `CloudError` messages before crossing IPC.
- Sessions are encrypted with operating-system secure storage. Provider API keys are stored as
  entered in local provider settings and are not synchronized through the account service.
- The first fully signed-in account is bound to the local Kucedr profile. A different account is
  rejected to prevent accidental cross-account access.
- Scheduled backups require a selected provider, selected folders, and an enabled schedule.
  Shutdown waits for active storage work before tearing down cloud and account services.

## Folder backup semantics

Cloud Backup is an incremental upload plus an explicit restore, not bidirectional file-system
synchronization. Backup overwrites matching remote objects and retains other remote objects.
Restore atomically replaces matching local files and retains other local files.

Kucedr rejects filesystem roots, symbolic-link crossings, sensitive settings/provider folders,
and files larger than 50 MiB. Traversal and transfer are sequential to keep memory and open-file
usage bounded. Operation revisions prevent delayed snapshots from overwriting newer UI status.

## Credential storage

Model, database, and search keys are stored as entered in `~/.kucedr/settings/providers.json`.
They are not automatically synchronized by the account service. Storage secret keys use Electron
`safeStorage`, and saving them requires secure device storage. Account sessions also use
`safeStorage`; without secure encryption, sessions remain in memory. The current implementation
does not provide the previously described passphrase-based key-sync workflow.

Backup object prefixes are `kucedr/v1/<built-in-folder>/` or a hash-based custom-folder prefix.
They are not account user-ID prefixes. Use bucket policies and credentials appropriate for the
selected backup destination.

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
