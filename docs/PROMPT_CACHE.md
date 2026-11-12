# Prompt Cache — Hits, Misses and Plan

> **Status:** analysis and plan, 2026-11-12 (revised the same day after an audit against the OpenAI prompt-caching guide, the Anthropic prompt-caching docs and the DeepSeek KV-cache docs). Steps 1–5 implemented the same day; see "Landed" at the end. Step 6 is not done.

## Why

Every agent turn sends the whole context again: tools, system prompt, then the history. A provider can reuse cached work only for an **unchanged prefix**. The entire rendered prefix has to match token for token, and a change anywhere invalidates everything after it. A cache hit cuts time to first token and costs 0.1× (OpenAI GPT-5.6+) or about 0.1× (Anthropic) of the input price. A miss on GPT-5.6+ and Anthropic also pays a **1.25× write**.

The useful rules from the provider docs:

- **Order of the prefix:** provider hidden instructions → tool definitions (names, descriptions, schemas, order) → system/developer text → history.
- **Settings that change the prefix:** `model`, `tools`, `parallel_tool_calls`, `reasoning.effort` (it changes the hidden instructions), verbosity, compaction and truncation.
- **Only written entries can hit.** OpenAI GPT-5.6+ writes at the end of the latest eligible message (user message, last tool response). Anthropic's automatic caching writes at the last cacheable block. DeepSeek writes a unit at the end of each request's input and output. A later request hits only a prefix that one of those writes ended at. The exceptions are OpenAI models before GPT-5.6 (fixed ~2,048-token intervals) and DeepSeek's best-effort common-prefix units.
- **Append, never rewrite.** Changing an earlier message, even by removing a block, breaks reuse from that message on.
- **Keep tools stable.** Add discovered tools at the end, or restrict what can be called, rather than swapping the list.
- **OpenAI models before GPT-5.6:** a stable `prompt_cache_key` improves routing to the same cache. Retention is set with `prompt_cache_retention`.
- **GPT-5.6+:** `prompt_cache_options` (`mode`, `ttl` 30m/12h, `prewarm`).
- **Usage fields:**
  - OpenAI: `input_tokens_details.cached_tokens` (reads) and `input_tokens_details.cache_write_tokens` (writes).
  - Chat Completions: `prompt_tokens_details.cached_tokens`.
  - DeepSeek: `prompt_cache_hit_tokens`.
  - Anthropic: `cache_read_input_tokens` and `cache_creation_input_tokens`.

Constraint from the user: **no provider-specific code in `src`**. Provider behaviour comes from data in `resources/plugins/<provider>/**/manifest.json`.

## What exists

| Area | State | Where |
|---|---|---|
| Asking for caching | Anthropic native: one top-level `cache_control: { type: 'ephemeral' }` (5-minute TTL). It is spread before the request options, so a user option can override it. Every other path relies on automatic caching. No `prompt_cache_key`, `prompt_cache_retention` or `prompt_cache_options` is sent anywhere. | `models/adapters/llm/llm_model.ts:520-523`, `anthropic.ts:17-19`, `llm_model.ts:256-271`, `responses.ts:22-38` |
| Reading hits | `LlmUsage.cachedTokens` from the four field names above, one per adapter path. | `anthropic.ts:59`, `chat.ts:93-96`, `responses.ts:123`, `llm_model.ts:467,473,578,670-672` |
| Reading writes | Not read. Anthropic `cache_creation_input_tokens` is added into `inputTokens`. OpenAI `cache_write_tokens` is ignored. A miss can still be derived as `inputTokens − cachedTokens`; a write cannot be told apart from uncached input. | `llm_model.ts:573-578`, `anthropic.ts:54-59`, `llm_model.ts:465-473` |
| Storing | Per call, in `model_call_end` in `run.jsonl` only, and only since 2026-11-11 08:25Z. `SessionUsage`, `recordTurn`, `run_finished` and message usage keep input and output tokens only. `AgentTokenUsage.cachedTokens` exists but is never filled. | `session/session_trace_entry.ts:141-150`, `session/session_types.ts:16`, `shared/agent_types.ts:153-158` |
| Showing | Nothing in the renderer reads cached tokens. | `renderer/src/pages/home/context/*`, `tokens.ts` |
| Explaining a miss | Nothing. The trace has tool counts only, no fingerprint of the tools, system prompt or history. | `session_trace_entry.ts:28-29`, `run_model_turn.ts:91-97` |

## What the traces show

From `~/.kucedr/sessions/*/run.jsonl`, 2,112 model calls from 2026-09-23 to 2026-11-11:

