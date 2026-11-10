# Pre-tool log

A `PRE_TOOL_USE` hook script. Kucedr runs it right before every agent tool call (chat, tasks, health, subagents and voice). It only writes a log: it never changes, blocks or slows down the tool beyond its own run time, and a failure is ignored.

Each call is appended as one JSON line to `<directory>/pre-tool-use-YYYY-MM-DD.jsonl`, with:

- `time`, `event`, `agent`, `runId`, `toolCallId`, `toolName`
- `tool`: the tool's `name`, `description`, `category` and `source` (`{ "kind": "builtin", "id" }` or `{ "kind": "mcp", "serverId", "toolName" }`)
- `input`: the validated tool input

## Configuration

Set it up in **Settings → Scripts → Pre-tool log**. The fields come from `settings.inputSchema` in `manifest.json`:

- `enabled` (required, default off): turns the log on.
- `directory` (required): the folder the log files are stored in. A leading `~` is the home folder.

The script runs only once `enabled` is on and `directory` is saved. Kucedr sends the saved values to the script as `settings` in each event.

Logs are never rotated or deleted, and they contain full tool inputs.
