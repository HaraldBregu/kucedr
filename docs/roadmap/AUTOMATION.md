# 16. Automation: scheduled tasks and health checks

Part of the [Roadmap](README.md). Status: proposal.

## What exists today

- Scheduled tasks run on a timer while the app is open, and Settings has Tasks and Health pages.
- Only the agent can create a task; there is no form to create or edit one
  ([FEATURES.md](../FEATURES.md)).
- A task record keeps no run history and no last result (`src/main/tasks/tasks_types.ts`).
- A failed run is written to the console only (`src/main/tasks/tasks_fire.ts`).
- Runs missed while the app was closed are not caught up.
- There is no limit on how often a task may run ([Security audit](../SECURITY_AUDIT.md) #22).
- A health check that needs attention is only logged (`src/main/health/run.ts`), and several of its
  settings are not applied yet ([FEATURES.md](../FEATURES.md), marked partial).

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 16.1 | Create and edit tasks | A form for name, instructions, schedule and allowed tools, with the schedule shown in plain words. Built 2026-11-25: New task and Edit open `tasks/edit/Page.tsx`; a task uses only the tools ticked there (none ticked means no tools), any other call fails with "not available for this agent". Tasks the agent creates (`create_task` has no tools field) and tasks saved earlier have no allowlist and keep the full catalog until edited in the form. Checked in the app: create, edit, plain-words schedule in English and Italian, only the chosen tool offered to the model, a call to another tool refused | `tasks:create` / `tasks:update` IPC, `tools/groups.ts` | M |
| 16.2 | Run history | Each task shows when it last ran, whether it worked, and a link to that run's chat. Built 2026-11-28: each settled run is saved in the task's `runs` (newest first, at most 20) with its time, its chat and any error (`tasks_fire.ts`; a task never runs twice at once, so the chat added during the run is that run's). The task page's history shows Worked or Failed (the error on hover) beside each chat, and Open chat shows it on the home page. Checked in the app with a mock provider: a working and a refused run showed Worked and Failed, and Open chat showed the run's reply | The chats a task already creates | S |
| 16.3 | Failures surfaced | A failed or stuck task is shown on the task and raises a notification. Built 2026-11-25: each run saves `lastRun` (time and error); a failed or timed-out run shows Failed in the list and the error on the task page, and the existing notifier says "Task failed". Checked in the app with a mock provider that refuses the request | Notifications ([User experience](EXPERIENCE.md), 3.1), `tasks_fire.ts` | S |
| 16.4 | Catch-up | A task missed while the app was closed runs once at next start, if the user chose that. Built 2026-11-28: "Run missed runs at start" in the task form (off by default; tasks the agent creates have it off) saves `catchUp`. At start, a task with it on runs once when its schedule had a time after its last run (or its creation) and before the current minute, in local time, looking back at most 31 days (`tasks_missed.ts`, called from `tasks_start.ts`; the usual running limits apply). Checked in the app: of three seeded tasks last run two days ago, only the daily one with catch-up on ran at start; a yearly one with it on and a daily one with it off did not; the switch saves from the form. Ceilings: day rules like `5#2` never count as missed; a run cut off by quitting leaves no last run, so it is caught up again | The schedule record | S |
| 16.5 | Limits | A minimum interval between runs and a cap on tasks running at once. Built 2026-11-25: a schedule may fire at most once every 5 minutes, refused when saved and skipped when scheduled (saved data included); at most 3 tasks run at once, Run now says so and a scheduled run is skipped. Checked in the app: `*/2` and `* * * * *` refused, a seeded every-minute task never fired, the fourth Run now refused | `tasks_limits.ts`, `tasks_interval.ts` | S |
| 16.6 | Health results | Health findings appear in the app with what needs attention, and every health setting takes effect | The Health page | M |
| 16.7 | Run while closed | Tasks run when the window is closed, from the menu bar or system tray | Nothing today | L |

## Open decisions

- **Approvals in unattended runs.** A task cannot ask the user. Recommended: a task may only use
  the tools chosen when it was created, and anything else fails with a clear message.
  Decided 2026-11-25 with 16.1: taken as recommended.
- **16.7** changes what "quitting" the app means and should be an explicit setting.
