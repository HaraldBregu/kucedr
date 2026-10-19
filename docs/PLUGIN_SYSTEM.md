# Plugin system strategy

Status: steps 1–5 of section 12 are implemented (the manifest, install from an upload or URL, the
`vector_databases` rename, plugin entries in the listing APIs, and the Installed list). The rest is
still a proposal.

This document plans how the Kucedr desktop app installs, loads, and distributes plugins. A plugin is
one package that can contain five kinds of contributions:

| Kind | What it adds | Where it runs |
| --- | --- | --- |
| **apps** | Standalone HTML/JS/CSS apps opened in their own window | Sandboxed app window |
| **extensions** | HTML/JS/CSS UI placed inside Kucedr's own screens (sidebar, panel, toolbar, settings, composer) | Sandboxed frame inside the host UI |
| **mcp** | Agent tools served over MCP: local stdio servers or remote http servers | Separate process, or remote |
| **providers** | Provider manifests: models (remote API models and local model files), vector databases, web search, storage, and remote MCP services | Remote API, or local through Ollama |
| **skills** | `SKILL.md` instruction packages for the agent | No code |

Users install plugins from the in-app catalog, from an https URL, or by uploading a folder or `.tgz`
archive. The CLI is not part of this plan.

## 1. Goals and non-goals

Goals:

- Browse, install, update, enable, disable, and remove plugins from Settings → Plugins, with no
  restart.
- Support the five contribution kinds above.
- Make sure a broken or malicious plugin can't compromise the main process or read other plugins'
  data.

Non-goals for v1:

- Running plugin JavaScript in the main process or in Kucedr's own renderer. See section 9.
- Letting anyone publish without review, paid plugins, or ratings. See section 11.

## 2. What already exists

| Need | Existing piece |
| --- | --- |
| Manifest validation | Manifest v4 zod schema in `packages/cli/src/manifest.ts` (`pluginManifestSchema`), entry checks in `entries.ts`, and path safety in `pluginpath.ts`. Section 4 extends this. |
| Remote models | `readCatalog()` in `src/main/models.ts` reads provider manifests from `resources/plugins/*/providers` and `~/.kucedr/providers/<id>/`. |
| Running unknown providers | `streamProvider()` in `src/main/models/adapters/llm/llm_model.ts` falls back to OpenAI-compatible chat for any provider id it doesn't recognize. |
| Local models | The `ollama` provider (`resources/plugins/ollama/providers/ollama`) plus `ModelLocation = 'remote' \| 'local'` in `src/shared/provider_types.ts`. |
| Apps | `src/main/apps/*` (`appsRoot`, `appDirectory`, `AppRegistry`, `app_manifest_validate`, and `render` in `app_render.ts`). |
| MCP servers | Local stdio servers are folders with `mcp.json` (see `resources/plugins/kucedr/mcp/configured-demo-server`), read by `readLocalMcpServer()` and discovered through `mcpLocalDiscoveryRoots()` in `src/main/mcp/mcp_local_root.ts`. |
| Skills | `src/main/agent/skills/*` (`skillsRoot`, `skills_list.ts`, `skills_resolve_folder.ts`). |
| Atomic install | `src/main/agent/skills/skills_import.ts`: copy into a staging folder, validate, then rename. |
| Settings UI | `src/renderer/src/pages/settings/pages/plugins/` (today it lists built-in integrations). |

What's missing: the plugin installer, loading `~/.kucedr/plugins/*`, extension slots, local model
downloads, the catalog, and the management UI.

## 3. Layout

Plugins load from two folders:

- **Installed:** `path.join(userDataLocation(), 'plugins')`, which is `~/.kucedr/plugins`.
  Settings → Plugins installs here.
- **Built-in:** `resources/plugins/` in the repo, shipped with the rest of `resources/`
  (`bundledPluginsRoot()`). These can be disabled but not removed.
- **Core plugin:** `resources/plugins/kucedr/` (`CORE_PLUGIN_ID`) ships Kucedr's own apps,
  extensions, MCP servers, and skills. It can't be disabled, removed, or replaced by an installed
  plugin with the same id.
