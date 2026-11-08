# Provider contributions

A plugin becomes a **provider** when it defines provider fields. The provider is not a folder of its own. `pluginProvider()` (`src/main/plugins/plugins_provider.ts`) assembles it from:

- provider fields in `manifest.json` (`authentication`, `apiKeyUrl`, `baseUrl`, …)
- `models/<id>/manifest.json` → `models[]`
- `services/<id>/manifest.json` → `web_search[]`
- `mcp/<id>/manifest.json` (remote servers) → `mcp_servers[]`

If none of these exist, the plugin has no provider and `contributes.providers` is empty.

## Building the provider manifest

```ts
{
	providerId: manifest.id,
	providerName: manifest.title,
	icon_light_url: `/assets/${icon}`,              // if icon is set
	icon_dark_url: `/assets/${iconDark ?? icon}`,
	apiKeyUrl, baseUrl, modelsUrl, modelUrl,         // copied from the first model that has modelsUrl, else the first model
	...every remaining provider field from the manifest
}
```

Manifest fields override values copied from the model. The result goes through `validateProviderManifest()` (`src/shared/providers/validation.ts`). Any error fails the whole plugin.

`/assets/...` icon paths resolve against the plugin folder (`PluginProvider.directory`).

## `models/`

`readPluginModels()` (`plugins_models_read.ts`):

- each entry must be a folder with a `manifest.json` containing valid JSON
- the model `id` must be the folder name, or `<vendor>/<folder>` (for routers like OpenRouter)
- if `models/` exists, it must contain at least one model

Model manifests are provider-catalog entries:

```json
{
	"id": "claude-opus-5-5",
	"name": "Claude Opus 5.5",
	"type": "large-language-model",
	"authentication": "api-key",
	"url": "https://api.anthropic.com",
	"location": "remote",
	"metadata": {
		"promptAttachments": [ { "kind": "image", "mimeTypes": ["image/png"], "maxBytes": 7864320 } ],
		"inputs": { "max_tokens": { "type": "integer", "required": true, "maximum": 128000 } },
		"contextWindow": 1000000,
		"documentationUrl": "https://…"
	}
}
```

### Discovery models

A model with `"discoveryOnly": true` plus `modelsUrl` / `modelUrl` stands for a list fetched at runtime instead of a fixed model. Bundled examples: `ollama/models/auto` (local `http://localhost:11434/v1`), `openrouter/models/remote`, `iteracompute/models/remote`. `metadata.discoveryInputs` describes options that apply to discovered models.

## `services/`

`readPluginServices()` (`plugins_services_read.ts`):

- each entry must be a folder with `manifest.json`; a top-level `README.md` is skipped
- `id` must equal the folder name
- `type` must be in `PLUGIN_SERVICE_TYPES`, currently only `SEARCH_ENGINE`
- every service goes into the provider's `web_search`

Example (`brave/services/web-search/manifest.json`):

```json
{
	"id": "web-search",
	"name": "Web Search",
	"type": "SEARCH_ENGINE",
	"url": "https://api.search.brave.com/res/v1/web/search",
	"authentication": "api-key",
	"settings": [{ "key": "apiKey", "label": "API key", "type": "password", "required": true }],
	"metadata": {
		"search": {
			"method": "GET",
			"query": "q",
			"count": "count",
			"apiKeyHeader": "X-Subscription-Token",
			"resultsPath": ["web", "results"],
			"descriptionField": "description"
		}
	}
}
```

`metadata.search` tells `src/main/search/search_web.ts` how to call the API and read results. The API key comes from the plugin's `apiKey` setting.

## Remote MCP servers (`mcp/<id>/manifest.json`)

`readPluginMcpServers()` (`plugins_mcp_read.ts`) reads every `mcp/<id>/manifest.json` (folders without one are skipped) into `mcp_servers`. `id` must equal the folder name.

```json
{
	"id": "web-search",
	"name": "Web Search",
	"description": "Search, extract, crawl, and map the web with Tavily.",
	"authentication": "oauth2",
	"url": "https://mcp.tavily.com/mcp/",
	"scopes": []
}
```

Fields: `id`, `name`, `description?`, `url`, `authentication` (`oauth2` | `api-key` | `none`), `scopes`, optional `oauth` (`client_id_setting`, `client_secret_setting`, `authorization_params`, `credentials_required`), and optional `icon_dark_url` / `icon_light_url`. Without `oauth`, the app registers itself with the server dynamically.

A folder with `manifest.json` and **no** `mcp.json` is a remote server, and the local MCP loader skips it. A folder with `mcp.json` is a local server (see [mcp.md](mcp.md)).

## Provider catalog

`readCatalog()` in `src/main/models.ts` builds the provider catalog from:

1. `pluginProviders()` — enabled plugins with a provider, tagged with their `PluginSource`
2. `~/.kucedr/providers/<dir>/manifest.json` — user providers, loaded last so they override

`refreshProviderCatalog()` runs after every plugin change (see [loading.md](loading.md)), and `modelsChanged` tells the renderer to reload model, provider, search, and MCP lists.
