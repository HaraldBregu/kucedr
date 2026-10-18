# Plugin system strategy

Status: proposal. Nothing in this document is implemented yet.

This document plans how the Kucedr desktop app installs and loads plugins. A plugin can add model
providers, UI, and new functionality. Users install plugins from a remote URL or by uploading a
folder or archive in the app. The CLI is not part of this plan.

## 1. Goals and non-goals

Goals:

- Install a plugin from an https URL (`.tgz`, including npm registry tarball URLs) or by uploading
  a local folder or `.tgz`.
- Plugins can contribute model providers, apps (UI), skills, MCP servers, languages, and themes.
- Users can enable, disable, and remove plugins without restarting the app.
- A broken or malicious plugin cannot compromise the main process.

Non-goals for v1:

- Running plugin JavaScript in the Electron main process. This is never allowed, see section 8.
- A plugin marketplace, signing, or auto-update. See section 9.

## 2. What already exists

Most of the building blocks are already in the codebase. The plugin system mostly connects them.

| Need | Existing piece |
| --- | --- |
| Manifest format | Manifest v4 zod schema in `packages/cli/src/manifest.ts` (`pluginManifestSchema`, `readPluginManifest`), entry checks in `entries.ts`, path safety in `pluginpath.ts`. The layout is documented in [PLUGINS.md](PLUGINS.md). |
| Model providers | `readCatalog()` in `src/main/models.ts` reads provider manifests from `resources/providers` and `~/.kucedr/providers/<id>/`. |
| Running unknown providers | `streamProvider()` in `src/main/models/adapters/llm/llm_model.ts` falls back to OpenAI-compatible chat for any provider id it doesn't recognize, so a provider can be added with JSON only. |
| UI | Sandboxed HTML apps in `~/.kucedr/apps/<id>`, handled by `src/main/apps/*` (`appsRoot`, `appDirectory`, `AppRegistry`, `app_manifest_validate`). |
| New agent functionality | Skills in `src/main/agent/skills/*` (`skillsRoot`) and MCP servers in `src/main/mcp/*`. |
| Atomic install | `src/main/agent/skills/skills_import.ts`: copy to a staging folder, validate, then rename. |
| Per-plugin enabled state | `getEnabledPluginProviders` and `setPluginProviderEnabled` in `src/main/providers/providers_store.ts` (electron-store). |
| Settings UI | `src/renderer/src/pages/settings/pages/plugins/` (currently lists built-in integrations). |

What's missing:

1. Installing plugins from inside the desktop app.
2. The desktop loading `~/.kucedr/plugins/*`.
3. A UI for managing installed plugins.

## 3. Architecture

```text
 Install (URL / upload)                    ~/.kucedr/plugins/<plugin-id>/
 ──────────────────────►  stage → validate → rename ──► manifest.json
                                                         providers/<id>/manifest.json
                                                         apps/<id>/index.html
                                                         skills/<id>/SKILL.md
                                                         languages/<locale>.json
                                                         themes/<id>.json

 Existing loaders also scan the matching subfolder of every enabled plugin:
   readCatalog()     ← pluginDirs('providers')
   app list/dir      ← pluginDirs('apps')
   skills list       ← pluginDirs('skills')
   MCP catalog       ← manifest.contributes.mcpServers
   i18n / themes     ← manifest.contributes.languages / themes
```

Rules:

- **Plugins stay in their own folder.** Their files are never copied into `~/.kucedr/apps`,
  `providers`, or `skills`. Uninstalling a plugin deletes one folder and leaves nothing behind.
- **Loaders get extra roots.** Each existing loader keeps its logic and also reads the plugin
  folders. There is no second, parallel registry.
- **Declarative only.** The manifest says what a plugin contributes. Kucedr decides how to run it.

## 4. Plugin location and layout

Plugins are installed under `path.join(userDataLocation(), 'plugins')`, which is
`~/.kucedr/plugins`. Because this uses `userDataLocation()`, the `KUCEDR_E2E_DATA_ROOT` override
also applies to plugins.

The layout and manifest stay as in [PLUGINS.md](PLUGINS.md) (manifest v4). The folder name must
match the manifest `id`. All ids use lowercase kebab-case.

## 5. Contribution points

| Contribution | How it loads | Runs code? |
| --- | --- | --- |
| `providers` | Added to the directory list in `readCatalog()`. Unknown ids run through the OpenAI-compatible chat adapter. Credentials stay in the provider settings store and never go in the manifest. | No |
| `apps` (UI) | `app_list.ts` and `appDirectory()` also look in plugin `apps/` folders. Ids are namespaced as `<plugin-id>.<app-id>` so they cannot collide with user apps. They render in the existing sandboxed app view and use `AppRegistry`. | Sandboxed renderer only |
| `skills` | `skills_list.ts` and `skills_resolve_folder.ts` also scan plugin `skills/` folders. | No |
| `mcpServers` | Merged into the MCP catalog in `src/main/mcp`. Credentials go through the existing MCP settings flow. | Separate process or remote server |
| `languages` | Loaded by `src/main/i18n.ts` as extra locale JSON. | No |
| `themes` | There is no custom-theme loader yet; only light/dark exist (`nativeTheme`). This needs a small new loader that applies theme JSON as CSS variables in the renderer. Build it last. | No |
| `channels` | Not loaded in v1. These are executable `.mjs` files, see section 9. | — |

A provider that needs more than OpenAI-compatible chat, such as a custom request format, should
come as an MCP server in v1, or wait for the code host in section 9.

## 6. Main-process module: `src/main/plugins/`

Following the `src/main/apps/` style, each file holds one function:

