# 14. Terminal

Part of the [Roadmap](README.md). Status: proposal.

## What exists today

The back end is built and unit-tested: sessions owned by a window, shell detection, IPC and a
preload API (`src/main/terminal/manager.ts`, `src/main/terminal/shell.ts`,
`src/main/ipc/terminal.ts`, `src/preload/terminal.ts`). [Terminal](../TERMINAL.md) documents it.

**Nothing uses it.** There is no terminal screen anywhere in the app, and no terminal view library
is installed.

## Found in the review

Read from code on 2026-11-19; nothing here was run.

- **Likely bug.** The navigation handler in `src/main/terminal/manager.ts` ends a window's
  terminals on any main-frame navigation and ignores the same-document flag. The app uses hash
  routing (`src/renderer/src/router.tsx`), so changing page would probably close every terminal.
- **Start-up risk.** The native terminal module is imported when the app starts. If it fails to
  load, the whole app may fail to start, not just the terminal _(inferred)_.
- **Environment.** The user's shell inherits the app's entire environment
  (`src/main/terminal/environment.ts`), including app-internal variables. The agent's own commands
  get a filtered one (`src/main/agent/execution/environment.ts`).
- **Output.** Every chunk is sent to the window as it arrives, with no batching, no flow control
  and no kept history, so a session cannot be reattached after a reload.
- **Stopping.** One signal is sent with no forced stop afterwards, and there is no limit on the
  number of sessions.
- **Three separate command paths.** The agent's `bash` tool
  (`src/main/agent/tools/core/bash.ts`), its `process` tool
  (`src/main/agent/tools/core/process.ts`) and the coding page (`src/main/coding/shell.ts`) each run
  commands their own way. None appears in a user terminal.
- **Single line of defence.** Plugin app views load the same preload and can see the terminal API;
  only the main-process sender check stops them.
- **Tests.** CI (`.github/workflows/pipeline.yml`) never runs the smoke test
  (`scripts/terminal-smoke.cjs`), and nothing checks that the native module loads in packaged
  builds. Linux has no prebuilt binary and builds it at package time.
- **Doc drift.** [Terminal](../TERMINAL.md) describes an install step the project does not use.

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 14.1 | Sound back end | Terminals survive page changes and reloads, cannot stop the app from starting, and cope with large output | Fixes to the findings above | M |
| 14.2 | Terminal panel | A terminal in the app, opening in the active workspace folder | The existing API; needs a terminal view library (new dependency) | M |
| 14.3 | Tabs and essentials | Several terminals, search, copy and paste, clickable links, theme and text size following the app | 14.2 | M |
| 14.4 | Clean environment | The shell gets the user's own environment without the app's internals | The filter the agent's commands already use | S |
| 14.5 | Terminal and chat | Send a selection or an error to the chat; the agent proposes a command and the user runs it with one click | 14.2 | M |
| 14.6 | Agent commands visible | Commands the agent runs appear in a read-only terminal tab | The agent's `bash` and `process` tools | M |
| 14.7 | Checks | The smoke test runs in CI; packaged builds are checked on all three systems | `scripts/terminal-smoke.cjs` | S |

## Open decisions

- **May the agent type into the user's terminal?** Recommended: no by default. It proposes, the
  user runs. Direct typing only with approval, under the same permission rules as its own commands.
- **Where the panel lives.** Recommended: a bottom panel in Workspace first, since it opens in the
  workspace folder; Home later if wanted.
- **Order.** 14.1 and 14.4 before any screen is built on the back end.
- **Network.** Commands the user types are the user's own and are not filtered; commands the agent
  runs follow the [Network shield](SHIELD.md), 13.4.