- **Provider plugins:** each built-in provider is its own plugin,
  `resources/plugins/<provider-id>/providers/<provider-id>/`, so it can be disabled like any
  other built-in plugin.

An installed plugin overrides a built-in plugin with the same id. Each plugin keeps every
contribution kind in its own folder:

```text
~/.kucedr/plugins/<plugin-id>/
  manifest.json              plugin info only
  assets/                    images and other data, including the plugin icon
  apps/<app-id>/
    manifest.json
    index.html
    *.js, *.css, assets/
  extensions/<extension-id>/
    manifest.json            title, description, slot, icon
    index.html
    *.js, *.css, icon.svg
  mcp/
    servers.json             optional: server configs keyed by server id (stdio or http)
    <server-id>/
      mcp.json               same format as resources/plugins/kucedr/mcp/*/mcp.json
    server.mjs, ...          stdio servers only
  providers/<provider-id>/
    manifest.json            same format as resources/plugins/*/providers/*/manifest.json
                             (models, vector_databases, web_search, storage, mcp_servers)
    images/
  skills/<skill-id>/
    SKILL.md
```

Rules:

- The folder name must match the manifest `id`. All ids use lowercase kebab-case.
- **Plugins stay in their own folder.** Their files are never copied into `~/.kucedr/apps`,
  `providers`, `mcp`, or `skills`. Uninstalling a plugin deletes one folder.
- **Loaders get extra roots.** Each existing loader keeps its logic and also scans the matching
  folder of every enabled plugin. There is no second registry.
- **Contribution ids are folder names.** Each contribution lives in `<kind>/<id>/` and is
  described by its own file (`manifest.json`, `mcp.json`, or `SKILL.md`). The plugin manifest
  doesn't list contributions; `pluginContents()` finds them from the folders. Ids aren't namespaced. When a user app,
  skill, or MCP server has the same id as a plugin's, the user's wins; between plugins, the first
  by plugin id wins.
- **No symlinks.** A plugin containing a link is rejected.

## 4. Manifest (schema version 5)

Implemented today (`src/shared/plugin_manifest.ts`):

```json
{
	"schemaVersion": 5,
	"id": "acme-tools",
	"title": "Acme Tools",
	"version": "1.0.0",
	"description": "Acme models, dashboard, and CRM tools.",
	"author": "Acme",
	"minAppVersion": "1.3.0",
	"icon": "icon.png"
}
```

An extension's `extensions/<id>/manifest.json` (`extensionManifestSchema`):

```json
{
	"title": "Acme CRM",
	"description": "Acme records for the current conversation.",
	"slot": "panel",
	"icon": "icon.svg"
}
```

Planned additions (later steps) keep the same shape:

```json
{
	"configSchema": {
		"type": "object",
		"additionalProperties": false,
		"properties": {
			"workspace": { "type": "string" },
			"apiKey": { "type": "string" }
		}
	},
	"uiHints": {
		"workspace": { "label": "Workspace", "placeholder": "acme-team" },
		"apiKey": { "label": "API key", "sensitive": true }
	},
	"permissions": ["network:https://api.acme.test", "agent.prompt"]
}
```

Field rules:

- `schemaVersion`, `id`, `title`, `version`, and `description` are required. Unknown keys are
  rejected. The plugin must still contain at least one contribution folder.
- The manifest has no contribution list. Each `<kind>/<id>/` folder is one contribution. An
  extension's own `manifest.json` requires a `title`, a `description`, and a `slot`, and it can
  set an `icon`.
