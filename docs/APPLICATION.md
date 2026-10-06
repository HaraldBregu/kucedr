# Kucedr application guide

Kucedr is a desktop AI assistant for conversations, tools, local work, web research, media, and automation. It also opens separate app windows for focused workflows. This guide covers the current repository implementation; see the [apps guide](APPS.md) for those windows and the [feature reference](FEATURES.md) for detailed capabilities.

## Get started

Use a packaged desktop release, or follow [Development](DEVELOPMENT.md) to run from source. Model requests require credentials for a supported provider and network access. A Kucedr account is optional; local-only mode still sends requests to the providers you configure.

1. Open Kucedr and select **Get started**.
2. Sign in, create an account, or choose **Skip and continue**.
3. Save a model-provider API key in the Model stage. Typing a key without saving does not complete this step.
4. Optionally connect a search provider.
5. Select the assistant provider and model, then finish setup. Voice, transcription, media, and search selections are optional.
6. Send a short message in Home and verify that a response arrives.

Setup checks whether an assistant provider and model are stored; it does not prove that the credentials work. If the first request fails, check the saved key, model selection, and provider access. [Start page](ui/START.md) explains returning-user and password-recovery behavior.

## Find your way around

Home contains the conversation, composer, session sidebar, and tool activity. Settings contains preferences, service configuration, Library, Memory, and Workspace. Use the title-bar search to find deeper pages and **Return to Home** to resume the conversation.

| Area                 | What to configure or inspect                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Account              | Sign-in state and sign out                                                                           |
| Settings and Persona | Language, theme, tray behavior, keep-awake preferences, app data, device tests, and voice appearance |
| Agent and Voice      | Assistant, speech, search, and media model selections; voice configuration and history               |
| Providers            | Model and search credentials, database accounts, and storage providers                               |
| Storage              | Selected storage provider, folders, backup schedule, backup, and restore                             |
| Library              | Collections or list view, upload, preview, move, download, and delete local files                    |
| Workspace            | Browse agent files; create, rename, and delete entries; edit Markdown                                |
| Memory               | Enable memory, select its model and type                                                             |
| Channels             | Telegram bot credentials, sender policies, and channel model choices                                 |
| Integrations and MCP | External service connections and tool servers                                                        |
| A2A                  | Remote Agent2Agent-compatible agents                                                                 |
| Apps                 | Import, inspect, open, remove, or register external apps                                             |

From Agent or route search, open Tools, Skills, Tasks, Chat History, Knowledge, Health, and Permissions. The Coding entry is marked **Soon**; `/code` redirects to Workspace. The [Settings reference](ui/SETTINGS.md) explains save behavior and routes.

## Conversations and tools

Start a new chat or select an existing session in the sidebar. Enter a request and send it; while a run is active, use Stop to cancel. Tool activity shows what the assistant requested, its inputs, output, and errors. Expand a tool row when you need to inspect an action.

Attach files through the composer. Queued files remain with the session as drafts and submitted files appear in the conversation. The current composer does not check model capability, file type, or size before sending; an unsupported file can fail during processing.

For work that needs planning, use `/plan`. For a persistent objective, use `/goal <objective>`; pause, resume, or clear it with the corresponding `/goal` command. A goal belongs to its conversation. Review inline questions and permission requests when they appear.

Chat history persists locally. Rename, clear, compact, open the folder for, or delete a session from its sidebar context menu. Clear, compact, and delete require confirmation. Chat History in Settings also offers confirmation-backed deletion. See [Home](ui/HOME.md) for exact composer, transcript, and session behavior.

### Permissions

Review Permissions before asking the assistant to change files or run commands outside its workspace. Policies distinguish read, write, and execution locations; explicit deny rules take precedence. Interactive requests can offer **Allow once**, **Deny**, or a persistent location grant where supported.

Background tasks cannot stop to ask for approval: an operation requiring an interactive decision is denied. OS device permissions and command sandbox readiness remain separate from tool enablement. Disabling a tool is also different from denying a filesystem location.

### Personalization and memory

The agent workspace can hold `IDENTITY.md`, `SOUL.md`, `USER.md`, `HEALTH.md`, and `BOOTSTRAP.md`. Profile files are created when their corresponding profile is saved. Kucedr generates `AGENTS.md` from the completed identity, soul, and user profiles; edit those source profiles through their update tools rather than editing `AGENTS.md`. `HEALTH.md` supplies the health checklist. Durable memory is managed separately under `~/.kucedr/memory`.

Memory is captured and updated asynchronously from saved conversations. You can ask the assistant to correct or forget a fact; a forget request takes effect after the memory module processes the saved conversation. Use **Settings → Memory** to enable memory and select its model and type. Memory, conversation history, and folder indexing are separate stores; deleting one does not imply deleting all of them.

## Voice and generated media

Configure transcription for dictation, text-to-speech for reading responses aloud, and a compatible realtime model for spoken conversations. These are independent selections.

1. Open Agent settings and select the required speech models.
2. Use System settings to check microphone access and grant OS permission if prompted.
3. Dictate into the composer and confirm the transcript, or start a Voice session from the empty composer.
4. End the Voice session to release capture and playback resources.

For images, music/audio, or video, connect a supported provider and select its media model in Agent settings, then ask the assistant in chat. Agent-generated media appears inline and is saved to Library; supported context-menu actions open, reveal, or save local output. A catalog entry alone does not establish an implemented generation adapter: consult [Providers](PROVIDERS.md).

