# 2. Performance and agent efficiency

Part of the [Roadmap](README.md). Status: 2.1–2.4 built. The remaining items are proposed.

Agent-turn speed has five measured rounds in [AGENT_TURN.md](../AGENT_TURN.md). The model call
dominates, so the features that matter reduce turns and prompt size, then make the app feel instant
around the model. The renderer and startup have not been measured yet; 2.7 comes first for those.

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 2.1 | Automatic compaction | Main chats can summarize older turns as they approach the model’s context limit. An expandable marker shows the summary, and the original messages remain readable and searchable | Built. With a known context window, the app attempts compaction at 80% of the available input budget using the configured compaction model or the chat model. Existing context trimming handles an unavailable summary | M |
| 2.2 | Run insights | Per reply: time to first token, turns, tokens, cache hits and cost, with a timeline of model and tool steps | Built: open Run insights from a reply’s actions. Reads the local session trace on demand. Shows reported cost when available for the whole run. Older replies use their timestamp when it identifies one run | M |
| 2.3 | Run budgets | A limit on turns or tokens per run, with a warning and a pause before the limit | Built. Optional limits apply to the main chat model. The user can stop or authorize one more call | S |
| 2.4 | Lighter first message | A smaller opening prompt when saved conversation summaries are unrelated to the request | Built. Main chat keeps durable memory and selects summaries by the current message on each run | S–M |
| 2.5 | Smooth streaming | Replies stream without stutter in long chats | Each token appears to re-render the whole chat and crosses to the window one at a time _(read from code, not measured)_ | M |
| 2.6 | Instant start and sidebar | Window appears before background services start; the chat list updates on change | 1.29 s from services ready to window shown on the surveyed machine; `src/renderer/src/pages/home/Sidebar.tsx` re-reads every chat from disk every 1.5 s | M |
| 2.7 | Performance check | A repeatable measurement of start time, streaming smoothness and bundle size, run before each release | Startup lines in the daily log, the memory monitor in `src/main/shared/metrics.ts`, the Playwright smoke spec | S |
| 2.8 | Spend tracking | Cost per provider and per chat over time, with prices read from plugin manifests | Shares its data with 2.2 | M |
