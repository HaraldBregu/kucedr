# Parallel Tool Calls: Analysis

> **Status:** analysis, 2026-11-14. The question was whether the agent should run tool calls in parallel, with the goal of a faster response. This answers it with measured data rather than assumptions. No code was changed.

## Answer

- **Feasible:** yes.
- **Necessary:** no. Running a turn's tool calls concurrently would have saved **55 s in 5 h of runs (0.3%)**. The time goes to model calls, not tools.
- **Recommendation:** don't build parallel tool execution now. Spend the effort on model latency and turn count (§4).

## 1. Where the time goes

Measured from `~/.kucedr/sessions/*/run.jsonl`: all 388 runs and 2,172 model calls, read-only.

| | All history (5.04 h) | Since 2026-11-12 (37 runs) |
|---|---|---|
| Model calls | **85%** | **78%**, of which 56% is waiting for the first token |
| Tool execution (excluding approvals; `ask` included in the history column) | 10% | 18% |
| Median turn | 4–13 s (by day) | 1.5–2 s, with a 60–71% prompt-cache hit rate |

Most tools are fast. Median times: `bash` 92 ms, `read` 4 ms, `fetch_web_page` 18 ms, `use_web_browser` 12 ms, `search_web` 1.1 s. Only `create_image`/`create_video` (5–28 s), subagents and `ask` (user think time) take long. Those are rare, or can't be parallelized.

## 2. Two meanings of "parallel"

### 2a. Executing one turn's tool calls concurrently

Today `runToolCalls` (`runner/run_tool_calls.ts:18`) runs them one by one.

- Turns that request several calls: **160 of 1,708 tool turns (9%)**. The rest have a single call, so there's nothing to overlap.
- Ideal saving on those 160 turns: serial 206 s → parallel 151 s, **55 s total**. If only read-only tools run in parallel: 36 s.
- The best single batches saved about 2 s each: two `search_web` calls, or 14 contact searches.

What it would take to do it safely:
- **Approvals:** two permission prompts can't be shown at once. Calls that need approval or `ask` must stay serial.
- **Writes:** writes to overlapping paths have to serialize. The resource mutex already does this per path, but `bash` roots and file writes don't share keys.
- **Event order:** the UI and the session history expect `tool_call_start`/`end` per call. Interleaved events need buffering, or the renderer has to accept interleaving.
- **Budget, file history and stopping:** the budget is admitted per call, file history is recorded per call, and the batch stops on MCP authorization or abort. All of that would need to be made order-independent.

Cheapest safe version: run consecutive calls that are `readOnly`, need no approval, and aren't `ask`, via `Promise.all`, and emit their events in input order after each one finishes. That's about 40–60 lines plus tests, for at most 0.3%. Not worth it yet.

### 2b. The model requesting independent calls together (fewer turns)

This is the useful kind, because every turn saved removes a full model round trip: about 7 s historically, 1.5–2 s now.

- The prompt already asks for it: "request them together in one response" (`system/system_add_tools_prompt.ts`).
- How often each model batches calls: DeepSeek flash 2–16% of turns, pro 12–23%, Qwen VL 0%.
- Back-to-back read-only turns that could have been merged: **71 of 1,811 turns (about 4%)**. That's an upper bound: many are search-then-fetch-the-result, which depend on each other.
- **702 turns (39%) sit in runs of three or more consecutive single-`bash` turns.** Sampled chains are mostly dependent (inspect → edit → verify), and the model already chains commands inside one call (`&&`, Python heredocs). Little to gain here.

The agent already has the parallel path that helps for big independent work: `subagent` with 2–3 tasks runs them concurrently.

## 3. Why the analysis comes out this way

The agent spends its time waiting on the model, about 1.3 s to the first token on recent turns. Tools run in milliseconds. Running a turn's calls concurrently only overlaps tool time, which is small. Saving a whole turn removes model time, which is large. So the agent gets faster with fewer turns and faster turns.

## 4. What would actually make it faster (ranked)

1. **Time to first token (56% of recent run time)**
   - **Keep the prompt prefix stable** so the provider's cache hits.
     - The 2026-11-14 change made every tool line a one-line summary, about 23 KB → 11.6 KB. That section no longer changes when `tool_search` loads a tool, so loading stops breaking the cache.
     - Next: measure turn 1 of each run, which AGENT_TURN.md found still misses the cache.
   - **Reasoning effort per turn:** low or none for tool-routing turns, higher only for the final answer. Measure TTFT with and without it on the same prompts.
   - **Model and provider choice:** recent medians vary by about 5× between models (see §1). Expose a "fast" model profile for chat.
2. **Turn count** (median 3 per run historically, p90 15)
   - `tool_search`-only turns: 172 historically, 0 in recent runs since the preloads. Keep watching after the default-limit change from 5 to 3.
   - Stronger batching guidance only for models that underuse it (Qwen VL 0%). Cheap to try; measure the multi-call share before and after.
3. **Parallel tool execution (§2a):** revisit only if traces show multi-call turns with slow tools becoming common, for example many `search_web` or MCP lookups per turn.

## 5. How to re-measure

The Python snippets used here read only `run.jsonl` timestamps, `model_call_end` (`durationMs`, `firstTokenLatencyMs`, `usage`) and `tool_call_end` (`durationMs`, `permissionOutcome`). Group tool calls between two `model_call_end` events into a batch, then compare the sum of a batch's durations with its maximum. Re-run once more traces exist since 2026-11-12: the recent sample is only 37 runs.