Camera and screen tests live under System. On macOS, changing Screen Recording permission may require quitting and reopening the same installed app. Development and packaged apps can have different permission identities.

## Tasks and health checks

Ask the assistant to create a scheduled task with a clear prompt and schedule. Open Tasks to verify the saved cron expression, enabled state, and selected task model. Open its detail page to run it now, change its enabled state or tool allowlist, or delete it. Creating schedules and editing their prompts or cron expressions remains agent-driven.

Health runs execute the `HEALTH.md` checklist at the configured interval. Select a model, set the interval and active range, write the checklist, and save. Empty or heading-only checklists are skipped. A response of `HEALTH_OK` means no attention is needed; other responses are logged. Some stored health delivery options are not consumed by the runner; see [Health limitations](FEATURES.md#periodic-health-checks).

Keep Kucedr running for its in-process schedulers to execute. Verify an automation with **Run now** where available and inspect its resulting session or logs before relying on it unattended.

## Knowledge and folder retrieval

Folder retrieval, also called retrieval-augmented generation (RAG), indexes selected local folders and returns relevant passages to the agent. It complements memory and conversation history; these are not interchangeable backups. The current query tool uses folder retrieval, not a separate Markdown wiki compiler.

To configure folder retrieval:

1. Connect the supported database account in Providers and an embedding provider in Models.
2. Open Knowledge and explicitly select the database and embedding model.
3. Set the index name and choose source folders with the folder picker.
4. Enable indexing and approve the displayed embedding and remote-mirror disclosures for those selections.
5. Index the folders, inspect the result, and use the search field to verify expected passages and paths.
6. Enable an indexing schedule only after the manual run succeeds.

Retrieval queries search a local SQLite index after sending the query to the selected embedding service. Indexing can send source text to the embedding provider and mirror data remotely; changing the selected recipient can require renewed consent. Export and purge controls are scoped to the displayed local or remote data. Read the selected scope before using Purge.

## Connect external capabilities

### Skills, plugins, and MCP

Skills provide instructions and resources the agent can load. Import them from the Skills page and inspect their details and diagnostics. A plugin can package skills, apps, MCP servers, and provider definitions; installation and manifest rules are documented in [Plugins](PLUGINS.md).

Model Context Protocol (MCP) servers expose tools through remote HTTP or local commands. Add or import a server, configure its credentials, test the connection, and inspect its tools before relying on it. Authentication depends on the server. The Integrations page offers shortcuts for catalog services; enabling a shortcut is not proof that authentication or tool execution succeeded. Turning an integration off removes its configured MCP entry.

### Remote agents

In A2A, choose **Add agent**, enter its base URL and authentication information, and use **Validate and save**. Successful validation lists the remote agent and its advertised skills. Editing with a blank secret retains the existing credential. Delegated work is sent to the configured remote service.

### Telegram

Open Channels, configure the reply and optional speech models, then open Telegram and save the bot token and sender policies. Restrict direct senders and groups as needed. Test with an allowed sender and inspect the resulting reply. The current detail screen does not expose a runtime enable/disable switch or live connection-status controls.

## Data, backup, and privacy

Kucedr stores its profile under `~/.kucedr` (the user's home directory on each platform). Settings can open application data. See [Architecture](ARCHITECTURE.md) for the storage map.

Configure a storage provider in **Providers → Storage**, select it in **Storage**, choose folders and a schedule, and run a backup. Review operation status for transferred files or errors. Restore requires confirmation and can overwrite matching local files; preserve any local versions you need before restoring. Storage-provider backup is separate from account authentication; see [Cloud architecture](CLOUD.md).

Prompts, selected files, tool inputs, and generated data can leave the device through configured model providers, search engines, MCP servers, remote agents, channels, and storage. Local-only account mode does not make these services offline. Secrets are handled by their respective main-process stores; do not treat the entire profile directory as encrypted.

## Troubleshooting

| Symptom                            | Check                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Setup finishes but chat fails      | Saved provider key, supported assistant model, network access, and the returned provider error       |
| A tool is unavailable              | Tools settings, enabled skill/MCP configuration, connection diagnostics, and run-specific allowlists |
| A file or command action is denied | Target paths, explicit deny rules, sandbox readiness, and whether the run can request approval       |
| Dictation or voice fails           | Correct service model, microphone access in both Kucedr and the OS, and the inline error             |
| Indexing is disabled               | Enabled state, explicit database, embedding model, folders, index name, and matching disclosures     |
| Backup controls are unavailable    | Selected storage provider, its credentials, and current operation/loading status                     |
| An app is missing or will not open | Valid manifest, built entry file, import/debug registration, and the Apps error; see [Apps](APPS.md) |
| Scheduled work does not run        | Kucedr is running, task enabled state, cron configuration, model access, and background permissions  |

For development failures, follow [Development](DEVELOPMENT.md). For a security issue, follow [Security](../SECURITY.md).

## Implementation references

- [Routes](../src/renderer/src/router.tsx) and [Settings navigation](../src/renderer/src/pages/settings/navigation.ts)
- [Assistant settings](../src/renderer/src/pages/settings/pages/assistant/Page.tsx)
- [Folder retrieval settings](../src/renderer/src/pages/settings/pages/knowledge/Page.tsx)
- [Storage controls](../src/renderer/src/pages/settings/pages/storage/Page.tsx)
- [Health execution](../src/main/health/run.ts)
- [Agent knowledge implementation](../src/main/agent/knowledge/)
