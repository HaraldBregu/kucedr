# post-model-log

Runs after every agent model turn and appends the event as one JSON line to `<directory>/post-model-turn-YYYY-MM-DD.jsonl`.

Configuration (`config.json`):

- `directory`: where the log files are stored. A leading `~` is the home folder; a relative path is resolved from this script's folder. Default `~/.kucedr/logs/models`.

Each line has `time`, `event`, `agent`, `agentId`, `runId`, `sessionId`, `model`, `stopReason`, `usage`, `retryCount`, `durationMs`, `firstTokenLatencyMs`, `content` and `toolCalls` (`id` and `name` of each). `model` has the model `id` the provider answered with, `provider`, `effort`, `contextWindow`, `maxTokens` and `options`.
