# Prompt Cache — Hits, Misses and Plan

> **Status:** analysis and plan, 2026-11-12. No code changed.

## Why

Every agent turn sends the whole context again. When the provider can reuse a cached prefix, the turn starts sooner and costs less. Today the app can tell whether one call hit the cache, but only inside `run.jsonl`. Nobody sees it, nothing adds it up, and nothing explains a miss.

## What exists

| Area | State | Where |
|---|---|---|
| Asking for caching | Anthropic native: top-level `cache_control: { type: 'ephemeral' }`. Every other path relies on the provider's automatic prefix caching. | `models/adapters/llm/anthropic.ts:18`, `llm_model.ts:522` |
| Keeping the prefix stable | System prompt built once per tool set. Clock, file listing and memory go on the run's user message, not in the system prompt. | `agent/runner/run_stream.ts`, `system/system_build_run_context.ts`, `runner/run_attach_context.ts` |
| Reading cache hits | `LlmUsage.cachedTokens`, read from `cache_read_input_tokens`, `prompt_tokens_details.cached_tokens`, `prompt_cache_hit_tokens` or `input_tokens_details.cached_tokens`, depending on the path. | `anthropic.ts:59`, `chat.ts:93`, `responses.ts:123`, `llm_model.ts:467,473,578,670` |
| Reading cache writes | Anthropic `cache_creation_input_tokens` is added into `inputTokens` and is not reported separately. No other path reads writes. | `anthropic.ts:56`, `llm_model.ts:575` |
| Storing | Per call, in `model_call_end` in `run.jsonl` only. `SessionUsage`, `recordTurn`, `run_finished` and message usage keep input and output tokens only. `AgentTokenUsage.cachedTokens` exists in `shared/agent_types.ts` but is never filled. | `session/session_trace_entry.ts:144`, `session/session_types.ts:16` |
| Showing | Nothing in the renderer reads cached tokens. | `renderer/src/pages/home/context/*`, `tokens.ts` |
| Explaining a miss | Nothing. | — |

## What the traces show

From `~/.kucedr/sessions/*/run.jsonl`, calls since 2026-11-11 that report `cachedTokens`:

- **Within a run, hits are close to 100%.** `openrouter/auto` turn 2 cached 11,548 of 11,914 input tokens; turn 3 cached 11,911 of 12,040.
- **Turn 1 of every run missed (0 cached).** These runs predate the 2026-11-12 run-context change, which targets exactly this. Not measured yet.
- **`openrouter/auto` can miss on turn 2** (0 of 12,987 in one run), most likely because the router picked a different model. Automatic routing and caching conflict.
- **iteraCompute calls report no cached field at all.** Its docs list cached-input prices, so it does cache, but under a field name the adapter does not read. The hit rate for the user's most-used route is unknown.
- `gpt-5.4-mini` and `glm-4.5` calls were all first turns, so no conclusion yet.

## Gaps

1. Cache numbers stop at the trace. There is no per-session or per-run total and no cache-write count.
2. They are invisible to the user.
3. Field names and request options are hardcoded per API shape. A provider that uses another field (iteraCompute) silently shows nothing. The user's rule is no provider-specific code in `src`, so new ones must come from data.
4. A miss on turn 2+ has no explanation: was it the system prompt, the tool list, the history trimming, or the provider?

## Plan

### 1. Carry cache numbers end to end
- `LlmUsage`: add `cacheWriteTokens`. Fill it from Anthropic `cache_creation_input_tokens` (already parsed). Leave `inputTokens` as the total, as it is now.
- `SessionUsage` (`session/session_types.ts`): add optional `cachedTokens` and `cacheWriteTokens`. `recordTurn` sums them the way it sums input and output.
- Pass them through `run_finished.usage`, message usage (`addAssistantMessage`) and `AgentTokenUsage`, which already has the field.
- Trace: add `cacheWriteTokens` next to `cachedTokens` in `session_trace_entry.ts`.
- Verify: a stand-in `ModelTurnStream` returning fixed usage produces the right sums in `run_finished` and in `messages.json`.

### 2. Explain misses in the trace
- In `runModelTurn`, compute three short hashes per call: system prompt, tool ids plus schemas, and the message prefix that was already sent on the previous call. Add them to `model_call_start`.
- When turn > 1 and `cachedTokens` is 0 or missing, the trace already holds the reason: whichever hash changed. If none changed, the provider or the router dropped the cache.
- Verify: replay two calls with a changed tool list and confirm the tool hash differs while the others match.

### 3. Show it in the UI
- Next to the context-usage meter on the home page, show "cached N% of input" for the last turn and for the session, using the existing components and tooltip patterns (no new visual pattern).
- Hide it when the provider reports no cached field, rather than showing 0%.
- Verify: drive the built app with Playwright and the mock provider, then screenshot the tooltip.

### 4. Provider cache behaviour from manifests, not code
Add an optional `cache` block to a model or provider manifest under `resources/plugins/<provider>/models/*/manifest.json`, read generically by the adapters:

```json
"cache": {
  "readTokens": ["usage.prompt_tokens_details.cached_tokens"],
  "writeTokens": ["usage.cache_creation_input_tokens"],
  "requestOptions": { "prompt_cache_key": "{sessionId}" },
  "breakpoints": "content-block"
}
```

- `readTokens` / `writeTokens`: JSON paths tried in order. This fixes iteraCompute once its field name is known from one real response, with no `src` change.
- `requestOptions`: extra request fields with `{sessionId}` filled in (for example OpenAI's `prompt_cache_key`, which keeps one chat on the same cache shard).
- `breakpoints: "content-block"`: mark the last system block and the last history message with `cache_control` on the chat path. OpenRouter needs this for Anthropic models; today they get no caching there.
- Then move the four hardcoded field names into the manifests that use them, so `src` keeps no provider list.
- Verify: unit check of the path reader against sample usage objects; one live call per provider, which needs the user to run it (live calls with stored keys are blocked here).

### Order
1 → 2 → 3 → 4. Steps 1 and 2 give numbers and causes before anything is tuned. Step 4 is the largest and needs one real response from iteraCompute to fill its field name.

## Not planned

- Caching responses locally. Agent turns are rarely identical, and a stale answer is worse than a slow one.
- Picking `openrouter/auto` alternatives automatically. Routing is the user's choice; step 3 makes its cache cost visible instead.
