# 2. Performance and agent efficiency

Part of the [Roadmap](README.md). Status: 2.1–2.4, 2.6 and 2.7 built. The remaining items are
proposed.

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
| 2.6 | Instant start and sidebar | Window appears before background services start; the chat list updates on change | Built 2026-11-25. Sidebar: it no longer re-reads every chat every 1.5 s. Main watches the sessions folder (`src/main/agent/session/session_watch.ts`, ignoring `run.jsonl`, settled for 300 ms) and sends `agent:sessions-changed`; the sidebar reloads on that. Checked in a production build: no list call in 6 s idle, 4 during a 300-chunk reply, and a chat written to disk from outside appeared. Start: no change. The daily log shows services take 71–113 ms before the window is created across nine starts; the rest of the 1.29 s was the renderer loading, 1.1–1.4 s from the dev server. In a production build, launch to first render is 655–783 ms (below), so the remaining lever is the 4 MB renderer chunk | M |
| 2.7 | Performance check | A repeatable measurement of start time, streaming smoothness and bundle size, run before each release | Built 2026-11-25: `npm run perf` (`scripts/perf.mjs`) after `npm run build`; listed in the release preflight ([Development](../DEVELOPMENT.md#release-preflight-for-every-product)). Not in CI | S |
| 2.8 | Spend tracking | Cost per provider and per chat over time, with prices read from plugin manifests | Shares its data with 2.2 | M |

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

What this means for the next items: streaming in a new chat is already smooth, so 2.5 needs a
measurement in a long chat before any work. The sidebar's 1.5 s re-read is gone (2.6); the
4 MB renderer chunk is the likeliest cost left at start.