- **Only 13 calls carry cache data at all**, because the field was added to the trace on 2026-11-11. DeepSeek and iteraCompute make up 99.5% of logged input tokens, so their hit rates are **unknown, not 0%**. A rescan found the DeepSeek gap is a timing artifact: those calls are older than the field.
- **Within a run, hits are close to 100%.** On `openrouter/auto`, turns 2 and later reused 72.5% of input. Single turns reached 11,548 of 11,914, 11,911 of 12,040 and 12,503 of 12,651.
- **Turn 1 of every run missed.** On `openrouter/auto` that is 0 of 75,456 over 6 calls, including a run that started 15 s after the previous one.
- **All 11 iteraCompute calls since the field was added report no cached field at all.** iteraCompute lists cached-input prices, so it caches, but under a field name the adapter does not read.
- **There are no runs after the 2026-11-12 run-context change**, so nothing below is measured on the current build.
- **Things that change between runs:**
  - 284 follow-up runs in total.
  - 79 came more than 5 minutes after the previous run.
  - 58 changed reasoning effort; 18 of 51 sessions mix effort values.
  - 17 changed model; 9 changed provider.
  - 25 changed the number of tools.
  - About 55% of follow-up runs met every condition for a turn-1 hit, yet none got one.
- **`tool_search` changes the prefix in the middle of a run.** It ran in 155 of 351 runs, and 193 of 1,774 later-turn calls come right after one.

## Findings, verified

Each finding was investigated in code and then re-checked by an independent reviewer, who corrected line numbers and overstated impact. Citations point to the current tree.

### A. The run context sent only with the request is a half fix
The 2026-11-12 change has `run_stream.ts:448,453-457,503-509` and `runner/run_attach_context.ts`. They add the run context (file listing, clock, memory) as the first block of the run's user message, in the request only. The next run loads that message from disk without the block (`agent.ts:234`, `session_init.ts:28-36`), so the rendering of an earlier message changes. `llm_shared.ts:110-111` joins the text into one string, so it is `"<ctx>\n<text>"` in run N and `"<text>"` in run N+1.

- **Anthropic, OpenAI GPT-5.6+ and DeepSeek units:** every entry run N wrote ends at or after its user message *with* the block. Run N+1 therefore matches no entry and gets 0 cached on its first call. On Anthropic and GPT-5.6+ it also pays a 1.25× write on the whole prompt. The old layout, with the clock in the system prompt, failed in the same way, so this is not a regression, but it is not the fix either.
- **OpenAI before GPT-5.6 (fixed intervals):** run N+1 reuses up to the last ~2,048-token boundary before run N's user message, and loses run N's whole tool loop. This is the only case the change actually helped.
- **Fix:** save the block into the stored user message once, at run start, and drop the request-only attach. Every earlier message then renders identically in every later run, and run N+1 pays only for run N's final answer plus the new message.
  - **Cost:** history grows by the run context each run. Save only what changed since the last saved context, to keep it small.
  - **Hide it in the UI:** mark it `internal`, which `run_stream.ts:572` already uses for nudges. Whether the renderer hides internal blocks is unverified.
  - **No user message:** runs without one put the run context into the system prompt (`run_stream.ts:502`). Save it as its own message instead.

### B. The tool list changes within and between runs
Order is deterministic and newly found tools are appended at the end (`run_discovery.ts:78,101`, MCP servers sorted at `tools/mcp/loader.ts:20-22`). What changes is the *set*, and the system prompt changes with it:

1. **Loading a tool with `tool_search`** changes the tools array and flips the `_(Loaded.)_` / `_(Not loaded…)_` markers in the 18.5 KB Tools section (`system_add_tools_prompt.ts:33-35`). That forces a rebuild of the system prompt (`run_stream.ts:466-481`). The next turn misses the system prompt and the history.
2. **Discovered tools are dropped every run.** `createToolSearch` is created per run and seeded only from `required` (`run_stream.ts:341-352`, `run_discovery.ts:37-38,97`). Run N+1 starts with fewer tools than run N ended with, so it misses, and the model then repeats the same `tool_search` turns.
3. **Regexes on the message choose some tools.** Task tools (`run_task_request.ts:5`), skill tools (`run_skill_request.ts:2-7`) and the MCP-hint preload (`run_mcp_hint.ts:11`, `run_stream.ts:343-348`) depend on the message wording and are inserted mid-array. One keyword message costs two full misses: one when the tools appear and one when they go. A message containing "primary task" triggered this in a real trace.
4. **Synthesis-only turns send `tools: []`** (`run_stream.ts:461`) and a different system prompt, so they always miss fully. Keeping the tools there needs a re-prompt path, because a tool call on a synthesis turn currently throws (`run_stream.ts:532-542`).
5. **A skill's `allowed-tools` shrinks the array mid-run** (`run_stream.ts:234-248`). Enforce it in the runner gate instead.
6. **Fix:**
   - Keep the active tool set per chat session and restore it at run start, appending new tools only at the end.
   - Make message-triggered tools sticky and append them at the end.
   - Take the loaded/not-loaded state out of the system prompt; the `tool_search` result is already in the history.
   - Keep the tools on synthesis turns.
   - Sending the full eligible list every turn would be the most stable option, but MCP can add up to 64 tools of up to 64 KB each (`tools/mcp/limits.ts:1-2`), so the sticky approach is the safer default. Where a provider supports restricting what can be called (OpenAI `allowed_tools`), declare that in its manifest.

