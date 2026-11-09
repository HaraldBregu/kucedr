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
