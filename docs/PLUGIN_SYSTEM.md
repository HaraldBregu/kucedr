# Plugin system strategy

Status: proposal. Nothing in this document is implemented yet.

This document plans how the Kucedr desktop app installs, loads, and distributes plugins. A plugin is
one package that can contain five kinds of contributions:

| Kind | What it adds | Where it runs |
| --- | --- | --- |
| **apps** | Standalone HTML/JS/CSS apps opened in their own window | Sandboxed app window |
| **extensions** | HTML/JS/CSS UI placed inside Kucedr's own screens (sidebar, panel, toolbar, settings, composer) | Sandboxed frame inside the host UI |
| **mcp_servers** | Agent tools served over MCP: local stdio servers or remote http servers | Separate process, or remote |
| **providers** | Provider manifests: models (remote API models and local model files), databases, web search, storage, and remote MCP services | Remote API, or local through Ollama |
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
| Remote models | `readCatalog()` in `src/main/models.ts` reads provider manifests from `resources/providers` and `~/.kucedr/providers/<id>/`. |
| Running unknown providers | `streamProvider()` in `src/main/models/adapters/llm/llm_model.ts` falls back to OpenAI-compatible chat for any provider id it doesn't recognize. |
| Local models | The `ollama` provider (`resources/providers/ollama`) plus `ModelLocation = 'remote' \| 'local'` in `src/shared/provider_types.ts`. |
| Apps | `src/main/apps/*` (`appsRoot`, `appDirectory`, `AppRegistry`, `app_manifest_validate`, and `render` in `app_render.ts`). |
| MCP servers | Local stdio servers are folders with `mcp.json` (see `resources/mcp/configured-demo-server`), read by `readLocalMcpServer()` and discovered through `mcpLocalDiscoveryRoots()` in `src/main/mcp/mcp_local_root.ts`. |
| Skills | `src/main/agent/skills/*` (`skillsRoot`, `skills_list.ts`, `skills_resolve_folder.ts`). |
| Atomic install | `src/main/agent/skills/skills_import.ts`: copy into a staging folder, validate, then rename. |
| Settings UI | `src/renderer/src/pages/settings/pages/plugins/` (today it lists built-in integrations). |

What's missing: the plugin installer, loading `~/.kucedr/plugins/*`, extension slots, local model
downloads, the catalog, and the management UI.

## 3. Layout

Plugins are installed in `path.join(userDataLocation(), 'plugins')`, which is `~/.kucedr/plugins`.
Each plugin keeps every contribution kind in its own folder:

