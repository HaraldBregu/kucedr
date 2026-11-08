# Installing and removing plugins

## Sources

| Entry point | Function | Used by |
|---|---|---|
| Remote catalog by id | `installCatalogPlugin(id)` | Settings → Plugins (Available, Marketplace), onboarding plugins step |
| Any https URL | `downloadPlugin(url)` | `window.plugins.installUrl` (IPC exists; no renderer UI calls it today) |
| Local folder | `installPlugin(folder)` | Internal, called by the two above |
| Manual | Copy a folder into `~/.kucedr/plugins/<id>` | Picked up by the watcher |

## Catalog

`listCatalog()` (`plugins_catalog.ts`) fetches `https://kucedr.github.io/kucedr-plugins/index.json` and validates it:

```json
{
	"schemaVersion": 1,
	"plugins": [
		{
			"id": "brave",
			"title": "Brave",
			"description": "…",
			"author": "…",
			"website": "https://…",
			"categories": ["SEARCH"],
			"icon": "https://…/brave.svg",
			"iconDark": "https://…",
			"version": "1.0.1",
			"minAppVersion": "0.0.0",
			"url": "https://…/brave-1.0.1.tgz",
			"integrity": "sha512-<base64>",
			"contains": ["providers"]
		}
	]
}
```

- `icon`, `iconDark`, and `url` must be `https://`.
- `integrity` must start with `sha512-`.
- Unknown values in `contains` are dropped.
- A missing `website` falls back to `pluginWebsites[id]`.

`availablePlugins()` returns catalog entries that are not installed (`update: false`), plus installed ones whose catalog version is newer (`update: true`). The comparison includes bundled plugins, so a newer catalog release of a bundled plugin shows as an update. Installing it puts a user copy in `~/.kucedr/plugins`, which then replaces the bundled one (see [loading.md](loading.md)).

## Download

`downloadPlugin(url, integrity?)` (`plugins_download.ts`):

1. The URL must parse and use `https:`.
2. Fetches the archive. Rejects if `content-length` or the streamed size goes over **200 MB**.
3. If `integrity` is given (always, for catalog installs), checks `sha512-` + base64 SHA-512 of the bytes.
4. Writes the bytes to a temp folder as `plugin.tgz` and calls `installPluginArchive()`.

## Archive

`installPluginArchive(file)` (`plugins_install_archive.ts`) extracts a tar/tgz into a temp folder with `tar` in strict mode, **keeping only regular files and directories**. Links and devices are dropped. Then:

- `manifest.json` at the archive root → install that folder.
- Otherwise exactly one non-hidden top-level folder that contains `manifest.json` → install that folder. This covers npm tarballs (`package/`) and GitHub-style wrappers.
- Otherwise: `The archive has no manifest.json at its root.`

## Install

`installPlugin(source)` (`plugins_install.ts`):

1. Copies the source to `~/.kucedr/plugins/.install-<uuid>` (symlinks copied verbatim so the next step can catch them).
2. `readPlugin(staging, null)` runs the full manifest checks (see [manifest.md](manifest.md)). The id comes from the manifest, not the folder name.
3. `validatePluginContents()` checks every contribution with the loader that will serve it:
   - id must not be `kucedr` (reserved)
   - `apps/<id>`: valid app manifest, and the `metadata.entry` file exists
   - `mcp/`: `listLocalMcpServers()` on the folder reports no diagnostics
   - `scripts/<id>`: `readPluginScript()` passes
   - `modes/<id>`: `readMode(..., builtIn = false)` passes, so bundled-only fields are rejected
   - `skills/<id>`: `validateSkill()` passes
4. If `~/.kucedr/plugins/<id>` exists, renames it to `.backup-<uuid>`.
5. Renames staging to `<id>`. If that fails, the backup is restored.
6. Clears the scan cache and returns the new `PluginInfo`.
7. Always deletes staging and backup folders.

Installing the same id again is an in-place upgrade or downgrade. Settings and secrets are keyed by id, so they carry over.

## Remove

`removePlugin(id)` (`plugins_remove.ts`) deletes the plugin folder and clears the cache. Bundled plugins can't be removed (`Built-in plugins can be disabled but not removed.`). Stored settings, secrets, and the `disabled` entry are **not** cleaned up. If the bundled plugin with the same id exists, it takes over again.

## Safety summary

- Downloads over https only, with a size cap and SHA-512 check for catalog installs.
- Archives can't carry links or special files; user plugin folders are re-checked for links on every read.
- Paths in contribution manifests (app entries, script entries and instructions) must be relative, with no `..`, `.`, empty segments, or backslashes.
- Icons are capped at 256 KB.
- Plugins can't claim the `kucedr` id, and user plugins can't set `protectedPrompt` or `model` on modes.
- Plugin MCP servers start disabled.
- Script output is shown in a sandboxed iframe with a CSP that blocks network access (see [scripts.md](scripts.md)).

Plugin code (script entries, local MCP commands, app pages) runs with the same trust as the app. Nothing sandboxes a script's Node process itself.
