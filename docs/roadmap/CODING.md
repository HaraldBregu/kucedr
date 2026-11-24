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
- Its unit test imports a module that no longer exists (`tests/unit/main/coding/coding.test.ts`).
- Its command output is shown as plain text and runs through its own path, separate from the
  terminal ([Terminal](TERMINAL.md)).

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 20.1 | Coding page shipped | Open a project folder, ask for a change, review the changes file by file, accept or reject | The existing screen and harness | L |
| 20.2 | Same permission rules | The coding agent asks before the same actions the main agent asks about | The permission system | M |
| 20.3 | Terminal inside coding | Commands run in the app's terminal, visible and stoppable | [Terminal](TERMINAL.md), 14.2 and 14.6 | M |
| 20.4 | Version control view | See changed files and differences, commit from the page | Nothing today | M |
| 20.5 | More coding harnesses | Pick a harness other than Codex for a coding chat | A second protocol adapter (`acp`), [plan](../CODING_CHAT.md) | M |

## Open decisions

- **Ship or remove.** Recommended: decide before more work lands. Half-built and unreachable, the
  page costs maintenance (a broken test today) and delivers nothing. If it ships, 20.2 comes first.
- **One coding agent or several.** The harness supports one today; more is a later choice.
