# 10. Workspaces and windows

Part of the [Roadmap](README.md). Status: 10.1–10.4 and 10.6–10.9 built 2026-11-26; 10.5 and the
items under [Left](#left) open. How it works and what was checked:
[Multiple workspaces](../WORKSPACES.md).

Several named workspaces, for example one for work and one for personal use, each shown in its own
window when the user wants them side by side. The two are one piece of work: a window is where a
workspace is shown.

## Decided 2026-11-26

- `~/.kucedr/workspace` stays the default workspace, unchanged.
- A new workspace is a folder the user picks anywhere on disk. Kucedr keeps a reference to it and
  writes nothing into it.
- A workspace is a separate case: files, chats, Library, memory, knowledge, browser sign-ins,
  scheduled tasks and file-access rules. Existing chats and memory stay with the default workspace.
- Each window shows one workspace. There is no app-wide "current workspace".
- **Shared on purpose:** model keys, providers, plugins, skills, connectors, app settings, the
  account and anything paid for ([Payments](PAYMENTS.md)).

## Decided 2026-11-27: no `~/.kucedr/workspaces` folder

Replaces the per-workspace data folders in [Layout](../WORKSPACES.md#layout). Kucedr no longer
creates `~/.kucedr/workspaces`.

- **Registry:** `~/.kucedr/settings/workspaces.json`, same format as today.
- **Pictures:** stored under `~/.kucedr/settings/` next to the registry, instead of
  `~/.kucedr/workspaces/images/`.
- **Chats:** every session stays directly in `~/.kucedr/sessions/`. Each session carries
  `"workspace": "<id>"`; the chat list, search and the read guard filter by it. A session without the
  property belongs to the default workspace, so existing chats need no migration.
- **Memory, knowledge and settings:** use the default folders `~/.kucedr/memory`, `~/.kucedr/rag`
  and `~/.kucedr/settings`. No per-workspace copies of these folders.

Open:

- Memory and knowledge in one folder: are they shared by all workspaces, or does each entry
  (memory lines, indexed folders, vectors, settings such as the chat model override and "always
  allow" rules) carry a workspace id? This decides whether 10.2 and 10.4 stay as they are.
- Library and browser data are not covered: keep them in the default `library` and `browser`
  folders with a workspace id, or give them another home.
- The read guard in 10.2 denies another workspace's chats by folder today; with one sessions folder
  it has to deny by the session's `workspace` property.
- Installs that already have `~/.kucedr/workspaces/`: move its data into the new layout, or treat
  it as test data.

## Features

| # | Feature | What the user gets | Status | Size |
| --- | --- | --- | --- | --- |
| 10.1 | Workspaces and switcher | Create a workspace by picking a folder; name it, give it a picture and switch to it from the Home sidebar | Built 2026-11-26. The home folder, Kucedr's data folder and folders that overlap another workspace are refused; a moved folder shows "Folder not found" with Locate. Checked in the app | M |
| 10.2 | Separate chats and memory | Each workspace has its own chat list, Library, memory and knowledge. A run in one workspace is refused the other's files | Built 2026-11-26. The read tool and sandboxed commands are denied the other workspace's files, chats and memory in both directions, and "always allow" rules are per workspace; checked in the app. Memory generation and knowledge indexing in a second workspace not checked | M |
| 10.3 | Separate sign-ins | Each workspace has its own browser tabs, logins, history, passwords and bookmarks | Built 2026-11-26 for the browser: its own partition and data folder; tab list, partition and bookmarks checked in the app, a real sign-in and saved passwords not. Connected accounts (mail, calendar) stay shared ([Integrations](INTEGRATIONS.md), 17.4) | M–L |
| 10.4 | Per-workspace defaults | A workspace can use its own chat model; the default workspace keeps the global one | Built 2026-11-26: the model picker writes an override in a non-default workspace, and Settings → Chat has **Use default model**. Checked in the app | S |
| 10.5 | Delete and move | Delete a workspace with its data, never its folder; move a chat to another workspace | Open | S |
| 10.6 | A workspace per window | Each window shows one workspace. Two windows show two workspaces side by side, and switching one leaves the other alone | Built 2026-11-26. Checked in the app | M |
| 10.7 | Open in new window | The switcher opens a chosen workspace in its own window. File → New Window opens the default workspace | Built 2026-11-26. Checked in the app | S |
| 10.8 | Work continues in the background | A reply, tool run or approval keeps going in the workspace it started in when its window switches away. The switcher shows what is running or waiting in each workspace, and a notification opens the right one | Built 2026-11-26. A slow reply finishing after a switch, the running count, a task firing in its own workspace and opening a chat from another workspace checked in the app. A real system notification and the "needs you" count not checked | M |
| 10.9 | Windows kept apart | A window's last chat, drafts, selected file and browser tabs belong to its workspace, and a change reaches only the windows showing that workspace | Built 2026-11-26. Checked in the app for chats and browser tabs | S–M |

## Left

- Delete and move (10.5).
- Renaming the default workspace.
- Windows: the command sandbox is re-initialised when commands alternate between workspaces. Not
  built and not tested; macOS only was checked.
- Coder harness homes and sessions stay shared in `~/.kucedr/coder` ([Coding](CODING.md)).
- Voice in a second workspace is built and not checked (needs a realtime key).
- Encryption and backup of a second workspace are built and not checked.
- Connected accounts per workspace ([Integrations](INTEGRATIONS.md), 17.4).
- Reopening every window on its workspace after a restart. One window opens on the default
  workspace.
- Runs that finish after their window is closed. Closing a window still cancels its runs.
- A reply streaming live in two windows at once.

## Touches other features

- Search across chats (3.2) searches the window's workspace.
- Notifications (3.1) name the workspace.
- Encryption (1.3) and backup (1.5) cover every workspace.
- Storage limits (9.1) count all workspaces together.
- A workspace can set a default browsing route ([Private and VPN browsing](VPN.md), 12.4): open.
- Browser import (23) brings bookmarks, history and passwords into the window's workspace.
- Memory per workspace (18.3) is covered by 10.2.
