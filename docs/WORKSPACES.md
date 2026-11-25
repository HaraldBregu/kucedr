# Multiple workspaces plan

Status: proposal. Nothing here is implemented. Today there is one workspace, fixed at
`~/.kucedr/workspace` ([agent_location.ts](../src/main/shared/agent_location.ts)).

## Goal

Users can create several named workspaces, each with an optional image, and work in them side by
side:

- **A workspace is a case.** Everything that holds its content stays inside it: files, chats,
  Library, memory, knowledge, browser sign-ins, scheduled tasks and file-access grants. Setup stays
  shared.
- **A workspace can use any folder.** The user can create a workspace from a folder anywhere on
  disk. Its files stay where they are, and Kucedr keeps the workspace's chats, memory and the rest
  in its own data folder.
- **Each window has its own workspace.** Two windows can show two workspaces at once. Switching a
  window only changes that window.
- **Nothing in flight is interrupted.** A chat that is streaming, running tools or waiting for an
  approval keeps going in the workspace it started in when its window switches away.
- **Settings can differ per workspace.** The default workspace uses the global settings unchanged.
  Another workspace can override some of them, starting with the agent's provider and model.

This matches [PRODUCT.md](mission/PRODUCT.md) ("separate everything: files, chats, memory, knowledge,
sign-ins") and items 10.1–10.3 of [roadmap/WORKSPACES.md](roadmap/WORKSPACES.md).

## What a workspace owns

| Per workspace                                    | Shared                                          |
| ------------------------------------------------ | ----------------------------------------------- |
| Files                                            | Providers, keys, model catalog                  |
| Chats of every kind (main, voice, task, subagent) | Plugins, skills                                 |
| Library (captures, screenshots, recordings, media) | MCP servers and tokens                          |
| Memory content and memory state                  | USER, SOUL, IDENTITY                            |
| Knowledge folders, consent and index             | Memory and knowledge provider/model setup       |
| Browser partition, history, passwords, bookmarks, tabs | App settings, theme, language, lock, tray  |
| Scheduled tasks                                  | Vault key, backup account                       |
| "Always allow" file rules                        | Health checklist (runs in the default workspace) |
| Setting overrides (see below)                    |                                                 |

Chats cannot stay shared. A chat stores its workspace in its own history: `SYSTEM.md` holds the
absolute workspace path, every run context lists the root and its top-level files, and tool results
return absolute paths. Reopened in another workspace, it sends those to the model while relative
tool paths resolve against the other workspace's files.

The Library cannot stay shared either. Browser screenshots, recordings and generated media are
saved there without a prompt, and [PRODUCT.md](mission/PRODUCT.md) §5 ties every capture to a case.

Memory cannot stay shared. Every durable `MEMORY.md` line is injected into every main turn
([memory/prompt.ts](../src/main/memory/prompt.ts)), and the memory folder also keeps a plain-text copy
of every chat.

## Layout

One folder per workspace. The default workspace's root is `~/.kucedr` itself, so existing data
does not move.

| Store       | Default workspace           | Other workspaces                       |
| ----------- | --------------------------- | -------------------------------------- |
| Files       | `~/.kucedr/workspace`       | `~/.kucedr/workspaces/<id>/files`, or the folder the user picked |
| Chats       | `~/.kucedr/sessions`        | `~/.kucedr/workspaces/<id>/sessions`   |
| Library     | `~/.kucedr/library`         | `~/.kucedr/workspaces/<id>/library`    |
| Memory      | `~/.kucedr/memory`          | `~/.kucedr/workspaces/<id>/memory`     |
| Knowledge   | `~/.kucedr/rag`             | `~/.kucedr/workspaces/<id>/rag`        |
| Browser     | `~/.kucedr/browser`         | `~/.kucedr/workspaces/<id>/browser`    |
| Partition   | `persist:agent-browser`     | `persist:agent-browser-<id>`           |
| Overrides and rules | `settings/*.json` (unchanged) | `~/.kucedr/workspaces/<id>/settings/` |

`sessionsRoot(location)` already returns the sibling `sessions` folder of the files folder
([session_sessions_root.ts](../src/main/agent/session/session_sessions_root.ts)), so chats split with no
change to it or its callers. Never nest workspace folders under `sessions/`: `listSessions` treats
every UUID folder there as a chat.

The registry lives in `~/.kucedr/workspaces/workspaces.json`, inside the backed-up folder, so a
restore brings names back:

```json
{
	"workspaces": [
		{
			"id": "0f8b6c1e-52a7-4c3e-9d41-7a1c2e6b90d3",
			"name": "Client work",
			"image": "6d2e9a40-1b7c-4f35-8e02-c94d7f1a3b68.png"
		}
	]
}
```

- The default workspace is implicit: id `default`, named "Personal", never written to the file.
- **IDs** come from `crypto.randomUUID()` and are never shown.
- **Names** are trimmed, 1–64 characters, and unique ignoring case.
- **Invalid data:** an ID must be `default` or a UUID before it is joined into a path. Unknown or
  invalid IDs are rejected.
- **Missing file:** only the default workspace exists, so existing installs need no migration.

## The workspace value

A new `src/main/workspaces/` module resolves an ID into one frozen value:

```ts
interface Workspace {
	readonly id: string;
	readonly root: string;
	readonly files: string;
	readonly sessions: string;
	readonly library: string;
	readonly memory: string;
	readonly rag: string;
	readonly browser: string;
	readonly partition: string;
}
```

There is **no process-wide active workspace**. Every piece of code gets its workspace from exactly
one of these places:

| Caller                     | Workspace comes from                                      |
| -------------------------- | --------------------------------------------------------- |
| An agent run and its tools | The run, frozen when it is admitted                        |
| An IPC call from a window  | The window's context, or the ID the renderer sent with it |
| A scheduled task           | The schedule                                              |
| A voice call               | The voice window, frozen when the call starts             |
| Health, tray, setup, deep links | `default`                                            |

`agentLocation()`, `libraryLocation()`, `memoryPath()` and `ragLocation()` lose their global meaning.
Each takes a workspace, or is replaced by a field on it.

## Runs keep their workspace

`Agent.send()` takes `workspaceId`, resolves the workspace once, and stores a run `Config`
(`{ location: ws.files, workspace: ws }`) on the run record. Everything the run does reads that value:

- **Run loop:** session directory, init, stream, subagents and the post-run memory capture use the
  record's config, never `Agent.config`. A run queued in the scheduler still starts in its own
  workspace.
- **Tools:** `ExecutionScope` and the tool security context get a required `workspace`. A new
  `currentWorkspace()` reads it from the scope and **throws outside a scope**, so a leftover global
  read fails loudly. `parseInput` moves inside `executionScope.run` in
  [run_tool_call.ts](../src/main/agent/runner/run_tool_call.ts).
- **Files and bash:** read, write, edit, patch and bash resolve against `currentWorkspace().files`.
- **Media:** `mediaDirectory`, `saveMedia` and `mediaAccess` take the workspace. Generation that
  finishes after a switch saves into the run's own Library.
- **Memory:** `memoryFor(ws)` is a lazy map of memory services, each bound to `ws.memory` for its
  store, sources scan and settings state. The run gets its instance at admit time.
- **Knowledge:** `query_knowledge` and index jobs are bound to `ws.rag`. Every
  `getRagConfiguration()` and `assertRagCurrent()` in the run and job paths takes that root, so a
  job is never compared against another workspace's settings.
- **Browser:** tabs carry `workspace` and are created in `ws.partition`. Popups inherit the opener's
  workspace. Tab listing, `targetId` lookups and `shown()` only match the run's workspace. History,
  passwords and bookmarks are cached per workspace.
- **Permissions and sandbox:** `getPermissions(ws)`, `addPermissionRule(ws, …)`,
  `protectedRoots(ws)` and `isBroadTarget(t, ws)`. The check after an approval wait uses the same
  workspace as the first check.
- **Deferred session operations** (edit, clear, delete) capture the session's config and memory
  instance before `scheduler.run`. They often run after the window has switched.
- **Profile tools:** the legacy `USER.md`, `SOUL.md` and `IDENTITY.md` fallbacks in
  [user/get.ts](../src/main/user/get.ts) and its siblings are pinned to the default workspace's files.

The renderer sends the `workspaceId` it showed **when the user acted** with every session-scoped
call (send, follow-up, edit, rename, pin, delete, compact, snapshot). Main resolves the workspace
from that ID, never from the window's current one, and rejects the call if the session is not in
that workspace. A prompt typed in A therefore runs in A, even if the window switched while
attachments were being read.

## Switching a window

1. The renderer calls `workspaces.select(id)`. Main validates the ID, updates
   `WindowContext.workspaceId` and sends `currentChanged` to that window only.
2. Main ensures the workspace's folders exist and lazily starts its file watcher, sessions
   watcher and memory service. They stay alive until the workspace is deleted.
3. The renderer remounts its routes with `key={workspaceId}`, opens that workspace's last chat and
   hides the other workspace's browser tabs.

The switch never touches runs, pending approvals or questions, the run scheduler, the sandbox,
processes, voice, cron jobs, index jobs or other windows. It must not call `cancelAll()`,
`rejectPendingToolPermissions()`, `interruptPendingUserInput()` or `sandbox.invalidate()`.

A submitted prompt must reach main even if the page remounts. `useHomeAgent` stops aborting a send
on a workspace switch. Main returns follow-ups that a run never delivered in `run_finished`, and the
renderer re-sends them into their workspace and chat.

### Seeing other workspaces' activity

- `Agent.listActivity()` returns live runs across all workspaces (workspace, chat, title, running /
  waiting for approval / waiting for an answer), with a push event when it changes.
- The switcher shows a badge per workspace, for example "Client work · 1 running · 1 needs approval".
- Run signals carry `workspaceId`. A notification click switches the window to that workspace and
  opens the chat, where the approval card is replayed and can be answered.
- Approvals still expire after 120 seconds and questions after 10 minutes, as they do today when the
  user is in another chat.

## Windows

- `WindowContext` gets a mutable `workspaceId`, `WindowContextManager` gets `windowsIn(workspaceId)`,
  and `TrustedRenderer` gets `workspace(event)`, built on `assert()`
  ([trusted.ts](../src/main/ipc/core/trusted.ts)). IPC handlers that touch workspace content move to
  event-aware wrappers. Handlers that only touch setup stay as they are.
- **Events:** a new `sendToWorkspace(id, channel, …)` sends to `windowsIn(id)`. File tree, chat list,
  Library, memory, knowledge, tasks, browser tab and model-override events are workspace-scoped.
  Agent responses, `openSession` and voice stay window-scoped. Theme, language, zoom, tray and the
  model catalog stay global. Events from a run use the run's workspace.
- **New windows:** Menu > New Window opens the default workspace, as today. The switcher gets
  **Open in new window**, which opens a chosen workspace.
- **Same workspace in two windows** is allowed. Both get its events and share its content and
  overrides.
- **Voice:** the voice window is opened with the opener's workspace, and `startSession` carries it.
  `manager.start` resolves it once and passes it to configuration, the conversation, a per-call
  memory context and the tool runtime. Tray-started voice uses the default workspace.
- **Renderer storage:** all windows share one `localStorage`. A helper `scoped(key)` returns `key` for
  the default workspace and `key@<id>` for others. It is used for `chat-session-id`, chat categories
  and collapsed groups, prompt attachments, `chat-runtime:<id>` and `workspace-selected-file`. UI
  preferences stay unscoped. The window's workspace ID is never stored in `localStorage`.
- **Restart:** one window opens on the default workspace, as today.
- **Closing a window** still cancels its runs ([bootstrap.ts](../src/main/bootstrap.ts)), as today.

## Background work

- **Scheduled tasks** store their `workspaceId`, with a missing value meaning `default`. Main keeps a
  schedule → workspace index loaded from every workspace, and `exists`, `requireSchedule`, `update`
  and `associateSession` resolve the owning store from it. Cron fires every workspace's schedules,
  whatever the windows show. Task tools and the list IPC are scoped to the caller's workspace.
- **Health** runs in the default workspace.
- **Coder** (hidden today) is pinned to the default workspace.

## Isolation

Today interactive runs read any path that is not protected without asking
([resolve_permission.ts](../src/main/agent/permissions/resolve_permission.ts)), and
[protected.ts](../src/main/agent/permissions/protected.ts) protects none of the content folders. Separate
folders alone would therefore be cosmetic.

`protectedRoots(ws)` is computed for the run's workspace:

- **read** adds every other workspace's content. For the default workspace that is all of
  `~/.kucedr/workspaces`. For workspace X it is the default's `workspace`, `sessions`, `memory`,
  `library` and `rag`, plus every sibling workspace folder. It also adds every workspace's `browser`
  folder, the whole Electron `Partitions` directory, `~/.kucedr/agent-browser`, `~/.kucedr/settings`
  and `~/.kucedr/logs`.
- **write** is unchanged: all of `~/.kucedr` stays write-protected.
- **writable** is `[ws.files, ws.library]`.

Protected roots are checked before allow rules, so no rule can open another workspace. Content
crosses workspaces only by user action.

"Always allow" rules are stored per workspace. The default keeps the `permissions` key in
`settings/chat.json`. Other workspaces use `~/.kucedr/workspaces/<id>/settings/permissions.json`. A
grant made in A never applies in B.

**Sandbox:**

- On macOS and Linux the filesystem policy is applied per command, so two runs in different
  workspaces each get their own. Drop `sandbox.invalidate()` on permission saves there
  ([ipc/agent.ts](../src/main/ipc/agent.ts)), because it kills every workspace's commands.
- On Windows, grant the `~/.kucedr/workspaces` parent and the default roots once at session level
  and deny other workspaces per command, so creating a workspace never resets the sandbox. Per-command
  denies are ACEs on the shared sandbox user. Check that they don't block a concurrent command in
  another workspace. If they do, run sandboxed commands from different workspaces one at a time.

**Screen recorder:** refuse the `application` and `workspace` targets when no window shows the run's
workspace, because the window would show another workspace's content.

## Settings per workspace

The default workspace and the global settings files never change. Another workspace stores only
the keys the user changed, in `~/.kucedr/workspaces/<id>/settings/chat.json`, with the same key names
as the global `settings/chat.json`.

- **v1 overrides one setting:** the agent's chat model, the `chat` profile's `llm` slot (provider,
  model and options together). The format leaves room for voice, tasks and media models later.
- **Lookup:** `resolveChatModel(workspaceId)` returns the override if the workspace is not the default
  and the override's provider still exists. Otherwise it returns the global value. Options are never
  mixed between layers.
- **Stale override:** if the provider was removed, the global value is used and the UI says so.
- **Use default** deletes the key, and the workspace follows the global value again, including
  later changes.
- **Writes:** a separate electron-store per workspace with key-level `set` and `delete`. It never
  goes through `agent_profiles` `read()`/`write()`, whose normalisation would fill every slot.
- **Runs pin settings at admit time.** `send()` pins provider, model and options from
  `resolveChatModel(ws)`. Changing an override or the global default never changes a running run.
  Compaction falls back to the run's pinned model when `compact_llm` is not set.

New IPC: `setModel({ providerId, modelId, options })` writes the global value from a default-workspace
window and the override from any other, atomically. `clearModel()` removes the override.
`getModelScope()` returns `{ workspaceId, isDefault, overridden, stale, global }`. The model getters
resolve through `resolveChatModel` for the caller's workspace. `setProvider` and `setModelId` stay
global writers for onboarding.

**Interface:** in a non-default workspace, Settings > Agent shows a badge with the workspace name and
a **Use default model** switch, following the memory page's switch row. When it is off, the existing
model picker writes the override. The Home composer picker calls `setModel`, so choosing a model in a
non-default workspace overrides it for that workspace only. Nothing changes in the default workspace's
UI.

## Workspace management

### IPC

A new `WorkspaceChannels` group, wrapped with `wrapIpcHandler` and renderer checks:

| Channel       | Behavior                                                               |
| ------------- | ---------------------------------------------------------------------- |
| `list`        | Return the workspaces, the caller's workspace and activity counts      |
| `current`     | Return the caller window's workspace                                   |
| `select`      | Validate the ID and bind it to the caller's window                     |
| `create`      | Validate the name, generate the ID, save and create the folders        |
| `rename`      | Validate the name and update the registry                              |
| `openWindow`  | Open a new window on the given workspace                               |
| `pickImage`   | Open the file dialog, copy the chosen image and update the registry    |
| `removeImage` | Clear `image` and delete its file                                      |

The registry is saved with the existing `atomic_write` helper. Preload exposes them as
`window.workspaces`. A `WorkspaceProvider` in `RootRouteComponent` holds `{ id, name, isDefault }`.

### Images

The main process opens the file dialog, so the renderer never supplies a source path:

- **Allowed files:** PNG, JPEG and WebP up to 5 MB. SVG is excluded because it can contain scripts.
- **Validation:** check size and leading bytes in the main process, not just the extension.
- **Saving:** copy to `~/.kucedr/workspaces/images/<new uuid>.<ext>`, update the registry, then delete
  the previous image. A new name on each change also avoids a stale cached image.

`list` returns images as `local-resource://file/...` URLs, which the main window can already load
([protocol.ts](../src/main/protocol.ts)).

### Interface

The switcher is a `DropdownMenu` in the Home sidebar. It shows the active image and name, lists
the other workspaces with their activity badges, and offers **New workspace**, **Edit** and
**Open in new window**. Images render through `Avatar`, whose fallback shows the first letter of the
name. New text goes through `react-i18next` under a `spaces.*` namespace, because
`settings.workspace.*` already means the Files page.

## Backups and encryption

- Pin the existing `agent`, `sessions` and `library` backup folders to the default workspace's paths
  ([storage_sync_folders.ts](../src/main/storage/storage_sync_folders.ts)), and add one `workspaces` folder
  for `~/.kucedr/workspaces`. Skip `*/browser` in it.
- `vault/convert.ts` converts `sessions` and `memory` in every workspace root.

## Fixes needed on the way

- `memory/migrate.ts` moves any `MEMORY.md` at the files root into memory and deletes the original.
  Run it only for the default workspace, or a client's file with that name would be consumed.
- Qualify the default knowledge `indexName` with the workspace ID for non-default workspaces, so
  remote mirrors don't share a namespace.
- `coding/projects.ts`, `health/data.ts` and `data/data_controller.ts` read the global locations. Pin
  them to the default workspace, or pass the caller's workspace for export.
- "Workspace" already means the Files page, the editor model, Coder projects and cloud-sync roots.
  Use `workspaces` / `WorkspaceChannels` / `spaces.*` for the new names.

## Known limitations

- **Existing data stays in the default workspace.** Today's memory and Library mix every client and
  can't be split automatically. Confidential work should start in a new workspace.
- **Sign-ins:** users sign in again in each workspace.
- **MCP connectors are shared.** A connector linked in A can be called from B. Per-workspace enabling
  is roadmap 10.3.
- **Not covered by isolation:** elevated host commands after approval, MCP servers, Codex's own
  sandbox, `local-resource://file`, the shared sandbox `TMPDIR`, and reads of folders outside
  `~/.kucedr` that the user never granted.
- **One vault key and one backup passphrase** cover every workspace.
- **Approvals expire** if the user stays away from a workspace longer than the timeout.
- **Deleting a workspace** is left out. When added, it must be refused while the workspace has live
  runs, voice, a running task or an index job, and must clear its partition.

## Implementation order

1. Workspace value and registry → verify: with no registry file, every resolved path equals today's.
2. Run binding (config, scope, `currentWorkspace()`, tools, media, memory, knowledge, browser, deferred
   operations, profile fallbacks) → verify: no argument-less `agentLocation()`, `libraryLocation()`,
   `memoryPath()` or `ragLocation()` is left in the run path, and a default-workspace chat works as
   before.
3. Isolation (`protectedRoots(ws)`, per-workspace rules, sandbox) → verify: a run in B is denied
   reading A's files, chats, memory and Library with the read tool and with bash, and an "always
   allow" from A does not apply in B.
4. Window binding, IPC, switcher and scoped renderer storage → verify: two windows on two workspaces
   show different files and chats, and switching one leaves the other unchanged.
5. Continuity → verify: start a long run in A that will ask for approval, switch the window to B,
   then come back from the badge. The run finished in A, its files, Library items and memory are in
   A, and B was untouched.
6. Tasks, voice and browser → verify: a task of A fires while every window shows B and runs in A; a
   voice call started in A keeps A's memory after a switch; B's browser has none of A's sign-ins.
7. Settings overrides → verify: picking a model in B leaves the default workspace's model unchanged,
   runs in B use the override, and **Use default** restores the global model.
8. Backups and encryption → verify: both workspace locations back up and restore with their names,
   and enabling the vault seals every workspace's chats and memory.
9. Workspace images → verify: an image can be set, replaced and removed, a renamed `.txt` is rejected,
   and a workspace with no image shows its first letter.

## Open decisions

Each has a recommendation, used above unless changed:

- **What Menu > New Window opens.** Recommended: the default workspace.
- **Restoring windows on relaunch.** Recommended: not in v1.
- **Closing a window with running chats.** Recommended: keep cancelling them, as today. Letting them
  finish in the background is a later step.
- **More overridable settings.** Recommended: only the chat model in v1.
- **Renaming the default workspace.** Recommended: allowed, as a display name only.
