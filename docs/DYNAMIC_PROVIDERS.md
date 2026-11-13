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

## Protocol ids (as implemented)

`metadata.protocol` is required on every model and picks the adapter from the registry for its capability. Each protocol names a wire shape, never a vendor.

| Capability | Registry | Ids |
|---|---|---|
| LLM | `adapters/llm/llm_model.ts` | `messages`, `responses`, `chat-completions` (the manifest-less custom endpoint defaults to `chat-completions`) |
| Speech-to-text | `stt/stt_factory.ts` | `transcriptions`, `transcriptions-intent`, `transcriptions-form`, `transcription-stream`, `transcription-session`, `listen`, `listen-v2`, `speech-to-text`, `speech-to-text-header`, `stt`, `stt-websocket`, `interactions`, `paas-transcriptions`, `multimodal-generation`, `duplex-asr` |
| Text-to-speech | `tts/tts_factory.ts` | `audio-speech`, `text-to-speech`, `text-to-dialogue`, `text-to-dialogue-stream`, `tts`, `tts-bytes`, `tts-bytes-2026-08-14`, `speak`, `generate-content`, `generate-content-voice`, `t2a`, `jobs`, `speech-complete`, `speech-synthesizer` |
| Text-to-audio | `tta/tta_factory.ts` | `music`, `sound-generation`, `interactions`, `task`, `jobs`, `music-generation`, `text-to-audio-form` |
| Text-to-video | `ttv/ttv_protocols.ts` | `videos`, `videos-async`, `polling-url`, `long-running`, `interactions`, `task`, `jwt-task`, `generations`, `video-generation`, `video-generation-content`, `jobs`, `sync`, `video-synthesis`, `versioned-tasks` |
| Text-to-image | `tti/tti_protocols.ts` | `images`, `images-sdk`, `images-url`, `generate-content`, `polling-url`, `polling-url-references`, `api-key`, `image-request`, `jwt-task`, `jwt-task-image-list`, `image-generation`, `generations`, `multimodal-generation`, `form-image` |
| Embedding | `embedding/embedding_factory.ts` | `embeddings`, `embeddings-task`, `embeddings-input-type`, `embed-types`, `embed-text`, `batch-embed-contents` |
| Realtime voice | `realtime_voice/realtime_voice_factory.ts` | see `PROTOCOLS` in the factory (`realtime`, `realtime-flat`, `realtime-beta`, and the socket protocols) |
| Coding agent | `src/main/coding/harness/protocols.ts` | `app-server` |

Related per-model fields used by these protocols: `metadata.endpoint`, `metadata.apiModelId`, `metadata.requestDefaults`, `metadata.baseUrlRule`, `metadata.inputTemplates`, `metadata.inputs.<key>.role`, `.hidden`, `.maxItems`, `.default`; and `default: true` on one model per capability to mark its provider as the default.

## What external plugins must add

Providers shipped from `kucedr-plugins` (google, qwen, zai, mistral, cohere, reka, kimi, minimax, jina, deepgram, cartesia, kling, pika, black-forest-labs, ideogram, and the bundled-repo copies of openai, anthropic, xai, deepseek, openrouter, ollama, iteracompute, elevenlabs) must add `metadata.protocol` to each model, using the table above. Until they do, using one of their models fails with "`<model>` (`<provider>`) declares no supported protocol." Specific needs:

- **LLM:** Mistral models also need `contentChunks: "roundtrip"` and `mergeUserAfterTool: true`; Reka needs `documentPart: "pdf_url"`; Cohere's reasoning model and the Z.ai GLM-5.3 models need a `metadata.effort` block (path `reasoning_effort` plus map and, for Z.ai, `set: { thinking: { type: "enabled" } }`).
- **Embedding:** Qwen models need `metadata.baseUrlRule` and the workspace pattern; Google's second model needs `metadata.inputTemplates`.
- **Media and speech:** `default: true` on one image model of the provider that should be the default (the old fixed default was Google), `role: "voice"` on TTS voice inputs, `role: "aspect-ratio"` where the editor ratio picker applies, and `hidden: ["settings"]` on prompt inputs of transcription models.
- **Provider manifest:** Reka needs `iconFullBleed: true`. Brave and Tavily already have it. Optional `order`, `website` and `settings.inputSchema.properties.baseUrl` (Qwen needs the base-URL field for its workspace URL).
- **kucedr-plugins validator:** require `metadata.protocol` on model manifests and allow the optional fields above.

Not done in this migration: the `kucedr-plugins` repository itself (it holds your uncommitted work), and the unit tests that encode the old behaviour (provider avatar, providers settings, realtime voice, LLM contracts, search key tests).
