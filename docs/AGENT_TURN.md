# Agent Turn — Analysis & Changes

> **Status:** analysis done on 2026-11-10. Implementation of the five items in "Order of work" started on 2026-11-11; see "Current state" at the end for what landed.

## Scope

One agent turn is: build the system prompt and tool list, call the model, run the tool calls it returns, persist, repeat. The code path is `agent/agent.ts` → `runner/run_stream.ts` → `runner/run_model_turn.ts` → `runner/run_tool_call.ts`, with the system prompt in `agent/system/`, tool discovery in `runner/run_discovery.ts`, MCP in `agent/tools/mcp/` and `main/mcp/`, skills in `agent/skills/`, and the provider adapters in `models/adapters/llm/`.

## Method

- Read the turn path end to end.
- Mined the local run traces: 341 runs, 2,094 model calls, 50 sessions. Each session folder under `~/.kucedr/sessions/<id>/` holds `run.jsonl` (timed events with token usage, no message content), `SYSTEM.md` (last system prompt sent) and `messages.json`.
- Bundled the context-budget, tool-search and MCP-hint modules with esbuild and ran them against synthetic input and the saved sessions.

## Where the time goes

Last four days before the analysis (110 runs, 855 model calls):

| Measure | Value |
|---|---|
| Share of run time spent in model calls | 86% (7,885 s of 9,215 s) |
| Input tokens per model call | avg 64K, median 81K, p90 93K |
| Output tokens per model call | avg 631 |
| Time to first token | avg 7.5 s, median 3.4 s |
| Local work between turns (prompt build, persist, hooks) | avg 18 ms, max 64 ms |
| Run startup before the first model call | avg 21 ms |
| Tool calls per model turn | 1.0 on average |

Consequences:

- Session persistence, settings reads and startup are not worth optimizing. Startup grows with the MCP catalog (11 ms median with none, 55 ms median and 245 ms p90 with 41–64 tools) but stays small.
- Parallel tool execution would have saved 50 s of 17,516 s (0.3%), because the model almost never emits two calls in one turn.
- Anything that shrinks or caches the input, or removes a model round trip, pays; nothing else does.

## Findings: speed

1. **Prompt caching was defeated every turn.** `system_add_base_prompt.ts` wrote a millisecond timestamp at character 1,866 of a ~40 KB system prompt, and `run_stream.ts` rebuilt that prompt on every turn. Providers that cache by prefix could reuse about 470 tokens of a ~64K request. The directory listing ("refreshed before every model turn") also changed mid-prompt whenever the agent created a file. The Anthropic adapter never set `cache_control`. The adapters dropped the cached-token fields from usage, so the hit rate could not be measured.
2. **Long sessions sat at a context cap that was too low.** Models picked from a provider's live list (OpenRouter, iteraCompute) are not in the catalog, so `findModel` returned nothing and the run fell back to a 128K window and 8,192 output tokens. On `openrouter/~deepseek/deepseek-flash-latest` input never exceeded 99K tokens and 58% of calls were above 80K, while the same model on the native provider reached 318K. The estimator counts 3 bytes per token, so the usable budget was roughly 90K real tokens.
3. **Model round trips.** Each turn costs about 9 s and re-sends the whole context. `tool_search`-only turns were 9% of all turns historically and 3% after `bash`, `search_web` and `fetch_web_page` were preloaded on 2026-11-09; 13% of recent runs still started with one. The most-searched remaining tools were `use_web_browser`, `process`, `run_task_now` and the three `create_*` tools. 14 runs (4%) hit the 32-turn cap doing ordinary work, one `bash` call per turn.
4. **Reasoning effort was dropped for most providers.** It was forwarded only for openai, anthropic, xai, openrouter, cohere and zai. For deepseek the two flags that would send it (`reasoningEffortEnabled`, `thinkingModeEnabled`) are never set, so those runs thought at the provider default on every turn. One trace shows a 69 s turn whose only output was a `tool_search` call.
5. **MCP connections are opened and closed per run.** The first call to a server in a run took a median 1.3 s against 0.17 s for later calls (61 calls, small sample).

## Findings: correctness

| # | Problem | Evidence |
|---|---|---|
| 1 | An MCP server name in the message removed every built-in tool for the run, and so did any "<word> mcp" phrase. | Ran the modules: "delete the old mcp config file" produced hint `old`; with a hint, `tool_search("read")`, `("write")` and `("bash")` returned nothing while the prompt still listed them as loadable. |
| 2 | Once over budget, every tool result above ~6 KB was replaced by `[tool result omitted]`, including the one just fetched. If the current turn alone was too big the run threw. | Replayed the saved sessions with the 128K fallback: 15 of 50 over budget, 5 with results of the latest turn blanked, 1 threw. |
| 3 | A 10-minute wall-clock limit killed the run and reported it as `cancelled`. Time waiting on an `ask` answer counted against it. | One run ended at exactly 600 s as `cancelled` after 9 slow turns. |
| 4 | `undo` and `redo` only saw edits from the same run, so "undo that" as a follow-up message could not work. | The sessions contain "There is no file operation to undo." |
| 5 | Any provider error containing "exceed", "context" or "too long" became a context-overflow error and was never retried. That catches rate-limit messages such as "would exceed your rate limit". | By reading; not seen in traces. |
| 6 | A hook script with a saved directory but `enabled` off was still spawned on every model turn and tool call, because the default is the string `'false'`, which passed the required check. | Spawn measured at 36 ms each. |
| 7 | Every streamed tool-argument delta carries the full accumulated text over IPC (`agent.ts`, `tool_call_args_delta`), so cost grows with the square of the argument size. | By reading; the renderer already receives `jsonDelta`. |

