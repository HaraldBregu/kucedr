# Plugins

Built-in Kucedr plugins live here, one folder per plugin. The desktop app loads this folder as
well as `~/.kucedr/plugins`, where plugins installed from Settings → Plugins go. An installed
plugin overrides a built-in one with the same id.

Every folder is packaged into the app. `kucedr/` is the core plugin: it holds Kucedr's
built-in apps, extensions, MCP servers, and skills, and it can't be disabled, removed, or replaced.
Every other folder is one built-in provider as its own plugin (`<id>/providers/<id>/`), which can be
disabled.

```text
<plugin-id>/
  manifest.json               plugin info only
  assets/                     images and other data (the plugin icon lives here)
  apps/<app-id>/              manifest.json + index.html, js, css
  extensions/<extension-id>/  manifest.json + index.html, js, css, optional icon
  mcp/servers.json            optional: server configs keyed by id (stdio or http)
  mcp/<server-id>/            mcp.json (+ server files, stdio only)
  providers/<provider-id>/    manifest.json (models, vector_databases, web_search, storage, mcp_servers)
  skills/<skill-id>/          SKILL.md
```

`manifest.json` (schema version 5) describes only the plugin:

```json
{
	"schemaVersion": 5,
	"id": "acme-tools",
	"title": "Acme Tools",
	"version": "1.0.0",
	"description": "What the plugin adds.",
	"author": "Acme",
	"minAppVersion": "1.2.0",
	"icon": "icon.svg"
}
```

`icon` is a png, svg, jpg, or webp file in `assets/` (256 KB max).

Contributions are found from their folders, and each one is described by its own file. An
extension's `manifest.json`:

```json
{
	"title": "Word counter",
	"description": "Counts the words in pasted text.",
	"slot": "panel",
	"icon": "icon.svg"
}
```

Rules:

- The plugin folder name must match `id`. Every folder under a kind is one contribution, and its
  folder name is its id.
- A plugin must contain at least one app, extension, MCP server, provider, or skill.
- Every `mcp` id is either a folder `mcp/<id>/` or a key in `mcp/servers.json`, not both.
- Plugins can't contain symlinks, and stdio MCP servers must be bundled (Kucedr never runs
  `npm install`).
- An extension's `slot` is one of `sidebar`, `panel`, `toolbar`, `composer`, or `settings`.
  Extensions don't render yet.
- A provider id can't reuse a built-in provider id.

See [docs/PLUGIN_SYSTEM.md](../../docs/PLUGIN_SYSTEM.md) for the full design.
