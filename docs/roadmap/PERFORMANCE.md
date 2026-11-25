# 2. Performance and agent efficiency

Part of the [Roadmap](README.md). Status: 2.1–2.4 and 2.7 built. The remaining items are proposed.

Agent-turn speed has five measured rounds in [AGENT_TURN.md](../AGENT_TURN.md). The model call
dominates, so the features that matter reduce turns and prompt size, then make the app feel instant
around the model. The baseline for streaming, startup and bundle size (2.7) is below.

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 2.1 | Automatic compaction | Main chats can summarize older turns as they approach the model’s context limit. An expandable marker shows the summary, and the original messages remain readable and searchable | Built. With a known context window, the app attempts compaction at 80% of the available input budget using the configured compaction model or the chat model. Existing context trimming handles an unavailable summary | M |
| 2.2 | Run insights | Per reply: time to first token, turns, tokens, cache hits and cost, with a timeline of model and tool steps | Built: open Run insights from a reply’s actions. Reads the local session trace on demand. Shows reported cost when available for the whole run. Older replies use their timestamp when it identifies one run | M |
| 2.3 | Run budgets | Set optional turn and token limits in Settings → Chat. The run warns at 80% usage and pauses before a call would exceed the allowance | Built. Stop ends the run. Continue authorizes one main chat model call. Compaction and delegated model calls are outside these limits | S |
| 2.4 | Lighter first message | A smaller opening prompt when saved conversation summaries are unrelated to the request | Built. Main chat keeps durable memory and recalls summaries matching the current request, including follow-ups. In a 15-summary fixture, an unrelated opening request included 93 bytes of memory from a 5,736-byte file. Live provider latency remains unmeasured ([measurement](../AGENT_TURN.md#on-demand-memory-summaries-2026-11-25)) | S–M |
| 2.5 | Smooth streaming | Replies stream without stutter in long chats | Each token appears to re-render the whole chat and crosses to the window one at a time _(read from code)_. Measured 2026-11-25 in a new chat: a 600-chunk reply streamed at 60 fps with no long task (see the baseline below). A chat with a long history is not measured yet | M |
| 2.6 | Instant start and sidebar | Window appears before background services start; the chat list updates on change | 1.29 s from services ready to window shown on the surveyed machine; `src/renderer/src/pages/home/Sidebar.tsx` re-reads every chat from disk every 1.5 s | M |
| 2.7 | Performance check | A repeatable measurement of start time, streaming smoothness and bundle size, run before each release | Built 2026-11-25: `npm run perf` (`scripts/perf.mjs`) after `npm run build`; listed in the release preflight ([Development](../DEVELOPMENT.md#release-preflight-for-every-product)). Not in CI | S |
| 2.8 | Spend tracking | Cost per provider and per chat over time, with prices read from plugin manifests | Shares its data with 2.2 | M |
