# Pre-tool log

A `PRE_TOOL_USE` hook script. Kucedr runs it right before every agent tool call (chat, tasks, health, subagents and voice). It only writes a log: it never changes, blocks or slows down the tool beyond its own run time, and a failure is ignored.

Each call is appended as one JSON line to `<directory>/pre-tool-use-YYYY-MM-DD.jsonl`, with:

- `time`, `event`, `agent`, `runId`, `toolCallId`, `toolName`
- `tool`: the tool's `name`, `description`, `category` and `source` (`{ "kind": "builtin", "id" }` or `{ "kind": "mcp", "serverId", "toolName" }`)
- `input`: the validated tool input

## Configuration

`config.json`:

- `directory`: where the log files are stored. A leading `~` is the home folder, and a relative path is resolved from this script's folder. Default `~/.kucedr/logs/tools`.

Logs are never rotated or deleted, and they contain full tool inputs.