Already fixed before this work: the `unknown tool` errors (61, all older than the "not loaded" message) and `fetch_web_page` rejecting public hosts as private (26 failures until the 2026-11-09 fix in `private.ts`).

## Findings: tools, skills, MCP

- **Tool gate.** The strict gate with one filter pipeline and an actionable error is correct (see `TOOL_SELECTION.md`).
- **Prompt cost.** `## Tools` is 18 KB, 45% of the system prompt. It lists all eligible tools with descriptions, and the loaded ones are sent again as schemas.
- **Search breadth.** The default `limit` of 5 loads neighbours nobody asked for; the three `create_*` tools always arrive together.
- **Skills.** Skill tools exist only when the message matches English regexes (`run_skill_request.ts`) or starts with `/skill`; Italian phrasing never matches although the app ships an `it` locale. Activation lasts one run. `load_skill` was called once in 341 runs.
- **MCP, good.** Tools come from a persisted catalog and the connection opens lazily on first call.
- **MCP, open.** The 64-tool cap fills alphabetically by server id, so later servers are cut silently (peak seen: 56). A result with no text block reaches the model as JSON-stringified base64, up to 64 KB. Any tool error containing the number 401 triggers re-authorization. The 30 s tool timeout also covers connecting. Each run compiles one Ajv validator per catalogued tool.

## Order of work

1. Make the prompt prefix stable and record cached tokens.
2. Fix the MCP hint: preload the hinted server's tools alongside the built-ins.
3. Fix the context budget: keep the current turn intact, and use the real window for models from a live list.
4. Fix the timeout: report it as a timeout and pause it during any user wait.
5. Small ones: undo history, effort for deepseek, error classification, hook check.

## Current state

Landed on 2026-11-11:

- **Stable prefix.** The clock moved out of `addBasePrompt` into `system/clock.ts` and is appended last by `buildSystemPrompt`. `run_stream.ts` builds the prompt once per tool set and reuses it across turns, so the clock and the directory listing are fixed for the run. The clock is therefore the run's start time, not the turn's.
- **Cached tokens.** `LlmUsage.cachedTokens` is filled by all six adapter paths and written to `model_call_end` in `run.jsonl`. The Anthropic requests send top-level `cache_control`.
- **MCP hint.** A named server's tools are preloaded next to the built-ins; the hint no longer removes or hides anything, and the "<word> mcp" branch is gone.
- **Context budget.** Results of the current turn are omitted oldest first and only while that turn does not fit. `resolveContextWindow` reads the window from the provider's live model list when the catalog has none (one lookup per provider per app run).
- **Timeout.** Ten minutes without any event, paused while waiting on `ask`, MCP authorization or a permission prompt, and reported as `timeout`.
- **Small ones.** Undo history is kept per main chat in memory; effort is sent to deepseek as `reasoning_effort`; provider errors with status 429 or 5xx are no longer classified as context overflow; a hook whose required boolean is off is not spawned.

- **MCP output.** A result with no text block keeps its structure, but its base64 `data` and `blob` fields are replaced by a length note, so an image no longer fills the context.

Checked: `typecheck:node` and eslint pass. Every change except the run loop itself was run as a bundled module with stand-ins for Electron and the settings store: budget, hint, effort, trace, prompt prefix, hook spawning, MCP output, and the live window lookup (the OpenRouter and iteraCompute DeepSeek models both resolve to 1,048,576). Not confirmed: a live model call. The dev app has to be restarted to load the main-process changes; a run made at 09:57 on 2026-11-11 was still on the old build.

Not done:

- Cross-run caching of the history. The first turn of each run still misses, because three things in the system prompt can change between runs: the clock (always), the directory listing (when files were added) and the memory block (when the memory module updated it). All three would have to move behind the history, as context attached to the newest message.
- Automatic compaction. `compactConversation` replaces older messages in the chat view for good, so it stays a manual action until that is decided.
- Correctness item 7. The cumulative `argsText` on `tool_call_args_delta` is part of the event type the SDK package exports, so dropping it is an API change for apps.
- The 8,192 output default for live-list models, the 3-bytes-per-token estimator, and the remaining tools, skills and MCP points above.
- Tests for the timeout, undo history, hook check, deepseek effort and error classification.

Tests: the five that encoded the old behaviour were updated (`system-prompt`, `run-discovery`, `run-stream-prompt`, `llm-nonstream`) and two were added (current-turn trimming in `run-model-context-budget`, the live-list window in `models/context`). Compared with the commit before this work, these changes add no failures to the main suite. 56 of its files still fail for reasons that predate this work or come from other changes.

