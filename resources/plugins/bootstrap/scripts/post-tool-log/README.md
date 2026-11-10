# Post-tool log

A `POST_TOOL_USE` hook script. Kucedr runs it right after every executed agent tool call (chat, tasks, health, subagents and voice), without waiting for it. It only writes a log: it never changes the tool result, and a failure is ignored.

Each call is appended as one JSON line to `<directory>/post-tool-use-YYYY-MM-DD.jsonl`, with:

- `time`, `event`, `agent`, `runId`, `toolCallId`, `toolName`
- `tool`: the tool's `name`, `description`, `category` and `source` (`{ "kind": "builtin", "id" }` or `{ "kind": "mcp", "serverId", "toolName" }`)
- `input`, `output` (the text the model sees), `isError` and `durationMs`

## Configuration

`config.json`:

- `directory`: where the log files are stored. A leading `~` is the home folder, and a relative path is resolved from this script's folder. Default `~/.kucedr/logs/tools`.

Logs are never rotated or deleted, and they contain full tool inputs and outputs.
