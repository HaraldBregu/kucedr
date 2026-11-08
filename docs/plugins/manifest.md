# Plugin manifest and layout

## Folder layout

```
<id>/
  manifest.json          required
  assets/                icons referenced by the manifest
  apps/<app-id>/         windowed or extension apps
  mcp/<server-id>/       mcp.json (local) or manifest.json (remote, provider)
  mcp/servers.json       several local servers keyed by id
  models/<model-id>/     manifest.json per model (provider)
  services/<service-id>/ manifest.json per service (provider)
  skills/<skill-id>/     SKILL.md and resources
  scripts/<script-id>/   manifest.json, instructions.md, built entry
  modes/<mode-id>/       manifest.json, SYSTEM_PROMPT.md
```

The folder name must equal the manifest `id` (for installed and bundled plugins; see [loading.md](loading.md)).

## Contribution kinds

`PLUGIN_KINDS` in `src/shared/plugin_types.ts`: `apps`, `mcp`, `providers`, `skills`, `scripts`, `modes`.

`pluginContents()` (`src/main/plugins/plugins_contents.ts`) computes the contribution ids of each kind:

- For `apps`, `mcp`, `skills`, `scripts`, `modes`: every child **folder** of `<kind>/` is one contribution, sorted by name. Dotfiles and a top-level `README.md` are skipped. Any other file is an error (`<kind>/<name> must be a folder.`).
- `mcp/` also counts the keys of `mcp/servers.json`. An id that is both a folder and a `servers.json` key is an error.
- `providers` is not a folder. It is `[<plugin id>]` when the manifest (plus `models/`, `services/`, and remote `mcp/*/manifest.json`) defines a provider, else empty. See [providers.md](providers.md).

A plugin with no contributions at all is rejected: `A plugin must contain at least one contribution.`

## `manifest.json`

Validated by `pluginManifestSchema` (`src/shared/plugin_manifest.ts`). The object is **strict**: unknown keys fail.

| Field | Required | Rule |
|---|---|---|
| `schemaVersion` | yes | Literal `5`. |
| `id` | yes | Lowercase kebab-case: `^[a-z0-9]+(?:-[a-z0-9]+)*$`. |
| `title` | yes | Non-empty. Shown as the plugin name. |
| `version` | yes | Semver (`1.2.3`, optional `-pre` / `+build`). |
| `description` | yes | Non-empty. |
| `author` | yes | Non-empty. |
| `categories` | no | Array of non-empty strings, e.g. `["LLM"]`, `["SEARCH"]`, `["CORE"]`. |
| `website` | no | Must be an `https://` URL. When missing, `pluginWebsites` (`src/shared/plugin_websites.ts`) supplies a default by id. |
| `minAppVersion` | no | Semver. The plugin fails to load if the app version is lower. |
| `icon` | no | File name in `assets/`: `png`, `svg`, `jpg`, `jpeg`, or `webp`. Must exist and be ≤ 256 KB. |
| `iconDark` | no | Same rules; shown in dark mode. |
| `settings` | no | `{ inputSchema: { type: "object", properties, required? } }`. See [settings.md](settings.md). |

Provider fields are accepted as `unknown` here and validated later by `validateProviderManifest()` (`src/shared/providers/validation.ts`): `authentication`, `apiKeyUrl`, `baseUrl`, `modelsUrl`, `modelUrl`, `icon_dark_url`, `icon_light_url`, `instructions`, `models`, `mcp_servers`, `vector_databases`, `web_search`, `storage`.

### Example: provider plugin

```json
{
	"schemaVersion": 5,
	"id": "anthropic",
	"title": "Anthropic",
	"version": "1.1.0",
	"description": "Claude chat models for writing, coding, and analysis.",
	"categories": ["LLM"],
	"author": "Harald Bregu",
	"website": "https://www.anthropic.com",
	"icon": "anthropic-light.svg",
	"iconDark": "anthropic-dark.svg",
	"apiKeyUrl": "https://console.anthropic.com/settings/keys",
	"settings": {
		"inputSchema": {
			"type": "object",
			"properties": {
				"apiKey": { "type": "string", "title": "API key", "format": "password" }
			},
			"required": ["apiKey"]
		}
	}
}
```

### Example: content plugin

```json
{
	"schemaVersion": 5,
	"id": "bootstrap",
	"title": "Bootstrap",
	"version": "1.4.0",
	"description": "Core plugin with the built-in apps, MCP servers, skills, scripts, and modes.",
	"categories": ["CORE"],
	"author": "Harald Bregu",
	"icon": "icon.svg",
	"settings": { "inputSchema": { "type": "object", "properties": {} } }
}
```

## Read-time checks

`readPlugin()` (`src/main/plugins/plugins_read.ts`) runs these in order. The first failure becomes the plugin's `error` (see [loading.md](loading.md)).

1. `manifest.json` exists and is valid JSON.
2. Schema passes; issues are joined as `path: message`.
3. Folder name equals `id` (skipped for staged installs, which pass `expectedId = null`).
4. `minAppVersion` ≤ app version.
5. No symbolic links anywhere in the folder — **user plugins only**. Bundled plugins skip this because their script workspaces can contain npm `.bin` links.
6. `icon` / `iconDark` exist under `assets/` and are ≤ 256 KB.
7. `models/` is read (see [providers.md](providers.md)).
8. The provider is built from manifest + `models/` + `services/` + remote `mcp/` and validated.
9. Contribution ids are computed; at least one must exist.

Per-contribution validation (apps, MCP, scripts, modes, skills) runs only at install time, in `validatePluginContents()`. See [install.md](install.md).