- `configSchema` and `uiHints` are optional. When present, Settings → Plugins renders the
  plugin's settings form from them, so plugins never ship settings UI code. Fields marked
  `sensitive` are saved in the existing credential store and are never written into the plugin
  folder. (The idea comes from OpenClaw's `openclaw.plugin.json`.)
- `icon` is an optional png, svg, jpg, or webp file (256 KB max) in the plugin's `assets/`
  folder, which holds the plugin's images and other data. An
  extension's `icon` is the same, inside its own folder. Settings shows them, and plugins without
  one get a default icon.
- `minAppVersion` blocks installing a plugin built for a newer Kucedr.
- `permissions` lists what the plugin's apps and extensions may do through the bridge in
  section 9. They are shown to the user before install, and anything not listed is denied.
- On install, each contribution must also be readable by its loader (`validatePluginContents()`):
  - an app needs a valid app `manifest.json` and entry file;
  - an extension needs an `index.html`;
  - every `mcp` id needs either a folder `mcp/<id>/` with a valid `mcp.json` or an entry in
    `mcp/servers.json`, but not both;
  - a provider needs a valid provider manifest whose `providerId` equals the folder name and isn't
    a built-in provider id;
  - a skill needs a valid `SKILL.md`.

The desktop schema lives in `src/shared/plugin_manifest.ts`. The CLI keeps its own v4 schema in
`packages/cli/src/manifest.ts`, because the CLI is out of scope.

## 5. Contribution kinds

### 5.1 Apps

Apps are standalone apps opened in their own window. They load through the existing apps pipeline:
`app_list.ts` and `appDirectory()` also look in `pluginDirs('apps')`. They render with `render()`
in `app_render.ts`, and `AppRegistry` tracks them under the id `<plugin-id>.<app-id>`. Apps keep
the existing app sandbox and per-app storage. JS and CSS are loaded only from the app's own folder
(see the CSP in section 9).

### 5.2 Extensions

An extension is plugin UI that appears *inside* Kucedr's screens, not in its own window. Each
extension picks one **slot**:

| Slot | Where it appears | Typical use |
| --- | --- | --- |
| `sidebar` | A new item in the main navigation that opens a full page | Dashboards, browsers |
| `panel` | A side panel in the workspace, next to the conversation | CRM records, previews |
| `toolbar` | A button in the conversation toolbar that opens a popover | Quick actions |
| `composer` | An action in the message composer's attachment/actions menu | Insert content into the prompt |
| `settings` | A page under Settings → Plugins → *plugin* | Advanced settings beyond `configSchema` |

How an extension renders:

- Kucedr owns the slot's frame: the nav item, panel header, button, and icon. These use the
  existing shadcn components and take `title` and `icon` from the manifest.
- The slot body is the extension's `index.html`, loaded in a **sandboxed iframe** from the
  `kucedr-plugin://<plugin-id>/extensions/<extension-id>/` protocol. The iframe has no preload,
  no Node, and no access to `window.api`. Each plugin gets its own origin, so plugins can't read
  each other's storage.
- The extension talks to Kucedr only through the `postMessage` bridge in section 9, limited to the
  plugin's declared `permissions`.
- The host sends theme tokens (CSS variables for colors, radius, and font) on load and whenever the
  theme changes, so extensions match light and dark mode.

Extension JS is never injected straight into Kucedr's renderer. That renderer has `window.api`,
which gives full access to the app's IPC, so injected plugin code would control the whole app.
VS Code makes the same choice with its webviews.

### 5.3 MCP servers

A plugin's `mcp/` folder holds its servers in two forms. A server's id is its folder name or its
`servers.json` key.

- **Server folders:** `mcp/<id>/mcp.json` uses the existing local MCP format (`command`, `args`,
  `cwd`, `env`, `require_approval`), next to the server's own files. Folders support stdio only,
  as they do in `~/.kucedr/mcp/servers`.
- **`mcp/servers.json`:** one file with any number of servers, keyed by server id. Each value
  uses the same fields as `mcp.json`, plus `"type": "http"` with a `url` for remote servers
  (https, or http on loopback). A stdio entry's `cwd` is relative to `mcp/`.

  ```json
  {
  	"acme-search": { "type": "http", "url": "https://mcp.acme.test/mcp", "name": "Acme Search" },
  	"acme-cli": { "command": "node", "args": ["acme-crm/server.mjs", "--cli"] }
  }
  ```

- Both are read by `listLocalMcpServers()` (`mcp_servers_file_entries.ts` for `servers.json`),
  which `mcpLocalDiscoveryRoots()` points at `pluginDirs('mcp')`. Plugin servers keep
  `source: 'local'` and run as separate processes, as local servers do today. OAuth sign-in for
  remote plugin servers is not supported yet.
- The plugin installer copies files exactly as they are and never runs `npm install` or lifecycle
  scripts. A stdio server must be bundled: one `.mjs` file, or its `node_modules` included in the
  archive.
- Plugin servers default to `require_approval: "always"` unless the user changes it.

### 5.4 Providers (models, vector databases, web search, storage, remote MCP)

`providers/<provider-id>/manifest.json` uses the existing provider manifest format. One manifest
can declare any of `models`, `vector_databases`, `web_search`, `storage`, and `mcp_servers`,
exactly as bundled providers do. `readCatalog()` adds `pluginDirs('providers')` to its directory
list, so every catalog API returns plugin entries as well (see section 5.6).

#### Vector databases only

Kucedr uses databases only to store and search embeddings (RAG and knowledge). The manifest key
`databases` is therefore renamed to **`vector_databases`**, for plugins and bundled providers alike:

```json
{
	"vector_databases": [
		{
			"id": "pinecone",
			"name": "Pinecone Vector Database",
			"description": "Store and search vector embeddings in Pinecone.",
			"url": "https://api.pinecone.io",
			"authentication": "api-key"
		}
	]
}
```

- **No `type` field.** Every entry is a vector database, so `DATABASE_TYPES`
  (`'vector' | 'sql' | 'nosql'`) and the per-entry type check in
  `src/shared/providers/validation.ts` are removed.
- **Validation:** `parseProviderManifest()` accepts `vector_databases` and rejects the old
  `databases` key with a clear error ("use vector_databases"). A plugin that ships `databases` is
  shown as unavailable instead of half-loading.
- **Runtime:** a vector database is executable only if it has an adapter in
  `src/main/database/vector_adapters.ts` (Pinecone today). Entries without one are still listed,
  but marked catalog-only, as `docs/PROVIDERS.md` does for models. Plugins can't ship vector
  database adapters until code plugins exist (section 11).
- **Renames:** the manifest key, `ProviderManifestDatabase` → `ProviderManifestVectorDatabase`,
  `loadDatabases()` → `loadVectorDatabases()`, `AppChannels.databases` →
  `AppChannels.vectorDatabases`, and the matching renderer calls (`lib/providers.ts`, Settings →
  Providers, Settings → Knowledge). Bundled manifests that have `"databases": []` change to
  `"vector_databases": []`, or drop the key.
- **Not renamed:** the stored credentials section (`StoredProviderKind 'databases'` in
  `providers_store.ts`) keeps its name. Users' saved API keys keep working with no data migration.

The rest of this section covers models.

**Remote models** (`"location": "remote"`): API models of any type the catalog supports
(`large-language-model`, speech to text, text to speech, image, video, audio, and embeddings).
Unknown provider ids run through the OpenAI-compatible adapter. Credentials come from the
provider settings or from `sensitive` fields in `configSchema`. They are never stored in the
manifest.

**Local models** (`"location": "local"`): model weights that the plugin points to. They are
downloaded after install and run locally. In v1 they run through **Ollama**, which the app already
supports, so Kucedr doesn't bundle its own inference runtime. A local model declares a `source`:

```json
{
	"id": "acme-small",
	"name": "Acme Small 3B",
	"type": "large-language-model",
	"location": "local",
	"source": {
		"ollama": "acme/small:3b"
	}
}
```

or, for raw weights:

```json
{
	"source": {
		"url": "https://huggingface.co/acme/small-gguf/resolve/main/small-q4.gguf",
		"sha256": "…",
		"sizeBytes": 2147483648,
		"format": "gguf"
	}
}
```

Install flow for local models:

1. Installing the plugin does **not** download weights. The model shows as "Not downloaded" in
   Settings → Providers → Models, with its size.
2. When the user clicks **Download**:
   - an `ollama` source calls Ollama's `/api/pull`;
   - a `url` source downloads to `~/.kucedr/models/<plugin-id>/<model-id>/`, with resume and a
     progress bar, checks `sha256`, and then registers the file with Ollama through `/api/create`.
3. If Ollama isn't running, the model shows "Requires Ollama" with a link, and no error is raised.
4. Removing the plugin offers to delete its downloaded weights, which are often several GB.

Running ONNX models (embeddings, speech) directly in the app without Ollama is deferred. See
section 11.

### 5.5 Skills

`skills_list.ts` and `skills_resolve_folder.ts` also scan `pluginDirs('skills')`. Each skill must
contain `SKILL.md` and pass the existing `validateSkill()` and `validateSkillPackage()` checks.

### 5.6 Listing APIs return plugin contributions

The UI keeps calling the same APIs it calls today. No new "plugin models" or "plugin MCP" endpoints
are added. Each existing list function also reads enabled plugins, so the UI receives bundled,
user, and plugin entries in one list.

| UI API (IPC channel) | Main function | Plugin source added |
| --- | --- | --- |
| `AppChannels.models` | `loadModels()` (`src/main/models.ts`) | `providers/*/manifest.json` → `models` |
| `AppChannels.vectorDatabases` | `loadVectorDatabases()` | `providers/*/manifest.json` → `vector_databases` |
| `AppChannels.webSearches` | `loadWebSearches()` | `providers/*/manifest.json` → `web_search` |
| `AppChannels.storages` | `loadStorages()` | `providers/*/manifest.json` → `storage` |
| `AppChannels.mcps` | `loadMcps()` | `providers/*/manifest.json` → `mcp_servers` (remote catalog services) |
| MCP server list (`src/main/ipc/mcp.ts`) | `mcp_local_list.ts` via `mcpLocalDiscoveryRoots()` | `mcp/*/mcp.json` (stdio) and `mcp/servers.json` (stdio and http) |
| `SkillsChannels.list` | `skills.list()` (`skills_list.ts`) | `skills/*/SKILL.md` |
| Apps list (`src/main/ipc/apps.ts`) | `listApps()` | `apps/*` |
| Provider lookups (`ipc/provider.ts`, `ipc/agent.ts`) | `loadProviders()`, `findModel()`, `modelsFor()`, and the rest | Same catalog, so plugin providers resolve everywhere |
| `plugins:extensions` (new) | `plugins_extensions.ts` | `extensions/*/manifest.json`, grouped by slot |

How it works:

1. **One change covers all five catalog APIs.** `loadModels`, `loadVectorDatabases`, `loadWebSearches`,
   `loadStorages`, and `loadMcps` all come from `readCatalog()`. That function's directory loop
   becomes:

   ```ts
   for (const directory of [...pluginDirs('providers'), providersDir()]) {
   ```

   The built-in providers arrive through their own built-in plugins like any other plugin's. The user's
   `~/.kucedr/providers` loads last, so user overrides still win.
2. **Local MCP servers:** `mcpLocalDiscoveryRoots()` returns
   `[localRoot, ...pluginDirs('mcp')]`.
3. **Skills and apps** scan `pluginDirs('skills')` and `pluginDirs('apps')` after their own roots.
4. **Entries are tagged with their source.** `PublicProvider` (shared by every catalog entry
   through `entry.provider`), `McpServerInfo`, `SkillInfo`, and the app list item get an optional
   field:

   ```ts
   readonly plugin?: { readonly id: string; readonly name: string };
   ```

   The field is absent for bundled and user entries. The UI can show a "from Acme Tools" badge and
   filter by plugin without another request. Plugin MCP servers keep `source: 'local'` and add
   the `plugin` field.
5. **Disabled or unavailable plugins are left out.** `pluginDirs()` only returns enabled,
   available plugins, so their entries disappear from every list at once.
6. **Ids:** a plugin provider id that matches a core provider id is rejected at install. For
   apps, skills, and MCP servers, user entries win over plugin entries with the same id. Deleting
   a plugin's app or skill from its own settings page is refused; disable or remove the plugin
   instead.
7. **Lists stay fresh.** After an install, removal, or toggle, `PluginsIpc` refreshes the plugin
   scan cache and the provider catalog, then broadcasts `AppChannels.modelsChanged`. MCP, skill,
   and app lists are read fresh on each call. `watchPlugins()` watches both plugin folders, so
   plugins edited on disk during development reload too.

## 6. Main-process module: `src/main/plugins/`

Following the `src/main/apps/` style, each file holds one function:

| File | Responsibility |
| --- | --- |
| `plugins_root.ts` | `pluginsRoot()` returns `path.join(userDataLocation(), 'plugins')`. |
| `plugins_list.ts` | Reads each `<root>/<id>/manifest.json` with the shared schema. A plugin that fails validation is listed as **unavailable**, with the reason, instead of being skipped. The other plugins keep loading. |
| `plugins_enabled.ts` | Stores enabled plugin ids in electron-store. New installs start enabled. |
| `plugins_dirs.ts` | `pluginDirs(kind)` returns the `<plugin>/<kind>` folders of enabled, available plugins. All loaders call this one function. |
| `plugins_install.ts` | Takes a source folder, copies it to `<root>/.install-<uuid>/`, validates the manifest, entries, `minAppVersion`, and per-kind checks, then renames it to `<root>/<id>`. Re-installing the same id replaces the old version. If anything fails, the staging folder is deleted. |
| `plugins_upload.ts` | Opens a picker for a folder or `.tgz`, extracts the archive if needed, then installs. |
| `plugins_download.ts` | Downloads an https `.tgz` with `fetch` and a size cap, checks `integrity` when one is given, extracts it to a temp folder, then installs. |
| `plugins_remove.ts` | Deletes `<root>/<id>` and its enabled entry, and optionally its downloaded model weights. |
| `plugins_catalog.ts` | Fetches and caches the catalog `index.json` (section 10). |
| `plugins_config.ts` | Reads and writes plugin config values; `sensitive` values go to the credential store. |
| `plugins_protocol.ts` | Serves `kucedr-plugin://<plugin-id>/...` from the plugin folder and rejects any path that escapes it. |
| `models_download.ts` | Downloads local model weights through Ollama pull, or by URL plus a `sha256` check. |

Archives are extracted with `tar` (already used by the CLI; add it to the root `dependencies`).
Extraction rejects symlinks and entries that escape the target folder. npm tarballs unpack into
`package/`, and install uses that folder when present. The desktop never shells out to `npm`.

After an install, removal, enable toggle, or config change, the module emits `plugins:changed` on
`src/main/event_bus.ts`. The model, app, MCP, skill, and extension-slot lists then refresh without
a restart.

## 7. IPC and preload

These follow the existing pattern in `src/main/ipc/mcp.ts`, `src/preload/mcp.ts`, and
`src/shared/ipc_channels_*`:

| Channel | Purpose |
| --- | --- |
| `plugins:list` | Lists installed plugins with their manifest, enabled state, availability, and contributions. |
| `plugins:catalog` | Returns the remote catalog with an `installed` / `update available` state for each entry. |
| `plugins:install-url` | Installs from an https URL (used by catalog installs too). |
| `plugins:upload` | Opens the picker and installs the selection. |
| `plugins:remove` | Uninstalls a plugin. |
| `plugins:set-enabled` | Enables or disables a plugin. |
| `plugins:config-get` / `plugins:config-set` | Reads and writes values for the `configSchema` form. |
| `plugins:extensions` | Lists enabled extensions grouped by slot, for the renderer to mount. |
| `models:download` / `models:download-progress` | Downloads a local model and streams its progress. |

## 8. UI (Settings → Plugins)

Use the existing shadcn components and the patterns already on the plugins page:

- **Browse:** catalog cards showing icon, name, author, description, the kinds the plugin
  contains, and an **Install** or **Update** button.
- **Installed:** a list of installed plugins showing version, an enable switch, and a remove
  button. Unavailable plugins show the reason they couldn't be loaded.
- **Plugin detail:** the plugin's contributions, its permissions, and the settings form generated
  from `configSchema` and `uiHints`.
- **Install from URL** and **Upload** buttons.
- **Install confirmation:** before every install, a dialog lists what the plugin adds and the
  permissions it requests (reuse `Confirm.tsx`).

Extension slot hosts, each a small component that mounts the sandboxed iframe:

| Slot | Where the host component goes |
| --- | --- |
| `sidebar` | Main navigation |
| `panel` | Workspace page |
| `toolbar` | Conversation toolbar |
| `composer` | Composer actions menu |
| `settings` | Plugin detail page |

## 9. Security model

- **No plugin code in the main process or in Kucedr's renderer, ever.** Code runs only where it's
  isolated:
  - apps in a sandboxed window;
  - extensions in a sandboxed iframe with a per-plugin origin;
  - stdio MCP servers in their own process;
  - local models inside Ollama.
- **The bridge is narrow.** Apps and extensions call the host with
  `postMessage({ id, method, params })`. The host checks each call against the plugin's declared
  `permissions` and rejects anything not listed. Initial methods:

  | Method | Permission | Purpose |
  | --- | --- | --- |
  | `theme.get` | none | Returns theme tokens; updates are pushed too. |
  | `config.get` | none | Returns the plugin's own non-sensitive config. |
  | `storage.get` / `storage.set` | none | Per-plugin key-value storage. |
  | `composer.insert` | `composer.insert` | Inserts text into the message composer. |
  | `agent.prompt` | `agent.prompt` | Sends a prompt to the agent; the user sees it in the conversation. |
  | `mcp.call` | `mcp.call` | Calls a tool on one of the plugin's *own* MCP servers. |
  | `app.open` | none | Opens one of the plugin's own apps. |

- **Network is opt-in.** Plugin pages get the CSP `default-src 'self' kucedr-plugin:`. Each
  `network:<origin>` permission adds that origin to `connect-src`.
- **Paths are validated** on install and when serving files: no absolute paths, no `..`, no
  backslashes, no symlinks.
- **Downloads are https only**, size-capped, and checked against `integrity` / `sha256` when given.
- **Manifests carry no secrets.** Credentials stay in the existing provider, MCP, and plugin
  credential stores.
- **Users approve each install** after seeing its contributions and permissions.

## 10. Distribution

Plugin packages are hosted on **npm**. The list of plugins is a static catalog file in a GitHub
repo.

- **Packages:** each plugin is published as an npm package (for example `@kucedr/plugin-acme`)
  whose tarball has the layout in section 3. npm provides free hosting, versioning, a fixed
  tarball URL per version, and a SHA-512 `integrity` hash.
- **Catalog:** a public `kucedr-plugins` GitHub repo holds `index.json`, served from GitHub Pages
  or `raw.githubusercontent.com`. Plugin authors open a pull request to be listed, which doubles
  as the review step. The catalog URL is a single constant in `plugins_catalog.ts`.

```json
{
	"schemaVersion": 1,
	"plugins": [
		{
			"id": "acme-tools",
			"title": "Acme Tools",
			"description": "Acme models, dashboard, and CRM tools.",
			"author": "Acme",
			"icon": "https://…/icon.png",
			"version": "1.0.0",
			"minAppVersion": "1.3.0",
			"url": "https://registry.npmjs.org/@acme/kucedr-tools/-/kucedr-tools-1.0.0.tgz",
			"integrity": "sha512-…",
			"contains": ["apps", "extensions", "mcp", "providers", "skills"]
		}
	]
}
```

- **Updates:** an update is available when the catalog `version` is newer than the installed one.
  Updating reinstalls through the same atomic path, and the plugin's config is kept.
- **Install from URL and Upload** stay available for private or development plugins. Those
  installs show an "Unlisted source" warning in the confirmation dialog.

## 11. Later phases

Build each of these only when a real plugin needs it.

1. **A built-in local runtime.** Run ONNX or GGUF models directly (for example with
   `onnxruntime-node` or `node-llama-cpp` in a `utilityProcess`), so local embeddings and speech
   work without Ollama.
2. **Background code.** Plugin JS that runs without UI (custom provider adapters, hooks), in one
   `utilityProcess` per plugin with the same permission-checked bridge. Until then, MCP servers
   cover tools.
3. **Self-serve publishing.** A Supabase `plugins` table plus a storage bucket, with download
   counts and moderation, once outside authors outgrow pull requests.
4. **Signing.** Signed packages and a publisher identity for third-party plugins at scale.

## 12. Implementation order

1. ✅ Add the schema v5 manifest in `src/shared/plugin_manifest.ts`.
2. ✅ Add the `src/main/plugins/` core (root, list, enabled, dirs, install, upload, download,
   remove) and the IPC handlers.
3. ✅ Rename `databases` to `vector_databases` (section 5.4) in the manifest key, validation, types,
   `loadVectorDatabases()`, `AppChannels.vectorDatabases`, bundled manifests, and the renderer.
   Verify with `npm run typecheck`, and confirm Pinecone still connects in Settings → Knowledge.
4. ✅ Connect the listing APIs (section 5.6): `readCatalog()` (models, vector databases, web search,
   storage, and remote MCP), `mcpLocalDiscoveryRoots()`, skills, and apps. Add the `plugin` source
   tag and refresh on `plugins:changed`.
5. ✅ Build the Settings → Plugins Installed list (enable switch, remove), Upload, and Install from
   URL. The install confirmation dialog listing contributions is still to do.
6. Add the config form generated from `configSchema` and `uiHints`.
7. Add the `kucedr-plugin://` protocol, the postMessage bridge, and the extension slot hosts
   (start with `panel` and `sidebar`). Extensions can already be declared, validated, and listed,
   but they don't render yet.
8. Add local model downloads (Ollama pull, then URL plus `sha256`).
9. Add the catalog: `plugins_catalog.ts`, the Browse tab, and updates.
10. Update [PLUGINS.md](PLUGINS.md) to describe schema v5 and the desktop flow, and
    [PROVIDERS.md](PROVIDERS.md) to use `vector_databases`.

## 13. Verification

- `npm run typecheck && npm run lint`.
- Build a sample `acme-tools` plugin containing one app, one `panel` extension, one stdio MCP
  server, a provider with one remote model, one Ollama local model, and one vector database, and one
  skill. Then:
  1. **Upload it:**
     - the app opens in its own window;
     - the panel appears in the workspace and follows the theme;
     - the MCP tools appear in the agent's tool list;
     - both models come back from `AppChannels.models` and appear in Settings → Providers →
       Models with a "from Acme Tools" badge;
     - the vector database comes back from `AppChannels.vectorDatabases` and appears in
       Settings → Providers → Database;
     - a plugin manifest that uses the old `databases` key is shown as unavailable;
     - disabling the plugin removes them from both responses without a restart;
     - the skill appears in Skills.
  2. **Download the local model:** progress is shown, and the model then answers a chat through
     Ollama. With Ollama stopped, it shows "Requires Ollama" instead of an error.
  3. **Test the bridge:** a `composer.insert` call from the extension works when declared and is
     rejected when the permission is removed. `fetch` to an undeclared origin is blocked by CSP.
  4. **Install from the catalog:** after publishing a test `index.json`, Install and then Update
     both work. Changing `integrity` makes the install fail.
  5. **Disable and remove:** disabling removes every contribution, and removing deletes the
     folder (and the weights, if confirmed).
  6. **Reject bad packages:** a malformed manifest, a `../` entry, a symlink in the archive, or a
     newer `minAppVersion` is rejected, and nothing is left in `~/.kucedr/plugins`.
- Run `npm run dev` and check the whole flow end to end.
