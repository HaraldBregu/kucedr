# Backup

Folder backup to S3-compatible storage. Under Settings → Cloud the user picks a **storage
service**, chooses folders, and sets a cron schedule. The app uses that service for manual and
scheduled backups and restores, and version-history sync uses the same service.

## Storage services

A plugin offers a storage service as `services/<id>/manifest.json` with `type: "STORAGE"`. The
built-in `resources/plugins/s3` plugin provides `s3/storage`:

```
resources/plugins/s3/
  manifest.json                  settings.inputSchema: bucket, region, endpoint,
                                 forcePathStyle, accessKeyId, secretAccessKey (password)
  services/storage/manifest.json { "id": "storage", "type": "STORAGE", ... }
```

The connection values are ordinary plugin settings. The user edits them on the plugin page
(Settings → Plugins → S3). `password` fields are encrypted with Electron `safeStorage`
(`plugins_save_settings.ts`) and decrypted only in main (`plugins_settings.ts`).

`plugins_services_read.ts` routes `STORAGE` manifests to the provider's `storage_services`, and
`loadStorageServices()` in `models.ts` lists them. Settings → Services shows them alongside
search engines.

## Main process: `src/main/backup/`

| File | Responsibility |
|---|---|
| `resolve.ts` | `resolveBackupService(serviceId)` → S3 connection from the plugin's settings. Throws when the service is missing or unconfigured, and validates the bucket and endpoint. |
| `services.ts` | `listBackupServices()`: STORAGE services with a `configured` flag for the Cloud page. |
| `store.ts` | Settings in `~/.kucedr/storage/settings.json`: `serviceId`, `paths`, `syncEnabled`, `syncCronExpression`. Saving rejects an unresolvable service. |
| `normalize.ts` | Settings validation; rejects an invalid cron expression. |
| `schedule.ts` | `node-cron` task (`noOverlap`); `rescheduleStorageSync()` after each save; `nextStorageSync()` for the UI. |
| `run.ts` | One scheduled backup and its logging. |
| `operations.ts` | `StorageOperations`: one running operation, status revisions, wait/settle. |
| `fork.ts` | Runs the `STORAGE` script (`cloud-sync-s3`) in a utility process with the resolved connection. |

`serviceId` is `<plugin>/<service>`. The former `providerId` field is dropped on load; existing
users select the service again. Credentials from the removed provider store are **not migrated**.

### Version-history sync

`storage/cloud/configure.ts` and `storage/cloud/sync.ts` resolve the selected service with
`resolveBackupService`. The backend expects a UUID provider ID, so `resolve.ts` derives a stable
UUID from the service ID, endpoint, region, and bucket. Changing the bucket therefore counts as a
provider switch, and `configure.ts` requires pending versions to be published first.

## IPC

`window.storage` (`StorageChannels`, trusted renderers only):

| Method | Purpose |
|---|---|
| `listServices()` | STORAGE services with `configured`. |
| `getSettings()` / `saveSettings(settings)` | Read and save backup settings; saving reschedules. Rejected while an operation runs. |
| `getNextRun()` | ISO time of the next scheduled backup, if any. |
| `pickFolders()`, `syncFolders()` | Folder selection. |
| `backup()`, `restore()`, `getOperationStatus()`, `onOperationStatusChanged()` | Operations. |

## Settings → Cloud

`src/renderer/src/pages/settings/pages/cloud/`:

- `Service.tsx`: a select of STORAGE services. Unconfigured services are disabled, and
  **Configure** opens the service's plugin page.
- Folders, Upload, and Download are enabled once a configured service is selected.
- Schedule: Off, presets (`constants.ts`), or a custom cron expression. An invalid expression
  shows an inline error and leaves the previous schedule active. While enabled, a "Next backup"
  row shows the next run.

## Data flow

```
Settings → Cloud ──IPC──▶ backup/store (serviceId, paths, cron) ──▶ backup/schedule (node-cron)
                                                                          │
Upload / Download ──IPC──▶ backup/operations ◀────────────── backup/run ──┘
                                  │
                           backup/fork ── resolveBackupService(serviceId) → plugin settings
                                  │
                                  ▼
                  cloud-sync-s3 (utility process) ──▶ S3 bucket
```

## Verification

```sh
npm run typecheck:app
npx jest --selectProjects main tests/unit/main/storage tests/unit/main/ipc/storage.test.ts \
  tests/unit/main/preload/storage.test.ts tests/unit/main/cloud/storage-sync-schedule.test.ts
```

Manually: configure S3 on the plugin page, select **S3 - S3 Storage** under Settings → Cloud, add
a folder, and run Upload. Then set the custom cron `*/1 * * * *` and confirm that the scheduled
run starts and "Next backup" advances.
