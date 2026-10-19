# Plugins

Built-in Kucedr plugins live here, one folder per plugin. The desktop app loads this folder as
well as `~/.kucedr/plugins`, where plugins installed from Settings → Plugins go. An installed
plugin overrides a built-in one with the same id.

Every folder is packaged into the app. `bootstrap-kucedr/` is the core plugin: it holds Kucedr's
built-in apps, extensions, MCP servers, providers, and skills, and it can't be disabled, removed, or
replaced.

```text
<plugin-id>/
  manifest.json
  icon.svg                    optional png, svg, jpg, or webp (256 KB max)
  apps/<app-id>/              manifest.json + index.html, js, css
  extensions/<extension-id>/  index.html, js, css, optional icon (shown in a host UI slot)
  mcp/servers.json            optional: server configs keyed by id (stdio or http)
  mcp/<server-id>/            mcp.json (+ server files, stdio only)
  providers/<provider-id>/    manifest.json (models, vector_databases, web_search, storage, mcp_servers)
  skills/<skill-id>/          SKILL.md
```

`manifest.json` (schema version 5):

```json
{
	"schemaVersion": 5,
	"id": "acme-tools",
	"title": "Acme Tools",
	"version": "1.0.0",
	"description": "What the plugin adds.",
	"minAppVersion": "1.2.0",
	"icon": "icon.svg",
	"contributes": {
		"apps": [{ "id": "notes" }],
		"extensions": [
			{
				"id": "word-counter",
				"title": "Word counter",
				"description": "Counts the words in pasted text.",
				"slot": "panel",
				"icon": "icon.svg"
			}
		],
		"mcp": [{ "id": "text-tools" }, { "id": "deepwiki" }],
		"providers": [{ "id": "acme" }],
		"skills": [{ "id": "release-notes" }]
	}
}
```

Rules:

- The plugin folder name must match `id`. Every contribution lives in `<kind>/<id>/`, and every
  folder under a kind must be declared in `contributes`.
- Every `mcp` id is either a folder `mcp/<id>/` or a key in `mcp/servers.json`, not both.
- Plugins can't contain symlinks, and stdio MCP servers must be bundled (Kucedr never runs
  `npm install`).
- An extension's `slot` is one of `sidebar`, `panel`, `toolbar`, `composer`, or `settings`.
  Extensions don't render yet.
- A provider id can't reuse a built-in provider id.

See [docs/PLUGIN_SYSTEM.md](../../docs/PLUGIN_SYSTEM.md) for the full design.
