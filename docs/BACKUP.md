# Backup

Folder backup to S3-compatible storage. A backup **service** is a plugin script of type
`STORAGE`. The built-in one is `resources/plugins/bootstrap/scripts/backup-s3`.

- **Settings → Scripts → <script>**: the script's detail page holds the storage connection
  (bucket, region, endpoint, access key, secret key). It saves an S3 provider with
  `window.storage.saveProvider` (`storage/providers/*`; the secret is encrypted with
  `safeStorage`) and stores its ID as `providerId` in the backup settings.
- **Settings → Cloud**: select the STORAGE script (`serviceId`), choose folders, and set the cron
  schedule. **Configure** opens the selected script's detail page.

## Main process: `src/main/backup/`

| File | Responsibility |
|---|---|
| `store.ts` | Settings in `~/.kucedr/storage/settings.json`: `serviceId`, `providerId`, `paths`, `syncEnabled`, `syncCronExpression`. Saving rejects an unknown script or provider. |
| `normalize.ts` | Settings validation; rejects an invalid cron expression. |
| `schedule.ts` | `node-cron` task (`noOverlap`); rescheduled after every save; `nextStorageSync()` for the UI. |
| `run.ts` | One scheduled backup and its logging. A schedule runs only with a script, a provider, folders, and `syncEnabled`. |
| `operations.ts` | `StorageOperations`: one running operation, status revisions, wait/settle. |
| `fork.ts` | Runs the selected STORAGE script in a utility process with the saved provider, folders, and protected root (the script's `inputSchema`). |

Version-history sync (`storage/cloud/*`) uses the same `providerId`.

## IPC (`window.storage`, trusted renderers only)

`listProviders` / `saveProvider` / `removeProvider`, `getSettings` / `saveSettings`,
`getNextRun`, `pickFolders`, `syncFolders`, `backup`, `restore`, `getOperationStatus`, and
`onOperationStatusChanged`. The Cloud page lists services with `window.scripts.list()`, filtered
to `type === 'STORAGE'`.

## Data flow

```
Scripts → backup-s3 ──saveProvider──▶ storage/providers (encrypted)   settings.providerId
Settings → Cloud ──saveSettings──▶ backup/store (serviceId, paths, cron) ──▶ backup/schedule
Upload / schedule ──▶ backup/operations ──▶ backup/fork ──▶ selected STORAGE script ──▶ S3
```

## Encryption

The storage form has an optional **Backup passphrase**. It is saved next to the S3 provider and
sealed with `safeStorage` like the secret key (`encryptedPassphrase`); the renderer only sees
`hasPassphrase`, and saving with the field empty keeps the saved passphrase. It must be at least
8 characters. A lost passphrase makes the encrypted backups unrecoverable.

With a passphrase, `backup-s3` encrypts every file into its staging file before upload, so no
plaintext copy is written to the temp folder. Each object is:

```
"\0kbackup" (8) ‖ salt (16) ‖ IV (12) ‖ AES-256-GCM ciphertext ‖ tag (16)
```

The object key is the additional authenticated data, so an object cannot be moved to another
key. The key is `scrypt(passphrase, salt, 32, N 2^17, r 8, p 1)`, derived once per run with one
random salt per run. Files sealed by the encrypted data folder (`"\0kvault1"`) are opened with the
vault key (sent by `fork.ts` only for a backup with a passphrase) and their plaintext is
encrypted, so the backup restores on another device; without the vault key they are encrypted as
they are. Without a passphrase, files upload unchanged, as before.

Restore decrypts objects that start with `"\0kbackup"` into a second temp file next to the target
and renames it only after the tag verifies. A missing or wrong passphrase, or a changed object,
stops the whole restore. Other objects restore as they are, so older unencrypted buckets still
work. After a restore, `fork.ts` runs `convertVault()` when the encrypted data folder is on, so
restored plaintext is sealed again.

Not hidden: object keys still show folder and file names, and object sizes show file sizes
(plus 52 bytes). Backups stay a mirror without history.

## Verification

```sh
npm run typecheck:app
npx jest --selectProjects main tests/unit/main/storage tests/unit/main/ipc/storage.test.ts \
  tests/unit/main/preload/storage.test.ts tests/unit/main/cloud/storage-sync-schedule.test.ts
```

Manually: save a bucket on the Backup S3 script page, select **Backup S3** under
Settings → Cloud, add a folder, and run Upload. Set the custom cron `*/1 * * * *` and check that
"Next backup" appears; an invalid expression shows an inline error and keeps the previous
schedule.
