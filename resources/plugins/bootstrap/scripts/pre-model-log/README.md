# Pre-model log

A `PRE_MODEL_TURN` hook script. Kucedr runs it right before every agent model turn (chat, tasks, health, subagents and context compaction; not voice). It only writes a log: it never changes the request, and a failure is ignored.

Each turn is appended as one JSON line to `<directory>/pre-model-turn-YYYY-MM-DD.jsonl`, with:

- `time`, `event`, `agent`, `agentId`, `runId`, `sessionId`
- `model`: the model `id`, `provider`, `effort`, `contextWindow`, `maxTokens` and `options`
- `estimatedInputTokens`, `messageCount` and `toolCount`

## Configuration

Set it up in **Settings → Scripts → Pre-model log**. The fields come from `settings.inputSchema` in `manifest.json`:

- `enabled` (required, default off): turns the log on.
- `directory` (required): the folder the log files are stored in. A leading `~` is the home folder.

The script runs only once `enabled` is on and `directory` is saved. Kucedr sends the saved values to the script as `settings` in each event.

Logs are never rotated or deleted.