### C. System-prompt text that changes during a run
- **What changes:** loaded skill instructions, the mode's protected prompt, and finalization and synthesis notes (`run_stream.ts:483-493`, merged at `run_model_context_budget.ts:48-50`). Mode state (`modes/extension.ts:44-45`, `modes/state/context.ts:34-37`) also changes after `update_mode_state` and from one run to the next.
- **Effect:** each change misses from the system prompt on.
- **Fix:** add these as messages after the relevant tool result, not as system-prompt suffixes. Saved skill text then stays in the history, which is acceptable.

### D. Effort and context mode switch between runs
- **Effort:** when no effort is saved, the renderer picks reasoning effort per prompt (`renderer/src/pages/home/hooks/useHomeAgent.ts:38-55,209-219`). OpenRouter is the exception. Changing effort rewrites hidden instructions (OpenAI) and invalidates the message cache (Anthropic), so the whole history misses at each switch.
- **Context mode:** the same heuristic switches the context mode. That adds or removes the Workspace section of the system prompt between runs (`agent.ts:291-293`, `system_resolve_context_mode.ts:13-23`).
- **Fix (product decision):** keep one effort and one context mode per chat when the user has not chosen one. On GPT-6, per-turn effort could later use `configuration_update`, declared in the manifest.

### E. Usage does not count cache writes
- **Fix:** add `cacheWriteTokens` to `LlmUsage` and `AgentTokenUsage`, read from OpenAI `input_tokens_details.cache_write_tokens` and Anthropic `cache_creation_input_tokens`, and add it to the trace whitelist.
- **Size:** about 7 touch points (`llm_model.ts:467,473,578`, `responses.ts:123`, `anthropic.ts:59`, the two types, `session_trace_entry.ts`).
- **Chat path:** misses there come from `prompt_tokens − hits`, so no new field is needed. The chained `??` in `chat.ts:93-96` should prefer whichever field the provider actually reports.

### F. No cache hints from data
- **What works today:** static options such as `prompt_cache_retention: "24h"` can be set by the user when the model manifest declares them in `metadata.inputs`.
- **What is missing:** nothing applies defaults or a per-chat key.
- **Lookup limit:** `streamProvider` looks up model metadata only for four hardcoded provider ids (`llm_model.ts:213-215`). A generic lookup through `findModel` is needed.
- **Fix:** add an optional `cache` block to model or provider manifests (shape in step 4 below).

### G. Trimming near the context limit rewrites old history
- **What happens:** `run_model_context_budget.ts:78-122,191-230` replaces large old tool results and drops whole earlier turns. When the start of the kept window moves, every provider misses fully.
- **Fix:** cut in large, sticky steps and save the cut point in the session.
- **Priority:** only matters for chats near the limit, rare now that live-list models get their real window.

### H. Provider ids are already hardcoded in the adapters
The reasoning round-trip (`llm_model.ts:594-595`), content profiles (`mistral`, `reka`), `/deepseek/i` and the effort lookup ids all name providers in `src`. That conflicts with the data-only rule. DeepSeek models on iteraCompute and OpenRouter never send `reasoning_content` back.
- **Fix:** move these to manifest flags, for example `metadata.reasoningContent: "roundtrip"`, while doing step 4.

### Checked and fine
- Attachment projection, hydration and sanitizing are deterministic (`attachments/project.ts:10-46`).
- `parallel_tool_calls` and `tool_choice` are effectively constant.
- Thinking blocks replay byte-stably on current Anthropic models. Haiku 4.5 strips them, but only when the user enables thinking.
- Anthropic's 20-block lookback is not a problem for parallel tool calls: consecutive tool blocks count as one position.
- DSML rewriting only touches DSML-in-text output, so it is not a cache issue.

## Plan

