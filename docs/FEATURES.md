# Kucedr Feature Reference

Kucedr is a cross-platform Electron desktop assistant that turns chat requests into model responses, tool calls, local file and process work, web research, generated media, background checks, and messaging-channel replies.

This document describes the feature set present in the current source tree, grouped from most to least central to the product, and orders items within each group the same way. It distinguishes working behavior from surfaces that are only partially wired so that a visible setting or catalog entry is not mistaken for an end-to-end capability.

## Feature status

| Status       | Meaning                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Available    | The current renderer and main process are connected to an implementation. Provider credentials or OS permissions may still be required. |
| Partial      | A useful portion is implemented, but an important control or execution path is missing.                                                 |
| Placeholder  | A visible control or surface exists, but its intended workflow is not connected.                                                        |
| Catalog only | The provider or model is selectable or described, but no working execution adapter is present.                                          |

## Contents

- [Product overview](#product-overview)
- [1. Core conversation experience](#1-core-conversation-experience)
- [2. Agent runtime and automation](#2-agent-runtime-and-automation)
- [3. Providers and model catalogs](#3-providers-and-model-catalogs)
- [4. Media generation](#4-media-generation)
- [5. Messaging channels](#5-messaging-channels)
- [6. Desktop, settings, and extensibility surfaces](#6-desktop-settings-and-extensibility-surfaces)
- [7. Privacy, storage, and security](#7-privacy-storage-and-security)
- [8. Platform and packaging](#8-platform-and-packaging)
- [Source map](#source-map)

## Product overview

Kucedr provides:

- Persistent, streaming conversations with multiple local chat sessions.
- An agent loop that can use files, patches, commands, long-running processes, the web, a browser, memory, skills, MCP tools, media generation, automation tools, and one-level subagents.
- Image and PDF attachments for multimodal requests, and live or recorded speech-to-text input with text-to-speech playback.
- Independent provider and model selection for chat, transcription, speech, image, video, audio, scheduled work, and health checks.
- Local skills, remote HTTP MCP servers, local stdio MCP servers, and standalone app windows.
- Persistent schedules, periodic `HEALTH.md` checks, and account-backed cloud backup for local folders.
- Telegram bot connections with sender policies.
- Local configuration, conversation history, memory, generated-media storage, and operational logs.
- Windows, macOS, and Linux packaging; partial English and Italian localization; light, dark, and system themes.

## 1. Core conversation experience

The chat surface is the primary way users interact with Kucedr, so its setup, input, and rendering behavior are documented first.

See [Home UI](ui/HOME.md) for the layout, session, composer, message, tool, and voice behavior
contract.

### First-run setup

The first launch uses a single `/start` flow with five visible stages: **Welcome**, **Account**,
**Model**, **Search**, and **Models**. Account sign-in is optional; users
can continue in local-only mode. After sign-in or local-only continuation, Kucedr checks for a
stored Assistant provider and model. A complete configuration opens Home, while an incomplete one
continues through setup. A restored signed-in user runs this check automatically and skips Welcome
and Account.

The Model stage requires at least one saved model-provider API key. Search is optional. The final
Models stage offers Assistant,
Voice, Transcription, Image, Audio, Video, realtime conversation, and search configuration, but
only the Assistant selection is required to finish. Task and health model selection remain on their
own Settings pages.

See [Start Page Flow](ui/START.md) for routing, authentication branches, navigation behavior,
validation, persistence, and completion rules. The same provider keys and service selections can
be changed later in Settings.

Provider API keys are stored in Kucedr's local application data and are masked after saving. Requests and credentials are still sent to the configured provider as required for authentication and inference.

### Chat input

- The multiline TipTap prompt editor supports Markdown-oriented editing and keyboard submission.
- `Enter` sends when appropriate; modified Enter and structural contexts such as lists or code blocks retain their editor behavior.
- `Cmd/Ctrl+/` focuses the prompt editor.
- The send button becomes a stop button while a response is running. Stopping aborts the active run and rejects pending tool-approval requests.
- Starting a new request for the same agent also cancels that agent's previous active request.
- Empty conversations offer four guided prompts: schedule a task, create a sound, create an image,
  and create a video. Selecting one fills the composer without sending it.

### Attachments

- Multiple files can be attached to one request. Known text files are accepted independently;
  supported binary types such as images and PDFs depend on the selected model's verified
  capabilities.
- Attachment chips show the filename, size, removal action, and any validation error.
- The renderer enforces file count, type, individual size, aggregate text/binary size, and
  model-specific media limits before Send is enabled.
- Queued files are revalidated when the model changes, encoded locally, and included in the agent
  request.
- Submitted attachment metadata is not rendered in the user bubble or restored transcript.

### Slash commands

The Home editor provides two styled command modes:

- `/plan` switches the current session into Plan mode. A completed plan can render an **Implement**
  action that returns to the normal interaction mode.
- `/goal <objective>` creates a durable goal for the current conversation. `/goal pause`, `/goal
resume`, and `/goal clear` control its lifecycle. Bare `/goal` cannot currently be submitted from
  Home because the Goal mode requires following text.

`/task_list`, `/create_task`, and `/delete_task` are expanded into agent instructions before the
message is sent. Home does not currently mount a general slash-command menu or searchable skill
picker.

### Voice input and playback

- With a streaming speech-to-text model, Kucedr captures mono PCM audio and appends partial and final transcript events live.
- With a batch-only model, Kucedr records audio locally, submits it when recording stops, and appends the returned transcript.
- Dictation includes microphone permission checks, elapsed time, a waveform, confirm, cancel, and
  error states. The current dictation panel does not expose mute.
- Assistant responses can be read aloud through the configured text-to-speech provider.
- With a supported OpenAI or xAI realtime model configured, the empty-composer voice action starts
  a full-duplex session with microphone capture, assistant audio playback, transcript messages,
  interruption, tool activity, permissions, and generated media in the normal conversation.

### Response rendering

- Assistant output streams into the current response.
- GitHub-flavored Markdown, headings, lists, tables, blockquotes, line breaks, inline code, and syntax-highlighted code blocks are rendered.
- External links open outside the application.
- Copy, read-aloud, and reply/focus actions are available on assistant messages.
- Tool calls are grouped into collapsible activity summaries and show running, completed, or error states, input, output, duration, and tool-call identifiers.
- Generated images, video, and audio appear inline. Local media can be played without leaving the conversation.
- Image context menus can open, reveal, copy the image, copy its path, or save a copy. Video and audio menus can open, reveal, copy the path, or save a copy.
- Earlier long user messages collapse. A More/Less control is also rendered for earlier long assistant messages, but it currently does not change the assistant content layout.

### Sessions and conversation history

- The Home sidebar starts a new UUID-backed conversation or switches to an existing one. It also
  supports context-menu rename and deletion.
- Sessions are listed newest first and titled from the first user message, shortened to 60 characters.
- Switching sessions restores its stored transcript; the Home view loads at most the last 50 stored messages before expanding tool results.
- Stored transcripts remain complete. Model calls always retain the current run and add older complete turns within a 50-message, 120,000-serialized-character history budget.
- Settings includes a Chat History screen with session title, creation date, and confirmation-backed deletion.
- Session storage is separated into `main`, `task`, `health`, and `bot` categories.
- Each stored session can contain `messages.json`, append-only `run.jsonl`, and the latest system prompt in `SYSTEM.md`.

There is a clear-messages API in the runtime, but the current Chat History screen exposes per-session deletion rather than a separate clear button.

## 2. Agent runtime and automation

This group covers what makes Kucedr an agent rather than a chat window: the tool-calling loop, its permission model, and the automation surfaces (skills, MCP, schedules, health checks) built on top of it.

### Agent runtime

Kucedr uses an iterative tool-calling loop:

1. Build a system prompt from the base assistant contract, tool descriptions, workspace metadata, the live filesystem inventory, and any skill loaded during the run. Editable profile and memory files plus installed-skill routing metadata are prepended separately as user-controlled context.
2. Stream a model turn and collect text, reasoning continuity where supported, and tool calls.
3. Run requested tools, stream their activity into the conversation, and append results to the transcript.
4. Continue until the model returns no tool calls, the request is cancelled, an error occurs, or the 20-turn session limit is reached.

Each model turn currently allows up to 8,192 output tokens and is retried once after a provider failure.

The Home prompt classifier computes `none`, `medium`, or `high` reasoning effort from prompt language, length, and code context, and also derives `lightContext`. `toolsAllow`, `toolsDeny`, and `lightContext` are forwarded from the renderer but dropped by the main-process IPC normalizer before reaching the agent; `effort` survives that step but is never read when the run's input is assembled. These Home options therefore have no execution effect at present.

### Built-in tools

| Area       | Tools and behavior                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Files      | Read a complete UTF-8 file, create or overwrite a text file, replace one exact unique match, and apply structured multi-file patches.                                                                               |
| Commands   | Run a shell command with working directory, environment, timeout, yield/background behavior, and optional PTY. Host elevation, gateway execution, and remote-node execution are not implemented in this runtime.    |
| Processes  | List, poll, page through logs, write text, submit text, paste, send special keys, kill, clear, or remove retained long-running process sessions.                                                                    |
| Web search | Query the selected Brave or Tavily engine for 1–20 results using its API key from Settings. `BRAVE_API_KEY` and `TAVILY_API_KEY` remain available as environment fallbacks.                                         |
| Web fetch  | Fetch public HTTP(S) pages or JSON, follow up to three redirects, convert HTML to plain text, and truncate long output. Private, loopback, and link-local targets are blocked.                                      |
| Browser    | Start or stop a persistent visible Chrome profile; manage tabs; navigate; take DOM/text snapshots, screenshots, or PDFs; read console output; and click, type, press, hover, drag, select, fill, wait, or evaluate. |
| Media      | Generate an image, video, music track, or sound effect with the configured service and save agent-created output in the media library.                                                                              |
| Memory     | Save a durable fact or forget all saved facts containing a case-insensitive match.                                                                                                                                  |
| Skills     | Load an enabled skill's `SKILL.md` instructions and return its directory path to the current run.                                                                                                                   |
| MCP        | Load enabled server tools dynamically as `mcp__<server>__<tool>`.                                                                                                                                                   |
| Schedules  | Create, update, pause, resume, delete, inspect, list, or trigger persistent schedule records. See [Scheduled tasks](#scheduled-tasks) for the execution limit.                                                      |
| Health     | Replace the `HEALTH.md` checklist or update health-run settings.                                                                                                                                                    |
| Bootstrap  | Complete the one-time conversational bootstrap after profile files have been written.                                                                                                                               |
| Subagents  | Run one independent subagent with a fresh conversation and the same tool set except further subagent spawning.                                                                                                      |

Agent runs have one explicit runtime type:

- `default` resolves every tool call against the live global permission policy. Approval is interactive only when the run has both an originating window and an event callback; otherwise `ask` denies immediately.
- `background` is available only to trusted main-process callers. It resolves the same stored policy without interactive approval, so an **Ask** decision is denied. An omitted tool allowlist exposes the full catalog, a non-empty allowlist narrows it, and an explicit empty allowlist exposes no tools.

Both types still enforce capability filtering, input validation, cancellation, timeouts, resource locks, execution budgets, sandboxing, OS permissions, and authorization implemented inside a tool. Subagents inherit the parent run type and exact filtered tool IDs, but cannot spawn nested subagents.

### Permissions and execution control

The Permissions screen provides persistent controls for sensitive tools:

- The policy has three buckets: `read`, `write`, and `exec`.
- Each bucket contains only `allow` and `deny` rule arrays. There is no persisted `ask` property.
- All entries are absolute or home-relative path globs. Exec allow entries identify directories where sandboxed commands may write files.
- The default policy trusts the agent workspace recursively for reads, writes, and sandboxed commands. Unmatched sensitive operations resolve to an interactive **Ask** decision.
- Other tools use their capability policy; sensor access and external effects retain separate approval requirements.
- An interactive permission card offers **Deny**, **Allow once**, and **Trust this location** when the grant can be persisted.
- Trusting a location stores a recursive containing-folder glob for the requesting capability.
- Resetting restores the default workspace path glob in all three buckets.

Permissions use this top-level structure:

```json
{
	"read": {
		"allow": ["/workspace/**", "/tmp/**"],
		"deny": ["/workspace/.env", "/workspace/secrets/**"]
	},
	"write": {
		"allow": ["/workspace/src/**", "/workspace/tests/**"],
		"deny": ["/workspace/.git/**", "/workspace/config/prod/**"]
	},
	"exec": {
		"allow": ["/workspace/**", "/shared/build-cache/**"],
		"deny": ["/workspace/private/**"]
	}
}
```

Rule resolution is deny-first:

- Any matching deny rule denies the operation, even when an allow rule also matches.
- The workspace is trusted by default; explicit block rules remain effective.
- If no deny matches, a matching allow rule allows the operation.
- If neither matches, reads proceed without approval. File mutations request approval when interactive and are denied in background calls without an approval window.
- Shell syntax does not change the permission decision. Commands using pipes, substitutions, or redirections run without a prompt when every declared location is trusted.
- `bash.workdir` and every `bash.additionalRoots` entry are canonicalized before authorization. Relative additional roots resolve from the command working directory.

Important boundaries:

- Normal `bash` calls run inside the operating-system command sandbox. Writes are confined to trusted exec paths and the runtime temporary directory; explicit read, write, and exec denies remain effective.
- A command that needs to create, modify, or delete files in an outside directory must declare it in `additionalRoots`, including its working directory if that directory needs write access. Kucedr asks before spawning the command; a one-time approval extends only that sandboxed invocation.
- A command that intentionally needs host execution must use `elevated: true`. Host execution always requires interactive approval and cannot be persisted as a trusted location.
- Windows does not support per-invocation filesystem overrides. An outside location must be trusted persistently before a Windows sandboxed command can write to it.
- On macOS and Linux, permission edits apply to newly wrapped commands without stopping already-running sandbox sessions. Windows sandbox policy changes require reinitialization and may stop active sandboxed commands.
- Commands may read outside files and use an outside working directory without approval. This does not grant write access to that directory. Undeclared outside writes are blocked by the sandbox; retry with the required directory in `additionalRoots`.
- Background calls never bypass stored permissions. Because they cannot display an approval request, an **Ask** result is denied.
- Relative policy paths such as `Desktop/**` resolve from the user home directory.
- Permission rules are managed as trusted or blocked locations in Settings, scoped to read, write, and execute capabilities.
- **Allow once** authorizes one invocation; **Trust this location** saves a recursive grant for later runs, including overwrites, moves, deletes, undo, and redo. Approval and rejection outcomes are recorded in the session trace.
- MCP tools declaring `readOnlyHint: true` do not prompt under the default policy. Explicit server `always`/`never` settings are preserved; unclassified and mutating MCP tools retain approval.

### Skills

Skills are local directories under the agent's `skills` folder and must contain `SKILL.md`.

The Skills settings area can:

- List installed skills with name and description.
- Open the skills root in the system file manager.
- Refresh the catalog.
- Import one or more selected skill directories and report imported and skipped counts.
- Inspect ID, format, version, category, safety level, visibility, author, required and allowed tools, required connectors, tags, model visibility, folder path, skill-file path, and validation diagnostics.
- Enable or disable a skill.
- Export/download a skill directory.
- Delete a skill after confirmation.

Validation requires frontmatter `name` and `description`. Names are lowercase alphanumeric/hyphen identifiers of 1–64 characters, and descriptions are limited to 1,024 characters. Importing an existing ID replaces its folder. Only enabled skills can be loaded by the agent.

The Home slash menu searches installed skills, and the agent can load a selected skill's `SKILL.md` instructions during a run. The loader returns the skill directory path; bundled scripts, references, and assets must be read separately when needed.

### MCP servers

Kucedr supports two MCP transport types:

| Transport   | Configuration                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Remote HTTP | Server ID, name, URL, optional bearer token, and optional OAuth client ID and client secret.                                                |
| Local stdio | Server ID, name, command, whitespace-split arguments, optional `KEY=value` environment variables, and an optional stored working directory. |

MCP settings provide:

- One unified list for remote services, configured commands, and discovered local packages.
- Configured, disabled, testing, connected, and error states, with an enable/disable toggle for configured servers.
- Add and edit dialogs. Server ID and transport type are fixed after creation.
- Detail-page configuration, testing, and removal for configured servers; filesystem packages remain file-authoritative and are edited through the same detail workflow.
- OAuth authorization for HTTP servers without a bearer token, including reauthorization.
- Dynamic discovery of local server packages from `~/.kucedr/mcp/servers`.
- Folder upload, local-folder access, manual refresh, and a live connection test that reports tool count and latency for every local or remote server.

Each discovered local server lives in its own folder and contains an `mcp.json` manifest:

```json
{
	"id": "filesystem",
	"name": "Filesystem",
	"type": "stdio",
	"command": "node",
	"args": ["dist/server.js"],
	"env": { "MODE": "production" },
	"cwd": ".",
	"require_approval": "always",
	"enabled": true
}
```

The folder name is used as the ID when `id` is omitted. IDs use lowercase letters, numbers, and single hyphens. Relative `cwd` values are resolved from the package folder; omitting `cwd` also runs the command from that folder. Kucedr rescans the directory whenever settings or an agent run reads the MCP registry, so adding or removing a valid folder does not require an app restart. Explicitly configured servers take precedence over a discovered package with the same ID, and malformed or duplicate local packages are reported in Settings instead of preventing other servers from loading.

A dependency-free package with three sample tools is available at `resources/mcp/demo-server` and can be selected directly with **Upload local**.

At the start of each normal agent run, enabled servers connect in parallel, expose their tools to the model, and close when the run ends. Unreachable or unauthenticated servers are skipped for that run.

Current limits:

- A stored `require_approval` field is enforced: it sets a loaded MCP tool's default permission to allow or ask. A stored `defer_loading` field is not yet enforced by the tool loader.
- Dynamically loaded MCP tools are not included in the built-in gated-tool list; only their own `require_approval`-derived default applies.

### Scheduled tasks

Kucedr persists cron schedule records with:

- A name and optional description.
- A cron expression.
- Enabled or paused state.
- An agent prompt.
- Created and updated timestamps.
- Create, update, pause, resume, delete, get, list, and run-now operations.
- A separate provider and model selection for scheduled work.
- Startup reconciliation that reloads and reschedules persisted records.

The Tasks settings screen selects the task provider/model and lists each schedule's name, prompt,
cron expression, and enabled state. Task details expose metadata, **Run now**, and confirmed
deletion. Creating a task or editing its name, schedule, or prompt remains agent-driven rather
than a direct Settings form.

Scheduled tasks run as background agents with the full tool catalog by default. A non-empty persisted tool allowlist narrows the tools available to that schedule; a blank allowlist keeps the full catalog.

Scheduled prompts and **Run now** invoke the agent directly as background runs.

### Periodic health checks

`HEALTH.md` defines a checklist that Kucedr can run in the background.

Available behavior:

- Intervals of Off, 1 minute, 30 minutes, or 1 hour.
- Skip while the main or health agent is busy.
- Optional daily time windows or inclusive start/end date ranges.
- An isolated `health` session when enabled.
- Heading-only or empty checklists are skipped.
- A response of exactly `HEALTH_OK` is treated as healthy; other responses are logged as needing attention.
- The Health screen can read, edit, and save the checklist and configuration. An unmounted runtime API can reset the health configuration, but the screen has no reset action and there is no checklist-reset API.

The Health settings screen exposes provider, model, interval, target, direct policy, start/end dates, and the checklist editor. The agent tool can additionally update light-context, isolated-session, skip-when-busy, active-hours, and include-reasoning fields.

**Partial:** the runtime currently applies interval, busy checks, active hours/dates, and isolated-session behavior. Stored target, direct policy, light context, include reasoning, provider, and model fields are not consumed by `runHealthCheck`; health runs use the agent's normal active model.

### Personalization, workspace, and memory

Kucedr maintains an agent workspace in local application data with these Markdown files:

| File           | Purpose                                                         |
| -------------- | --------------------------------------------------------------- |
| `AGENTS.md`    | Standing behavior and workspace instructions.                   |
| `BOOTSTRAP.md` | One-time conversational setup instructions for a fresh profile. |
| `IDENTITY.md`  | Assistant identity and presentation.                            |
| `SOUL.md`      | Personality and behavioral guidance.                            |
| `USER.md`      | User profile and preferences.                                   |
| `MEMORY.md`    | Durable facts loaded into every conversation.                   |
| `HEALTH.md`    | Checklist used by periodic health runs.                         |

While `BOOTSTRAP.md` exists, it is included in the user-controlled workspace context. Completing bootstrap removes that file after the identity, user, and soul files have been updated.

`save_memory` adds one bullet fact without duplicating an identical line. `forget_memory` removes every bullet containing the requested text, case-insensitively. Workspace profile and memory content are rebuilt as transient user-level context before each model turn rather than persisted in the system-prompt snapshot.

### Persistent LLM Wiki

Kucedr's optional LLM Wiki is an additive knowledge-compilation layer. It snapshots supported source files into checksum-addressed immutable evidence, uses the configured text model to create or incrementally enrich Markdown pages, and stores claim-level source IDs and locators. Page changes, `index.md`, and `log.md` are staged and validated before the generated wiki directory is replaced.

The normal main assistant receives wiki tools only while the wiki is enabled. Query tools search exact titles and aliases before metadata, full text, and linked pages. Raw evidence is returned separately for quotations, exact facts, low-confidence matches, or contradictions. Existing Pinecone RAG remains unchanged and independent.

Available tools are `ingest_wiki_source`, `search_wiki`, `read_wiki_page`, `query_wiki`, `save_wiki_analysis`, `lint_wiki`, `review_wiki_changes`, `rebuild_wiki_index`, and `get_recent_wiki_activity`. Wiki tools are not exposed to task, health, or messaging-channel sessions because the current application has one local-user wiki and no per-sender tenancy boundary.

Major synthesis rewrites and contradiction resolutions enter a persistent review queue. Approval or rejection uses the existing interactive tool-permission flow. Scheduled generation also runs a lint inspection; optional startup lint is configurable.

See [LLM Wiki](WIKI.md) for storage, configuration, schemas, workflows, examples, migration, and rollback.

## 3. Providers and model catalogs

See [Provider Reference](PROVIDERS.md) for the complete built-in provider inventory, exact service
IDs, credential requirements, and the distinction between catalog entries and executable adapters.

### Chat and research providers

Provider routing uses the native Anthropic Messages API for Anthropic, the OpenAI Responses API for OpenAI, and the OpenAI-compatible Chat Completions path for every other chat provider.

The chat catalog includes Anthropic, DeepSeek, Google, Kimi, MiniMax, Mistral, OpenAI, Qwen,
Reka AI, xAI, and Z.ai. Exact model names, IDs, and support notes are maintained in
[Provider Reference](PROVIDERS.md#chat-and-research).

The built-in catalog contains 22 provider manifests.
Model-provider entries include capability labels and an external setup link.

Realtime voice has IPC and execution adapters for supported OpenAI and xAI models. Home connects
these models to microphone capture, assistant audio playback, transcripts, tools, and generated
media in the current chat session.

### Speech services

#### Speech-to-text

Realtime and recorded transcription use independent saved selections. Settings filters models by whether they implement streaming or batch transcription and provides a live test and a record-then-transcribe test.

Deepgram, ElevenLabs, Mistral, OpenAI, Qwen, and xAI have speech-to-text adapters. See
[Speech to text](PROVIDERS.md#speech-to-text) for the batch and streaming support of each model.

The transcription API accepts optional language, prompt, temperature, and sample-rate settings. Batch audio is capped at 64 MiB of encoded input, and realtime chunks are capped at 256 KiB.

#### Text-to-speech

Settings selects a provider/model and can synthesize and play editable sample text. Responses can use the same service for read-aloud playback. Input text is required and capped at 4,096 characters.

Cartesia, Deepgram, ElevenLabs, Google, MiniMax, Mistral, and OpenAI have text-to-speech adapters.
See [Text to speech](PROVIDERS.md#text-to-speech) for their exact model catalogs.

## 4. Media generation

Media can be generated from the dedicated Settings studios or by agent tools during a conversation.

- Each studio persists an independent provider/model selection and accepts a text prompt.
- Image results are previewed in the studio.
- Video results are playable and can expose their local-file menu.
- The audio studio ("Audio"/Music Creator in Settings navigation) refreshes a dated local list and plays saved tracks.
- Agent-created image, video, and audio files are saved under the app's local `library` data folder and displayed automatically in chat.
- Standalone video and audio outputs are stored in their feature-specific application-data folders. Standalone image generation returns image data to the studio without adding it to the unified library.

### Image adapters

| Status    | Provider and models                                                |
| --------- | ------------------------------------------------------------------ |
| Available | Black Forest Labs: FLUX.2, FLUX.1 Kontext Pro, FLUX1.1 Pro Ultra   |
| Available | Google: Gemini 3.1 Flash Image Preview, Gemini 3 Pro Image Preview |
| Available | Ideogram: 3.0, 2a                                                  |
| Available | Qwen: Qwen Image, Qwen Image Edit                                  |
| Available | xAI: Grok Imagine Image, Grok Imagine Image Quality                |

### Video adapters

| Status    | Provider and models                 |
| --------- | ----------------------------------- |
| Available | Google: Veo 3.1, Veo 3.1 Fast       |
| Available | Kling: 2.5 Turbo, 2.1 Master        |
| Available | MiniMax: Hailuo 2.3, Hailuo 02      |
| Available | Pika: 2.2                           |
| Available | Qwen: Wan 2.5 T2V, Wan 2.2 T2V Plus |
| Available | xAI: Grok Imagine Video 1.5         |

### Audio adapters

| Status       | Provider and models                                               |
| ------------ | ----------------------------------------------------------------- |
| Available    | ElevenLabs: Eleven Music, ElevenLabs Sound Effects                |
| Catalog only | Google: Lyria 3 Pro Preview, Lyria 3 Clip Preview, Lyria Realtime |
| Catalog only | Kling Audio                                                       |
| Catalog only | MiniMax Music 2.6, Music Cover                                    |

The audio catalog presents four providers, but only ElevenLabs currently has an executable adapter.

### Media output in Settings

There is no unified image, video, and audio Library route in Settings. Image and Video service
pages show the result of the current generation request. The Audio service page additionally lists
saved generated audio with its filename and creation date, provides playback, and opens the native
audio file menu on right-click. It has no search, filter, refresh, or delete toolbar.

## 5. Messaging channels

Kucedr includes a Telegram bot adapter. Telegram starts when the app becomes ready if enabled with a token.

### Shared behavior

- Incoming direct, group/channel, and thread messages are normalized and routed to the agent.
- Replies target the originating chat, message, and thread when the platform supports it.
- Channel replies use their own configured chat provider and model.
- Long replies are split into platform-sized parts, and delivery receipts distinguish sent, partial, and failed delivery.
- `/start` returns a fixed connected greeting. Other slash-prefixed channel messages are ignored.
- All accepted Telegram messages currently share one fixed bot-session UUID.
- Channel agent runs use the background type with the full tool catalog, plus an eight-call public-web budget per run.

### Access policies

- Disabled or tokenless channels reject input.
- Empty messages are ignored.
- Direct-message policy can be **Allowlist** (default), **Open**, **Pairing**, or **Deny**.
- Allowlist mode accepts only configured sender IDs.
- An optional group/channel list restricts accepted route IDs.
- **Pairing is partial:** the current policy always rejects with `pairing_required`; there is no code-generation or approval flow.

### Telegram

- Long polling with pending updates dropped at start.
- Connection, error, and disconnected status events.
- A 60-second health check and exponential reconnect delay from 2 to 60 seconds.
- In-memory duplicate-message protection.
- Reply splitting at 4,096 characters.
- Renderer IPC supports start, stop, and restart.

The Channels screen configures Telegram with enable state, token, DM policy, direct-sender allowlist, group/channel allowlist, and the reply provider/model. It also displays live runtime status.

## 6. Desktop, settings, and extensibility surfaces

### Settings navigation

See [Settings UI](ui/SETTINGS.md) for the canonical navigation, persistence, and page behavior.

- `/settings` and the application Settings entry points open General settings directly.
- The sidebar groups pages as **General**, **Assistant**, **Providers**, **Channels**, and
  **Integrations**. Dedicated model-service and API-key pages are also available through
  Assistant, route search, or direct links.
- The **Cloud** page configures folders, schedules, backup, and restore for the signed-in account's
  private storage. It also configures end-to-end encrypted API-key sync. It has no infrastructure
  provider selection, endpoint, bucket, or storage credentials.
- Deep pages use breadcrumbs.
- `Cmd/Ctrl+F` opens a route and setting search palette.
- Unknown routes show a 404 recovery view; route failures show retry, restart, or Home actions.
- Page transitions respect the operating system's reduced-motion preference.
- **Providers → Search** stores Brave or Tavily credentials, while Assistant selects the active
  configured engine used by the agent's web search tool. It is not a separate local-search feature.

### Apps

Apps are standalone mini-app windows:

- Each app lives in its own folder under the app's local data directory with a `manifest.json` declaring a title, description, and entry point.
- The application menu and a `window.apps` API can list installed apps and open each one in its own `BrowserWindow`.
- The main process watches app folders and supports hot-reload.
- The Apps settings page opens the apps folder, refreshes discovery, imports app
  packages, shows list/detail metadata, opens an app, and deletes it from the list.

**Partial:** the app-loading backend and import/removal UI are implemented, but Settings has
no enable/disable control.

### Cloud storage sync

- **Cloud** selects local paths and a backup interval so chosen folders back up to the signed-in
  account's private storage on a schedule. Restore replaces matching local files after explicit
  confirmation and keeps other local files.
- **Secure key sync** encrypts saved model, database, and search API keys with a separate
  user-held passphrase and reconciles them across signed-in devices.
- Assistant RAG uses Pinecone as its environment-configured remote vector mirror and does not
  expose a vector-database provider or database picker.

### Application preferences

- View application name and version.
- Enable or disable the tray/menu-bar icon.
- Keep the computer and display active while Kucedr is running.
- Open the application-data folder.
- Select English or Italian.
- Select light, dark, or system theme; system mode follows OS theme changes.

### Media permissions and tests

- System pages are available for Microphone, Camera, and Screen capture.
- On macOS, Kucedr displays microphone/camera permission status, can request access, and opens the relevant System Settings pane.
- Screen capture opens its OS settings pane.
- Microphone can be recorded and played back.
- Camera and screen capture show a live preview, can record, stop, retry, and play the result. Screen recordings include the selected microphone when access is granted, and remain usable as video-only if it is unavailable.
- On non-macOS platforms, the explicit system permission status is reported as unknown and the current application-level microphone/camera toggle handlers do not disable capture.
- Display capture selects one display or window per recording. macOS 15+ uses Electron's native system picker when available; other platforms use a native Kucedr source chooser when Electron returns multiple sources. Linux PipeWire environments may expose only one portal-mediated source.
- Background recorder tools stream WebM chunks to a main-process-owned file with ordered writes, bounded in-flight buffering, no silent overwrite, and completion only after the file is closed. Screen recordings include microphone audio when available; system-audio loopback is not enabled.

### Screen recording troubleshooting

- macOS 10.15+ requires Screen Recording permission. In a packaged build, enable Kucedr under System Settings → Privacy & Security → Screen Recording, then fully quit and relaunch Kucedr. Development runs are permissioned as the development app/host and should not be treated as packaged-app validation.
- Windows uses Electron desktop capture and supports one selected display or window per recording. System-audio loopback is not enabled by the screen recorder.
- Linux X11 relies on Electron desktop source enumeration. Linux Wayland relies on the desktop's PipeWire/portal capture support; unrestricted display enumeration and silent source selection are not assumed. If the portal or PipeWire service is unavailable, capture fails and the recording returns to an error state.
- Recorder output is WebM and the destination name must use `.webm`. Existing files are never overwritten. A single recording is limited to 256 MiB; capture stops with an error if disk writes cannot keep up or the limit is reached.

### Window, tray, and native menus

- The primary launcher is a transparent, frameless 440×600 window that closes to the tray.
- macOS uses vibrancy and native traffic-light controls; Windows and Linux use custom window controls.
- The tray toggles visibility and provides localized Show/Hide and Quit actions.
- Native menus include New Window, standard editing commands, reload, window controls, English/Italian selection, developer console, and refresh.
- The app can open additional launcher windows.

## 7. Privacy, storage, and security

### Local data

Kucedr stores configuration and working data below Electron's application-data directory:

| Area        | Stored data                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| App         | Tray, keep-awake, language, and theme settings.                                                                                             |
| Providers   | Provider name, API key, and base URL.                                                                                                       |
| Agent       | Active model, policy, MCP definitions and OAuth state, skills, schedules, health settings, workspace Markdown, sessions, and media library. |
| Channels    | Bot tokens, sender policies, and channel reply model.                                                                                       |
| Services    | Independent text, transcription, voice, image, video, and audio selections.                                                                 |
| Media       | Standalone generated video and audio files.                                                                                                 |
| Browser     | Persistent agent-browser profile.                                                                                                           |
| Storage     | Local folder selections and cloud-backup schedule.                                                                                          |
| Diagnostics | Local rotating logs and crash dumps. Crash dumps are not uploaded by the current configuration.                                             |
| Wiki        | Source inbox, immutable evidence snapshots, generated Markdown, source/page/operation registries, review queue, failures, and audit log.    |

Model, database, and search provider keys are stored as entered in the local provider settings
file and are visible in Provider settings. Bot tokens and MCP secrets use their respective local
stores and should still be protected as sensitive app data.

Prompts, attachments, tool inputs, and generated content may be sent to configured model providers,
MCP servers, websites, browser targets, messaging channels, or Kucedr account cloud services as
required by the requested operation. Only folders selected in Cloud are included in folder
backups.

### Electron hardening

- Renderer windows use Electron sandboxing, context isolation, disabled Node integration, web security, and insecure-content blocking.
- Production navigation is restricted to local `file://` content.
- Renderer capabilities are exposed through typed preload APIs rather than direct Node access.
- App views use an isolated Electron session; their local-resource protocol is limited to the agent workspace, clipboard reads are denied, and media/display capture is reserved for app windows.
- Renderer agent requests are always mapped to the `default` run type; renderers cannot request privileged background execution.
- Media permission requests are limited to trusted app windows and renderer origins.
- Native media context menus validate that files are inside the agent or media data roots.

Known boundaries:

- Provider secrets can be read by trusted renderer code through the provider preload API.
- Some MCP behaviors (see [MCP servers](#mcp-servers)) run outside the centralized tool-policy system.
- Trusted background callers bypass only Kucedr's stored tool policy. Capability allowlists, sandboxing, OS controls, and tool-internal authorization remain in force.
- Kucedr does not claim formal certification for regulated data.

## 8. Platform and packaging

- Windows: signed NSIS installer and no-install portable executable for x64; the installer supports a selectable directory and desktop shortcut, while both retain per-user app data.
- macOS: PKG and DMG targets for x64 and arm64, dark-mode support, hardened runtime, and microphone/camera entitlements.
- Linux: no-install AppImage and tar archive for x64, plus DEB packaging with declared system dependencies.
- English and Italian translation catalogs and a locale selector are present, but localization is partial: major first-run and Home copy, including suggestions and the editor placeholder, remains hardcoded in English. The Windows installer additionally declares Italian, English, Spanish, French, and German installer languages.

## Source map

The main implementation areas behind this reference are:

- [Chat and renderer UI](../src/renderer/src/pages/home/)
- [Settings pages](../src/renderer/src/pages/settings/)
- [Agent runtime and tools](../src/main/agent/)
- [LLM Wiki](../src/main/agent/knowledge/wiki/)
- [Apps](../src/main/apps/)
- [Cloud storage sync](../src/renderer/src/pages/settings/pages/storage/)
- [Account and cloud architecture](CLOUD.md)
- [Provider catalog declarations](../resources/providers/)
- [Provider catalog loader](../src/main/models.ts)
- [Speech-to-text adapters](../src/main/models/adapters/stt/)
- [Text-to-speech adapters](../src/main/models/adapters/tts/)
- [Image adapters](../src/main/models/adapters/tti/)
- [Video adapters](../src/main/models/adapters/ttv/)
- [Audio adapters](../src/main/models/adapters/tta/)
- [Messaging channels](../src/main/channels/)
- [Desktop application services](../src/main/)
- [Security policy](../SECURITY.md)

Feature claims in this document intentionally exclude unmounted demo components, legacy translation
strings without a current route, the disabled tray "Apps" placeholder, inactive browser-style
navigation controls, the `documentReader` service identifier (a reserved name with no Settings
surface or backend consumer), and package manifest entries that do not have a corresponding current
implementation.