## Re-measuring

The baseline numbers above come from `run.jsonl`. After the changes, `model_call_end` also records `cachedTokens`, so the cache hit rate is `cachedTokens / inputTokens` per call. Expect it near zero on the first turn of a run and high on later turns.

## Round 2 (2026-11-12)

Goal: faster first response and fewer seconds to finish a task. Analysis only; no code changed.

### Measurements

Traces since 2026-11-06: 131 runs. Only 13 runs were made after the round-1 fixes, so the cache numbers are a small sample.

| Measure | Value |
|---|---|
| Model turns per run | median 4, avg 7, p90 18; 4 runs hit the turn cap |
| Model call duration | median 5.3 s, p90 21 s |
| Tool calls per model turn | ~1.0 |
| Tool time | small: `bash` avg 0.3 s; `ask` 719 s total is time waiting on the user |
| Cache hit rate after round 1 | 0.73 on turns 2+, ~0 on turn 1 of each run |
| Local work between turns, startup | still ~20 ms and under 100 ms |

Time to first token by provider, same model family:

| Route | TTFT median | Cached tokens reported |
|---|---|---|
| `openrouter/~deepseek/deepseek-flash-latest` | 2.9 s | 0 (pre-fix runs) |
| `iteracompute/deepseek/deepseek-v4.1-flash-1017` | 10.7 s | 0, also after the fix |

Each turn is one model round trip, so the number of turns is the main reason tasks take long. Local code is still not worth touching.

### Findings, largest expected win first

1. **Turn 1 of every run misses the cache for the whole history.** `system/clock.ts` puts `new Date()` in the system prompt. Memory (`options.memory.read()`) and the directory listing (`addWorkspacePrompt`) are in it too (`runner/run_stream.ts:453-485`). Messages come after the system prompt, so a 60–80K-token history is processed again on every new user message. Fix: move the clock, memory and directory listing out of the system prompt and into an internal context block on the newest user message. This is the "cross-run caching" item already under "Not done".
2. **Each `tool_search` load breaks the cache in the middle of a run.** Loading a tool changes `turnKey`, so `buildSystemPrompt` runs again (`run_stream.ts:452`). That changes the `## Tools` section (18 KB, near the top), takes a new clock reading, lists the directory again and changes the tool schemas. Fixes, cheapest first: preload the most-searched tools (`use_web_browser`, `process`, the `create_*` tools) so the search turn goes away, and take the clock reading once per run.
3. **Tools run one at a time and the prompt never asks for batching.** `runner/run_tool_calls.ts:18` is a sequential `for`, and no prompt text tells the model to send independent tool calls together. The round-1 estimate (parallel execution saves 0.3%) was measured on models that were never asked to batch. Fix: add one prompt line asking for independent calls in a single response, and run read-only calls (`tools/core/readonly.ts`) at the same time. This cuts turns, which is the main cost.
4. **The provider route changes time to first token 3–4× on the same model.** This is configuration, not code: show it to the user or default to the faster route.

Not worth doing: session persistence, settings and memory reads, startup, MCP startup.

### Order of work

3 (batching: one prompt line and concurrent read-only tools) → 2 (preloading and a single clock reading per run) → 1 (moving the per-run context next to the newest message).

### Landed (2026-11-12)

- **Batching.** The `## Tools` section asks for independent tool calls in one response. Running read-only tools at the same time was not done: tool time is under 1 s on average, so the saving comes from having fewer turns, not from concurrency.
- **Preloading.** `use_web_browser`, `process`, `create_image`, `create_video` and `create_sound` are now in the required set in `run_stream.ts`.
- **Run context.** `buildRunContext` (`system/system_build_run_context.ts`) builds the filesystem listing, the clock and memory once per run. `attachRunContext` (`runner/run_attach_context.ts`) adds it as the first text block of the run's user message in the request only, so it is never saved to the history. `buildSystemPrompt` now takes a `runContext` flag. `run_stream` passes `false`, so the system prompt and the earlier history stay identical from run to run. Realtime voice keeps the default and is unchanged. **Correction (same day):** the previous user message then renders without its block on the next run. Providers that only reuse a prefix that ended an earlier request (Anthropic, OpenAI GPT-5.6+, DeepSeek) therefore still miss on turn 1. Only fixed-interval caching benefits. The fix, saving the block into the stored message, is in `PROMPT_CACHE.md` (finding A, plan step 2). `buildWorkspaceContext` no longer takes memory.

Checked: `typecheck:node` and eslint pass. A bundled check confirmed that two prompt builds are byte-identical, that the clock and filesystem listing are absent from the run prompt and still present for voice, and that the context is attached to the right message without changing the saved message. Not run: the unit suite. `run-stream-prompt`, `system-prompt` and `system-filesystem` probably still expect the old layout. Not confirmed: a live model call. Restart the dev app before measuring.

### Re-measuring

Measure turns per run, the turn-1 cache hit rate and the median run time from `run.jsonl` (`model_call_end` has `durationMs`, `firstTokenLatencyMs` and `usage.cachedTokens`; `run_finished` has `numTurns`), then compare them with the tables above.
