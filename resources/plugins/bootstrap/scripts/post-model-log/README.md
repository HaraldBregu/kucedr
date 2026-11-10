# Post-model log

A `POST_MODEL_TURN` hook script. Kucedr runs it right after every successful agent model turn (chat, tasks, health, subagents and context compaction; not voice), without waiting for it. It only writes a log: it never changes the reply, and a failure is ignored. A turn that fails after its retries is not logged.

Each turn is appended as one JSON line to `<directory>/post-model-turn-YYYY-MM-DD.jsonl`, with:

- `time`, `event`, `agent`, `agentId`, `runId`, `sessionId`
- `model`: the model `id` the provider answered with, `provider`, `effort`, `contextWindow`, `maxTokens` and `options`
- `stopReason`, `usage`, `retryCount`, `durationMs` and `firstTokenLatencyMs`
- `content` (the reply text) and `toolCalls` (`id` and `name` of each)

## Configuration

`config.json`:

- `directory`: where the log files are stored. A leading `~` is the home folder, and a relative path is resolved from this script's folder. Default `~/.kucedr/logs/models`.

Logs are never rotated or deleted, and they contain the full reply text.