| File | Responsibility |
| --- | --- |
| `plugins_root.ts` | `pluginsRoot()` returns `path.join(userDataLocation(), 'plugins')`. |
| `plugins_list.ts` | Reads `<root>/<id>/manifest.json` with the shared schema and skips any that are invalid or have a mismatched id. |
| `plugins_enabled.ts` | Stores the set of enabled plugin ids in electron-store. New installs start enabled. |
| `plugins_dirs.ts` | `pluginDirs(kind)` returns the existing `<plugin>/<kind>` folders of enabled plugins. All loaders call this one function. |
| `plugins_install.ts` | Takes a source folder: copy to `<root>/.install-<uuid>/`, validate the manifest and entries, then rename to `<root>/<id>`. Re-installing the same id replaces the old version. If anything fails, the staging folder is deleted. |
| `plugins_upload.ts` | Opens a dialog for a folder or `.tgz` file, extracts the archive if needed, and calls install. |
| `plugins_download.ts` | Downloads an https `.tgz` with `fetch` and a size cap, extracts it to a temp folder, then calls install. |
| `plugins_remove.ts` | Deletes `<root>/<id>` and its enabled entry. |

The manifest code (`pluginManifestSchema`, `readPluginManifest`, `validatePluginEntries`,
`isPluginPath`) moves from `packages/cli/src` to `src/shared/plugin/`. The CLI re-exports it, so
there is a single source of truth.

Archives are extracted with the `tar` package, which the CLI already uses; it gets added to the
root `dependencies`. The desktop does not shell out to `npm`, because end users may not have it.
npm tarballs unpack into a `package/` folder, and install uses that folder when present.

After an install, removal, or enable toggle, the plugin module emits a `plugins:changed` event on
`src/main/event_bus.ts`. The provider, app, skill, and MCP catalogs then refresh, and so does the
renderer, without a restart.

## 7. IPC, preload, and UI

IPC handlers follow the existing pattern in `src/main/ipc/mcp.ts`, `src/preload/mcp.ts`, and
`src/shared/ipc_channels_*`:

| Channel | Purpose |
| --- | --- |
| `plugins:list` | Lists installed plugins with their manifest, enabled state, and contributions. |
| `plugins:install-url` | Installs from an https URL. |
| `plugins:upload` | Opens the picker and installs the selection. |
| `plugins:remove` | Uninstalls a plugin. |
| `plugins:set-enabled` | Enables or disables a plugin. |

UI: add an **Installed** section to `settings/pages/plugins/`, using the existing shadcn components
and that page's existing patterns:

- A list of installed plugins showing name, version, description, an enable switch, and a remove
  button.
- **Install from URL** (an input and a button) and **Upload** (opens the picker).
- Before installing, a confirmation listing what the plugin will add (providers, apps, skills, MCP
  servers). The page's `Confirm.tsx` can be reused for this.

## 8. Security model

- **No plugin code in the main process, ever.** In v1, code runs only where it is already
  isolated: app HTML in the sandboxed app view, and MCP servers in their own process or remotely.
  This is the VS Code model (manifest contribution points plus process isolation). The Obsidian
  model, where plugin code runs in-process with full access, is avoided.
- **Paths are validated.** Every manifest entry passes `isPluginPath`: no absolute paths, no
  `..`, no backslashes. After resolving, each entry must be a regular file inside the plugin
  folder. Archive extraction rejects symlinks and entries that escape the target folder.
- **Downloads are https only**, with a size cap, extracted into a temp folder, and validated before
  anything reaches `~/.kucedr/plugins`.
- **Manifests carry no secrets.** Credentials stay in the existing provider and MCP settings
  stores.
- **Users approve each install** after seeing what the plugin contributes.

## 9. Later phases

Build each of these only when a real plugin needs it.

1. **Code plugins.** Custom provider adapters and channel `.mjs` files run in one Electron
   `utilityProcess` per plugin, talking over a narrow MessagePort API (for example,
   `provider.stream(request)` returning an event stream). They never run in main. Build this when a
   real plugin can't be expressed as a declarative provider or MCP server.
2. **Registry index.** A JSON index of published plugins that the Settings page can browse, with
   the same install path as URL install.
3. **Integrity and signing.** Check a manifest `integrity` hash, or sign packages, before
   installing third-party plugins at scale.
4. **Updates.** Compare the installed `version` against the registry and re-install through the
   same atomic install path.

## 10. Implementation order

1. Move the manifest schema to `src/shared/plugin/`. Verify with `npm run typecheck`.
2. Add `src/main/plugins/*` (root, list, enabled, dirs, install, upload, download, remove).
3. Connect `pluginDirs()` to the provider, app, skill, MCP, language, and theme loaders.
4. Add the IPC handlers, preload API, and the shared channel definitions.
5. Add the Installed section to Settings → Plugins.
6. Update [PLUGINS.md](PLUGINS.md) to describe the desktop install flow.

## 11. Verification

- `npm run typecheck && npm run lint`.
- Build a sample `acme-tools` plugin with one OpenAI-compatible provider, one HTML app, one skill,
  and one MCP server. Then:
  1. Upload the folder: the provider appears in Settings → Providers → Models, the app opens from
     the apps list, and the skill appears in Skills.
  2. Pack it with `tar czf`, serve it locally (or use an npm tarball URL), and install from the
     URL: the result is the same. A second install replaces the first.
  3. Disable it and its contributions disappear. Remove it and its folder is gone.
  4. A malformed manifest, an entry containing `../`, or an archive with a symlink is rejected,
     and nothing is left in `~/.kucedr/plugins`.
- Run `npm run dev` and check the whole flow end to end.
