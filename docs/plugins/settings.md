# Plugin settings and secrets

A plugin declares its settings in `manifest.settings.inputSchema`, a small JSON Schema subset:

```json
"settings": {
	"inputSchema": {
		"type": "object",
		"properties": {
			"apiKey": { "type": "string", "title": "API key", "format": "password" },
			"tenant_id": { "type": "string", "title": "Tenant", "description": "…" }
		},
		"required": ["apiKey"]
	}
}
```

Each property needs `type`. `title`, `description`, and `format` are optional, and extra keys are allowed. Settings → Plugins → *plugin* builds the form from this schema (`src/renderer/src/pages/settings/pages/plugins/Plugin.tsx`).

## Storage

Values live in `~/.kucedr/plugins/settings.json` (`pluginsStore`):

- `settings[<id>]` — plain values
- `secrets[<id>]` — values whose property has `format: "password"`, encrypted with Electron `safeStorage` and stored as base64

`savePluginSettings(id, values)` (`plugins_save_settings.ts`):

- rejects unknown plugin ids and unknown keys
- trims values and **drops empty ones**
- encrypts `password` fields, and fails if secure storage is unavailable
- **replaces** the plugin's whole `settings` and `secrets` entries, so callers must send every value they want to keep

`pluginSettings(id)` (`plugins_settings.ts`) returns plain values merged with decrypted secrets. It throws if secrets exist and secure storage is unavailable.

IPC: `plugins.getSettings(id)` / `plugins.saveSettings(id, values)` (see [ipc.md](ipc.md)). Values must be a map of strings.

## Who reads plugin settings

Consumers read by plugin id, so a key only works if the consumer looks for it:

| Consumer | Reads |
|---|---|
| Provider models (`src/main/settings_store.ts`) | `apiKey` of the model's plugin |
| Web search (`src/main/search/*`) | `apiKey` of the search service's plugin; saving a search key writes it back through `savePluginSettings` |
| MCP OAuth (`src/main/mcp/oauth_options.ts`) | the settings named by the server's `oauth.client_id_setting` / `client_secret_setting` |
| Microsoft MCP endpoint (`src/main/mcp/endpoint.ts`) | `microsoft` → `tenant_id` |
| Google Drive (`src/main/drive/client.ts`, `src/main/ipc/drive.ts`) | `google` → `client_id`, `client_secret` |

Service manifests (`services/<id>/manifest.json`) also carry a `settings` array (`key`, `label`, `type`, `required`). The provider catalog uses it to describe the service, but the values are still stored in the plugin's settings above.
