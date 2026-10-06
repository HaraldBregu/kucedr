# Settings UI

Settings is Kucedr's configuration workspace after setup. It combines application preferences,
assistant and provider selection, background work, knowledge, permissions, messaging channels,
and integrations under `/settings`.

See [Home UI](HOME.md) for the conversation workspace and [Provider Reference](../PROVIDERS.md)
for the current provider and model catalog.

## Flow at a glance

```text
Open /settings
  -> redirect to /settings/settings
  -> use the sidebar or route search to choose another page
  -> load that page's stored configuration and runtime status
  -> update a selection or form
       -> immediate settings: save on selection, toggle, or blur
       -> staged settings: use the page's Save action
  -> show saved, running, empty, or error feedback on the same page
  -> follow a breadcrumb to the parent page or Return to Home
```

## Layout and navigation

Settings should use the same split-pane shell as Home, with a navigation sidebar and a scrollable
workspace below the application title bar.

- On desktop, the sidebar should be collapsible and resizable by pointer or keyboard. Its width is
  shared with Home and restored from local storage.
- On mobile, the sidebar should open in a left-side sheet.
- **Return to Home** should navigate to `/home` and close the mobile sheet.
- The title bar should show breadcrumbs for deep Settings pages and expose route search.
- Pages should use a centered column, page header, compact sections, and shared loading, notice,
  empty-state, row, and panel components.

The visible sidebar is grouped as follows:

| Group      | Destinations                                              |
| ---------- | --------------------------------------------------------- |
| General    | Account, Settings, Storage, Providers, Library, Workspace |
| Assistant  | Agent, Voice, Tasks, Health, Skills, MCP                  |
| Brain      | Memory, Knowledge                                         |
| Extensions | Plugins, Apps, Channels, Remote Agents                    |

The `/settings` route redirects to `/settings/settings`. The username link, title-bar user button,
Settings route-search item, and `Cmd+,` shortcut also open Settings directly.

## Route search and deep pages

The title-bar search button and `Cmd/Ctrl+F` should open **Search routes and settings** while Home
or Settings is active. The initial list shows the main routes; after at least two characters, the
search also matches individual settings by label, description, and keywords.

- `Cmd+,` should navigate directly to Settings on macOS.
- Search results should include deep pages such as Persona, provider API keys, individual model
  services, assistant data, and media permissions.
- Breadcrumbs should link detail pages back to their Settings parent.
- Legacy service and knowledge paths should redirect to their current nested routes.
- An unknown Settings route should use the application 404 recovery view.

## Saving and feedback

Settings uses both immediate and explicit persistence:

- Provider/model selectors, simple application preferences, channel policy changes, and many
  service choices save when changed.
- Permissions, Health, Storage sync, MCP, A2A, and task capability forms provide explicit
  save or submit actions where multiple values belong together.
- Provider secrets should use password inputs and display a masked connected state after saving.
- Pages should disable conflicting controls while loading, saving, testing, importing, running, or
  deleting.
- Load and save failures should remain on the related page as destructive notices or inline model
  configuration errors.

## Account, application, and appearance

### Account

Account should show local or signed-in status and the current email when available. Local users can
start sign-in; signed-in users can sign out and continue using Kucedr on the device. A sign-out
failure should appear inline.

### Settings

Settings should provide:

- the application name and version;
- tray or menu-bar visibility;
- keep-awake behavior for the computer and display;
- actions to open the application-data and user-data folders;
- English or Italian language selection;
- light, dark, or system theme selection.

The Persona detail page is a preview, not a persistent editor. It should let the user inspect the
idle, listening, thinking, and speaking visual states.

## System media

System should link to separate Microphone, Camera, and Screen capture pages.

- Microphone and Camera should show the operating-system permission status when available, request
  access, and open the related system settings pane.
- Screen capture should open the operating-system screen-recording settings pane.
- Each page should provide a capture test. Microphone records audio; Camera and Screen show a live
  preview and record video.
- After a recording, the page should provide playback and a retry action.
- Permission and capture failures should stay visible on the detail page.

On platforms where explicit operating-system status is unavailable, permission status may remain
unknown. Screen testing uses the display source supplied by Electron and does not provide an
additional Kucedr source picker.

## Assistant and Voice

### Assistant

Assistant is the central model and behavior page. It should provide collapsible configuration for:

- the main chat provider, model, and verified model options;
- realtime conversation model and voice;
- read-aloud, image, audio, and video defaults;
- the active configured web-search engine.

Only search engines with stored credentials should be selectable. The same page should link to
Chat history, Health, Permissions, Knowledge, and Data management.

### Voice

