# Agent work and automation use cases

Use disposable data. File writes and commands can request permission outside the trusted agent workspace. See [permissions and runtime](../FEATURES.md#permissions-and-execution-control).

## Write and read a workspace file

1. Send: “Create `test-<RUN>.md` in my agent workspace with the text `Kucedr file test <RUN>`, then read it back and report its path.”

**Pass:** The write and read tools appear in activity, the content matches, and the file is visible in Workspace. Delete the file afterward.

## Run a harmless command

1. Send: “Run a command that prints the current working directory and the word `KUCEDR-<RUN>`. Do not install packages or modify files.”

**Pass:** Command tool activity contains the expected output and exit status. If the sandbox or permission policy denies it, record that as a permission result rather than a model response pass.

## Create and run a scheduled task

1. Configure a Task model. Send: “Create a scheduled task named `Kucedr task <RUN>` that asks for a one-line greeting every day at 09:00 in my local time zone. Show the cron expression and prompt before saving.”
2. Open **Settings → Tasks**, find the record, and use **Run now**.

**Pass:** The task appears with its prompt and schedule, and Run now produces a task run/session result. Pause or delete the disposable task after testing. Background runs cannot pause for interactive tool approval.

## Run a health checklist

1. Configure a Health model. In **Settings → Health**, save a short `HEALTH.md` checklist such as “Check whether the agent workspace contains `test-<RUN>.md`; report `HEALTH_OK` if it does.”
2. Set an interval and inspect the next health result while Kucedr remains open.

**Pass:** A health run occurs and its result follows the checklist. An empty or heading-only checklist is skipped. Restore your previous checklist and interval afterward.
