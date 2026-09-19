# Application Architecture

Kucedr is an Electron desktop application with a React interface and a main-process agent.
This reference describes the current checkout; see [Development](DEVELOPMENT.md) for commands,
[Providers](PROVIDERS.md) for model integrations, and [Plugins](PLUGINS.md) for extensions.

## Process and service boundaries

| Layer                  | Responsibility                                                                                | Source                                     |
| ---------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Main entry and runtime | Single-instance lock, auth deep links, lifecycle, tray, shortcuts, scheduling, shutdown       | `src/main/index.ts`, `src/main/runtime.ts` |
| Composition root       | Creates agent, coding, account, cloud-record, storage, terminal, window, and channel services | `src/main/bootstrap.ts`                    |
| Main IPC               | Registers operations and validates access to privileged services                              | `src/main/ipc`                             |
| Preload                | Exposes typed capabilities through Electron context bridges                                   | `src/preload/index.ts`                     |
| Renderer               | React pages, settings, chat, voice, localization, and interaction state                       | `src/renderer/src`                         |
| Shared contracts       | Types, IPC channel names, and serialization shared across processes and SDK                   | `src/shared`                               |

The renderer invokes preload methods rather than importing Node filesystem or provider SDKs.
Main services publish state through the event bus and IPC. Window closure cancels associated
agent/coding work and voice activity. Shutdown stops terminals and agent work, closes windows,
settles backup operations, and then destroys cloud/account/channel services.

## Agent execution

`src/main/agent/agent.ts` coordinates sessions, run admission, cancellation, tasks, goals, and
streamed responses. The runner in `src/main/agent/runner` builds model context and dispatches
available tools. Main conversations, channel conversations, scheduled tasks, health runs,
subagents, and voice sessions have explicit session categories and scheduling priorities.

Tools live under `src/main/agent/tools`; provider-specific text, speech, image, audio, video,
embedding, and realtime adapters live under `src/main/models`. MCP servers provide additional
tools, skills contribute reusable instructions, and A2A integrations connect external agents.
Coding has a separate service under `src/main/coding`. Telegram is the registered messaging
channel in `src/main/channels/catalog.ts`.

Permissions and command sandboxing are enforced by `src/main/agent/permissions` and
`src/main/agent/sandbox.ts`. A tool being installed does not imply unrestricted filesystem or
command access. The terminal service is a separate typed IPC capability; see
[Terminal IPC Architecture](TERMINAL.md).

## Knowledge, memory, and RAG

Workspace instruction files include `AGENTS.md`, `BOOTSTRAP.md`, `HEALTH.md`, `IDENTITY.md`,
`SOUL.md`, and `USER.md`. The standalone memory module stores its configuration and
`MEMORY.md` under `~/.kucedr/memory`; conversation history and memory remain separate from the
searchable RAG index.

RAG configuration selects source folders, an embedding provider/model, a vector database, and
an index name. Indexing validates source paths, rejects symlinks and unsafe content, reads
bounded UTF-8 text, and chunks it with source ranges. It requires explicit consent both for
sending document text/search queries to the embedding provider and for storing plaintext chunks
and vectors in the selected remote database. Consent is bound to the configured recipient.

`rag_index.ts` embeds content, uploads a remote generation, and maintains the local SQLite
index. `rag_search.ts` embeds the query and searches local vectors, returning source paths,
line ranges, checksums, timestamps, text, and scores. The `query_knowledge` tool returns these
results as evidence, or an explicit limitation/abstention when disabled or empty. Local vector
search therefore still involves the selected embedding service for each query. The current
tool is not an automatic cited-wiki compiler.

## Local data

The application profile defaults to `~/.kucedr` on all platforms, resolved from the user's home
directory. `KUCEDR_E2E_DATA_ROOT` overrides it for isolated tests. Electron runtime data such as
Chromium state and crash dumps uses Electron's own platform-specific paths.

| Profile path         | Purpose                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `settings/`          | App, agent, provider, RAG, task, account, and integration configuration |
| `memory/`            | Memory configuration, processing state, and `MEMORY.md`                 |
| `workspace/`         | Default agent working directory and personalization Markdown files      |
| `sessions/`          | Conversation/session persistence                                        |
| `skills/`            | Installed skill instructions                                            |
| `apps/`              | Managed application files and per-app data                              |
| `library/`           | Library/media files                                                     |
| `rag/vectors.sqlite` | Local RAG vectors and source records                                    |

Model, database, and search API keys are stored as entered in `settings/providers.json`.
Storage secret keys use secure device storage. Account sessions are encrypted when secure
storage is available, otherwise retained only in memory. Do not assume the entire profile is
encrypted. See [Account and Cloud Architecture](CLOUD.md) for account binding and backup scope.

## Account, backup, and external services

Account authentication and cloud records use provider-neutral ports with Supabase adapters in
`src/main/cloud`. Their environment configuration belongs to the distributor/main process.
Folder backup independently uses a user-selected S3-compatible provider through
`src/main/storage`; account sign-in is not required. Backup and restore retain unmatched files
and are not bidirectional synchronization. Vector database configuration belongs to RAG and
does not configure folder backups.

## Embedded apps, SDK, CLI, and website

Managed apps are discovered and loaded by `src/main/apps`. Registered external debug folders
execute from their selected location rather than being copied into managed storage. App entry
validation and resource protocols constrain file access; installed apps keep their own data.

The SDK in `packages/sdk` exposes typed embedded bridges and a separate `connect()` HTTP client.
The latter defaults to `http://127.0.0.1:8765`, uses a bearer token, and expects a compatible server.
The current desktop runtime does not start that SDK server or generate its token. SDK smoke tests
use a test server and do not prove a desktop HTTP endpoint exists. Embedded app integration is
documented in the [SDK README](../packages/sdk/README.md).

The [CLI](../packages/cli/README.md) launches the desktop app, installs plugins, and provides a
terminal UI. It is independently packaged from Electron and the SDK. The root manifest declares
a `website` workspace and scripts, but no website directory is present in this checkout.

## Security boundaries

Window defaults enable sandboxing, context isolation, and web security, and disable Node
integration. Main IPC has trusted-renderer checks for sensitive operations. App resource loading
validates entry paths and containment; navigation is constrained by the window factory. Agent
file/command operations apply their own permission checks and sandbox policy.

External services receive the data needed by configured capabilities, including prompts,
attachments, tool arguments, embedding text, and selected backup files. RAG consent and account
sign-in are distinct controls. The hosted account backend must enforce ownership and private
storage policies independently of client checks; see [Supabase](SUPABASE.md) and
[Security policy](../SECURITY.md).

## Maintenance checks

Verify architecture changes across main services, shared contracts, preload bridges, IPC, and
renderer consumers. Run the relevant tests and `npm run typecheck:app` for code changes.
Documentation-only changes should verify source references and relative links. CI and release
workflow definitions currently have `.yml.disabled` extensions and do not run automatically.