```text
~/.kucedr/plugins/<plugin-id>/
  manifest.json
  icon.png
  apps/<app-id>/
    index.html
    *.js, *.css, assets/
  extensions/<extension-id>/
    index.html
    *.js, *.css
  mcp_servers/<server-id>/
    mcp.json                 same format as resources/mcp/*/mcp.json
    server.mjs, ...          stdio servers only
  providers/<provider-id>/
    manifest.json            same format as resources/providers/*/manifest.json
                             (models, databases, web_search, storages, mcp_servers)
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
- **Ids are namespaced.** Inside Kucedr, contributions are referred to as
  `<plugin-id>.<contribution-id>` so they can't collide with user content or other plugins.

## 4. Manifest (schema version 5)

```json
{
	"schemaVersion": 5,
	"id": "acme-tools",
	"name": "Acme Tools",
	"version": "1.0.0",
	"description": "Acme models, dashboard, and CRM tools.",
	"author": "Acme",
	"icon": "icon.png",
	"minAppVersion": "1.3.0",
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
	"contributes": {
		"apps": [
			{
				"id": "dashboard",
				"title": "Acme Dashboard",
				"entry": "apps/dashboard/index.html"
			}
		],
		"extensions": [
			{
				"id": "crm-panel",
				"title": "Acme CRM",
				"slot": "panel",
				"entry": "extensions/crm-panel/index.html"
			}
		],
		"mcpServers": [{ "id": "acme-crm", "path": "mcp_servers/acme-crm" }],
		"models": [{ "id": "acme", "path": "models/acme" }],
		"skills": [{ "id": "summarizer", "path": "skills/summarizer" }]
	},
	"permissions": ["network:https://api.acme.test", "agent.prompt"]
}
```

Field rules:

- `schemaVersion`, `id`, `name`, and `version` are required.
- `configSchema` and `uiHints` are optional. When present, Settings → Plugins renders the
  plugin's settings form from them, so plugins never ship settings UI code. Fields marked
  `sensitive` are saved in the existing credential store and are never written into the plugin
  folder. (The idea comes from OpenClaw's `openclaw.plugin.json`.)
- `minAppVersion` blocks installing a plugin built for a newer Kucedr.
- `permissions` lists what the plugin's apps and extensions may do through the bridge in
  section 9. They are shown to the user before install, and anything not listed is denied.
- Every `entry` and `path` must pass `isPluginPath` and resolve to a file or folder inside the
  plugin.

The schema moves from `packages/cli/src` to `src/shared/plugin/` (`manifest.ts`, `entries.ts`,
`pluginpath.ts`) so the desktop uses the same validation.

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

- **Local (stdio):** `mcp_servers/<id>/mcp.json` uses the existing local MCP format (`command`,
  `args`, `cwd`, `env`, `require_approval`). Add `pluginDirs('mcp_servers')` to
  `mcpLocalDiscoveryRoots()`, and they're read by `readLocalMcpServer()` like any other local
  server. They run as separate processes, as they do today.
- **Remote (http):** `mcp.json` with `"type": "http"` and a `url`. These are merged into the MCP
  catalog. OAuth and tokens go through the existing MCP settings flow.
- The plugin installer copies files exactly as they are and never runs `npm install` or lifecycle
  scripts. A stdio server must be bundled: one `.mjs` file, or its `node_modules` included in the
  archive.
- Plugin servers default to `require_approval: "always"` unless the user changes it.

### 5.4 Models

`models/<provider-id>/manifest.json` uses the existing provider manifest format, with one entry
per model. `readCatalog()` adds `pluginDirs('models')` to its directory list.

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
			"name": "Acme Tools",
			"description": "Acme models, dashboard, and CRM tools.",
			"author": "Acme",
			"icon": "https://…/icon.png",
			"version": "1.0.0",
			"minAppVersion": "1.3.0",
			"url": "https://registry.npmjs.org/@acme/kucedr-tools/-/kucedr-tools-1.0.0.tgz",
			"integrity": "sha512-…",
			"contains": ["apps", "extensions", "mcp_servers", "models", "skills"]
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

1. Move the manifest schema to `src/shared/plugin/` and add schema v5. Verify with
   `npm run typecheck`.
2. Add the `src/main/plugins/` core (root, list, enabled, dirs, install, upload, download,
   remove) and the IPC handlers.
3. Connect the loaders: models in `readCatalog()`, apps, `mcpLocalDiscoveryRoots()`, and skills.
4. Build the Settings → Plugins Installed list, Upload, Install from URL, and the confirmation
   dialog.
5. Add the config form generated from `configSchema` and `uiHints`.
6. Add the `kucedr-plugin://` protocol, the postMessage bridge, and the extension slot hosts
   (start with `panel` and `sidebar`).
7. Add local model downloads (Ollama pull, then URL plus `sha256`).
8. Add the catalog: `plugins_catalog.ts`, the Browse tab, and updates.
9. Update [PLUGINS.md](PLUGINS.md) to describe schema v5 and the desktop flow.

## 13. Verification

- `npm run typecheck && npm run lint`.
- Build a sample `acme-tools` plugin containing one app, one `panel` extension, one stdio MCP
  server, one remote model plus one Ollama local model, and one skill. Then:
  1. **Upload it:**
     - the app opens in its own window;
     - the panel appears in the workspace and follows the theme;
     - the MCP tools appear in the agent's tool list;
     - both models appear in Settings → Providers → Models;
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
