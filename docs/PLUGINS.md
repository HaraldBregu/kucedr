# Plugins

This page describes the plugin system as it is implemented today. For the full design, including
the parts not built yet (config forms, the postMessage bridge, local model
downloads, the catalog), see [PLUGIN_SYSTEM.md](PLUGIN_SYSTEM.md).

A plugin is one folder that can contribute four kinds of things:

| Kind | Folder | Loaded by |
| --- | --- | --- |
| **apps** | `apps/<app-id>/` | The apps pipeline (`src/main/apps/`), opened inside Kucedr or in their own window (see [Apps](#apps)) |
| **mcp** | `mcp/<server-id>/mcp.json` or `mcp/servers.json` | The local MCP loader |
| **providers** | Provider fields in the plugin's own `manifest.json` | The provider catalog (`readCatalog()`) |
| **skills** | `skills/<skill-id>/SKILL.md` | The skills loader |
| **scripts** | `scripts/<script-id>/manifest.json` | `pluginScripts()`, run by the agent through `run_plugin_script` (see [PLUGIN_SCRIPTS.md](PLUGIN_SCRIPTS.md)) |

## Where plugins live

| Location | Contents |
| --- | --- |
| `resources/plugins/<id>/` | Built-in plugins, packaged with the app (`bundledPluginsRoot()`). They can be disabled but not removed. |
| `resources/plugins/kucedr/` | The core plugin (`CORE_PLUGIN_ID`). It can't be disabled, removed, or replaced, and installed plugins can't use the id `kucedr`. |
| `~/.kucedr/plugins/<id>/` | Plugins installed from Settings → Plugins (`pluginsRoot()`). An installed plugin overrides a built-in plugin with the same id. |
| `~/.kucedr/plugins/settings.json` | The ids of disabled plugins (`pluginsStore`; everything else is enabled) and each plugin's `settings` values, keyed by plugin id. |

Every built-in folder except `kucedr/` is a provider plugin: just `manifest.json` and `assets/`.
The core plugin ships the built-in apps (Arcade, Tetris, Triangle, Roast Room), skills, and an empty
`mcp/servers.json`.

Plugin files are never copied into `~/.kucedr/apps`, `providers`, `mcp`, or `skills`. Each loader
also scans the matching folder of every enabled plugin through `pluginDirs(kind)`. Removing a
plugin deletes one folder.

## Layout

```text
<plugin-id>/
  manifest.json               plugin info, plus provider services when it is a provider
  assets/                     images and other data (plugin and provider icons live here)
  apps/<app-id>/              app manifest.json + entry file, js, css
  mcp/servers.json            optional: server configs keyed by id (stdio or http)
  mcp/<server-id>/            mcp.json (+ server files, stdio only)
  skills/<skill-id>/          SKILL.md
  tools/<tool-id>/            manifest.json + INSTRUCTIONS.md + built Node script that prints HTML
```

## Manifest (schema version 5)

`src/shared/plugin_manifest.ts` (`pluginManifestSchema`):

```json
{
	"schemaVersion": 5,
	"id": "acme-tools",
	"title": "Acme Tools",
	"version": "1.0.0",
	"description": "Acme models, dashboard, and CRM tools.",
	"categories": ["LLM", "TTS"],
	"author": "Acme",
	"minAppVersion": "1.3.0",
	"icon": "icon.svg",
	"iconDark": "icon-dark.svg"
}
```

- `schemaVersion`, `id`, `title`, `version` (semver), and `description` are required. Unknown
  keys are rejected.
- `id` is lowercase kebab-case and must equal the folder name.
- `categories` are free-form labels. Settings → Plugins builds its category filter from them.
- `icon` and `iconDark` are png, svg, jpg, or webp file names in `assets/`, 256 KB max.
- `minAppVersion` makes the plugin unavailable on an older Kucedr (major.minor.patch only).
- The manifest doesn't list contributions. `pluginContents()` finds them from the folders, and
  each folder name is the contribution's id.

A plugin is a **provider** when its manifest also has provider fields: `authentication`,
`apiKeyUrl`, `icon_dark_url`, `icon_light_url`, `instructions`, `models`, `mcp_servers`,
`vector_databases`, `web_search`, `storage`, or `bots`. The provider id is the plugin `id` and its
name is the plugin `title`. `pluginProvider()` checks those fields with
`validateProviderManifest()`. See [PROVIDERS.md](PROVIDERS.md) for the provider format.

## Loading

1. `scanPlugins()` (`plugins_scan.ts`) reads every folder in the built-in root, then the installed
   root, and caches the result. A plugin that fails `readPlugin()` stays in the list as
   **unavailable** with its error; the others keep loading.
2. `readPlugin()` parses the manifest, checks the folder name, `minAppVersion`, icons, that there
   are no symlinks, and that the plugin has at least one contribution.
3. Loaders call `pluginDirs(kind)` (or `pluginProviders()` for providers), which only returns
   enabled, available plugins:

   | Kind | Where plugins are added |
   | --- | --- |
   | apps | `listApps()` and `appDirectory()` (`app_plugin_directory.ts`) |
   | mcp | `mcpLocalDiscoveryRoots()` |
   | providers | `readCatalog()` in `src/main/models.ts` |
   | skills | `skills_list.ts` and `skills_resolve_folder.ts` |

4. Entries that come from a plugin carry `plugin: { id, name }` (`PluginSource`), so the UI can
   show where they came from. Bundled and user entries don't have it.
5. When a user app, skill, or MCP server has the same id as a plugin's, the user's wins.

`PluginsIpc` (`src/main/ipc/plugins.ts`) calls `changed()` after every install, removal, or toggle:
it clears the scan cache, refreshes the provider catalog, and broadcasts
`AppChannels.modelsChanged`. `watchPlugins()` watches both roots, so plugins edited on disk
reload too.

## Installing

Settings → Plugins has an upload tile (drop a folder or `.tgz`, or click to pick one). The
`plugins:install-url` channel installs from an https URL.

- `uploadPlugin()` installs a folder directly, or an archive through `installPluginArchive()`.
- `downloadPlugin()` accepts https only and caps the download at 200 MB.
- `installPluginArchive()` extracts with `tar`, keeping only files and folders (no links). The
  manifest can be at the archive root or inside one wrapper folder, such as npm's `package/`.
- `installPlugin()` copies the source into `<root>/.install-<uuid>/`, runs `readPlugin()` and
  `validatePluginContents()`, then renames it to `<root>/<id>`. An existing install is moved to a
  backup first and restored if the rename fails. The staging folder is always deleted.

`validatePluginContents()` checks that every contribution is readable by its loader:

- each app has a valid app manifest and its entry file exists;
- every MCP server passes `listLocalMcpServers()`, and no id is both a folder and a
  `servers.json` key;
- each skill passes `validateSkill()`.

Kucedr never runs `npm install` or lifecycle scripts, so a stdio MCP server must be bundled.

## Enabling, disabling, removing

- `setPluginEnabled()` adds or removes the id in the disabled list. The core plugin can't be
  disabled. A disabled plugin's contributions disappear from every list at once.
- `removePlugin()` deletes an installed plugin's folder. Built-in plugins can't be removed.
- Deleting a plugin's app from Settings → Apps is refused; disable or remove the plugin instead.

## Apps

A plugin's `apps/<app-id>/` folder is a normal app (see [APPS.md](APPS.md)): a `manifest.json`
with `title`, `description`, and `metadata.version`, `metadata.category`, `metadata.entry`, plus
the built entry file.

- Plugin apps appear in Settings → Apps after installed and debug apps, tagged with their plugin.
  Their id is the folder name, not namespaced. An installed or debug app with the same id wins.
- They open by their manifest `mode` like any other app: inside Kucedr (`extension`, the
  default), or in their own window (`window`). See
  [APPS.md](APPS.md#opening-modes).
- Their files stay in the plugin folder. App-scoped data still goes to
  `~/.kucedr/apps/<id>/data/`. `appDirectory()` treats an installed folder as the app only when it
  has a manifest, so a data-only folder doesn't hide the plugin app.
- They can't be deleted on their own; disable or remove the plugin.

## IPC

`window.plugins` (`src/preload/plugins.ts`), all limited to trusted renderers:

| Method | Channel | Purpose |
| --- | --- | --- |
| `list()` | `plugins:list` | All plugins with manifest info, icons as data URLs, enabled state, error, and contributions |
| `installUrl(url)` | `plugins:install-url` | Download and install an https `.tgz` |
| `upload(path?)` | `plugins:upload` | Install a folder or `.tgz`; opens a picker when no path is given |
| `remove(id)` | `plugins:remove` | Remove an installed plugin |
| `setEnabled(id, enabled)` | `plugins:set-enabled` | Enable or disable a plugin |

## Not implemented yet

- `configSchema` / `uiHints` settings forms and `permissions`.
- A host bridge (theme tokens, conversation, agent) for apps opened in extension mode.
- An install confirmation dialog listing what a plugin adds.
- Local model downloads, the plugin catalog, and updates.

## CLI

The Kucedr CLI (`packages/cli`) still uses its own manifest version 4 and installs to a separate
data directory. The desktop app doesn't read CLI-installed plugins.