### 1. Measure first
- Add `cacheWriteTokens` end to end (finding E).
- Add `cachedTokens` and `cacheWriteTokens` to `SessionUsage`, summed in `recordTurn`, and pass them through `run_finished.usage` and message usage.
- Add short hashes of the serialized tools, the system prompt and the history already sent to `model_call_start`. Then a miss on turn 2 or later names its cause: whichever hash changed, or none, meaning the provider or router dropped the cache.
- **Verify:** use a stand-in `ModelTurnStream` with fixed usage and check the sums and hashes in `run.jsonl` and `messages.json`.

### 2. Make history append-only (A, C)
- Save the run context into the stored user message (internal block) at run start, only what changed since the last one. Delete `run_attach_context.ts`.
- Send skill, mode-state and finalization text as messages after the history, not as system suffixes.
- **Verify:** a bundled check that the rendered messages of run N's last request are a byte prefix of run N+1's first request, for all three renderers in `llm_shared.ts`. Then compare turn-1 `cachedTokens` before and after in live traces.

### 3. Keep tools stable (B)
- Keep the active tool set per chat session, restore it at run start, and append new tools at the end.
- Make message-triggered tools sticky and append them at the end.
- Take the loaded markers out of the system prompt.
- Keep the tools on synthesis turns and replace the throw with one re-prompt.
- Enforce skill `allowed-tools` in the runner gate.
- **Verify:** the tool hash from step 1 stays the same across runs that do not discover anything new.

### 4. Cache hints from manifests (F, H)
Add an optional `cache` block to a model or provider manifest under `resources/plugins/<provider>/models/*/manifest.json`. The adapters read it generically, through a provider-agnostic `findModel` lookup:

```json
"cache": {
  "readTokens": ["usage.prompt_tokens_details.cached_tokens"],
  "writeTokens": ["usage.input_tokens_details.cache_write_tokens"],
  "requestDefaults": { "prompt_cache_retention": "24h" },
  "sessionKey": "prompt_cache_key",
  "breakpoints": ["system"]
}
```

- `readTokens` / `writeTokens`: JSON paths tried in order. This replaces the hardcoded field names and fixes iteraCompute once its field name is known.
- `requestDefaults`: merged under the user's options. For example `prompt_cache_retention` on gpt-5.4/5.5, or `prompt_cache_options: { "ttl": "30m" }` on GPT-5.6+.
- `sessionKey`: the request field that receives a stable per-chat key, for example `prompt_cache_key` for OpenAI models before GPT-5.6. The value is the chat session id, so related requests reach the same cache.
- `breakpoints`: where to place explicit breakpoints. `"system"` marks the end of the stable system prompt with `cache_control` on Anthropic, so tools and system survive a history change. On OpenRouter it also gives Anthropic models caching.
- Optional later: `prewarm` for GPT-5.6+, sent when a chat opens, so the first turn starts warm. It is billed as a write, so measure first.
- Also move the hardcoded reasoning round-trip and content-profile ids into manifest flags.
- **Verify:** a unit check of the path reader against sample usage objects. Then one live call per provider, which the user has to run, because live calls with stored keys are blocked for the agent.

### 5. Product choices (D)
- Keep one reasoning effort and one context mode per chat unless the user picks one.
- Show "cached N% of input" next to the context meter using existing components, and hide it when the provider reports nothing.

### 6. Sticky trimming (G)
Only after steps 1–3, and only if traces show chats reaching the limit.

### Order
1 → 2 → 3 → 4 → 5 → 6.
- Step 1 makes every later step measurable.
- Step 2 fixes turn-1 misses on the user's providers.
- Step 3 removes the most frequent mid-run miss.
- Step 4 is the largest and needs one real iteraCompute response.

## Not planned
- Caching responses locally. Agent turns are rarely identical, and a stale answer is worse than a slow one.
- Picking `openrouter/auto` alternatives automatically. Routing is the user's choice; step 5 makes its cache cost visible instead.

## Landed (2026-11-12)

**Step 1, measuring**
- `cacheWriteTokens` is read from OpenAI `input_tokens_details.cache_write_tokens` and Anthropic `cache_creation_input_tokens`.
- `SessionUsage` sums `cachedTokens` and `cacheWriteTokens` in `recordTurn`. They stay undefined when a provider never reports them.
- Both are passed through message usage, `run_finished.usage` and `run.jsonl`.
- `model_call_start` carries `prefix: { tools, system, messages[] }` (`runner/run_prefix_hashes.ts`): 10-hex hashes with sorted keys, one per message. The first differing hash between two calls names the cause of a miss.
- The session id now reaches the adapters as `LlmStreamRequest.sessionId`.

