# 5. Reliability and updates

Part of the [Roadmap](README.md). Status: proposal.

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 5.1 | Stable and beta channels | Stable updates by default, beta as a choice, and update checks can be switched off | `src/main/updater.ts` gives everyone prereleases today, on one channel with no opt-out | S |
| 5.2 | Crash recovery | The window reloads itself after a crash and offers to resume an interrupted run | Crashes are logged by `src/main/shared/error_reporter.ts`; a crashed window is not reloaded; resume behaviour today is _not verified_ | M |

## Kept out on purpose

A crash-reporting service. The app sends no telemetry today, and that is worth keeping.
