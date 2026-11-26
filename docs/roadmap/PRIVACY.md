# 1. Privacy

Part of the [Roadmap](README.md). Status: 1.1 in progress; 1.2 built 2026-11-23, the first
release of 1.10 built 2026-11-24, 1.4 implemented, 1.7 built 2026-11-26, and the backup
portability warning (1.12) built.

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 1.1 | Privacy centre | One Settings page: what is stored and how much, what leaves the machine and to whom, delete all chats, export everything, retention periods for chats and logs | Storage totals, per-scope purge/export and a combined local export are available. Still needs a recipient/data-flow view and chat retention controls | M |
| 1.2 | Sealed credentials | Every key (model, database, search) protected by the OS keychain and never sent to the app window; Settings shows only whether a key is saved, with replace and remove | Done 2026-11-23: model, database and search keys are sealed on disk (`src/main/providers/seal.ts`), like S3 and connector tokens (`src/main/shared/safe_storage.ts`, `src/main/mcp/mcp_record_seal.ts`). Settings never showed keys on screen, but the provider and search list queries returned the plain key to the renderer; they now return `saved` only (`src/main/providers/saved.ts`), and the custom model list reads the key in main. `plugins:get-settings` returns configured field names only. Plugin Settings can replace or reset one credential at a time, and integrations decrypt saved credentials in the main process | S |
| 1.3 | Encrypted data at rest | A switch that encrypts chats, memory, attachments and health notes on disk with a key held in the OS keychain; export still produces readable files | Partially implemented: sessions (except `run.jsonl`), memory and health notes use the vault. Audit remaining personal files and traces before marking complete | L |
| 1.4 | App lock | Touch ID, Windows Hello or a passphrase to open the app or after idle | Implemented: passphrase, optional Touch ID on macOS, idle and system-lock handling. Windows Hello is not implemented | S–M |
| 1.5 | Encrypted backup | Backups encrypted with a passphrase before upload, so the bucket owner cannot read them | `resources/plugins/bootstrap/scripts/backup-s3` uploads unencrypted today | M |
| 1.6 | Private chat | A chat that is never written to disk and never feeds memory | Session persistence in `src/main/agent/session`; a memory toggle already exists | M |
| 1.7 | Storage management | Built 2026-11-26. Settings → Privacy shows total and per-folder storage use, provides access to confirmed session, memory and knowledge cleanup, and reports automatic log retention. On macOS and Linux, the app data root is owner-only from startup. | `src/main/data/storage_usage.ts`, `src/main/shared/restrict_user_data.ts`, and existing data purge and log-retention flows | S |
| 1.8 | Account and cloud data deletion | Delete the account and everything held on the server from inside the app | Sign-out only today; needs a server function | M |
| 1.9 | Encrypted sync across devices | Chats and settings on a second device, readable only by the user | Sync code exists but is not wired in ([Cloud file synchronization design](../STORAGE_SYNC.md)); after 1.5 | L |
| 1.10 | App-wide Privacy Mode | Route supported external connections through a local SOCKS5 proxy and pause unsupported network features. Settings → Privacy shows the active state. | [Browser proxy](VPN.md), with Electron session and Node transport policies. | L |
| 1.11 | Lost app lock passphrase | The lock dialog says how to get back in without Touch ID: quit, delete `settings/lock.json`, restart; chats are untouched because the lock encrypts nothing | `src/main/lock/state.ts` treats a missing file as lock off; dialog text in `settings.privacy.lock.dialogDescription` | S |
| 1.12 | Backup without passphrase warning | Built. Settings → Cloud and the storage configuration show a warning when data encryption is on and the provider has no saved backup passphrase. It explains how to make future backups of vault-encrypted files portable. | [Backup encryption](../BACKUP.md#encryption) | S |

Related areas: the [Network shield](SHIELD.md) supplies the "what leaves the machine" view for
1.1 and guards stored keys on the way out; [Memory and knowledge](MEMORY.md) covers seeing and
editing what the agent remembers.

Plugin credentials saved as plaintext by older builds are hidden from Settings. Replacing one
seals it with the OS keychain, and resetting it clears it from the plugin store.

## Privacy centre (1.1)

Settings → Privacy shows total and per-area storage use, automatic log cleanup, and session,
memory and knowledge controls. It can export sessions, persistent memory and the local knowledge
index together as a readable JSON archive; remote knowledge data is excluded. Per-scope export and
purge remain available. The combined export does not include provider settings or other app
configuration. A recipient/data-flow view and configurable chat retention are still open.

## App-wide Privacy Mode

First release built 2026-11-24 (`src/main/privacy`, Settings → Privacy).

Configure a local, unauthenticated SOCKS5 endpoint as `socks5://127.0.0.1:PORT` in Browser
Connections, then enable Privacy Mode and restart. Changing the proxy or turning the mode off also
requires a restart. The provider still receives data sent to it by the app. Browser profile storage
follows the existing tab type. The first release enforces routing in Kucedr’s network clients.
An OS-level egress filter remains open.

Background Chrome, web fetch and link previews, shell and coding commands, external OAuth,
stdio MCP, plugin scripts, plugin-backed database and backup workers, and updates are paused in
this version. These paths need a verified protected transport before they can be enabled.

## Open decisions

- **1.3 changes how the data folder behaves.** Files stop being readable by other tools, including
  the run-trace analysis used for agent speed and plain-file backup. Recommended as opt-in, off by
  default.
- **1.3 and 1.4 protect fully only on signed builds** ([Distribution and trust](DISTRIBUTION.md),
  6.1). On unsigned builds another local process can ask the keychain for the same key
  ([Security audit](../SECURITY_AUDIT.md) #18).
- **1.5 before any device sync.** 1.9 should reuse the same passphrase scheme.

## Documentation to correct alongside

- [SECURITY.md](../../SECURITY.md) and [CLOUD.md](../CLOUD.md) describe version-history sync and
  cloud chat records as live, but only tests call them.
- [Settings](../ui/SETTINGS.md) says data Purge has no confirmation; `src/main/ipc/data.ts` shows a
  native one.
