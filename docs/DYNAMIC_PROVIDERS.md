# Dynamic Providers — Manifest Contract

> **Status:** contract for the 2026-11-12 migration that removes every hardcoded provider and model name from `src`. The scope covers model providers (all modalities), web search and the coding harness. Google Drive, Calendar and Contacts clients, Google sign-in, skills source formats and persisted data tags are out of scope.

## Rule

`src` contains no provider names, provider ids, model names or model ids. That includes literals, lists, defaults, branches (`provider.id === 'x'`, `modelId === 'y'`, `startsWith('gemini-')`, `/deepseek/i`), record keys, file names and error strings. Everything provider- or model-specific comes from plugin manifests:

- `resources/plugins/<provider>/manifest.json`: the provider level, with title, website, icon, `order`, `iconFullBleed`, `apiKeyUrl` and `settings.inputSchema`.
- `resources/plugins/<provider>/models/<model>/manifest.json`: the model level, with `type`, `url`, `default`, `location`, `authentication`, `sampleRate` and `metadata`.

Code that implements a wire protocol stays in code. It is **selected** by `metadata.protocol` from a registry keyed by protocol id. Protocol ids, file names and identifiers name the wire shape (`chat-completions`, `messages`, `responses`, `live`, `bidi`, …), never a vendor. Adapters never branch on provider or model ids and never embed model lists. A behaviour that differs per model is a manifest field. Error messages use the provider `title` (as `ResolvedProvider.name`, `PublicProvider.name`) and the model `name`.

A model whose `protocol` is missing or unknown is not dropped at load. Using it fails with "`<model name>` (`<provider name>`) declares no supported protocol." The only code default is `chat-completions` for the manifest-less custom OpenAI-compatible endpoint, which is an app concept and not a vendor.

Exceptions that stay as literals:
- SDK package names in imports (`openai`, `@anthropic-ai/sdk`).
- Wire field names a protocol defines (`prompt_tokens_details`, `OpenAI-Beta` when it is part of the protocol).
- The persisted format tags on `provider_item` and `reasoning_item` (`'openai' | 'anthropic' | 'deepseek' | 'mistral'`), which are stored in users' session files. Renaming them needs a data migration that was not requested. Code may emit and read them as format tags but must choose which one by protocol or flag, never by provider id.

## Fields

Every field is optional unless stated, and all live in `src/shared/model_types.ts` or `src/shared/provider_types.ts`.

### Provider manifest (`manifest.json`)
| Field | Meaning |
|---|---|
| `title` | Display name; used in all error strings. |
| `website` | Plugin website; the only source (no code fallback table). |
| `order` | Display rank in provider lists; lower first, providers without it follow by name. Replaces featured-provider lists. |
| `iconFullBleed` | Icon artwork fills the avatar without inner padding. |
| `settings.inputSchema.properties.baseUrl` | A user-editable API base URL (`title`, `description`, `format: "uri"`, `pattern`, `examples`, `errorMessage`). Replaces per-provider URL fields in settings. |

### Model manifest (`models/<model>/manifest.json`)
| Field | Meaning |
|---|---|
| `type` | Capability, including the new `coding-agent-model`. |
| `url` | Authoritative API base for the model when the user has not customised the provider base URL. |
| `default` | This model's provider is the default for its capability when nothing is configured; at most one per capability. |
| `metadata.protocol` | Wire protocol id; selects the adapter. Discovery-only manifests carry it for live-listed models. |
| `metadata.socketUrl` | WebSocket endpoint for socket protocols; `{key}` is filled from request options, then input defaults. |
| `metadata.requestDefaults` | Request values merged under the user's options; any modality. |
| `metadata.baseUrlRule` | `{ pattern, example? }`: the stored provider base URL this model accepts (regex source, case-insensitive). |
| `metadata.effort` | `{ path, map?, set?, setWhenPresent?, unset?, strict? }`: where and how a reasoning effort is written into the request. With no block, no effort is sent. `strict` means the renderer sends only efforts the model declares and never one derived from the prompt. |
| `metadata.clampEffort` | Clamp the effort to the model's declared levels. |
| `metadata.cache` | `{ readTokens?, writeTokens?, sessionKey?, breakpoints? }` (see `PROMPT_CACHE.md`). |
| `metadata.dsml`, `metadata.reasoningContent` | Chat: DSML tool parsing; `reasoning_content` round-trip. |
| `metadata.documentPart` | Chat: content-part type for PDF attachments (e.g. `pdf_url`); enables documents. |
| `metadata.contentChunks: "roundtrip"` | Chat: assistant content chunks stored and replayed verbatim. |
| `metadata.mergeUserAfterTool` | Chat: a text-only user message after a tool message is folded into it. |
| `metadata.endpoint`, `metadata.apiModelId`, `metadata.promptField` | Media: submit path, wire model id and prompt field name when they differ from the protocol default. |
| `metadata.inputTemplates` | Embedding: `{ query?, document? }` prefixes with `{text}`. |
| `metadata.harness` | Coding agent: `{ package, binary, homeEnv?, clearEnv?, instructionFiles }`. |
| `metadata.families` | Discovery-only manifests: `[{ match, metadata }]`, metadata merged for live model ids containing `match`. |
| `metadata.inputs.<key>` | Existing input schema, plus `exclusive` (setting one property clears its siblings), `hidden: ['settings' \| 'tool']`, `role: 'aspect-ratio' \| 'voice'`, `maxItems`. Defaults (`default`, first `enum`) are the only source of default voices, languages and formats. |

## External plugins

Providers that ship from `kucedr-plugins` must add these fields. Until they do, their models raise the "no supported protocol" error. The per-plugin list is at the end of this file, filled in from the implementation results.