**Step 2, append-only history**
- The run context (file listing, clock, memory) is saved once per run as an internal user message just before the user's message (`session/session_add_run_context.ts`).
  - The file listing is replaced by "Unchanged since the previous run context." when it matches the last full one. Memory is always sent in full, so trimming cannot lose it.
  - Edit-and-resend replaces the stale context in front of the reused message.
  - Deferred runs insert it into `pendingMessages`.
- Loaded skill instructions, mode state, finalization and synthesis notes are added as internal messages after the history (`session/session_add_internal_message.ts`), once each time they change. The system prompt keeps only the mode's static protected prompt.
- Internal messages are hidden from the chat history, memory snapshots, compaction transcripts, voice history and the chat title fallback.
- `fitModelContext` and compaction do not treat them as user turns (`runner/run_internal.ts`, `runner/run_turn_start.ts`).
- For Mistral, a note that follows a tool result is folded into the tool message, because Mistral rejects a user message right after a tool message.
- `run_attach_context.ts` is deleted.

**Step 3, stable tools**
- Tools loaded by `tool_search` are restored from the chat history at run start, after `tool_search`, in their original order (`runner/run_discovered.ts`, `restored` in `run_discovery.ts`).
- Task tools, skill tools and MCP-hint preloads are worked out from every user message in the chat, not just the current one (`runner/run_user_texts.ts`). A `/skill` run tags its skill message so the skill tools also stay in later runs. The MCP authorization prompt still reacts only to the current message.
- The Tools section has no Loaded or Not-loaded markers and lists the eligible tools in a fixed order.
- Synthesis turns keep the tools. A tool call there is skipped with one re-prompt, and that retry turn sends no tools, as before, so it cannot loop or fail on tool calls.
- A skill's `allowed-tools` is enforced in the runner (`skillBlocked` with `selectSkillTools`) instead of removing tools from the request.

**Step 4, manifest cache data** (`src/shared/model_types.ts`)
- **New metadata fields:** `cache` (`readTokens`, `writeTokens`, `requestDefaults`, `sessionKey`, `breakpoints`), plus the flags `clampEffort`, `dsml`, `reasoningContent` and `families`.
- **New adapter helpers:** `models/adapters/llm/metadata.ts` (catalog first, then the provider's discovery manifest with `families`), `tokens.ts` (usage path overrides) and `breakpoint.ts` (`cache_control` on the system block, for Anthropic and the Chat path).
- **Manifests:**
  - `sessionKey: "prompt_cache_key"` on gpt-5.4 and gpt-5.5, all variants.
  - `breakpoints: ["system"]` on all Anthropic models.
  - `clampEffort` on the openai, anthropic, xai and deepseek models, replacing the 4-id effort lookup.
  - `dsml` and `reasoningContent` on the DeepSeek models.
  - A `deepseek` family with `dsml` on the openrouter, iteraCompute and ollama discovery manifests, replacing `/deepseek/i`.
- **Still hardcoded:** the reka and mistral content profiles and `reka-flash-3` tool stripping, because no reka or mistral manifest ships; the `anthropic` and `openai` API dispatch; and the provider branches in `options.ts`.
- **Edge cases:** a model id outside the catalog on openai, anthropic, xai or deepseek no longer gets effort clamping or DSML. A user-defined provider serving DeepSeek needs its own `dsml` family.

**Step 5, renderer**
- Effort and context mode are kept per chat in `localStorage` (`chat-runtime:<sessionId>`). They only move up, so effort is the highest seen and context switches to workspace once any prompt needs it. A user-saved effort still wins.
- The context meter's tooltip shows "Cached N% of input last turn, M% this chat". It is hidden when the provider reports nothing, and the last-turn value clears when the latest turn reported nothing.

**Checked**
- `typecheck:node` passes. `typecheck:web` passes except the existing `hideIcons` error in `settings/Group.tsx`. eslint is clean on the changed files.
- A bundled check confirmed that run N's last request and final history are byte prefixes of run N+1's first request for the Chat, Anthropic and Responses builders. It also covered:
  - run-context dedupe and edit replacement;
  - trimming that keeps the current turn and its context;
  - a Tools section that does not change after a load;
  - the same tool order across runs;
  - usage totals, trace fields and the Mistral fold.
- The step 4 agent compared 18 provider/model cases with the old provider-id logic, and the step 5 agent checked the tooltip and the ratchet in a built app with a mock provider.
- An independent review with skeptic verification found 7 real issues. All are fixed above.

**Not confirmed:** live provider calls, and the unit suite. Tests that encode the old layout will need updating: Loaded markers, run context in the system prompt, synthesis with no tools. Restart the dev app before measuring.
