# 20. Coding page

Part of the [Roadmap](README.md). Status: proposal. Plan: [Coding Chat](../CODING_CHAT.md), the page
shipped as a second chat kind next to the agent chat.

## What exists today

- A coding screen of about 1,100 lines (`src/renderer/src/pages/code`) and a coding-agent harness
  (`src/main/coding/harness`) with sealed credentials.
- It is not reachable: the `code/*` route redirects away (`src/renderer/src/router.tsx`) and its
  Settings entry is marked "coming soon" (`src/renderer/src/pages/settings/navigation.ts`).
- The coding agent does not follow the app's permission rules
  ([PERMISSIONS_AGENTS.md](../PERMISSIONS_AGENTS.md), left as a decision) _(from docs)_.
- Its command output is shown as plain text and runs through its own path, separate from the
  terminal ([Terminal](TERMINAL.md)).

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 20.1 | Coding page shipped | Open a project folder, ask for a change, review the changes file by file, accept or reject | The existing screen and harness | L |
| 20.2 | Same permission rules | The coding agent asks before the same actions the main agent asks about | The permission system | M |
| 20.3 | Terminal inside coding | Commands run in the app's terminal, visible and stoppable | [Terminal](TERMINAL.md), 14.2 and 14.6 | M |
| 20.4 | Version control view | See changed files and differences, commit from the page | Nothing today | M |
| 20.5 | More coding harnesses | Pick a harness other than Codex for a coding chat or for the chat agent's coding tool: Claude, OpenCode, Cursor, Antigravity, Grok Build, Devin CLI, Pi, Oh My Pi or Factory Droid, each installed and signed in by the user | A second protocol adapter (`acp`), possibly a third for Factory Droid, [plan](../CODING_CHAT.md), [harness notes](../CODING_TOOLS.md#harness-notes) | L |
| 20.6 | Coding agent as a chat tool | Ask the main chat for a code change or fix, and it hands the work to a coding agent (Codex first), then reports what changed and how to continue | The existing harness, the app sandbox, [plan](../CODING_TOOLS.md) | M |
| 20.7 | Live coding-agent progress | Watch the coding agent's messages, commands and file changes in the chat while it works, with no 9-minute limit | 20.6, a tool progress event | M |
| 20.8 | Coding-agent approvals in the chat | When the coding agent needs permission, the chat asks with the usual approval card instead of declining | 20.6, 20.7 | M |
| 20.9 | Steer a running coding agent | Send a correction while the coding agent works, without stopping it. Only for harnesses that support it (Claude, Codex, Pi); the others offer Stop and a new call | 20.7, each harness's own protocol, since ACP has no steer message | M |
| 20.10 | Coding interface and module | The coding screen finished and reachable, and the coding module behind it completed, so 20.1 can ship. Added 2026-11-27; scope to be set in the detailed plan | The existing screen (`src/renderer/src/pages/code`) and harness (`src/main/coding/harness`); 20.2 first | L |

## Open decisions

- **Ship or remove.** Recommended: decide before more work lands. Half-built and unreachable, the
  page costs maintenance and delivers nothing. If it ships, 20.2 comes first.
- **One coding agent or several.** The harness supports one today; more is a later choice.
- **Account sign-ins.** Some harnesses are typically used with a consumer account (Claude,
  Antigravity). Recommended: offer only the sign-ins each vendor allows for third-party apps (API
  key for Claude), and confirm Antigravity's terms before shipping its manifest.
- **The chat tool and the page.** 20.6 uses the harness without the coding page, so it is useful
  whether the page ships or is removed. It runs every harness in the app sandbox, which covers 20.2
  for that path.
