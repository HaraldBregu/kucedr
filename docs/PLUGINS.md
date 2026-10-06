# Kucedr plugins

The Kucedr CLI installs user plugins to:

```text
<CLI data directory>/plugins/<plugin-id>/manifest.json
```

By default, the CLI data directory is `~/Library/Application Support/Kucedr` on macOS,
`%APPDATA%/Kucedr` on Windows, and `${XDG_CONFIG_HOME:-~/.config}/Kucedr` on Linux.
`kucedr install --data-dir <path>` overrides it. The desktop profile used for providers and apps
normally lives at `~/.kucedr`, so the CLI plugin directory is separate from those runtime catalogs.

Install a published or local plugin with the Kucedr CLI:

```sh
kucedr install package-one
kucedr install ./path/to/plugin
```

Use `kucedr tui` for the interactive terminal interface, then enter `/install package-one`.
The CLI fetches npm packages without running lifecycle scripts, validates their manifest and
contributed files, and installs them atomically. Installation stores the files for future runtime
integration; the current Electron main process does not scan this plugin directory or activate its
contributions.

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

## Manifest version 4

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

The following is the content of `providers/acme/manifest.json`:

```json
{
	"providerId": "acme",
	"providerName": "Acme AI",
	"authentication": "api-key",
	"apiKeyUrl": "https://acme.test/keys",
	"models": [
		{
			"id": "acme-chat",
			"name": "Acme Chat",
			"type": "large-language-model",
			"authentication": "api-key",
			"url": "https://api.acme.test/v1",
			"location": "remote",
			"metadata": { "promptAttachments": [] }
		}
	]
}
```

Provider credentials do not belong in the manifest. They remain in Kucedr's provider settings store.
The desktop catalog currently reads bundled manifests and standalone folders under
`~/.kucedr/providers/<provider-id>/`, not provider files inside installed plugins. To use this
declarative OpenAI-compatible chat provider today, place its provider folder directly in that
directory. Custom executable provider adapters are not loaded into the Electron main process.

App entries must be relative HTML paths inside the plugin folder. The CLI verifies that each entry
is a regular file and remains inside its plugin. The desktop app registry currently reads
`~/.kucedr/apps/`, not plugin app entries.

Skills must contain `SKILL.md`. Language and theme contributions are JSON assets. MCP server
contributions contain connection metadata but no credentials. Channel entries are contained
JavaScript modules. The CLI validates these files, but none of these plugin contributions is
currently registered with the desktop runtime. The **Settings → Plugins** page instead manages
built-in MCP, database, and storage integrations from provider manifests.
