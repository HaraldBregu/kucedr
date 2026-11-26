# 10. Workspaces and windows

Part of the [Roadmap](README.md). Status: proposal, nothing built (checked 2026-11-26). Plan:
[Multiple workspaces plan](../WORKSPACES.md).

Several named workspaces, for example one for work and one for personal use, each shown in its own
window when the user wants them side by side. The two are one piece of work: a window is where a
workspace is shown, so neither can be built without the other.

## Decided 2026-11-26

- `~/.kucedr/workspace` stays the default workspace, unchanged.
- A new workspace is a folder the user picks anywhere on disk. Kucedr keeps a reference to it and
  writes nothing into it.
- A workspace is a separate case: files, chats, Library, memory, knowledge, browser sign-ins,
  scheduled tasks and file-access rules. Existing chats and memory stay with the default workspace.
- Each window shows one workspace. There is no app-wide "current workspace".
- **Shared on purpose:** model keys, providers, plugins, skills, connectors, app settings, the
  account and anything paid for ([Payments](PAYMENTS.md)).

## What exists today

Workspaces:

- One fixed workspace at `~/.kucedr/workspace` (`src/main/shared/agent_location.ts`). Chats,
  Library, memory, knowledge and browser data each have one global folder under `~/.kucedr`, read
  through global helpers at about 90 call sites.
- A run knows only its files folder (`Config { location }` in `src/main/agent/types.ts`).

Windows, read from the code and not checked in the running app:

- File → New Window (⌘⇧N) opens a second full window (`createAdditionalWindow` in
  `src/main/create_window.ts`). Every window shows the same workspace.
- A window has no workspace of its own: `WindowContext` (`src/main/window_context.ts`) holds its
  id, services and event bus.
- A reply streams only to the window that started it (`src/main/ipc/agent.ts`). Closing that window
  cancels its runs, coding runs and voice (`src/main/bootstrap.ts`).
- All windows share one `localStorage`, so the last open chat (`chat-session-id`), attachment
  drafts, chat categories and the selected file are the same in every window.
- The browser pane has one set of tabs for all windows. A tab is drawn in one window at a time and
  moves to the window that shows it (`src/main/ipc/browser.ts`).
- Chat list and file changes are sent to every window (`eventBus.broadcast`).
- After a restart one window opens.

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 10.1 | Workspaces and switcher | Create a workspace by picking a folder; name it, give it a picture and switch to it from the Home sidebar | The global folder helpers become one workspace value | M |
| 10.2 | Separate chats and memory | Each workspace has its own chat list, Library, memory and knowledge, so what the agent learns at work never appears in a personal chat. A run in one workspace is refused the other's files | Chats live in `~/.kucedr/sessions`, memory in `~/.kucedr/memory`; both become per workspace | M |
| 10.3 | Separate sign-ins | Each workspace has its own browser tabs, logins, history, passwords and bookmarks. Connected accounts (mail, calendar) stay shared in the first version | One browser partition (`persist:agent-browser`) and one `~/.kucedr/browser` today; connectors are [Integrations](INTEGRATIONS.md) 17.4 | M–L |
| 10.4 | Per-workspace defaults | A workspace can use its own chat model; the default workspace keeps the global one | Model slots in Settings | S |
| 10.5 | Delete and move | Delete a workspace with its data, never its folder; move a chat to another workspace | Not in the plan yet | S |
| 10.6 | A workspace per window | Each window shows one workspace. Two windows show two workspaces side by side, and switching one leaves the other alone | New Window and `WindowContext` exist; a window has no workspace today | M |
| 10.7 | Open in new window | The switcher opens a chosen workspace in its own window. File → New Window opens the default workspace, as today | `createAdditionalWindow` | S |
| 10.8 | Work continues in the background | A reply, tool run or approval keeps going in the workspace it started in when its window switches away. The switcher shows what is running or waiting in each workspace, and a notification opens the right one | Replies that survive leaving Home (5.3), notifications (3.1); a run has no workspace today | M |
| 10.9 | Windows kept apart | A window's last chat, drafts, selected file and browser tabs belong to its workspace, and a change reaches only the windows showing that workspace | The shared `localStorage` keys and the broadcasts listed above | S–M |

## Build order

One sequence for both. The step numbers and the check for each step are in the plan's
[Implementation order](../WORKSPACES.md#implementation-order).

| Step | Build | Delivers | On screen afterwards |
| --- | --- | --- | --- |
| 1 | The workspace list and the value that resolves a workspace's folders | Groundwork | Nothing changes |
| 2 | Every run and its tools use the workspace the run started in | Groundwork for 10.2 and 10.8 | Nothing changes |
| 3 | Isolation: protected folders and "always allow" rules per workspace | 10.2 | Nothing changes |
| 4 | Create a workspace from a picked folder | 10.1 | Nothing yet; checked through the app's internal API |
| 5 | A workspace per window: the switcher, Open in new window, per-workspace window storage and events | 10.1, 10.6, 10.7, 10.9 | The switcher; two windows on two workspaces |
| 6 | Continuity: activity badges, notifications that open the right workspace, follow-ups delivered after a switch | 10.8 | Badges in the switcher |
| 7 | Scheduled tasks, voice and the browser in their own workspace | 10.3, 10.9 | Separate tabs and sign-ins; a task runs in its workspace |
| 8 | Chat model per workspace | 10.4 | A switch in Settings → Agent |
| 9 | Backup and encryption cover every workspace | [Privacy](PRIVACY.md) 1.3, 1.5 | Nothing changes |
| 10 | Workspace pictures | 10.1 | Pictures in the switcher |

- **Steps 1–3 come first and change nothing on screen.** With no workspace list on disk, every
  folder must resolve to today's path. Step 2 is the large one: about 90 call sites.
- **Steps 1–7 are the first usable version.** Before step 7 a second workspace would still show the
  first one's browser tabs and tasks.
- **Step 9 comes before a release.** Until then a new workspace is not backed up, and switching
  encryption on does not convert its chats.
- Steps 8 and 10 can follow in either order.

## Left for later

- Delete and move (10.5).
- Connected accounts per workspace (the second half of 10.3, [Integrations](INTEGRATIONS.md) 17.4).
- Reopening every window on its workspace after a restart. One window opens on the default
  workspace, as today.
- Runs that finish after their window is closed. Closing a window still cancels its runs.
- A reply streaming live in two windows at once. With the same workspace in two windows, the reply
  streams in the window that started it and a browser tab is drawn in one window at a time.

## Open decisions

Each has a recommendation in the plan's [Open decisions](../WORKSPACES.md#open-decisions): what
File → New Window opens, restoring windows on relaunch, closing a window with running chats, more
settings per workspace, and renaming the default workspace.

## Touches other features

- Search across chats (3.2) searches the window's workspace.
- Notifications (3.1) name the workspace.
- Encryption (1.3) and backup (1.5) cover every workspace.
- Storage limits (9.1) count all workspaces together.
- A workspace can set a default browsing route ([Private and VPN browsing](VPN.md), 12.4).
- Browser import (23) brings bookmarks, history and passwords into the window's workspace.
