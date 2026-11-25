# 5. Reliability and updates

Part of the [Roadmap](README.md). Status: proposal.

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 5.1 | Stable and beta channels | Stable updates by default, beta as a choice, and update checks can be switched off | `src/main/updater.ts` gives everyone prereleases today, on one channel with no opt-out | S |
| 5.2 | Crash recovery | The window reloads itself after a crash and offers to resume an interrupted run | Built 2026-11-25: a main window whose renderer crashes reloads on the same page (`src/main/reload_after_crash.ts`); a second crash within 10 s is left alone instead of looping. Runs live in the main process, so the run keeps going and the reloaded chat replays it; no resume offer is needed. A new chat now saves its real session id as soon as the run starts, so any reload or crash reopens it instead of an empty chat. Checked in the built app with a mock model | M |
| 5.3 | Replies survive leaving Home | A reply keeps running when the user opens Settings, Workspace or another page, and is there on return | Built 2026-11-21: the run is no longer cancelled when Home closes, and reopening the chat replays the live events (`src/renderer/src/pages/home/hooks/useHomeAgent.ts`). Not checked in the running app | S–M |

## Kept out on purpose

A crash-reporting service. The app sends no telemetry today, and that is worth keeping.
