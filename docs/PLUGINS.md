# Plugins

This page describes the plugin system as it is implemented today. For the full design, including
the parts not built yet (config forms, the postMessage bridge, extension slots, local model
downloads, the catalog), see [PLUGIN_SYSTEM.md](PLUGIN_SYSTEM.md).

A plugin is one folder that can contribute five kinds of things:

| Kind | Folder | Loaded by |
| --- | --- | --- |
| **apps** | `apps/<app-id>/` | The apps pipeline (`src/main/apps/`), opened in their own window |
| **extensions** | `extensions/<extension-id>/` | The home page, in a sandboxed iframe |
| **mcp** | `mcp/<server-id>/mcp.json` or `mcp/servers.json` | The local MCP loader |
| **providers** | Provider fields in the plugin's own `manifest.json` | The provider catalog (`readCatalog()`) |
| **skills** | `skills/<skill-id>/SKILL.md` | The skills loader |

## Where plugins live

| Location | Contents |
| --- | --- |
| `resources/plugins/<id>/` | Built-in plugins, packaged with the app (`bundledPluginsRoot()`). They can be disabled but not removed. |
| `resources/plugins/kucedr/` | The core plugin (`CORE_PLUGIN_ID`). It can't be disabled, removed, or replaced, and installed plugins can't use the id `kucedr`. |
| `~/.kucedr/plugins/<id>/` | Plugins installed from Settings → Plugins (`pluginsRoot()`). An installed plugin overrides a built-in plugin with the same id. |
| `~/.kucedr/plugins/settings.json` | The ids of disabled plugins (`pluginsStore`; everything else is enabled) and each plugin's `settings` values, keyed by plugin id. |
| `~/.kucedr/extensions/<id>/` | Extensions imported on their own, outside any plugin (`extensionsRoot()`). |

Every built-in folder except `kucedr/` is a provider plugin: just `manifest.json` and `assets/`.
The core plugin ships the built-in extensions (Arcade, Tetris, Triangle), skills, and an empty
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
  extensions/<extension-id>/  manifest.json + index.html, js, css, optional icon
  mcp/servers.json            optional: server configs keyed by id (stdio or http)
  mcp/<server-id>/            mcp.json (+ server files, stdio only)
  skills/<skill-id>/          SKILL.md
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
   are no symlinks, and that the plugin has at least one contribution. It also reads every
   extension's `manifest.json`.
3. Loaders call `pluginDirs(kind)` (or `pluginProviders()` for providers), which only returns
   enabled, available plugins:

   | Kind | Where plugins are added |
   | --- | --- |
   | apps | `listApps()` and `appDirectory()` (`app_plugin_directory.ts`) |
   | extensions | `listPlugins()` → `extensions`, served by `kucedr-plugin://` |
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
- each extension has an `index.html`;
- every MCP server passes `listLocalMcpServers()`, and no id is both a folder and a
  `servers.json` key;
- each skill passes `validateSkill()`.

Kucedr never runs `npm install` or lifecycle scripts, so a stdio MCP server must be bundled.

## Enabling, disabling, removing

- `setPluginEnabled()` adds or removes the id in the disabled list. The core plugin can't be
  disabled. A disabled plugin's contributions disappear from every list at once.
- `removePlugin()` deletes an installed plugin's folder. Built-in plugins can't be removed.
- Deleting a plugin's app from Settings → Apps is refused; disable or remove the plugin instead.

## Extensions

An extension is HTML/JS/CSS UI shown inside the main window. Its folder needs `index.html` and a
`manifest.json` (`extensionManifestSchema`):

```json
{
	"title": "Word counter",
	"description": "Counts the words in pasted text.",
	"slot": "panel",
	"category": "writing",
	"icon": "icon.svg"
}
```

- `title`, `description`, and `slot` are required. `slot` is one of `sidebar`, `panel`,
  `toolbar`, `composer`, or `settings`. `category` defaults to `utility`. `icon` is a file in the
  extension's folder, 256 KB max.
