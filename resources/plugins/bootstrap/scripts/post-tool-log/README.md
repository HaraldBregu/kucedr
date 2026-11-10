# Post-tool log

A `POST_TOOL_USE` hook script. Kucedr runs it right after every executed agent tool call (chat, tasks, health, subagents and voice), without waiting for it. It only writes a log: it never changes the tool result, and a failure is ignored.

Each call is appended as one JSON line to `<directory>/post-tool-use-YYYY-MM-DD.jsonl`, with:

- `time`, `event`, `agent`, `runId`, `toolCallId`, `toolName`
- `tool`: the tool's `name`, `description`, `category` and `source` (`{ "kind": "builtin", "id" }` or `{ "kind": "mcp", "serverId", "toolName" }`)
- `input`, `output` (the text the model sees), `isError` and `durationMs`

## Configuration

Set it up in **Settings → Scripts → Post-tool log**. The fields come from `settings.inputSchema` in `manifest.json`:

- `directory` (required): the folder the log files are stored in. A leading `~` is the home folder.

The script doesn't run until `directory` is saved. Kucedr sends the saved values to the script as `settings` in each event.

Logs are never rotated or deleted, and they contain full tool inputs and outputs.
