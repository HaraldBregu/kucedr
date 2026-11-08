# Discovery and loading

## Roots

| Root | Path | `builtIn` |
|---|---|---|
| Bundled | `<resourceRoot>/resources/plugins` (`plugins_bundled_root.ts`) | `true` |
| User | `~/.kucedr/plugins` (`plugins_root.ts`; `KUCEDR_E2E_DATA_ROOT` overrides `~/.kucedr`) | `false` |

Bundled plugins ship inside the app and can be disabled but not removed. User plugins are installed through the app (see [install.md](install.md)) or by copying a folder into the user root.

## Scanning

`scanPlugins()` (`src/main/plugins/plugins_scan.ts`):

1. Reads the bundled root, then the user root.
2. Skips non-folders and names starting with `.` (this hides install staging folders `.install-*` and `.backup-*`).
3. Calls `readPlugin(directory, folderName, builtIn)` for each folder.
4. On success stores `{ id, directory, builtIn, manifest }`; on failure stores `{ id, directory, builtIn, error }`. Broken plugins stay in the list so Settings can show the error, but they contribute nothing.
5. Sorts by id and caches the result.

### Bundled vs user with the same id

A user plugin with the same id as a bundled one **replaces** it, unless the bundled version is newer:

- user version ≥ bundled version → the user copy wins
- bundled version > user version → the user copy is ignored
- bundled copy failed to load → the user copy wins

`compareVersions()` (`plugins_version_compare.ts`) compares `major.minor.patch` only; pre-release and build tags are ignored.

## Cache and refresh

The scan result is held in memory. `refreshPlugins()` clears it; the next call rescans.

The cache is cleared:

- after `installPlugin()` and `removePlugin()`
- by the plugins IPC module's `changed()` handler after install, remove, enable/disable, and settings save
- by `watchPlugins()` on any file change

`watchPlugins()` (`plugins_watch.ts`) sets a recursive `fs.watch` on both roots. Each event clears the cache right away; the callback runs 100 ms after events stop. The IPC module passes a callback that also calls `refreshProviderCatalog()` and broadcasts `AppChannels.modelsChanged`. The renderer reloads plugin data on that event: model lists, `useModes()`, and `usePluginScripts()`. If watching fails (no recursive watch support, missing root), the error is ignored and only changes made through the app trigger a refresh.

## Enabled state

`pluginsStore` (`plugins_store.ts`) is an `electron-store` file at `~/.kucedr/plugins/settings.json`:

```ts
{ disabled: string[]; settings: Record<id, Record<key, string>>; secrets: Record<id, Record<key, string>> }
```

`setPluginEnabled(id, enabled)` adds the id to or removes it from `disabled`. Plugins are enabled by default. `CORE_PLUGIN_ID` (`'kucedr'`) cannot be disabled. No bundled plugin uses that id today; the shipped content plugin is `bootstrap`, so it can be disabled like any other.

Disabling hides every contribution: `pluginDirs()` and `pluginProviders()` skip disabled ids. The files stay on disk.

## Accessors

| Function | Returns | Skips |
|---|---|---|
| `listPlugins()` | `PluginInfo[]` for every scanned plugin, including broken and disabled ones. Icons are inlined as data URLs. | — |
| `pluginDirs(kind)` | `{ directory: <plugin>/<kind>, plugin, builtIn }` per plugin that has contributions of `kind` | broken, disabled |
| `pluginProviders()` | `{ directory, manifest: ProviderManifest, plugin }` | broken, disabled, no provider |
| `pluginOwner(path)` | The `PluginSource` whose folder contains `path` | broken |

`PluginInfo` (`src/shared/plugin_types.ts`) has `id`, `name`, `version`, `description`, `categories`, `author`, `website`, `icon`, `iconDark`, `builtIn`, `core`, `enabled`, `error`, `contributes` (ids per kind), and `settings`.

`pluginOwner()` lets other subsystems tell that something came from a plugin. Skills use it to refuse deletion; MCP uses it to start plugin servers disabled.

## Conflicts between plugins

Each consumer resolves duplicate ids itself. The plugin that comes first in id order usually wins:

| Kind | Rule |
|---|---|
| Apps | A user-installed app in `~/.kucedr/apps` wins, then debug apps, then plugin apps in plugin order. |
| MCP | First server per id across roots; the user root `~/.kucedr/mcp/servers` comes first. Duplicates inside one root are an error. |
| Skills | Project → user (`~/.kucedr/skills`) → plugins; later ones are shadowed with a `duplicate-name` warning. |
| Scripts | The first plugin to claim a script name wins; later ones log a warning. |
| Modes | The first plugin to claim a mode id **or** command wins; later ones log a warning. |
| Providers | `~/.kucedr/providers/*` load after plugin providers, so a user provider overrides a plugin provider with the same `providerId`. |
