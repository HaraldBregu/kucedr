# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

Changes since [v1.0.2] (2026-07-26).

### Added

- Goal and plan modes with persistent goal lifecycle, execution budgets, validated response envelopes, and dedicated composer commands.
- A redesigned agent runtime with run state management, cancellation, background tools, retries, context budgeting, subagents, and user-input requests.
- File editing history with undo and redo support, atomic writes, attachment externalization, and safer session persistence and recovery.
- Fine-grained sandbox and permission controls, including path-scoped grants and mandatory one-time approval for destructive actions.
- A knowledge system with local RAG indexing and search, wiki ingestion, provenance, linting, review workflows, scheduled maintenance, and evaluation fixtures.
- Embedding support for OpenAI-compatible, Cohere, Jina, Nomic, and Voyage providers, plus Pinecone-backed document indexing and similarity search.
- Realtime voice conversations and dictation with OpenAI and xAI support, PCM capture/playback, and configurable realtime voice settings.
- Background microphone, camera, and screen recording tools with status and stop controls.
- App packages, isolated app windows, manifests, stores, import/delete flows, file watching, and app management settings.
- Built-in workspace editors for Mermaid, tldraw, and Excalidraw files, plus document, spreadsheet, presentation, PDF, and coding app/skill resources.
- Provider manifests and catalogs for models, bots, channels, storage, search, vector databases, and transactional email.
- Bot/channel integrations for Telegram and Discord, including credential-backed configuration, default channel selection, voice handling, and channel security.
- Task scheduling APIs and agent tools for creating, updating, pausing, resuming, deleting, listing, and immediately running tasks.
- MCP local-server import and registry support, server testing, secret handling, OAuth record isolation, and expanded MCP settings UI.
- New model adapters and catalog entries across text, speech, transcription, image, sound, video, and embedding services.
- Data archive and remote-purge controls, database APIs, workspace APIs, and cloud/storage management screens.
- New settings pages for general preferences, persona, permissions, data, cloud, apps, embeddings, RAG, realtime voice, provider keys, tasks, and wiki.
- Broader unit, integration, and end-to-end coverage for the agent runtime, permissions, sessions, providers, apps, channels, MCP, RAG, realtime voice, storage, settings, and media.

### Changed

- Reorganized the main process, preload bridges, shared API types, model adapters, agent tools, and settings routes into domain-focused modules.
- Consolidated model selection and provider credentials into shared stores and a manifest-driven provider catalog loaded at runtime.
- Renamed scheduled jobs from cron/schedules to tasks and recorder tools to explicit microphone, camera, and screen actions.
- Reworked onboarding and provider settings to configure models, bots, vector databases, and storage inline.
- Redesigned settings navigation around general, assistant, services, cloud, channels, and app groups.
- Moved agent workspaces to the assistant directory, stored sessions alongside the workspace, and standardized the persisted system prompt as `SYSTEM.md`.
- Routed model operations through the unified `window.models` preload API and channel/provider operations through the app API.
- Changed generated media to save into the active workspace by default and made storage push/pull operate as full replacement mirrors.
- Simplified channel configuration around provider credentials and a single default channel.
- Improved prompt editing, attachment handling, tool activity, permission prompts, message rendering, navigationbar behavior, audio/video players, and startup layout.
- Updated English and Italian translations for the new and reorganized settings, providers, channels, storage, wiki, and agent features.
- Updated dependencies, including the Model Context Protocol SDK, `marked`, `node-cron`, PostCSS, and ts-jest.

### Fixed

- Preserved main-window dimensions correctly when switching compact and regular layouts.
- Prevented startup-page horizontal overflow and corrected multiple settings navigation and vector database routes.
- Hardened plan output validation and reset goal composer state after submission.
- Corrected attachment persistence, interrupted conversation history, session recovery, and cancellation behavior.
- Fixed model context/input/output limits, retry timing, tool signal lifetime, and background tool execution.
- Corrected provider capability lookups, fallback model selection, realtime transcription errors, and embedding result labels.
- Fixed MCP OAuth persistence, secret filtering, import paths, form validation, and server record handling.
- Corrected channel credential lookup, default channel selection, security scoping, and Telegram/Discord behavior.
- Fixed recorder data URL parsing, device capture wiring, voice recording controls, and media playback edge cases.
- Corrected Pinecone upserts, RAG migration/indexing behavior, wiki transactions, storage endpoints, and synchronization paths.

### Removed

- Legacy projects and library features, routes, IPC APIs, tools, prompt context, navigation entries, and storage synchronization options.
- Legacy widgets in favor of apps.
- Per-model IPC/preload modules and per-kind model stores superseded by the unified models API and shared store.
- Legacy channels IPC/preload surfaces superseded by app-level channel and bot APIs.
- Legacy cron modules and tool names superseded by tasks.
- Obsolete policy settings and policy modules superseded by permissions and sandbox controls.
- Temporary Electron and Playwright driver scripts used during development.

[Unreleased]: https://github.com/HaraldBregu/kucedr/compare/v1.0.2...HEAD
[v1.0.2]: https://github.com/HaraldBregu/kucedr/releases/tag/v1.0.2
