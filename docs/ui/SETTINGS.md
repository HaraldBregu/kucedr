# Settings UI

Settings is Kucedr's configuration workspace after setup. It combines application preferences,
assistant and provider selection, background work, knowledge, permissions, messaging channels,
and integrations under `/settings`.

See [Home UI](HOME.md) for the conversation workspace and [Provider Reference](../PROVIDERS.md)
for the current provider and model catalog.

## Flow at a glance

```text
Open /settings
  -> redirect to /settings/general
  -> use the sidebar or route search to choose another page
  -> load that page's stored configuration and runtime status
  -> update a selection or form
       -> immediate settings: save on selection, toggle, or blur
       -> staged settings: use the page's Save action
  -> show saved, running, empty, or error feedback on the same page
  -> follow a breadcrumb to the parent page or Return to Chat
```

## Layout and navigation

Settings should use the same split-pane shell as Home, with a navigation sidebar and a scrollable
workspace below the application title bar.

- On desktop, the sidebar should be collapsible and resizable by pointer or keyboard. Its width is
  shared with Home and restored from local storage.
- On mobile, the sidebar should open in a left-side sheet.
- **Return to Chat** should navigate to `/home` and close the mobile sheet.
- The title bar should show breadcrumbs for deep Settings pages and expose route search.
- Pages should use a centered column, page header, compact sections, and shared loading, notice,
  empty-state, row, and panel components.

The visible sidebar is grouped as follows:

| Group        | Destinations                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------- |
| General      | Account, General, System, Cloud                                                                   |
| Assistant    | Agent, Coder |
| Providers    | Models, Search engines                                                                            |
| Channels     | Channels                                                                                          |
| Integrations | A2A agents, Apps                                                                            |

The `/settings` route redirects to `/settings/general`. The username link, title-bar user button,
Settings route-search item, and `Cmd+,` shortcut also open General directly.

## Route search and deep pages

The title-bar search button and `Cmd/Ctrl+F` should open **Search routes and settings** while Home
or Settings is active. The initial list shows the main routes; after at least two characters, the
search also matches individual settings by label, description, and keywords.

- `Cmd+,` should navigate directly to General settings on macOS.
- Search results should include deep pages such as Persona, provider API keys, individual model
  services, assistant data, and media permissions.
- Breadcrumbs should link detail pages back to their Settings parent.
- Legacy service and knowledge paths should redirect to their current nested routes.
- An unknown Settings route should use the application 404 recovery view.

## Saving and feedback

Settings uses both immediate and explicit persistence:

- Provider/model selectors, simple application preferences, channel policy changes, and many
  service choices save when changed.
- Permissions, Health, LLM Wiki, Cloud sync, MCP, A2A, and task capability forms provide explicit
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

### General

General should provide:

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

## Assistant and Coder

### Assistant

Assistant is the central model and behavior page. It should provide collapsible configuration for:

- the main chat provider, model, and verified model options;
- realtime conversation model and voice;
- read-aloud, image, audio, and video defaults;
- the active configured web-search engine.

Only search engines with stored credentials should be selectable. The same page should link to
Chat history, Health, Permissions, RAG, LLM Wiki, and Data management.

### Coder

Coder should show the Pi SDK runtime and allow selection of its provider, model, thinking level,
and read-only or coding tool mode. OpenAI Codex authentication should support connect, cancel, and
disconnect flows, including browser login or device-code feedback. Other providers should link to
model-provider credentials.

Coding tool mode should show a destructive warning. Missing provider credentials and load, save,
connect, or disconnect failures should remain visible.

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
  connection cards with external setup links, password inputs, and connected state.
- Unsupported catalog entries should be disabled as **Soon**.
- The searchable **API Keys** deep page should provide the model-provider credential list. The
  visible Models page can connect the same model credentials inline.

Pinecone is an internal RAG dependency configured with `PINECONE_API_KEY` in the main-process
environment. It should not appear as a provider, credential card, or database selection.

### Model service pages

Individual service pages should be reachable from Assistant or route search:

- **Transcribe** has independent streaming and batch speech-to-text selections plus a microphone
  transcription test.
- **Voice** has independent realtime-conversation and read-aloud configuration plus a synthesis
  test.
- **Image** and **Video** select a provider/model and generate a preview from a prompt.
- **Embedding** selects a provider/model and tests text input by reporting vector dimensions.
- **Audio** selects a provider/model, generates from a prompt, and lists saved audio with playback
  and native context-menu actions.

Verified provider input schemas can expose additional model options. Changing a model should clear
options that belonged to the previous model rather than carrying incompatible values forward.

## Cloud storage

Cloud should use the signed-in Kucedr account's private storage directly. It should not show an
infrastructure provider, profile selector, endpoint, bucket, or storage credentials.

Cloud should allow the user to:

- create or unlock a passphrase-protected vault and synchronize saved API keys;
- include known Kucedr folders and additional folders selected from the system picker;
- select an automatic sync interval or edit the cron expression;
- save or cancel sync changes;
- run a backup immediately;
- confirm and run a restore;
- inspect save, backup, restore, and failure status inline.

