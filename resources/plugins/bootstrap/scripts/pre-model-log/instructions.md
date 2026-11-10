# pre-model-log

Runs before every agent model turn and appends the event as one JSON line to `<directory>/pre-model-turn-YYYY-MM-DD.jsonl`.

Configuration (`config.json`):

- `directory`: where the log files are stored. A leading `~` is the home folder; a relative path is resolved from this script's folder. Default `~/.kucedr/logs/models`.

Each line has `time`, `event`, `agent`, `agentId`, `runId`, `sessionId`, `model`, `estimatedInputTokens`, `messageCount` and `toolCount`. `model` has the model `id`, `provider`, `effort`, `contextWindow`, `maxTokens` and `options`.
