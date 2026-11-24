# 1. Privacy

Part of the [Roadmap](README.md). Status: proposal.

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 1.1 | Privacy centre | One Settings page: what is stored and how much, what leaves the machine and to whom, delete all chats, export everything, retention periods for chats and logs | `src/main/data/data_controller.ts` already handles memory, knowledge and a `sessions` scope no page shows; an unused `privacy` translation key exists | M |
| 1.2 | Sealed credentials | Every key (model, database, search) protected by the OS keychain and never sent to the app window; Settings shows only whether a key is saved, with replace and remove | Done 2026-11-23: model, database and search keys are sealed on disk (`src/main/providers/seal.ts`), like S3 and connector tokens (`src/main/shared/safe_storage.ts`, `src/main/mcp/mcp_record_seal.ts`). Settings never showed keys on screen, but the provider and search list queries returned the plain key to the renderer; they now return `saved` only (`src/main/providers/saved.ts`), and the custom model list reads the key in main. `plugins:get-settings` returns configured field names only. Plugin Settings can replace or reset one credential at a time, and integrations decrypt saved credentials in the main process | S |
| 1.3 | Encrypted data at rest | A switch that encrypts chats, memory, attachments and health notes on disk with a key held in the OS keychain; export still produces readable files | Node's built-in crypto; folder layout in `src/main/shared/user_data_location.ts` | L |
| 1.4 | App lock | Touch ID, Windows Hello or a passphrase to open the app or after idle | Electron's native biometric prompt on macOS; pairs with 1.3 | S–M |
| 1.5 | Encrypted backup | Backups encrypted with a passphrase before upload, so the bucket owner cannot read them | `resources/plugins/bootstrap/scripts/backup-s3` uploads unencrypted today | M |
| 1.6 | Private chat | A chat that is never written to disk and never feeds memory | Session persistence in `src/main/agent/session`; a memory toggle already exists | M |
| 1.7 | Storage management | Storage use per area with clean-up, automatic retention, owner-only folders | On the surveyed machine logs were 172 MB against 43 MB of chats; the chats, memory and logs folders are readable by other local accounts while `providers/` is owner-only | S |
| 1.8 | Account and cloud data deletion | Delete the account and everything held on the server from inside the app | Sign-out only today; needs a server function | M |
| 1.9 | Encrypted sync across devices | Chats and settings on a second device, readable only by the user | Sync code exists but is not wired in ([Cloud file synchronization design](../STORAGE_SYNC.md)); after 1.5 | L |
| 1.10 | App-wide Privacy Mode | Route supported external connections through a local SOCKS5 proxy and pause unsupported network features. Settings → Privacy shows the active state. | [Browser proxy](VPN.md), with Electron session and Node transport policies. | L |

Related areas: the [Network shield](SHIELD.md) supplies the "what leaves the machine" view for
1.1 and guards stored keys on the way out; [Memory and knowledge](MEMORY.md) covers seeing and
editing what the agent remembers.

## App-wide Privacy Mode

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
