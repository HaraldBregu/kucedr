# Kucedr plugins

Kucedr discovers user-installed plugins from:

```text
<Electron userData>/plugins/<plugin-id>/manifest.json
```

Install a published or local plugin with the Kucedr CLI:

```sh
kucedr install package-one
kucedr install ./path/to/plugin
```

Use `kucedr tui` for the interactive terminal interface, then enter `/install package-one`.
The CLI fetches npm packages without running lifecycle scripts, validates their manifest and
contributed files, and installs them atomically. Restart Kucedr after installation.

The installed application directory is not used because packaged application files may be read-only
or replaced by an update. Plugin IDs and contribution IDs use lowercase kebab-case. The plugin folder
name must match the manifest `id`.

A plugin keeps each contribution kind in its own folder. The `apps/`, `skills/`, and
`providers/` folders are the standardized layout: app entries must live under `apps/`,
skill paths under `skills/`, and each provider is a folder under `providers/` shaped like the
built-in `resources/providers/<id>/` catalog:

```text
<plugin-id>/
  manifest.json
  apps/<app-id>/index.html
  skills/<skill-id>/SKILL.md
  providers/<provider-id>/
    manifest.json
  mcp/
  languages/<locale>.json
  themes/<theme-id>.json
  channels/<channel-id>.mjs
```

## Manifest version 3

```json
{
	"schemaVersion": 4,
	"id": "acme-tools",
	"name": "Acme Tools",
	"version": "1.0.0",
	"description": "Acme provider and dashboard integrations.",
	"contributes": {
		"providers": [{ "id": "acme" }],
		"skills": [{ "id": "summarizer", "path": "skills/summarizer" }],
		"mcpServers": [
			{
				"id": "acme-docs",
				"name": "Acme Docs",
				"type": "http",
				"url": "https://mcp.acme.test"
			}
		],
		"apps": [
			{
				"id": "dashboard",
				"title": "Acme Dashboard",
				"description": "Account usage and status.",
				"category": "integration",
				"entry": "apps/dashboard/index.html"
			}
		],
		"languages": [{ "id": "fr", "name": "Français", "entry": "languages/fr.json" }],
		"themes": [{ "id": "ocean", "name": "Ocean", "entry": "themes/ocean.json" }],
		"channels": [
			{
				"id": "helpdesk",
				"name": "Helpdesk",
				"description": "Acme support chat.",
				"entry": "channels/helpdesk.mjs"
			}
		]
	}
}
```

A provider contribution only declares its `id`; the definition lives in `providers/<provider-id>/`:

```json
// providers/acme/manifest.json
{
	"providerId": "acme",
	"providerName": "Acme AI",
	"apiKeyUrl": "https://acme.test/keys",
	"services": [{ "id": "acme-chat", "name": "Acme Chat", "type": "large-language-model", "url": "https://api.acme.test/v1" }]
}
```

Provider credentials do not belong in the manifest. They remain in Kucedr's provider settings store.
Only declarative OpenAI-compatible chat providers are supported; custom executable provider adapters
are not loaded into the Electron main process.

App entries must be relative HTML paths inside the plugin folder. Kucedr verifies that each entry is
a regular file and remains inside its plugin before exposing it. Plugin apps run without Kucedr's
preload API.

Skills must contain `SKILL.md`. Language and theme contributions are JSON assets. MCP server
contributions contain connection metadata but no credentials. Channel entries are cataloged as
contained JavaScript modules but are not executed by this foundation; channel activation will require
an explicit trust decision and lifecycle integration with Kucedr's channel registry.

The main-process `PluginRepository` is the filesystem source of truth. It validates manifests, returns
structured scan issues, rejects provider ID collisions, and catalogs providers, skills, apps, MCP
servers, languages, themes, and chatbot communication channels. Provider and app contributions are
already supplied to their existing IPC and menu flows; the other catalogs are ready for their
respective runtime registries.