Voice settings configure realtime conversation and provide access to voice history and tool settings. Coding is currently marked **Soon** in the navigation catalog, and `/code` and `/settings/code` redirect to Workspace.

## Background tasks and Health

Background tasks should select a dedicated provider and model, then list stored schedules with
their prompt or message, cron expression, and enabled state. Selecting a task should open its
detail page.

Task details should show the schedule metadata and provide:

- **Run now**;
- confirmed deletion;
- the agent prompt, when applicable;
- enabled state and a comma-separated tool allowlist for agent tasks.

Task creation and cron editing are not direct Settings forms; they remain agent-driven.

Health should configure its provider and model, interval, output target, direct-message policy,
active date range, and `HEALTH.md` checklist. Model changes save immediately; the remaining values
and checklist use the page's Save action. Off, one-minute, 30-minute, and one-hour interval choices
are available.

The current Health UI uses calendar dates for the active range rather than times of day. Its target
selector can choose none, the last active session, or preserve an already-stored custom target; it
cannot introduce a new session ID.

## Providers and model services

See [Provider Reference](../PROVIDERS.md) for exact runtime coverage and model IDs.

### Provider connections

- **Models**, **Search engines**, and **Channels** should list their catalog providers as
  connection cards with external setup links, API-key inputs, and connected state.
- Unsupported catalog entries should be disabled as **Soon**.
- The searchable **API Keys** deep page should provide the model-provider credential list. The
  visible Models page can connect the same model credentials inline.

**Database** stores the user's database account credentials in local provider settings. The Knowledge
page requires an explicit database selection and uses that account for remote storage. Pinecone
is currently supported; there is no default database selection or environment API key fallback.
Embedding credentials are configured separately under **Providers → Models**. Both remote
disclosures must be approved before indexing.

### Model service configuration

Agent settings configures the assistant, realtime conversation, transcription, read-aloud,
image, audio, video, and web search. The embedding model is selected in Knowledge. The current router has no dedicated Music, Video, or Image studio routes.

Verified provider input schemas can expose additional model options. Changing a model should clear
options that belonged to the previous model rather than carrying incompatible values forward.

## Storage

Configure storage accounts under **Providers → Storage**, then select a provider in **Storage**.
Storage configures local folders, automatic backup intervals, manual backup, and confirmed restore.
It displays operation progress and errors. The current storage runtime uses the selected provider;
account sign-in is separate from this backup configuration. See [Cloud architecture](../CLOUD.md).

## Knowledge and data

### Memory

Memory settings enable or disable automatic memory processing and select its provider, model, model options, and memory type (**Facts**, **Summaries**, or **Both**). Changes save shortly after selection. Memory content is maintained by the memory module; this page is configuration, not a memory-file editor.

### Knowledge

Knowledge should configure enablement, consent for the selected remote embedding model, embedding model,
index name, and one or more source folders. It should support indexing now,
scheduled indexing presets, an inline retrieval test with scored matches, and export or purge
controls for local and remote knowledge scopes.

### Conversation and data management

Chat history should list stored sessions with dates and confirm before deleting one. Data
management should expose memory and session export or purge actions. Knowledge owns the
equivalent controls for its data scopes.

## Library and Workspace

