# 2. Performance and agent efficiency

Part of the [Roadmap](README.md). Status: 2.2 built; remaining items proposed.

Agent-turn speed has five measured rounds in [AGENT_TURN.md](../AGENT_TURN.md). The model call
dominates, so the features that matter reduce turns and prompt size, then make the app feel instant
around the model. The renderer and startup have not been measured yet; 2.7 comes first for those.

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 2.1 | Automatic compaction | Long chats stay fast and cheap without pressing Compact; a visible marker shows where history was summarised | Manual compaction with its own model (`src/main/agent/compaction/compact.ts`); trimming when the context is full | M |
| 2.2 | Run insights | Per reply: time to first token, turns, tokens, cache hits and cost, with a timeline of model and tool steps | Built: open Run insights from a reply’s actions. Reads the local session trace on demand. Shows reported cost when available for the whole run. Older replies use their timestamp when it identifies one run | M |
| 2.3 | Run budgets | A limit on turns or tokens per run, with a warning and a pause before the limit | Turn and token counts already in the run events | S |
| 2.4 | Lighter first message | Faster first reply in a new chat by loading memory summaries on demand instead of always | First call is 10.6K tokens against a 9K target; memory summaries are 5.7 KB of it ([AGENT_TURN.md](../AGENT_TURN.md), round 5) | S–M |
| 2.5 | Smooth streaming | Replies stream without stutter in long chats | Each token appears to re-render the whole chat and crosses to the window one at a time _(read from code, not measured)_ | M |
| 2.6 | Instant start and sidebar | Window appears before background services start; the chat list updates on change | 1.29 s from services ready to window shown on the surveyed machine; `src/renderer/src/pages/home/Sidebar.tsx` re-reads every chat from disk every 1.5 s | M |
| 2.7 | Performance check | A repeatable measurement of start time, streaming smoothness and bundle size, run before each release | Startup lines in the daily log, the memory monitor in `src/main/shared/metrics.ts`, the Playwright smoke spec | S |
| 2.8 | Spend tracking | Cost per provider and per chat over time, with prices read from plugin manifests | Shares its data with 2.2 | M |

## Open decisions

- **2.4 changes what the agent knows at the start of a chat.** It is a product choice, already
  noted as open in round 5.
