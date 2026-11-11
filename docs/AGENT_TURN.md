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

Implementation in progress; this section is replaced when it lands.

## Re-measuring

The baseline numbers above come from `run.jsonl`. After the changes, `model_call_end` also records `cachedTokens`, so the cache hit rate is `cachedTokens / inputTokens` per call. Expect it near zero on the first turn of a run and high on later turns.
