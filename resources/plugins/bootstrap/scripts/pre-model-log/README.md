# Pre-model log

A `PRE_MODEL_TURN` hook script. Kucedr runs it right before every agent model turn (chat, tasks, health, subagents and context compaction; not voice). It only writes a log: it never changes the request, and a failure is ignored.

Each turn is appended as one JSON line to `<directory>/pre-model-turn-YYYY-MM-DD.jsonl`, with:

- `time`, `event`, `agent`, `agentId`, `runId`, `sessionId`
- `model`: the model `id`, `provider`, `effort`, `contextWindow`, `maxTokens` and `options`
- `estimatedInputTokens`, `messageCount` and `toolCount`

## Configuration

`config.json`:

- `directory`: where the log files are stored. A leading `~` is the home folder, and a relative path is resolved from this script's folder. Default `~/.kucedr/logs/models`.

Logs are never rotated or deleted.