- The slot is only shown as a badge for now. Every extension opens the same way, whatever its
  slot.

Extensions come from two places:

| Source | Managed in | Served from |
| --- | --- | --- |
| A plugin's `extensions/<id>/` | Settings → Plugins (enable, disable, remove the plugin) | `kucedr-plugin://<plugin-id>/<extension-id>/<file>` |
| A standalone folder in `~/.kucedr/extensions/<id>/` | Settings → Extensions (import, remove) | `kucedr-extension://<extension-id>/<file>` |

**Settings → Extensions** lists both, with a search box and category filter. Its upload tile
imports one or more extension folders (`importExtensions()`): each folder name must be
lowercase kebab-case, have a valid `manifest.json` and an `index.html`, and is copied with the
same staging and backup steps as plugins. An existing extension with the same id is replaced.
Only standalone extensions have a remove button; it asks for confirmation, then deletes the
folder.

**Opening an extension:** pick it under **Extensions** in the command menu. The home page then
shows `ExtensionPage` in place of the chat: a header with the title and a close button, and the
extension in an iframe with `sandbox="allow-scripts"`. The open extension also appears in the home
sidebar under New chat.

**Isolation:**

- The iframe has no preload, no Node, and no `window.api`. Each plugin (and each standalone
  extension) gets its own origin.
- The protocol handlers only serve files from enabled plugins that declare that extension, and
  refuse any path that resolves outside the extension folder (`serveExtensionFile()`).
- Every response gets the CSP
  `default-src 'none'; script-src kucedr-plugin: kucedr-extension:; style-src … 'unsafe-inline'; img-src … data:; font-src … data:`.
  Extensions have no network access and no inline scripts.
- There is no bridge to the host yet. An extension can't read the theme, the conversation, or
  call the agent.

## Apps

A plugin's `apps/<app-id>/` folder is a normal app (see [APPS.md](APPS.md)): a `manifest.json`
with `title`, `description`, and `metadata.version`, `metadata.category`, `metadata.entry`, plus
the built entry file.

- Plugin apps appear in Settings → Apps after installed and debug apps, tagged with their plugin.
  Their id is the folder name, not namespaced. An installed or debug app with the same id wins.
- They open in their own window with the same sandbox and SDK as any other app.
- Their files stay in the plugin folder. App-scoped data still goes to
  `~/.kucedr/apps/<id>/data/`. `appDirectory()` treats an installed folder as the app only when it
  has a manifest, so a data-only folder doesn't hide the plugin app.
- They can't be deleted on their own; disable or remove the plugin.

## IPC

`window.plugins` (`src/preload/plugins.ts`), all limited to trusted renderers:

| Method | Channel | Purpose |
| --- | --- | --- |
| `list()` | `plugins:list` | All plugins with manifest info, icons as data URLs, enabled state, error, contributions, and extensions |
| `installUrl(url)` | `plugins:install-url` | Download and install an https `.tgz` |
| `upload(path?)` | `plugins:upload` | Install a folder or `.tgz`; opens a picker when no path is given |
| `remove(id)` | `plugins:remove` | Remove an installed plugin |
| `setEnabled(id, enabled)` | `plugins:set-enabled` | Enable or disable a plugin |
| `listExtensions()` | `plugins:list-extensions` | Standalone extensions |
| `importExtensions(paths?)` | `plugins:import-extensions` | Import extension folders; opens a picker when no paths are given |
| `removeExtension(id)` | `plugins:remove-extension` | Confirm, then delete a standalone extension |

## Not implemented yet

- `configSchema` / `uiHints` settings forms and `permissions`.
- The postMessage bridge and theme tokens for extensions, and the per-slot hosts.
- An install confirmation dialog listing what a plugin adds.
- Local model downloads, the plugin catalog, and updates.

## CLI

The Kucedr CLI (`packages/cli`) still uses its own manifest version 4 and installs to a separate
data directory. The desktop app doesn't read CLI-installed plugins.
