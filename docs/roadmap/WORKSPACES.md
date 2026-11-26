# 10. Multiple workspaces

Part of the [Roadmap](README.md). Status: proposal.

Several named workspaces, for example one for work and one for personal use, with a switcher.

## What exists today

One fixed workspace at `~/.kucedr/workspace` (`src/main/shared/agent_location.ts`); nothing of
the [Multiple workspaces plan](../WORKSPACES.md) is built (checked 2026-11-26).

The plan was decided 2026-11-26: `~/.kucedr/workspace` stays the default workspace, unchanged. A new
workspace is a folder the user picks anywhere on disk; Kucedr keeps a reference to it and writes
nothing into it. Each workspace is a separate case: files, chats, Library, memory, knowledge,
browser sign-ins, scheduled tasks and file-access rules. Keys, providers, plugins, skills and app
settings stay shared.

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 10.1 | Workspaces and switcher | Create a workspace by picking a folder, name, picture and switch workspaces | The [Multiple workspaces plan](../WORKSPACES.md) | M |
| 10.2 | Separate chats and memory | Each workspace has its own chat list and its own memory, so what the agent learns at work never appears in a personal chat | Chats live in `~/.kucedr/sessions`, memory in `~/.kucedr/memory`; both become per workspace | M |
| 10.3 | Separate sign-ins | Each workspace has its own browser logins and its own connected accounts (work mail and calendar apart from personal) | The agent's browser profile (`~/.kucedr/agent-browser`) and connector tokens are single and shared today | M–L |
| 10.4 | Per-workspace defaults | A default model and instructions per workspace; keys, plugins, skills and app settings stay shared | Model slots in Settings | S |
| 10.5 | Delete and move | Delete a workspace with its data; move a chat to another workspace | Left out of the existing plan | S |

## Open decisions

- **How much a workspace separates.** Recommended: 10.1 and 10.2 together as the first version. For
  "work and personal", shared chats and memory is the part that would surprise people. Deciding
  before implementation matters: the existing plan notes that separating them later changes where
  chats and memory are stored, and existing data would need a home. Existing chats and memory would
  stay with the first workspace. The [Multiple workspaces plan](../WORKSPACES.md) is updated once
  this is decided.
- **10.3 with the browser pane.** If the browser pane (3.9) is built first, its saved logins should
  be designed per workspace from the start.
- **Shared on purpose:** model keys, plugins, skills, app settings, the account and anything paid
  for ([Payments](PAYMENTS.md)).

## Touches other features

- Search across chats (3.2) searches the active workspace.
- Notifications (3.1) name the workspace.
- Encryption (1.3) and backup (1.5) cover every workspace.
- Storage limits (9.1) count all workspaces together.
- A workspace can set a default browsing route ([Private and VPN browsing](VPN.md), 12.4).