Library offers Collections and List views of local files. Users can create folders, upload, sort, select, move, download, preview, and delete files. Its preview supports images, audio, video, PDFs, and other supported content. Workspace shows agent workspace files, supports file and folder actions, and edits Markdown in Text or Raw view. See [Apps](../APPS.md#workspace) for Workspace behavior.

## Skills and apps

Skills should open the skills folder, refresh discovery, import from a selected file or folder, and
show imported/skipped feedback. A skill detail page should show its manifest, trust, hash, format,
compatibility, allowed tools, resources, loaded instructions, and diagnostics. It should also allow
download and confirmed deletion.

Apps opens the apps folder, refreshes discovery, imports apps, and registers external development
folders through Debug. Cards expose separate **Details**, **Open**, and **Delete** actions; the
card itself does not navigate. Details configures the app window. See [Apps](../APPS.md) for
registration, removal, and data behavior.

Apps do not currently expose enable/disable controls in Settings.

## MCP servers and remote agents

### MCP servers

MCP settings combine configured remote and command servers with discovered local packages. The
page lets users add HTTP or local-command servers. Local packages placed under
`~/.kucedr/mcp/servers` appear when the registry is read; the current page has no folder-opening,
manual refresh, or upload control.

Server details support test, enable/disable, edit, OAuth where configured, approval policy,
and confirmed removal of configured servers. The stored deferred-loading value is retained but
has no editable control. Local package changes
should be written to that package's `mcp.json`; configured server changes should be written to
Kucedr settings. Registry and connection diagnostics should remain visible.

### Remote agents

Remote agent settings should add and edit Agent2Agent-compatible agents. It should validate the base
URL while saving and support no authentication, bearer token, API-key header, or OAuth
`private_key_jwt`, plus enabled state. Stored secrets should never be loaded back into the edit
form; a blank secret retains the existing credential.

Saved entries should show their URL, advertised skills, enabled state, and credential status.

## Channels

Channels should configure shared reply, batch speech-to-text, and text-to-speech provider/model
selections, then list the channel services returned by the runtime catalog.

Each channel detail page should save its bot token, direct-message policy, direct-sender allowlist,
and group or channel allowlist. Tokens save on blur; allowlist values can be added with Enter or the
add action and removed individually.

The current channel UI does not expose enable/disable or live runtime-status controls, even though
those terms remain searchable.

## Permissions and sandbox

Permissions should show sandbox readiness, allow a status recheck, and offer Windows setup when
required. Filesystem policy should:

- show the agent workspace as trusted by default for read, write, and execution, while explicit deny rules can still override that default;
- add trusted or blocked directories from manual input or a folder picker;
- apply each directory to selected read, write, and execution kinds;
- normalize and deduplicate saved paths;
- apply deny rules before allow rules when a path matches both;
- remove custom locations;
- save the edited policy or reset it to defaults.

## Loading, errors, and current limitations

- Route-level lazy loading should use the Settings page skeleton, while individual pages use rows,
  empty states, and inline notices for their own asynchronous work.
- Detail routes should show a useful missing-item state or return to their parent when an ID is not
  valid.
- The current router has no dedicated Image, Video, or Audio studio pages; media model selection lives in Agent settings and local output is browsed in Library.
- Data-control **Purge** does not show a renderer confirmation dialog; it immediately performs the
  backend preview-token and purge sequence.
- Permissions **Reset** is immediate. Managed app deletion requests native confirmation.
- A2A deletion has no confirmation or inline failure handling.
- Ordinary Settings links do not close the mobile sidebar sheet after navigation; **Return to
  Home** does.
- Some setting-specific search entries still route search-engine and scheduled-task queries to
  broader pages instead of their newer provider or task pages.
- Some model selectors display the first catalog option as a fallback without persisting it until
  the user makes an explicit change.
- Staged pages do not warn before navigation with unsaved drafts.
- Some optimistic application, assistant-option, channel, and folder actions do not surface a
  failure or restore the prior value.
- Local-command MCP arguments are split on whitespace, so quoted arguments are not preserved.
- Some Account, MCP, A2A, and provider copy remains hardcoded in English while most Settings copy
  uses the translation catalogs.

## Implementation reference

- [Settings routes](../../src/renderer/src/router.tsx)
- [Navigation catalog](../../src/renderer/src/pages/settings/navigation.ts)
- [Settings layout](../../src/renderer/src/pages/settings/Layout.tsx)
- [Settings sidebar](../../src/renderer/src/pages/settings/Sidebar.tsx)
- [Shared Settings components](../../src/renderer/src/pages/settings/components/index.tsx)
- [Settings](../../src/renderer/src/pages/settings/pages/settings/Page.tsx)
- [Assistant settings](../../src/renderer/src/pages/settings/pages/assistant/Page.tsx)
- [Provider settings](../../src/renderer/src/pages/settings/pages/providers/Page.tsx)
- [Storage settings](../../src/renderer/src/pages/settings/pages/storage/Page.tsx)
- [Task settings](../../src/renderer/src/pages/settings/pages/tasks/Page.tsx)
- [System media settings](../../src/renderer/src/pages/settings/pages/settings/media/)
- [Knowledge settings](../../src/renderer/src/pages/settings/pages/knowledge/Page.tsx)
- [Permissions settings](../../src/renderer/src/pages/settings/pages/permissions/Page.tsx)
- [Channel settings](../../src/renderer/src/pages/settings/pages/channels/Page.tsx)
- [MCP settings](../../src/renderer/src/pages/settings/pages/mcp/Page.tsx)
- [Remote agent settings](../../src/renderer/src/pages/settings/pages/remote-agent/Page.tsx)
- [Settings tests](../../tests/unit/renderer/settings-page.test.tsx)
- [Assistant settings tests](../../tests/unit/renderer/assistant-settings.test.tsx)
- [Provider settings tests](../../tests/unit/renderer/providers-settings.test.tsx)
- [Permissions settings tests](../../tests/unit/renderer/permissions-settings.test.tsx)
- [Knowledge settings tests](../../tests/unit/renderer/knowledge-settings.test.tsx)