Secure key sync, backup, and restore require a fully signed-in account. Recovery sessions cannot
use them. Remote files are isolated below the account's private backup path; folder selections and
schedules remain local application settings.

## Knowledge and data

### RAG

RAG should configure enablement, consent for the selected remote embedding model, embedding model,
index name, and one or more source folders. It should support indexing now,
scheduled indexing presets, an inline retrieval test with scored matches, and export or purge
controls for local and remote RAG scopes.

### LLM Wiki

LLM Wiki should configure enablement, automatic answer filing, review requirements, startup linting,
provider/model, source and output folders, and an automation schedule. It should provide explicit
**Save**, **Run now**, and **Cancel** actions, live compiler progress, last/next-run status, pending
review count, an output-folder action, and Wiki export or purge controls.

### Conversation and data management

Chat history should list stored sessions with dates and confirm before deleting one. Data
management should expose memory and session export or purge actions. RAG and Wiki own the equivalent
controls for their data scopes.

## Skills and apps

Skills should open the skills folder, refresh discovery, import from a selected file or folder, and
show imported/skipped feedback. A skill detail page should show its manifest, trust, hash, format,
compatibility, allowed tools, resources, loaded instructions, and diagnostics. It should also allow
download and confirmed deletion.

Apps should open the apps folder, refresh discovery, import apps, and show each
app's category and detail metadata. The list should allow deletion and surface a failed delete;
the detail page should open the app in its own window.

Apps do not currently expose enable/disable controls in Settings.

## MCP servers and A2A agents

### MCP servers

MCP settings should combine cataloged remote services, configured remote servers, and imported
local packages. The page should open the MCP folder, refresh discovery, upload local packages, and
add HTTP or local-command servers.

Server details should support test, enable/disable, edit, OAuth where configured, approval policy,
deferred-loading preference, and confirmed removal of configured servers. Local package changes
should be written to that package's `mcp.json`; configured server changes should be written to
Kucedr settings. Registry and connection diagnostics should remain visible.

### A2A agents

A2A settings should add and edit remote Agent2Agent-compatible agents. It should validate the base
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

- keep the agent workspace visibly trusted for read, write, and execution;
- add trusted or blocked directories from manual input or a folder picker;
- apply each directory to selected read, write, and execution kinds;
- normalize and deduplicate saved paths;
- prevent blocking the workspace or a directory inside it;
- remove custom locations;
- save the edited policy or reset it to defaults.

## Loading, errors, and current limitations

- Route-level lazy loading should use the Settings page skeleton, while individual pages use rows,
  empty states, and inline notices for their own asynchronous work.
- Detail routes should show a useful missing-item state or return to their parent when an ID is not
  valid.
- There is no unified image/video/audio Library route in Settings. Only the Audio service page has
  a saved-output library.
- Data-control **Purge** does not show a renderer confirmation dialog; it immediately performs the
  backend preview-token and purge sequence.
- Permissions **Reset** and app deletion are immediate and do not request confirmation.
- A2A deletion has no confirmation or inline failure handling.
- Ordinary Settings links do not close the mobile sidebar sheet after navigation; **Return to
  Chat** does.
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
- [General settings](../../src/renderer/src/pages/settings/pages/general/Page.tsx)
- [Assistant settings](../../src/renderer/src/pages/settings/pages/assistant/Page.tsx)
- [Provider settings](../../src/renderer/src/pages/settings/pages/providers/Page.tsx)
- [Cloud storage settings](../../src/renderer/src/pages/settings/pages/cloud/Page.tsx)
- [Task settings](../../src/renderer/src/pages/settings/pages/tasks/Page.tsx)
- [System media settings](../../src/renderer/src/pages/settings/pages/system/)
- [Knowledge settings](../../src/renderer/src/pages/settings/pages/rag/Page.tsx)
- [Wiki settings](../../src/renderer/src/pages/settings/pages/wiki/Page.tsx)
- [Permissions settings](../../src/renderer/src/pages/settings/pages/permissions/Page.tsx)
- [Channel settings](../../src/renderer/src/pages/settings/pages/channels/Page.tsx)
- [MCP settings](../../src/renderer/src/pages/settings/pages/mcp/Page.tsx)
- [A2A settings](../../src/renderer/src/pages/settings/pages/a2a/Page.tsx)
- [General settings tests](../../tests/unit/renderer/general-settings.test.tsx)
- [Assistant settings tests](../../tests/unit/renderer/assistant-settings.test.tsx)
- [Provider settings tests](../../tests/unit/renderer/providers-settings.test.tsx)
- [Permissions settings tests](../../tests/unit/renderer/permissions-settings.test.tsx)
- [RAG settings tests](../../tests/unit/renderer/rag-settings.test.tsx)
- [Wiki settings tests](../../tests/unit/renderer/wiki-settings.test.tsx)
