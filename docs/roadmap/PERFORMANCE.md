# 2. Performance and agent efficiency

Part of the [Roadmap](README.md). Status: 2.1–2.8 built. Spend tracking reports provider-returned costs when model manifests identify the response field; it does not estimate prices when unavailable.

Agent-turn speed has five measured rounds in [AGENT_TURN.md](../AGENT_TURN.md). The model call
dominates, so the features that matter reduce turns and prompt size, then make the app feel instant
around the model. The baseline for streaming, startup and bundle size (2.7) is below.

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 2.1 | Automatic compaction | Main chats can summarize older turns as they approach the model’s context limit. An expandable marker shows the summary, and the original messages remain readable and searchable | Built. With a known context window, the app attempts compaction at 80% of the available input budget using the configured compaction model or the chat model. Existing context trimming handles an unavailable summary | M |
| 2.2 | Run insights | Per reply: time to first token, turns, tokens, cache hits and cost, with a timeline of model and tool steps | Built: open Run insights from a reply’s actions. Reads the local session trace on demand. Shows reported cost when available for the whole run. Older replies use their timestamp when it identifies one run | M |
| 2.3 | Run budgets | Set optional turn and token limits in Settings → Chat. The run warns at 80% usage and pauses before a call would exceed the allowance | Built. Stop ends the run. Continue authorizes one main chat model call. Compaction and delegated model calls are outside these limits | S |
| 2.4 | Lighter first message | A smaller opening prompt when saved conversation summaries are unrelated to the request | Built. Main chat keeps durable memory and recalls summaries matching the current request, including follow-ups. In a 15-summary fixture, an unrelated opening request included 93 bytes of memory from a 5,736-byte file. Live provider latency remains unmeasured ([measurement](../AGENT_TURN.md#on-demand-memory-summaries-2026-11-25)) | S–M |
| 2.5 | Smooth streaming | Replies stream without stutter in long chats | Measured 2026-11-26: the performance check seeds a 20-turn history, then streams a 600-chunk reply at 60 fps, with no frame over 50 ms and no long task. See the long-chat result below. | M |
| 2.6 | Instant start and sidebar | Window appears before background services start; the chat list updates on change | Built 2026-11-26. The sidebar reloads on session-folder changes instead of polling. Workspace and Shiki code load on demand. The production performance check measured a 3,687 KB largest renderer entry chunk, down from 4,037 KB in the 2026-11-25 fresh run. The current run measured 537 ms to first window and 649 ms to first render; startup remains sensitive to host load. | M |
| 2.7 | Performance check | A repeatable measurement of start time, streaming smoothness and bundle size, run before each release | Built 2026-11-25: `npm run perf` (`scripts/perf.mjs`) after `npm run build`; listed in the release preflight ([Development](../DEVELOPMENT.md#release-preflight-for-every-product)). Not in CI | S |
| 2.8 | Spend tracking | Built 2026-11-26. Settings → Usage shows reported cost totals by month, provider, and chat from local run traces. It reads response costs through the model manifest's `costUsdPath`; token totals remain visible when no cost is reported. Current manifests declare provider-returned cost fields for OpenRouter. No price estimate is shown when a model does not report a cost. | Shares run usage with 2.2 | M |

## Performance check (2.7)

`npm run perf` measures a built app. Baseline, 2026-11-25, on the development Mac (Apple
silicon), from a clean production build of `dev` on that date:

| Measure | Value |
| --- | --- |
| Main bundle | 1,562 KB |
| Preload bundle | 107 KB |
| Renderer bundle | 19,603 KB; largest chunk 4,114 KB |
| Launch to first window (median of 3) | 578 ms |
| Launch to first render (median of 3) | 705 ms |
| 600-chunk reply, new chat | 3.8 s at 60 fps; 0 frames over 50 ms; longest frame 18 ms; 0 long tasks |

Four runs of the script gave medians of 551–636 ms to the first window and 655–783 ms to the
first render, with the same streaming numbers each time. Launch times
include Playwright's own start-up, so compare them only with other runs of the script. Both
jank probes were checked by blocking the page for 300 ms during a stream: the frame probe
reported a 282 ms frame and the long-task probe one 300 ms task.

Latest run, 2026-11-26, after lazy-loading Shiki and adding the long-chat scenario:

| Measure | Value |
| --- | --- |
| Main bundle | 1,604 KB |
| Preload bundle | 109 KB |
| Renderer bundle; largest entry chunk | 19,650 KB; 3,687 KB |
| Launch to first window | 537 ms |
| Launch to first render | 649 ms |
| 600-chunk reply, 20-turn history | 3.84 s at 60 fps; 0 frames over 50 ms; longest frame 18 ms; 0 long tasks |

Streaming is smooth in both a new chat and a 20-turn history. The sidebar's 1.5 s re-read is gone
(2.6), and the largest renderer entry chunk is 350 KB smaller than the 2026-11-25 fresh-run
measurement. The total renderer bundle remains similar because code loaded on demand still
contributes to the emitted-file total.
