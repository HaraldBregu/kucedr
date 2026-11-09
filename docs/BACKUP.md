# Backup

Folder backup to S3-compatible storage. The user picks a **storage service**, chooses folders, and
sets a cron schedule under Settings → Cloud. The app then uses that service to run backups on
schedule or on demand.

## Current state

Backup already works end to end, but its credentials are not a service:

- `src/renderer/src/pages/settings/pages/cloud/Page.tsx` provides the folder list,
  backup/restore buttons, and the schedule picker (`SYNC_INTERVALS` presets plus a custom cron
  expression).
- `src/main/storage/storage_sync_schedule.ts` schedules backups with `node-cron`.
- `src/main/storage/fork.ts` runs the bootstrap `cloud-sync-s3` script (`type: "STORAGE"`) in a
  utility process.
- S3 credentials live in a separate store (`src/main/storage/providers/*`). The user edits them
  under Settings → Scripts → `StorageForm.tsx`, not as a service.
- Backup code shares `src/main/storage/` with version-history sync.

## Goal

1. S3 becomes a plugin **service** with `type: "STORAGE"`, configured like any other service.
2. Settings → Cloud selects a STORAGE service, the same way the assistant selects a search engine.
3. Backup logic moves into its own `src/main/backup/` module.
4. Version-history sync resolves credentials from the same selected service.
5. The old provider store is removed. There is **no migration**: existing users re-enter their S3
   credentials once in the service settings.

## 1. S3 as a STORAGE service

### New plugin `resources/plugins/s3/`

```
resources/plugins/s3/
  manifest.json
  icon.svg
  services/
    storage/
      manifest.json
```

The plugin's `manifest.json` declares the connection settings in `settings.inputSchema`:

| Key | Type | Notes |
|---|---|---|
| `endpoint` | string | Optional for Amazon S3; required for other S3-compatible providers. |
| `region` | string | Required. |
| `bucket` | string | Required. |
| `forcePathStyle` | string (`"true"`/`"false"`) | Optional; plugin settings are stored as strings. |
| `accessKeyId` | string | Required. |
| `secretAccessKey` | string, `format: "password"` | Required. |

`savePluginSettings` (`src/main/plugins/plugins_save_settings.ts`) already encrypts `password`
fields with Electron `safeStorage`, and `pluginSettings` (`src/main/plugins/plugins_settings.ts`)
decrypts them. No new credential store is needed.

`services/storage/manifest.json`:

```json
{
	"id": "storage",
	"name": "S3 Storage",
	"type": "STORAGE",
	"url": "https://s3.amazonaws.com",
	"authentication": "api-key"
}
```

### Service type plumbing

| File | Change |
|---|---|
| `src/shared/plugin_types.ts` | `PLUGIN_SERVICE_TYPES = ['SEARCH_ENGINE', 'STORAGE']`. |
| `src/main/plugins/plugins_services_read.ts` | Route `STORAGE` manifests to a `storage` array instead of always into `web_search`. This resolves the existing `ponytail:` note. |
| `src/main/models.ts` | Add `loadStorageServices()`, mirroring `loadWebSearches()` and reusing the existing `storages` / `CatalogStorage` slot. |
| `src/shared/provider_types.ts` | Add `CatalogStorageService` (manifest + `provider`), or extend `CatalogStorage`. |
| `src/main/ipc/services.ts` | Return web-search and storage services. |
| `src/renderer/src/pages/settings/pages/services/Page.tsx` | Type the list as a union. The existing type filter will show `STORAGE` automatically. |
| `resources/plugins/brave/services/README.md` | Document `STORAGE` as an allowed `type`. |

## 2. `src/main/backup/` module

Backup moves out of `storage/` into its own module, with one function or class per file:

| New file | Moved from | Responsibility |
|---|---|---|
| `backup/store.ts` | `storage/storage_store.ts`, `storage/storage_config.ts` | Settings: `serviceId`, `paths`, `enabled`, `cron`. The file stays at `~/.kucedr/storage/settings.json`. |
| `backup/schedule.ts` | `storage/storage_sync_schedule.ts` | `startBackupSchedule`, `stopBackupSchedule`, `rescheduleBackup` (node-cron, `noOverlap`). |
| `backup/next.ts` | — | Next run time from the active task (`task.getNextRun()`). |
| `backup/run.ts` | `storage/storage_auto_sync.ts` | A scheduled run plus logging. |
| `backup/operations.ts` | `storage/storage_operations.ts` | `BackupOperations` (status, revisions, wait, settle). |
| `backup/fork.ts` | `storage/fork.ts` | Spawns the STORAGE script with the resolved credentials. |
| `backup/resolve.ts` | replaces `storageProviders.resolve` | `serviceId` → S3 credentials from `pluginSettings(pluginId)`. |
| `backup/index.ts` | `storage/index.ts` (backup exports) | Public exports. |

### Settings shape

```ts
interface BackupSettings {
	serviceId?: string; // "<plugin>/<service>", e.g. "s3/storage"
	paths: string[];
	enabled: boolean;
	cron: string; // default '0 3 * * *'
}
```

