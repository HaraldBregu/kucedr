# pre-tool-log

Runs before every agent tool call and appends the event as one JSON line to `<directory>/pre-tool-use-YYYY-MM-DD.jsonl`.

Configuration (`config.json`):

- `directory`: where the log files are stored. A leading `~` is the home folder; a relative path is resolved from this script's folder. Default `~/.kucedr/logs/tools`.

Each line has `time`, `event`, `agent`, `runId`, `toolCallId`, `toolName` and `input`.
