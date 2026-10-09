# Provider Reference

Kucedr ships 31 provider manifests under `resources/providers`. This page inventories the 23
model, search, and database providers, their cataloged services, and whether the current runtime
can execute each service.

The inventory covers model, search, and database providers. Telegram is a
messaging channel and is documented in [Kucedr Feature Reference](FEATURES.md#5-messaging-channels).
The other manifests describe MCP, storage, messaging, and local-model integrations: Cloudflare,
GitHub, GitLab, Microsoft, Notion, Ollama, Supabase, and Telegram. See
[Kucedr Feature Reference](FEATURES.md) and [Account and Cloud Architecture](CLOUD.md) for their
respective runtime paths.

For Microsoft MCP app registration, permissions, and environment configuration, see
[Microsoft MCP setup](MICROSOFT.md).

## Support status

| Status       | Meaning                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------- |
| Available    | The service has both a catalog entry and an execution path in Kucedr.                          |
| Partial      | Execution code exists, but a normal configuration or selection path is incomplete.             |
| Mixed        | At least one cataloged capability works, while another capability is catalog only.             |
| Catalog only | Kucedr can display or select the service, but the runtime has no execution adapter for it.     |
| Code only    | Adapter support exists, but Kucedr does not ship a provider manifest that makes it selectable. |

A manifest is not proof that a service is executable. The provider-specific factories under
`src/main/models/adapters` determine runtime support.

## Configure a provider

See [Settings UI](ui/SETTINGS.md) for the complete Settings navigation and persistence behavior.

1. Open **Settings → Providers → Models** and connect each model provider you plan to use. The
   searchable **API Keys** deep page can edit the same model-provider credentials.
2. Choose assistant, speech, and media models in **Settings → Agent**; realtime voice in
   **Settings → Voice**; and the embedding model in **Settings → Knowledge**.
3. Configure Brave or Tavily under **Settings → Providers → Search**.
4. Save vector database API keys under **Settings → Providers → Database**
   (`/settings/providers/database`), then explicitly select the database in **Settings → Knowledge**.
   Pinecone is the currently supported vector database provider.
5. Run the test offered by the settings page, when present, before relying on the provider in an
   agent run.

Provider credentials and selections are stored in Kucedr's local application-data directory.
Requests, attachments, and credentials are sent to the selected provider when Kucedr invokes its
API. Provider billing, quotas, regional availability, safety rules, and data-retention policies
still apply.

Most integrations use one API key. The exceptions are:

- **Kling** expects the value saved in the API-key field to use `accessKey:secretKey` format.
- **Brave** and **Tavily** can use `BRAVE_API_KEY` and `TAVILY_API_KEY` respectively when no key is
  stored in Settings.
- **Pika** 2.5 and audio require a Pika developer API key. Existing Pika 2.2 requires fal.run credentials.
- **Qwen embeddings** require a workspace endpoint, saved as Qwen's base URL in Connections:
  `https://{workspace}.{region}.maas.aliyuncs.com/compatible-mode/v1`, with region
  `ap-southeast-1`, `cn-beijing`, or `cn-hongkong`. The legacy DashScope default cannot execute these models.
- **Qwen HTTP TTS** requires a Beijing API key; its requests use the documented Beijing endpoint.
  Qwen realtime voice also exposes its workspace and regional options in model settings.
- **Z.ai GLM 5.3 FlashX** uses the normal API and is unavailable with Coding Plan credentials.

## Built-in provider inventory

Provider links below point to the credential or account page declared by the corresponding
manifest.

| Provider                                                                           | ID                  | Cataloged capabilities                                           | Runtime coverage                                                         |
| ---------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [Anthropic](https://console.anthropic.com/settings/keys) | `anthropic` | Chat | Available |
| [Black Forest Labs](https://dashboard.bfl.ai) | `black-forest-labs` | Image, Video | Available |
| [Brave](https://api-dashboard.search.brave.com/app/keys)                           | `brave`             | Web search                                                       | Available                                                                |
| [Cartesia](https://play.cartesia.ai/keys) | `cartesia` | Speech to text, Text to speech | Available |
| [Cohere](https://dashboard.cohere.com/api-keys) | `cohere` | Chat, Speech to text, Embeddings | Available |
| [Deepgram](https://console.deepgram.com) | `deepgram` | Speech to text, Text to speech | Available |
| [DeepSeek](https://platform.deepseek.com/api_keys) | `deepseek` | Chat | Available |
| [ElevenLabs](https://elevenlabs.io/app/settings/api-keys) | `elevenlabs` | Speech to text, Text to speech, Audio | Available |
| [Google](https://aistudio.google.com/apikey) | `google` | Chat, Speech to text, Text to speech, Realtime voice, Image, Video, Audio, Embeddings | Mixed: existing Lyria Realtime is catalog only |
| [Ideogram](https://ideogram.ai/manage-api) | `ideogram` | Image | Available |
| [Jina AI](https://jina.ai/api-dashboard) | `jina` | Embeddings | Available |
| [Kimi](https://platform.moonshot.ai/console/api-keys) | `kimi` | Chat | Available |
| [Kling AI](https://app.klingai.com/global/dev) | `kling` | Image, Video, Audio | Available |
| [MiniMax](https://platform.minimax.io/user-center/basic-information/interface-key) | `minimax` | Chat, Speech to text, Text to speech, Image, Video, Audio | Available |
| [Mistral AI](https://console.mistral.ai/api-keys) | `mistral` | Chat, Speech to text, Text to speech, Embeddings | Available |
| [OpenAI](https://platform.openai.com/api-keys) | `openai` | Chat, Speech to text, Text to speech, Realtime voice, Image, Embeddings | Available |
| [Pika](https://pika.art) | `pika` | Text to speech, Video, Audio | Partial: existing Pika 2.2 requires fal.run |
| [Pinecone](https://app.pinecone.io)                                                | `pinecone`          | Vector database                                                  | RAG mirroring with the user's selected database and saved credentials    |
| [Qwen and Wan](https://modelstudio.console.alibabacloud.com) | `qwen` | Chat, Speech to text, Text to speech, Realtime voice, Image, Video, Embeddings | Available |
| [Reka AI](https://platform.reka.ai/apikeys) | `reka` | Chat | Available |
| [Tavily](https://app.tavily.com/home)                                              | `tavily`            | Web search                                                       | Available                                                                |
| [xAI](https://console.x.ai) | `xai` | Chat, Speech to text, Text to speech, Realtime voice, Image, Video | Available |
| [Z.ai](https://z.ai/manage-apikey/apikey-list) | `zai` | Chat, Speech to text, Image, Video | Available |

## Model and service catalog

Names and IDs match the bundled manifests. Model metadata links to the official API documentation and declares supported request options. Existing entries are preserved; provider deprecations and account restrictions still apply.

### Chat and research

| Provider | Cataloged models |
| --- | --- |
| Anthropic | Claude Fable 5.1 (`claude-fable-5-1`); Claude Opus 5.5 (`claude-opus-5-5`); Claude Sonnet 5.5 (`claude-sonnet-5-5`); Claude Haiku 5.5 (`claude-haiku-5-5`); Claude Opus 4.8 (`claude-opus-4-8`); Claude Fable 5 (`claude-fable-5`); Claude Opus 5 (`claude-opus-5`); Claude Sonnet 5 (`claude-sonnet-5`); Claude Opus 4.7 (`claude-opus-4-7`); Claude Sonnet 4.6 (`claude-sonnet-4-6`); Claude Haiku 4.5 20251001 (`claude-haiku-4-5-20251001`) |
| Cohere | Command A+ (`command-a-plus-05-2026`); Command A (`command-a-03-2025`); Command R7B (`command-r7b-12-2024`); Command A Translate (`command-a-translate-08-2025`); Command A Reasoning (`command-a-reasoning-08-2025`); Command A Vision (`command-a-vision-07-2025`); Command R (`command-r-08-2024`); Command R+ (`command-r-plus-08-2024`); North Small Translate (`north-small-translate-1-0`); North Mini Code (`north-mini-code-1-0`); Tiny Aya Global (`tiny-aya-global`); Tiny Aya Earth (`tiny-aya-earth`); Tiny Aya Fire (`tiny-aya-fire`); Tiny Aya Water (`tiny-aya-water`); Aya Expanse 32B (`c4ai-aya-expanse-32b`); Aya Vision 32B (`c4ai-aya-vision-32b`) |
| DeepSeek | DeepSeek V4 Pro (`deepseek-v4-pro`); DeepSeek V4.1 Flash (`deepseek-flash`) |
| Google DeepMind / Google | Gemini 3.8 Flash (`gemini-3.8-flash`); Gemini 3.7 Flash (`gemini-3.7-flash`); Gemini 3.6 Flash (`gemini-3.6-flash`); Gemini 3.5 Flash (`gemini-3.5-flash`); Gemini 3.5 Flash Lite (`gemini-3.5-flash-lite`); Gemini 3 Flash Preview (`gemini-3-flash-preview`); Gemini 3.1 Pro Preview (`gemini-3.1-pro-preview`); Gemini 3.1 Flash Lite (`gemini-3.1-flash-lite`) |
| Moonshot AI / Kimi | Kimi K3 (`kimi-k3`); Kimi K2.7 Code (`kimi-k2.7-code`); Kimi K2.7 Code Highspeed (`kimi-k2.7-code-highspeed`); Kimi K2.6 (`kimi-k2.6`); Kimi K2.5 (`kimi-k2.5`) |
| MiniMax | MiniMax M3 (`MiniMax-M3`); MiniMax M2.7 Highspeed (`MiniMax-M2.7-highspeed`); MiniMax M2.7 (`MiniMax-M2.7`); MiniMax M2.5 (`MiniMax-M2.5`) |
| Mistral AI | Z.ai GLM 5.3 (`zai-glm-5-3`); Mistral Large 4 (`mistral-large-4`); Mistral Small 4 (`mistral-small-2603`); Ministral 3 14B (`ministral-14b-2512`); Ministral 3 8B (`ministral-8b-2512`); Ministral 3 3B (`ministral-3b-2512`); Mistral Large 2512 (`mistral-large-2512`); Mistral Medium 3.5 (`mistral-medium-3-5`); Devstral 2512 (`devstral-2512`) |
| OpenAI | GPT-6 Astra (`gpt-6-astra`); GPT-6.1 Sol (`gpt-6.1-sol`); GPT-6 Sol (`gpt-6-sol`); GPT-6 Luna (`gpt-6-luna`); GPT-5.6 Sol (`gpt-5.6-sol`); GPT-5.6 Terra (`gpt-5.6-terra`); GPT-5.6 Luna (`gpt-5.6-luna`); GPT-5.5 (`gpt-5.5`); GPT-5.5 Pro (`gpt-5.5-pro`); GPT-5.4 (`gpt-5.4`); GPT-5.4 Pro (`gpt-5.4-pro`); GPT-5.4 Mini (`gpt-5.4-mini`); GPT-5.4 Nano (`gpt-5.4-nano`) |
| Alibaba / Qwen / Wan | Qwen 3.8 Max (`qwen3.8-max`); Qwen 3.8 Max 0902 (`qwen3.8-max-0902`); Qwen 3.8 Flash (`qwen3.8-flash`); Qwen 3.7 Plus (`qwen3.7-plus`); Qwen 3.7 Flash (`qwen3.7-flash`); Qwen3.7 Max (`qwen3.7-max`); Qwen3.6 Plus (`qwen3.6-plus`); Qwen3.6 Flash (`qwen3.6-flash`); Qwen 3.8 Omni Flash (`qwen3.8-omni-flash`) |
| Reka AI | Qwen 3.8 27B (`qwen3.8-27b`); GLM 5.3 Flash (`glm5.3-flash`); GLM 5.3 (`glm5.3`); Gemma 4 26B (`gemma4-26b`); DeepSeek 4 Flash (`deepseek4-flash`); Reka Flash 3 (`reka-flash-3`); Reka Flash (`reka-flash`); Reka Edge 2603 (`reka-edge-2603`) |
| xAI | Grok 4.7 (`grok-4.7`); Grok 4.3 (`grok-4.3`); Grok 4.6 (`grok-4.6`); Grok Build 0.1 (`grok-build-0.1`) |
| Z.ai / Zhipu AI | GLM-5.3 FlashX (`glm-5.3-flashx`); GLM-5.3 Flash (`glm-5.3-flash`); GLM-5.3 (`glm-5.3`); GLM-5.2 (`glm-5.2`); GLM-5.1 (`glm-5.1`); GLM-5 (`glm-5`); GLM-5 Turbo (`glm-5-turbo`) |

### Speech to text

| Provider | Cataloged models |
| --- | --- |
| Cartesia | Ink 2 (`ink-2`); Ink Whisper (`ink-whisper`) |
| Cohere | Cohere Transcribe (`cohere-transcribe-03-2026`); Cohere Transcribe Arabic (`cohere-transcribe-arabic-07-2026`) |
| Deepgram | Nova 3 (`nova-3`); Flux (`flux-general-en`); Flux Multilingual (`flux-general-multi`); Nova 3 Medical (`nova-3-medical`); Nova 3 Pharma (`nova-3-pharma`) |
| ElevenLabs | Scribe v2 (`scribe_v2`); Scribe v2 Medical (`scribe_v2_medical`); Scribe v2 Realtime (`scribe_v2_realtime`) |
| Google DeepMind / Google | Gemini 3.5 Transcribe (`gemini-3.5-transcribe`) |
| MiniMax | MiniMax ASR 1.0 (`asr-1.0`) |
| Mistral AI | Voxtral Mini 2602 (`voxtral-mini-latest`); Voxtral Mini Transcribe Realtime 2602 (`voxtral-mini-transcribe-realtime-2602`) |
| OpenAI | GPT Transcribe (`gpt-transcribe`); GPT Live Transcribe (`gpt-live-transcribe`); GPT-4o Transcribe (`gpt-4o-transcribe`); GPT-4o Mini Transcribe (`gpt-4o-mini-transcribe`); GPT Realtime Whisper (`gpt-realtime-whisper`) |
| Alibaba / Qwen / Wan | Qwen3 ASR Flash Realtime (`qwen3-asr-flash-realtime`); Qwen Audio 3.0 ASR Flash (`qwen-audio-3.0-asr-flash`); Qwen Audio 3.1 ASR Flash (`qwen-audio-3.1-asr-flash`); Qwen Audio 3.0 ASR Flash Streaming (`qwen-audio-3.0-asr-flash-streaming`); Qwen Audio 3.1 ASR Flash Streaming (`qwen-audio-3.1-asr-flash-streaming`) |
| xAI | xAI STT Batch (`xai-stt-batch`); xAI STT Streaming (`xai-stt-streaming`) |
| Z.ai / Zhipu AI | GLM ASR 2512 (`glm-asr-2512`, batch) |

### Text to speech

| Provider | Cataloged models |
| --- | --- |
| Cartesia | Sonic 3.6 (`sonic-3.6`); Sonic 3.5 (`sonic-3.5`); Sonic 3 (`sonic-3`) |
| Deepgram | Aura 2 (`aura-2`) |
| ElevenLabs | Eleven v3 (`eleven_v3`); Eleven Multilingual v2 (`eleven_multilingual_v2`); Eleven Flash v2.5 (`eleven_flash_v2_5`); Eleven Flash v2 (`eleven_flash_v2`); Eleven v4 (`eleven_v4`); Eleven v4 Turbo (`eleven_v4_turbo`); Eleven v3 Conversational (`eleven_v3_conversational`) |
| Google DeepMind / Google | Gemini 3.8 Flash TTS (`gemini-3.8-flash-tts`); Gemini 3.8 Flash Lite TTS (`gemini-3.8-flash-lite-tts`); Gemini 3.1 Flash TTS Preview (`gemini-3.1-flash-tts-preview`) |
| MiniMax | Speech 2.8 HD (`speech-2.8-hd`); Speech 2.8 Turbo (`speech-2.8-turbo`) |
| Mistral AI | Voxtral Mini TTS 2603 (`voxtral-mini-tts-2603`) |
| OpenAI | GPT-4o Mini TTS (`gpt-4o-mini-tts`); TTS-1 HD (`tts-1-hd`) |
| Pika | Pika Speech (`pika-speech`) |
| Alibaba / Qwen / Wan | Qwen Audio 3.0 TTS Plus (`qwen-audio-3.0-tts-plus`); Qwen Audio 3.0 TTS Flash (`qwen-audio-3.0-tts-flash`) |
| xAI | Grok Text to Speech (`xai-tts`) |

### Realtime voice

| Provider | Cataloged models |
| --- | --- |
| Google DeepMind / Google | Gemini 3.8 Live (`gemini-3.8-live`); Gemini 3.8 Live Extended Thinking (`gemini-3.8-live-extended-thinking`) |
| OpenAI | GPT Realtime 2.1 (`gpt-realtime-2.1`); GPT Realtime 2.1 Mini (`gpt-realtime-2.1-mini`); GPT Live 1 (`gpt-live-1`) |
| Alibaba / Qwen / Wan | Qwen 3.8 Omni Flash Realtime (`qwen3.8-omni-flash-realtime`) |
| xAI | Grok Voice Latest (`grok-voice-latest`) |

### Image

| Provider | Cataloged models |
| --- | --- |
| Black Forest Labs | FLUX 3 Image (`flux-3-image`); FLUX.2 [max] (`flux-2-max`); FLUX.2 [flex] (`flux-2-flex`); FLUX.2 [klein] 9B (`flux-2-klein-9b`); FLUX.2 [klein] 4B (`flux-2-klein-4b`); FLUX.2 [pro] Preview (`flux-2-pro-preview`); FLUX.2 [klein] 9B Preview (`flux-2-klein-9b-preview`); FLUX.2 (`FLUX.2`); FLUX.1 Kontext [pro] (`FLUX.1 Kontext [pro]`); FLUX1.1 [pro] Ultra (`FLUX1.1 [pro] Ultra`) |
| Google DeepMind / Google | Nano Banana 2.1 (`gemini-nano-banana-2.1`); Nano Banana 2 (`gemini-3.1-flash-image`); Nano Banana 2 Lite (`gemini-3.1-flash-lite-image`); Nano Banana Pro (`gemini-3-pro-image`); Gemini 3.1 Flash Image Preview (`gemini-3.1-flash-image-preview`); Gemini 3 Pro Image Preview (`gemini-3-pro-image-preview`) |
| Ideogram | Ideogram 4.5 (`ideogram-4.5`); Ideogram 4.0 (`ideogram-4.0`); P-Image Ideogram (`p-image-ideogram`); Ideogram 3.0 (`ideogram-3.0`); Ideogram 2a (`ideogram-2a`) |
| Kuaishou / Kling AI | Kling Image 3.0 (`kling-v3`); Kling Image 3.0 Omni (`kling-v3-omni`) |
| MiniMax | MiniMax Image 01 (`image-01`) |
| OpenAI | GPT Image 2.5 Sunburst (`gpt-image-2.5-sunburst`); GPT Image 2.5 Flare (`gpt-image-2.5-flare`) |
| Alibaba / Qwen / Wan | Qwen Image (`qwen-image`); Qwen Image Edit (`qwen-image-edit`); Qwen Image 3.0 Pro (`qwen-image-3.0-pro`); Qwen Image 3.0 (`qwen-image-3.0`); Qwen Image 2.1 Pro (`qwen-image-2.1-pro`); Qwen Image 2.0 Pro (`qwen-image-2.0-pro`); Qwen Image 2.0 (`qwen-image-2.0`); Qwen Image Max (`qwen-image-max`); Qwen Image Plus (`qwen-image-plus`); Qwen Image Edit Max (`qwen-image-edit-max`); Qwen Image Edit Plus (`qwen-image-edit-plus`); Wan2.7 Image Pro (`wan2.7-image-pro`); Wan2.7 Image (`wan2.7-image`) |
| xAI | Grok Imagine Image (`grok-imagine-image`); Grok Imagine Image Quality (`grok-imagine-image-quality`); Grok Imagine Image 2.0 (`grok-imagine-image-2.0`) |
| Z.ai / Zhipu AI | GLM Image (`glm-image`); CogView 4 (`cogview-4-250304`) |

### Video

| Provider | Cataloged models |
| --- | --- |
| Black Forest Labs | FLUX 3 Video (`flux-3-video`) |
| Google DeepMind / Google | Veo 3.1 Lite Preview (`veo-3.1-lite-generate-preview`); Gemini Omni Flash (`gemini-omni-1.1-flash`); Veo 3.1 (`veo-3.1`); Veo 3.1 Fast (`veo-3.1-fast`) |
| Kuaishou / Kling AI | Kling 3.0 (`kling-3.0`); Kling 3.0 Turbo (`kling-3.0-turbo`); Kling 2.6 (`kling-2.6`); Kling v2.5 Turbo (`kling-v2.5-turbo`); Kling v2.1 Master (`kling-v2.1-master`) |
| MiniMax | MiniMax H3 (`MiniMax-H3`); MiniMax H3 Max (`MiniMax-H3-Max`); Hailuo 2.3 (`MiniMax-Hailuo-2.3`); Hailuo 02 (`MiniMax-Hailuo-02`) |
| Pika | Pika 2.5 (`pika-2.5`); Pika 2.2 (`pika-2.2`) |
| Alibaba / Qwen / Wan | Wan 2.5 T2V (`wan2.5-t2v`); Wan 2.2 T2V Plus (`wan2.2-t2v-plus`); Wan 3.0 video (`wan3.0-video`); Wan 3.0 video prime (`wan3.0-video-prime`); HappyHorse  1.1 t2v (`happyhorse-1.1-t2v`); HappyHorse  1.1 i2v (`happyhorse-1.1-i2v`); HappyHorse  1.1 r2v (`happyhorse-1.1-r2v`) |
| xAI | Grok Imagine Video 1.5 (`grok-imagine-video-1.5`) |
| Z.ai / Zhipu AI | CogVideoX 3 (`cogvideox-3`) |

### Audio and sound effects

| Provider | Cataloged models |
| --- | --- |
| ElevenLabs | Eleven Music (`eleven-music`); ElevenLabs Sound Effects (`elevenlabs-sound-effects`); Eleven Music v2 (`music_v2`); Eleven Music v2.5 (`music_v2_5`); Eleven Sound Effects v2 (`eleven_text_to_sound_v2`) |
| Google DeepMind / Google | Lyria 3.5 (`lyria-3.5`); Lyria 3 Pro Preview (`lyria-3-pro-preview`); Lyria 3 Clip Preview (`lyria-3-clip-preview`); Lyria Realtime (`lyria-realtime`) |
| Kuaishou / Kling AI | Kling Audio (`kling-audio`) |
| MiniMax | Music 3.0 (`music-3.0`); Music 2.6 (`music-2.6`); Music Cover (`music-cover`) |
| Pika | Pika Music (`pika-music`); Pika SFX (`pika-sfx`) |

### Embeddings

| Provider | Cataloged models |
| --- | --- |
| Cohere | Embed v4 (`embed-v4.0`); Embed v5 Pro (`embed-v5.0-pro`); Embed v5 Fast (`embed-v5.0-fast`) |
| Google DeepMind / Google | Gemini Embedding 2 (`gemini-embedding-2`); Gemini Embedding 001 (`gemini-embedding-001`) |
| Jina AI | Jina Embeddings v3 (`jina-embeddings-v3`); Jina Embeddings v4 (`jina-embeddings-v4`); Jina Embeddings v5 Text Small (`jina-embeddings-v5-text-small`); Jina Embeddings v5 Text Nano (`jina-embeddings-v5-text-nano`); Jina Embeddings v5 Omni Small (`jina-embeddings-v5-omni-small`); Jina Embeddings v5 Omni Nano (`jina-embeddings-v5-omni-nano`) |
| Mistral AI | Codestral Embed (`codestral-embed-2505`); Mistral Embed (`mistral-embed-2312`) |
| OpenAI | Text Embedding 3 Large (`text-embedding-3-large`); Text Embedding 3 Small (`text-embedding-3-small`) |
| Alibaba / Qwen / Wan | Qwen3.7 Text Embedding (`qwen3.7-text-embedding`); Text Embedding v4 (`text-embedding-v4`); Text Embedding v3 (`text-embedding-v3`) |

Anthropic uses Messages, OpenAI uses Responses, and the other chat providers use their compatible Chat Completions endpoints. Cohere uses its dedicated compatibility URL. Native media, speech, realtime, and embedding factories route the other capabilities.

Google `lyria-realtime` is an existing catalog-only entry: realtime music needs a separate WebSocket protocol. Other Google music models use Interactions. The retained Google image preview IDs shut down on June 25; select their stable replacements. See [Google deprecations](https://ai.google.dev/gemini-api/docs/deprecations).

Pika 2.5 and Pika audio use the native Pika developer API. Existing Pika 2.2 uses fal.run and needs compatible credentials. MiniMax `music-3.0` is restricted to existing paying accounts. Google Omni video uses Interactions; uploaded-video extension is unavailable in the EEA, Switzerland, and UK. See [MiniMax models](https://platform.minimax.io/docs/guides/models-intro) and [Google Omni](https://ai.google.dev/gemini-api/docs/omni).

The code-only `bge` embedding adapter targets a self-hosted OpenAI-compatible endpoint, defaulting to `http://localhost:8080/v1/embeddings`; `BGE_BASE_URL` overrides it. No bundled BGE manifest makes it selectable.

### Search and vector storage

| Area            | Provider | Service                                 |
| --------------- | -------- | --------------------------------------- |
| Web search      | Brave    | Brave Web Search (`brave-web-search`)   |
| Web search      | Tavily   | Tavily Web Search (`tavily-web-search`) |
| Vector database | Pinecone | Pinecone Vector Database (`pinecone`)   |

Save and edit Pinecone API keys under **Settings → Providers → Database**. Credentials are stored
as entered in the local `providers/settings.json` file, separately from model and search
credentials. Create a key using [Pinecone's API key instructions](https://docs.pinecone.io/guides/projects/manage-api-keys).

Choose **Local SQLite** in **Settings → Knowledge** to index without a remote database account. New configurations default to local storage; existing remote selections are preserved. Selecting Pinecone adds a remote mirror, using its saved API key, while retrieval continues to use SQLite. Existing Pinecone indexes must match the selected embedding dimensions and cosine metric; use a different index name when those differ. The environment's `PINECONE_API_KEY` is not used. Configure the embedding provider's key separately under **Settings → Providers → Models**, then approve embedding access and, for a remote mirror, storage consent. Changing the database selection or account requires new storage consent. Failed-upload cleanup stays pinned to the account used for that upload.

## Official documentation audit: October 9, 2026

All 31 manifests were checked against official documentation. This update adds 155 model/service IDs across 18 model providers, including runtime adapters and factory registrations where needed. Provider-specific documentation links live beside the request metadata in each [manifest](../resources/providers).

| Provider | Official source | Audit result |
| --- | --- | --- |
| Anthropic | [Documentation](https://platform.claude.com/docs/en/models/overview) | 5 additions; documented request contracts implemented. |
| Black Forest Labs | [Documentation](https://docs.bfl.ai/llms.txt) | 8 additions; documented request contracts implemented. |
| Brave | [Documentation](https://api-dashboard.search.brave.com/documentation/services/web-search) | Existing search API; no model IDs. |
| Cartesia | [Documentation](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest) | 3 additions; documented request contracts implemented. |
| Cloudflare | [Documentation](https://developers.cloudflare.com/r2/api/s3/api/) | Existing R2/S3 integration; Workers AI is a separate product. |
| Cohere | [Documentation](https://docs.cohere.com/docs/models) | 20 additions; documented request contracts implemented. |
| Deepgram | [Documentation](https://developers.deepgram.com/docs/models-languages-overview) | 3 additions; documented request contracts implemented. |
| DeepSeek | [Documentation](https://api-docs.deepseek.com/quick_start/pricing/) | Current catalog already matches the documented API models. |
| ElevenLabs | [Documentation](https://elevenlabs.io/docs/overview/models) | 8 additions; documented request contracts implemented. |
| GitHub | [Documentation](https://github.com/github/github-mcp-server) | Existing MCP integration; GitHub Models is a separate product. |
| GitLab | [Documentation](https://docs.gitlab.com/user/model_context_protocol/mcp_server/) | Existing MCP integration; no inference catalog. |
| Google DeepMind / Google | [Documentation](https://ai.google.dev/gemini-api/docs/models) | 20 additions; documented request contracts implemented. |
| Ideogram | [Documentation](https://developer.ideogram.ai/api-reference/images/generate/ideogram-4-5) | 3 additions; documented request contracts implemented. |
| Jina AI | [Documentation](https://api.jina.ai/scalar) | 5 additions; documented request contracts implemented. |
| Moonshot AI / Kimi | [Documentation](https://platform.kimi.ai/docs/models) | Current catalog already matches the documented API models. |
| Kuaishou / Kling AI | [Documentation](https://kling.ai/document-api/api/video/3-0-omni/text-to-video) | 5 additions; documented request contracts implemented. |
| Microsoft | [Documentation](https://learn.microsoft.com/en-us/microsoft-agent-365/tooling-servers-overview) | Existing Work IQ/Learn MCP integrations; Azure model hosting is separate. |
| MiniMax | [Documentation](https://platform.minimax.io/docs/guides/models-intro) | 7 additions; documented request contracts implemented. |
| Mistral AI | [Documentation](https://docs.mistral.ai/models) | 8 additions; documented request contracts implemented. |
| Notion | [Documentation](https://developers.notion.com/docs/mcp) | Existing MCP integration; no model catalog. |
| Ollama | [Documentation](https://docs.ollama.com/api/tags) | Models are discovered from the local server; no fixed bundled IDs. |
| OpenAI | [Documentation](https://developers.openai.com/api/docs/models) | 8 additions; documented request contracts implemented. |
| Pika | [Documentation](https://dev.pika.art/models/pika/pika-2.5/text-to-video) | 4 additions; documented request contracts implemented. |
| Pinecone | [Documentation](https://docs.pinecone.io/guides/inference/understanding-inference) | Existing vector-storage integration; hosted inference is a separate API. |
| Alibaba / Qwen / Wan | [Documentation](https://www.alibabacloud.com/help/en/model-studio/models) | 32 additions; documented request contracts implemented. |
| Reka AI | [Documentation](https://docs.reka.ai/chat/models) | 6 additions; documented request contracts implemented. |
| Supabase | [Documentation](https://supabase.com/docs/guides/storage/s3/compatibility) | Existing S3 storage integration; no model catalog. |
| Tavily | [Documentation](https://docs.tavily.com/documentation/api-reference/endpoint/search) | Existing search API; no model IDs. |
| Telegram | [Documentation](https://core.telegram.org/bots/api) | Existing messaging channel; no model catalog. |
| xAI | [Documentation](https://docs.x.ai/developers/models/grok-4.7) | 2 additions; documented request contracts implemented. |
| Z.ai / Zhipu AI | [Documentation](https://docs.z.ai/release-notes/new-released) | 8 additions; documented request contracts implemented. |

The audit covers capabilities Kucedr can execute: chat, speech, realtime voice, image/video/audio generation, and text embeddings. OCR, moderation, reranking, voice enrollment, and indexed-media services need distinct application contracts and were not added. Restricted MiniMax M3.1 Flash Preview and retired Google embedding preview models were excluded.

Verification uses manifest validation, mocked HTTP/WebSocket contract tests, high-level selection paths, TypeScript checks, and a production build. Paid live API calls were not performed; account access, quotas, and generated output quality require provider credentials.

## Custom and plugin providers

Kucedr merges bundled manifests with provider folders from its application-data `providers`
directory. A local provider with the same normalized ID overrides the bundled manifest, and the
catalog watches the directory for changes. The current Settings UI does not open this directory or
import provider folders.

Provider plugins use the same folder shape. See [Kucedr plugins](PLUGINS.md) for the complete plugin
layout.

A provider manifest requires `providerId` and `providerName`. It declares capabilities in
`models`, `mcp_servers`, `databases`, `web_search`, `bots`, or `storage`; the former `services` field
is rejected. Entries in the array capabilities require `id`, `name`, and `url`, with additional
fields depending on the capability. Optional provider fields include `apiKeyUrl`, authentication,
and icon paths. Model entries declare their type, authentication, location, and prompt attachment
metadata where applicable. Use the [manifest validator](../src/shared/providers/validation.ts) and
bundled manifests as the schema reference.

Custom chat providers whose ID is not `anthropic` or `openai` are routed through the
OpenAI-compatible Chat Completions client. The reserved custom local provider can discover
models from an Ollama service in **Settings → Providers → Models**; its bundled `ollama` manifest
does not declare fixed model IDs. Other capabilities require an adapter in the corresponding
runtime factory; adding only a manifest makes the service catalog only.

## Source of truth

- Built-in declarations: [`resources/providers`](../resources/providers)
- Manifest schema and validation: [`src/shared/providers/validation.ts`](../src/shared/providers/validation.ts)
- Catalog loading and local overrides: [`src/main/models.ts`](../src/main/models.ts)
- Runtime adapters: [`src/main/models/adapters`](../src/main/models/adapters)
- Search integrations: [`src/main/search`](../src/main/search)
- Pinecone RAG integration: [`src/main/agent/knowledge/rag`](../src/main/agent/knowledge/rag)
- Supabase cloud backup: [`SUPABASE.md`](SUPABASE.md)

When a manifest changes, update this page in the same change and run `npm run quality:check`.
