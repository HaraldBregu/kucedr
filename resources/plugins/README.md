# Plugins

Built-in Kucedr plugins live here, one folder per plugin. The desktop app loads this folder as
well as `~/.kucedr/plugins`, where plugins installed from Settings → Plugins go. An installed
plugin overrides a built-in one with the same id.

Every folder is packaged into the app. `kucedr/` is the core plugin: it holds Kucedr's
built-in apps, extensions, MCP servers, and skills, and it can't be disabled, removed, or replaced.
Every other folder is one built-in provider as its own plugin, which can be disabled. A provider
plugin is just `manifest.json` (plugin info plus its services) and `assets/` (its images).

```text
<plugin-id>/
  manifest.json               plugin info, plus provider services when it is a provider
  assets/                     images and other data (plugin and provider icons live here)
  apps/<app-id>/              manifest.json + index.html, js, css
  extensions/<extension-id>/  manifest.json + index.html, js, css, optional icon
  mcp/servers.json            optional: server configs keyed by id (stdio or http)
  mcp/<server-id>/            mcp.json (+ server files, stdio only)
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
  For now every extension is listed in the home sidebar and opens in place of the chat in a
  sandboxed frame. It has no network access.
- A provider id can't reuse a built-in provider id.

See [docs/PLUGIN_SYSTEM.md](../../docs/PLUGIN_SYSTEM.md) for the full design.
