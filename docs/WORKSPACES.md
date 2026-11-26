# Multiple workspaces

Status: built 2026-11-26, except the items under [Not built](#not-built). What was checked in the
running app, and what was not, is under [What was checked](#what-was-checked).

## What the user gets

Several named workspaces, each with an optional picture, used side by side:

- **A workspace is a case.** Everything that holds its content stays inside it: files, chats,
  Library, memory, knowledge, browser sign-ins, scheduled tasks and file-access grants. Setup stays
  shared.
- **A new workspace is a folder the user picks.** The default workspace stays at
  `~/.kucedr/workspace`, unchanged. Creating a workspace means choosing a folder anywhere on disk;
  Kucedr keeps a reference to it. Its files stay where they are, and Kucedr keeps the workspace's
  chats, memory and the rest in its own data folder. Nothing is written into the picked folder.
- **Each window has its own workspace.** Two windows can show two workspaces at once. Switching a
  window only changes that window.
- **Nothing in flight is interrupted.** A chat that is streaming, running tools or waiting for an
  approval keeps going in the workspace it started in when its window switches away.
- **The chat model can differ per workspace.** The default workspace uses the global model. Another
  workspace follows it until the user picks a different model there.

This matches [PRODUCT.md](mission/PRODUCT.md) ("separate everything: files, chats, memory, knowledge,
sign-ins") and items 10.1–10.4 and 10.6–10.9 of [roadmap/WORKSPACES.md](roadmap/WORKSPACES.md).

## What a workspace owns

| Per workspace                                    | Shared                                          |
| ------------------------------------------------ | ----------------------------------------------- |
| Files                                            | Providers, keys, model catalog                  |
| Chats of every kind (main, voice, task, subagent) | Plugins, skills                                 |
| Library (captures, screenshots, recordings, media) | MCP servers and tokens                          |
| Memory content, memory state and memory settings | USER, SOUL, IDENTITY                            |
| Knowledge folders, consent, index and settings   | App settings, theme, language, lock, tray       |
| Browser partition, history, passwords, bookmarks, tabs | Vault key, backup account                  |
| Scheduled tasks                                  | Health checklist (runs in the default workspace) |
| "Always allow" file rules                        | Tor and proxy addresses, the task and voice models |
| The chat model, when overridden                  | Coder projects and harness sign-ins             |

Chats cannot stay shared: a chat stores its workspace path in its own history, and tool results
return absolute paths. The Library cannot stay shared: browser screenshots, recordings and generated
media are saved there without a prompt. Memory cannot stay shared: every durable `MEMORY.md` line is
injected into every main turn, and the memory folder keeps a plain-text copy of every chat.

Memory and knowledge settings are whole per workspace, including the memory model and the embedding
model. A new workspace starts with knowledge off and no embedding model chosen.

## Layout

One folder per workspace. The default workspace's root is `~/.kucedr` itself, so existing data
does not move.

| Store       | Default workspace           | Other workspaces                       |
| ----------- | --------------------------- | -------------------------------------- |
| Files       | `~/.kucedr/workspace`       | The folder the user picked             |
| Chats       | `~/.kucedr/sessions`        | `~/.kucedr/workspaces/<id>/sessions`   |
| Library     | `~/.kucedr/library`         | `~/.kucedr/workspaces/<id>/library`    |
| Memory      | `~/.kucedr/memory`          | `~/.kucedr/workspaces/<id>/memory`     |
| Knowledge   | `~/.kucedr/rag`             | `~/.kucedr/workspaces/<id>/rag`        |
| Browser     | `~/.kucedr/browser`         | `~/.kucedr/workspaces/<id>/browser`    |
| Partition   | `persist:agent-browser`     | `persist:agent-browser-<id>`           |
| Rules and model override | `settings/chat.json` (unchanged) | `~/.kucedr/workspaces/<id>/settings/` |

Only the files folder can live outside `~/.kucedr`.

The registry lives in `~/.kucedr/workspaces/workspaces.json`:

```json
{
	"workspaces": [
		{
			"id": "0f8b6c1e-52a7-4c3e-9d41-7a1c2e6b90d3",
			"name": "Client work",
			"folder": "/Users/me/Documents/Client work",
			"image": "6d2e9a40-1b7c-4f35-8e02-c94d7f1a3b68.png"
		}
	]
}
```

- The default workspace is implicit: id `default`, shown as "Personal", never written to the file.
- **IDs** come from `crypto.randomUUID()` and are never shown.
- **Names** are trimmed, 1–64 characters, and unique ignoring case. A new workspace is named after
  its folder, with a number added when that name is taken.
- **Invalid data:** an entry without a UUID id, a name or an absolute `folder` is ignored. An unknown
  id never resolves, so it is never joined into a path.
- **Missing file:** only the default workspace exists, so existing installs need no migration. The
  file is created with the first workspace.
- **Damaged file:** a registry that cannot be parsed is renamed aside
  (`workspaces.json.damaged-<time>`) and the copy taken before the last change
  (`workspaces.json.bak`) is used. The workspaces' data folders are not touched.

## How code finds its workspace

`src/main/workspaces/` resolves an id into one frozen value (`resolve.ts`, `build.ts`, `types.ts`):
`id`, `root`, `files`, `sessions`, `library`, `memory`, `rag`, `browser`, `coder`, `settings` and
`partition`.

There is **no process-wide active workspace**. A piece of work runs inside the scope of one
workspace (`scope.ts`, an `AsyncLocalStorage`), and `currentWorkspace()` (`current.ts`) reads it and
**throws outside a scope**, so a path that was never bound fails loudly instead of using the default.
The scope is entered in a few places only:

| Entry                      | Workspace                                                    |
| -------------------------- | ------------------------------------------------------------ |
| An IPC call from a window  | The window's workspace (`wrapIpcHandler`, `sender.ts`)        |
| `agent.send` from the chat | The id the renderer captured when the user pressed Enter      |
| An agent run and its tools | The workspace of the call that admitted it, kept for the whole run |
| A scheduled task           | The schedule's `workspaceId`                                  |
| A voice call               | The voice window's workspace, kept for the session            |
| A browser tab's own events | The tab's workspace                                           |
| Knowledge indexing on a schedule | The workspace whose schedule fired                      |
| Health, startup            | `default`                                                     |

`agentLocation()` still exists and means the default workspace's files: the bootstrap and profile
files, Coder projects and the default backup folders use it. `libraryLocation()` and `sessionsRoot()`
are gone; session code takes the sessions folder, and a run's `Config` carries its `workspace`.

## Creating a workspace

**New workspace…** opens the system folder dialog in the main process; it is the only way to create
one. The renderer never sends a path.

Main checks the folder, using its real path, before saving it (`folder.ts`):

- It exists and is a readable directory.
- It is not the file-system root, the home folder or one of its ancestors.
- It is not inside `~/.kucedr` and does not contain it.
- It is not the folder of another workspace, and doesn't sit inside or contain one.

Behaviour:

- **Nothing is written into the folder.** `BOOTSTRAP.md` is seeded only into the default workspace,
  and the legacy `MEMORY.md` and `HEALTH.md` migrations run only there.
- **The folder is trusted** like any workspace folder: the agent reads and writes it without
  asking, and runs in every other workspace are denied it.
- **Missing folder:** if the folder is moved, deleted or on a drive that isn't connected, the
  switcher shows "Folder not found" and the edit dialog offers **Locate folder…**, which runs the
  same checks. New runs are refused until then. The folder is never recreated.
- **File watching:** the Files watcher ignores `.git` and `node_modules`.

## Runs keep their workspace

`Agent.send()` reads the current workspace once and runs the whole run inside its scope. Everything
the run does reads that value:

- **Files and bash:** read, write, edit, patch and bash resolve against the workspace's files.
- **Media:** generated media, recordings and browser screenshots are saved in the run's Library.
- **Memory:** `memoryFor(workspace)` is a lazy map of memory services; the run uses its workspace's.
- **Knowledge:** the settings store, vector file, search worker, indexing job and schedule are per
  workspace. A non-default workspace's default index name is `kucedr-<id>`, so remote mirrors don't
  share a namespace.
- **Browser:** tabs carry their workspace and are created in its partition. Popups inherit it. Tab
  listing, `targetId` lookups and "the tab on screen" only match the run's workspace. History,
  passwords, bookmarks and saved tabs are kept per workspace.
- **Permissions and sandbox:** rules and protected folders are read for the run's workspace, before
  and after an approval wait.
- **Deferred session operations** (edit, clear, delete, rename, pin) capture the workspace before
  they are queued.
- **Profile files:** `USER.md`, `SOUL.md`, `IDENTITY.md` and `BOOTSTRAP.md` are read from the
  default workspace in every workspace.

A run is refused when its workspace's folder is missing.

## Switching a window

1. The renderer calls `workspaces.select(id)`. Main validates the id, binds it to that window
   (`bind.ts`, keyed by the window's web contents) and tells that window.
2. On the first use of a workspace, main starts its chat-list watcher and its memory service and
   restores its browser tabs (`open.ts`). They stay alive until the app quits.
3. The renderer (`src/renderer/src/spaces/Gate.tsx`) remounts its routes under the new id, opens
   that workspace's last chat and shows only its browser tabs.

The switch never touches runs, pending approvals or questions, the run scheduler, the sandbox,
processes, voice, tasks, index jobs or other windows.

### Seeing other workspaces' activity

- `Agent.listActivity()` counts live chat and task runs per workspace: running, or waiting for an
  approval or an answer. Every window is told when it changes.
- The switcher shows it next to each workspace, for example "Client work · 1 running · 1 needs you".
- A notification names the workspace. Clicking it opens the chat; a window showing another
  workspace switches to the chat's workspace first.
- Approvals still expire after 120 seconds and questions after 10 minutes.

## Windows

- **New windows:** File → New Window opens the default workspace, as before, and so does a window
  opened for a file. **Open in new window** in the switcher opens a chosen workspace.
- **Same workspace in two windows** is allowed. Both get its chat-list, file and tab events. As
  before, a reply streams in the window that started it, and a browser tab is drawn in one window
  at a time.
- **Events:** chat-list, file-tree and browser-tab events go only to windows showing that workspace.
  Theme, language, zoom, tray and the model catalog stay global.
- **Voice:** the voice window takes the workspace of the window that opened it. A voice call
  started from the tray uses the default workspace.
- **Window storage:** all windows share one `localStorage`. `scoped(key)` returns `key` for the
  default workspace and `key@<id>` for others, for the open chat, chat categories and collapsed
  groups, draft attachments, per-chat runtime and the selected file. The window's workspace id is
  never stored there.
- **Files in the window:** `local-resource://agent/…` carries `?workspace=<id>` for a non-default
  workspace. Plugin app views cannot pass it and always get the default workspace.
- **Restart:** one window opens on the default workspace.
- **Closing a window** still cancels its runs.

## Background work

- **Scheduled tasks** stay in the one shared task store (`settings/tasks`). Each schedule has a
  `workspaceId`, with a missing value meaning `default`. A schedule fires in its own workspace,
  whatever the windows show. Task tools and the task IPC only see the caller's workspace, and a call
  on another workspace's schedule is refused as not found.
- **Health** runs in the default workspace.

## Isolation

Interactive runs read any path that is not protected without asking, so separate folders alone
would be cosmetic. `protectedRoots()` is computed for the run's workspace:

- **read** adds every other workspace's content. For the default workspace that is all of
  `~/.kucedr/workspaces`. For workspace X it is the default's `workspace`, `sessions`, `memory`,
  `library` and `rag`, plus every other workspace's data folder. Either way it adds every other
  workspace's picked folder, every `browser` folder, the whole Electron `Partitions` directory,
  `~/.kucedr/agent-browser`, `~/.kucedr/settings` and `~/.kucedr/logs`.
- **write** is unchanged: all of `~/.kucedr` stays write-protected.
- **writable** is the workspace's files and Library.

Protected roots are checked before allow rules, so no rule can open another workspace, and the same
list feeds the command sandbox.

"Always allow" rules are stored per workspace: the default keeps the `permissions` key in
`settings/chat.json`, others use `~/.kucedr/workspaces/<id>/settings/permissions.json`.

On macOS and Linux the sandbox policy is built per command, so saving rules no longer stops running
commands there.

**Screen recorder:** the `application` and `workspace` targets are refused when no window shows the
run's workspace.

## Chat model per workspace

A non-default workspace stores an override in `~/.kucedr/workspaces/<id>/settings/chat.json`
(`llm`: provider, model and options together).

- The existing model getters and setters work on the caller's workspace: in a non-default workspace
  the composer picker and Settings → Chat read and write the override; in the default workspace they
  read and write the global model.
- If the override's provider was removed, the global model is used.
- Settings → Chat shows **Use default model** in a non-default workspace. Turning it on deletes the
  override (`clearModel`); `getModelScope` says whether one exists.
- A run pins its provider and model when it is admitted.
- Tasks, voice and health keep their own shared models.

## Workspace management

`WorkspacesChannels`, exposed as `window.workspaces`:

| Channel       | Behavior                                                               |
| ------------- | ---------------------------------------------------------------------- |
| `list`        | The caller window's workspace, and every workspace with its activity   |
| `select`      | Validate the id and bind it to the caller's window                     |
| `create`      | Open the folder dialog, check the folder, save the reference           |
| `rename`      | Validate the name and update the registry                              |
| `locate`      | Pick a new folder for a workspace whose folder is missing              |
| `openWindow`  | Open a new window on the given workspace                               |
| `pickImage`   | Open the file dialog, check and copy the image, update the registry    |
| `removeImage` | Clear the image and delete its file                                    |
| `changed`     | Event: the list, a name, a picture or the activity changed             |

**Pictures:** PNG, JPEG and WebP up to 5 MB, checked by size and leading bytes in the main process.
The file is copied to `~/.kucedr/workspaces/images/<new uuid>.<ext>` and the previous one deleted.

**Interface:** the switcher is the first item of the Home sidebar (`pages/home/Spaces.tsx`). It
lists the workspaces with their activity and offers **New workspace…**, **Edit workspace…** (name,
folder path, picture, **Locate folder…**) and **Open in new window**. Text is under `spaces.*`,
because `settings.workspace.*` already means the Files page.

## Backups and encryption

- The default backup folders stay the default workspace's. `~/.kucedr/workspaces` can be added as a
  backup folder; the backup script skips each workspace's `browser` folder.
- Picked folders are not backed up by Kucedr. After a restore the workspace asks to locate its
  folder.
- Switching encryption on or off converts the chats and memory of every workspace.

## Not built

- **Deleting a workspace**, and moving a chat to another workspace. Deleting must be refused while
  the workspace has live runs, voice, a running task or an index job, and must clear its partition.
- **Renaming the default workspace.**
- **A system-folder check** when picking a folder (the root, home and its ancestors, Kucedr's data
  and other workspaces are refused).
- **Windows sandbox:** the session-level policy differs per workspace, so a command in another
  workspace re-initialises the sandbox and stops running commands. Not built and not tested.
- **Coder storage per workspace:** harness homes and Coder sessions stay in `~/.kucedr/coder`.
- **A prompt sent in the instant before a switch** (while its attachments are read) is dropped, as
  when switching chats. Follow-ups queued for a run are not re-sent after a switch.
- **A notice for a stale model override.** The global model is used silently.
- **Connected accounts per workspace.** A connector linked in one workspace can be called from
  another ([Integrations](roadmap/INTEGRATIONS.md), 17.4).
- **Reopening every window on its workspace after a restart.**

## Known limits

- **Existing data stays in the default workspace.** Confidential work should start in a new one.
- **Sign-ins:** users sign in again in each workspace's browser.
- **Not covered by isolation:** elevated host commands after approval, MCP servers,
  `local-resource://file` in the main window, the shared sandbox temp folder, and reads of folders
  outside `~/.kucedr` that are not another workspace's.
- **One vault key and one backup passphrase** cover every workspace.
- **Picked folders are not encrypted** by Kucedr, and other apps can change them at any time.
- **Approvals expire** if the user stays away longer than the timeout.

## What was checked

In a production build on macOS, with an isolated profile and home folder and a mock model
(2026-11-26):

- **Default unchanged:** with no registry, every folder is today's; no registry is written.
- **Create:** a picked folder becomes a workspace with nothing written into it; its chats land in
  `~/.kucedr/workspaces/<id>/sessions`; the model is told the picked folder as its root. The home
  folder, a folder inside `~/.kucedr`, a folder nested in a workspace and a folder containing one
  are refused.
- **Isolation, both directions:** the read tool and sandboxed bash are denied the other workspace's
  files, chats and memory; each reads and writes its own. An "always allow" rule saved in one
  workspace is absent in the other.
- **Windows:** two windows on two workspaces list different chats; switching one leaves the other.
- **Continuity:** a slow reply started in B finished in B after its window switched to A, with
  nothing in A; the running count appeared and cleared.
- **Tasks:** a task is listed only in its workspace, the other workspace cannot run it, and it ran
  in its own workspace while every window showed another.
- **Browser:** a tab opened in B is listed only in B and uses `persist:agent-browser-<id>`;
  bookmarks are separate and stored under the workspace.
- **Missing folder:** shown as missing, runs refused, folder not recreated, **Locate** restores it.
- **Rename and pictures:** rename shows in the switcher, a duplicate name is refused; a picture can
  be set, replaced and removed, and a renamed text file is refused.
- **Model:** picking a model in B leaves the default's unchanged, runs in B use it, and **Use
  default model** restores the global one.
- **Open chat from another workspace:** the open-chat event switches the window and shows the chat.

Not checked: voice (needs a realtime key), Windows and Linux, encryption and backup of a second
workspace, a real system notification, the screen-recorder refusal, memory generation and knowledge
indexing in a second workspace, a real site sign-in in two workspaces, saved passwords per
workspace, and tabs restored per workspace after a restart.
