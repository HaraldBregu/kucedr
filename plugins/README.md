# Plugins

Built-in Kucedr plugins live here, one folder per plugin. The desktop app loads this folder as
well as `~/.kucedr/plugins`, where plugins installed from Settings → Plugins go. An installed
plugin overrides a built-in one with the same id.

Every folder except `example/` is packaged into the app. `example/` is a dev-only template.

```text
<plugin-id>/
  manifest.json
  apps/<app-id>/              manifest.json + index.html, js, css
  mcp_servers/<server-id>/    mcp.json (+ server files for stdio)
  providers/<provider-id>/    manifest.json (models, vector_databases, web_search, storage, mcp_servers)
  skills/<skill-id>/          SKILL.md
```

`manifest.json` (schema version 5):

```json
{
	"schemaVersion": 5,
	"id": "example",
	"name": "Example",
	"version": "1.0.0",
	"description": "What the plugin adds.",
	"minAppVersion": "1.2.0",
	"contributes": {
		"apps": [{ "id": "notes" }],
		"mcp_servers": [{ "id": "text-tools" }],
		"providers": [{ "id": "example-provider" }],
		"skills": [{ "id": "release-notes" }]
	}
}
```

Rules:

- The plugin folder name must match `id`. Every contribution lives in `<kind>/<id>/`, and every
  folder under a kind must be declared in `contributes`.
- Plugins can't contain symlinks, and stdio MCP servers must be bundled (Kucedr never runs
  `npm install`).
- A provider id can't reuse a built-in provider id.

See [docs/PLUGIN_SYSTEM.md](../docs/PLUGIN_SYSTEM.md) for the full design.