- `providerId` is replaced by `serviceId`. An old `providerId` is ignored and dropped on the next
  save. There is no migration.
- `saveBackupSettings` rejects an invalid `cron` (`cron.validate`). It also rejects `enabled: true`
  unless `serviceId` resolves to a configured service and at least one folder is selected.
- `src/shared/storage_types.ts` → move the backup types to `src/shared/backup_types.ts`
  (`BackupSettings`, `BackupOperationStatus`, and so on).

### Resolving the service

`backup/resolve.ts`:

1. Find the service in `loadStorageServices()` by `<provider.id>/<id>`. If it is missing, throw
   "Select a storage service for backup."
2. Read `pluginSettings(provider.id)`. If `region`, `bucket`, `accessKeyId`, or `secretAccessKey`
   is missing, throw "Configure this storage service before selecting it."
3. Return `{ protocol: 's3', endpoint, region, bucket, forcePathStyle, accessKeyId,
   secretAccessKey }`. This is the `provider` object the `cloud-sync-s3` script's `inputSchema`
   already expects, so the script does not change.

### Version-history sync

`src/main/storage/cloud/sync.ts` and `src/main/storage/cloud/configure.ts` call `resolveBackupService`
in place of `storageProviders.resolve` / `storageProviders.list()`. The provider id registered with
the backend is the `serviceId`.

### Removed

- `src/main/storage/providers/*` (store, normalize, identifier, summary, types).
- The `StorageChannels.listProviders`, `saveProvider`, and `removeProvider` IPC channels, along
  with their preload entries in `src/preload/storage.ts` and their declarations.
- `src/renderer/src/pages/settings/pages/scripts/details/StorageForm.tsx` and its use in
  `Configuration.tsx`.
- The backup files moved out of `src/main/storage/` (see the table above).

### Wiring

| File | Change |
|---|---|
| `src/main/bootstrap.ts` | Construct `BackupOperations` with `backup/fork.ts`. |
| `src/main/runtime.ts` | `startBackupSchedule` / `stopBackupSchedule`. |
| `src/main/ipc/storage.ts` → `src/main/ipc/backup.ts` | `BackupChannels`: `getSettings`, `saveSettings` (saves then reschedules), `listServices`, `pickFolders`, `syncFolders`, `getStatus` (operation + next run), `backup`, `restore`, `onStatusChanged`. |
| `src/preload/storage.ts` → `src/preload/backup.ts` | `window.backup.*`. |

## 3. Settings → Cloud page

`src/renderer/src/pages/settings/pages/cloud/`:

- **Storage service** row: replace `Provider.tsx` (which linked to Scripts) with `Service.tsx`.
  It is a `Select` of `STORAGE` services, following `settings/pages/assistant/search.tsx`.
  Unconfigured services are disabled, and a **Configure** button opens
  `/settings/services/<plugin>/<service>`.
- **Folders** section: unchanged.
- **Backup / Restore** buttons: unchanged. They are disabled without a selected, configured service.
- **Schedule** section: keeps the `Off` option, the `SYNC_INTERVALS` presets, and the custom cron
  input. Additions:
  - An inline error when the main process rejects an invalid cron. The previous schedule stays
    active.
  - A "Next backup" row showing the next run time while the schedule is enabled.
- **Status** notice: unchanged (last operation result).
- Use shadcn components and the existing `SettingsRow` / `SettingsSection` patterns only.
- i18n: rename the `settings.storage.provider.*` keys to `settings.backup.service.*`, and add keys
  for the next-run row and the invalid-cron error.

## 4. Data flow

```
Settings → Cloud ──IPC──▶ backup/store (serviceId, paths, cron)
                               │
               backup/schedule (node-cron) ──▶ backup/run ─┐
Backup button ──IPC──────────────────────────────────────▶ backup/operations
                                                           │
                                                 backup/fork
                                                           │ resolve(serviceId) → pluginSettings
                                                           ▼
                                  cloud-sync-s3 script (utility process) ──▶ S3 bucket
```

## 5. Docs to update during implementation

- `docs/CLOUD.md`: the capability table row for folder backup (`backup/*`, a STORAGE service),
  and the credential storage section (plugin settings, safeStorage).
- `docs/STORAGE_SYNC.md`: the provider is the selected STORAGE service. Remove references to
  `storage/settings.json` provider IDs and the provider store.

## 6. Verification

```sh
npm run typecheck:app
npm run test:main -- --runInBand
npm run test:renderer -- --runInBand
```

Manual check against the built app (Playwright `_electron`, isolated profile):

1. Settings → Services → S3 Storage: enter the bucket and credentials and save. The service shows
   as configured.
2. Settings → Cloud: select **S3 / S3 Storage**, add a folder, and click Backup. Objects appear
   under `kucedr/v1/...` in the bucket.
3. Choose Custom, then `*/1 * * * *`. Within a minute a scheduled run starts, the status updates,
   and the "Next backup" time advances.
4. Enter `not a cron`. An inline error appears and the previous schedule keeps running.
5. Clear the secret key in the service settings. Backup fails with "Configure this storage service
   before selecting it."
6. With version sync enabled, a sync pass uses the same selected service.
