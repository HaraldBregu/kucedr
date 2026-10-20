# Creating a provider

A provider adds models and services that Kucedr can call: chat and media models, vector databases,
web search, file storage, remote MCP services, and chat bots. It is plain JSON in the plugin's
`manifest.json`; no code runs.

## Steps

1. **Collect the facts from the provider's own documentation:** the API base URL, how keys are
   created, model ids, context limits, and the request parameters each model accepts. Don't
   guess; leave out anything the docs don't confirm.
2. **Pick the plugin id.** It is also the provider id, so use the provider's usual name in
   lowercase kebab-case (`acme`, `acme-ai`).
3. **Add the icons** to `assets/`: a dark-coloured logo for light mode and a light-coloured one for
   dark mode. Use the same file for both if the logo works on any background.
4. **Write the plugin fields** (`schemaVersion`, `id`, `title`, `version`, `description`, `icon`,
   `iconDark`), then the provider fields below.
5. **Add one entry per service** in the matching list.
6. **Validate** with the checklist at the end of this file.

## Provider fields

| Field | Value |
| --- | --- |
| `authentication` | `api-key`, `oauth2`, or `none` (local or open services) |
| `apiKeyUrl` | the page where users create a key (api-key providers) |
| `instructions` | short steps for getting credentials, when they need explaining |
| `icon_light_url`, `icon_dark_url` | `/assets/<file>` paths, shown next to the provider's services |
| `models` | list of models |
| `vector_databases` | list of vector databases |
| `web_search` | list of web search services |
| `mcp_servers` | list of remote MCP services the user can add |
| `bots` | list of chat bot channels |
| `storage` | one storage service (an object, not a list) |

Leave out every field and list the provider doesn't use. Don't add `providerId`,
`providerName`, or `images_url`: Kucedr takes them from the plugin.

## Models

```json
{
	"id": "acme-chat-1",
	"name": "Acme Chat 1",
	"type": "large-language-model",
	"authentication": "api-key",
	"url": "https://api.acme.test/v1",
	"location": "remote",
	"metadata": {
		"promptAttachments": [
			{ "kind": "image", "mimeTypes": ["image/png", "image/jpeg"], "extensions": [".png", ".jpg", ".jpeg"] }
		],
		"documentationUrl": "https://docs.acme.test/models/acme-chat-1",
		"documentationStatus": "verified",
		"contextWindow": 128000,
		"defaultOutputTokens": 8192,
		"inputs": {
			"temperature": { "type": "number" },
			"max_tokens": { "type": "integer", "maximum": 8192 },
			"tools": { "type": "array" },
			"stream": { "type": "boolean" }
		}
	}
}
```

- `type`:

  | Type | Use |
  | --- | --- |
  | `large-language-model` | chat |
  | `research-chat-model` | deep research chat |
  | `speech-to-text-model` | transcription |
  | `text-to-speech-model` | voices |
  | `realtime-voice-model` | live voice conversations |
  | `text-to-image-model` | images |
  | `text-to-video-model` | video |
  | `text-to-audio-model` | music and sound effects |
  | `embedding-model` | embeddings for knowledge search |

- `location` is `remote` for hosted APIs and `local` for models that run on the user's machine.
- Chat and research models need `metadata` with `promptAttachments`. Use `[]` when the model takes
  text only. Otherwise add one rule per accepted kind: `image`, `document`, `audio`, or `video`.
  Each rule needs `mimeTypes` and lowercase dot-prefixed `extensions`.
- `metadata.inputs` lists the request parameters the model accepts, as JSON-schema-like
  descriptions. Kucedr builds its model settings from them.
- `contextWindow` is in tokens. Add `contextWindowDocumentationUrl` when the limit is documented
  on a different page.
- Mark one model per capability with `"default": true` only if it should be preselected.
- An unknown provider id is called as an OpenAI-compatible chat API, so the `url` must serve
  `/chat/completions` in that format. Providers with other APIs need adapter code in Kucedr itself.

## Vector databases

```json
{
	"id": "acme-vectors",
	"name": "Acme Vectors",
	"description": "Store and search embeddings in Acme.",
	"url": "https://api.acme.test",
	"authentication": "api-key"
}
```

The user turns it on in Settings → Knowledge. Kucedr uses vector databases only for knowledge
search.

## Web search

```json
{
	"id": "acme-search",
	"name": "Acme Web Search",
	"url": "https://api.acme.test/search",
	"authentication": "api-key",
	"metadata": {
		"documentationUrl": "https://docs.acme.test/search",
		"inputs": { "q": { "type": "string", "required": true }, "count": { "type": "integer" } }
	}
}
```

## Remote MCP services

```json
{
	"id": "acme-crm",
	"name": "Acme CRM",
	"description": "Search accounts and update deals.",
	"url": "https://mcp.acme.test/mcp",
	"authentication": "oauth2",
	"scopes": ["crm.read", "crm.write"],
	"icon_light_url": "/assets/acme-crm.svg",
	"icon_dark_url": "/assets/acme-crm.svg"
}
```

- These appear in Settings → MCP servers, switched off, until the user turns them on.
- Put `{tenantId}` in the `url` when each organization has its own endpoint. Kucedr then asks
  for the tenant before adding the service.
- `oauth` holds provider-specific sign-in settings (`client_id_env`, `client_secret_env`,
  `authorization_params`). Copy them from a built-in provider that signs in the same way.

## Storage

```json
{
	"id": "acme-storage",
	"name": "Acme Storage",
	"description": "Store files in an Acme bucket through its S3 endpoint.",
	"authentication": "s3-access-key",
	"metadata": {
		"protocol": "s3",
		"endpointTemplate": "https://{account}.storage.acme.test",
		"region": "auto",
		"forcePathStyle": true
	}
}
```

Storage is S3-compatible only: `authentication` must be `s3-access-key` and `metadata.protocol`
must be `s3`.

## Bots

```json
{
	"id": "acme-bot",
	"name": "Acme Bot API",
	"url": "https://api.acme.test",
	"instructions": "Create a bot in Acme, then paste its token here.",
	"credentials": [{ "key": "apiKey", "label": "Bot token", "type": "password", "required": true }]
}
```

Kucedr loads bots only for chat channels it already supports (Telegram today). A bot for any
other service needs channel code in Kucedr itself.

## Checklist

- Every service has `id` and `name`, and models and web search also have `url`.
- Chat and research models have `metadata.promptAttachments`.
- Icon paths start with `/assets/` and the files exist.
- Every documented value comes from the provider's documentation.
- Empty lists are left out.
