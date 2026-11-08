# Tool Selection — Analysis & Refactoring Plan

## Symptom

In chat, asking the agent to do something (typically "make an image of …") sometimes fails with:

```
Error: unknown tool 'create_image'
```

The tool exists, is enabled, and is allowed by mode/profile. It just isn't *loaded* for the turn in which the model calls it.

## How tool selection works today

All in `src/main/agent/runner/run_stream.ts`, per run:

1. **Candidates** — `builtinTools(config, sandbox, mode)` (`run_builtin_tools.ts`) returns every builtin, including `create_image` (L232).
2. **Filtering** — the same list is passed through `filterModeTools`, `filterRuntimeTools` (profile + bootstrap, L182) and `filterTools(toolsAllow, toolsDeny)`, in slightly different orders, at L249–250, L254 (`filterEligibleTools`), L316 (`childTools` for subagents) and L349.
3. **Progressive discovery** — `createToolSearch` (`run_discovery.ts`, L373) splits the filtered list into:
   - `eligible`: everything that passed filtering;
   - `active`: only `requiredIds` (L353: read/write/edit/patch/undo/redo/subagent/…) plus `tool_search` itself.
   Other tools (`create_image`, web, recorders, tasks, MCP…) become active only after the model calls `tool_search` with a query that `rankTools` matches. They are usable **on the next turn**.
4. **Per turn** (L481–482):
   - `turnTools = search.active()` → sent to the provider as the tool schema **and** used to execute calls.
   - `eligibleTurnTools = tools` (all eligible) → passed to `buildSystemPrompt`.
5. **System prompt** — `addToolsPrompt` (`system/system_add_tools_prompt.ts`) lists *loaded and not-yet-loaded* tools, with id and full description, marking the latter `_(Available through tool_search.)_`.
6. **Execution** — `runToolCalls(turnTools, …)` (L673) does `tools.find(id === call.name)` (`run_tool_calls.ts:18`). If not found, `runToolCall` returns `unknown tool` (`run_tool_call.ts:104`).

## Root cause

The prompt and the executor disagree about which tools exist:

- The system prompt advertises `create_image` by exact id with its description.
- The executor only knows `search.active()`, which doesn't contain it until `tool_search` selected it.

Models that see an exact id and a description of what it does call it directly instead of first calling `tool_search`. This is near-certain on the DSML/text tool-call path (`models/adapters/llm/dsml.ts` → `invokes.ts:19`), which parses any `<invoke name="…">` without checking it against the schema, and it happens with native tool-calling too when the model trusts the prompt over the schema. The call reaches `runToolCalls` with a name that isn't in `turnTools` → `unknown tool`.

It's intermittent because it depends on the model choosing to call `tool_search` first, and on `rankTools` matching the query (e.g. "picture", "drawing", "logo" may not rank `create_image`).

### Contributing problems

- **Misleading error.** "unknown tool" is wrong (the tool is known and allowed) and gives the model no recovery path, so it often gives up or apologizes instead of calling `tool_search`.
- **Extra round-trip by design.** Even when it works, image generation needs `tool_search` turn → `create_image` turn.
- **Filter pipeline duplicated 4×** with different orderings (L249, L254, L316, L349, plus `search.replaceEligible` on MCP changes and skill activation). It's hard to tell what "eligible" means at any given point, and subagents (`childTools`) get a different list than the parent.
- **Three lists, no owner.** `tools`, `search.active()` and `eligibleTurnTools` are all live, mutated from several callbacks (`applyActivatedSkill`, MCP `onChanged`, MCP recovery). There's no single "resolve this call name" function.
- **Voice path** (`realtime_voice/create.ts:82`, `tool_runtime.ts`) builds and resolves its own list separately.

## Refactoring plan

### Phase 1 — Fix the bug (small, safe)

Resolve calls against **eligible** tools, not only active ones; promote on use.

- `ToolSearch` gets `resolve(name): Tool | undefined`: return the active tool; otherwise if the name is in `eligible`, add it to `active` and return it.
- `runToolCalls` takes a resolver (`(name) => Tool | undefined`) instead of an array; `run_stream` passes `search ? search.resolve : (name) => tools.find(…)`.
- Every guard in `runToolCall` stays the same (mode, profile, permission, hard approval, budget, paid-tool capability), so this doesn't widen what can run. Eligible tools have already passed all filters.
- Change the truly-unknown message to say what to do: `Error: tool 'x' is not available. Call tool_search to find a tool for this task.`

Verify:
- Repro on a DeepSeek (DSML) model and one native-tool model: "create an image of a red fox" in a fresh chat → before: `unknown tool 'create_image'`; after: image generated in one call, no `tool_search` turn.
- Disable `create_image` in Settings → Tools → the call still fails (not eligible).
- In a mode that forbids it → still `unavailable in the active mode`.
- A made-up name (`create_imagez`) → new "not available, call tool_search" message.

### Phase 2 — One owner for the run's tools

New module `src/main/agent/runner/toolset.ts`, built once per run, replacing the scattered `tools` / `filterEligibleTools` / `search` juggling in `run_stream.ts`:

```ts
interface ToolSet {
  eligible(): Tool[];                  // single filter pipeline, applied in one place
  active(): Tool[];                    // what goes in the provider schema
  resolve(name: string): Tool | undefined; // Phase 1 semantics
  activate(ids: string[]): void;       // tool_search, skills
  replaceMcp(entries: DiscoveredMcpTool[]): void;
  restrict(allowedTools?: string[]): void; // skill tool scopes
  forChild(): Tool[];                  // subagents: same pipeline, minus `ask`
}
```

- One `eligibleTools(candidates, { mode, profile, toolsAllow, toolsDeny, bootstrap, skillScopes })` function: same order everywhere. Replaces L249–250, L254–260, L316–318, L349–350.
- `createToolSearch` keeps only ranking and becomes the `tool_search` tool on top of `ToolSet` (no more own `eligible` / `active` maps).
- `buildSystemPrompt` gets `toolset.active()` and `toolset.eligible()` from the same object, so prompt and executor can't disagree again.
- MCP `onChanged`, MCP recovery and `applyActivatedSkill` call `toolset.replaceMcp` / `toolset.restrict` instead of rewriting `tools` and calling `search.replaceEligible`.
- Voice (`realtime_voice/create.ts`) builds its list with the same `eligibleTools` function (profile `voice`) and resolves through `ToolSet.resolve`.

Verify: behavior unchanged. Compare the `run_started.tools` event and the system-prompt Tools section before/after for: normal chat, a mode (restricted), bootstrap, a subagent, a skill with `allowedTools`, an MCP server connecting mid-run, and voice.

### Phase 3 — Prompt cleanup (optional, decide after Phase 1)

With Phase 1, "Available through `tool_search`" becomes advisory. Pick one:

- **A (recommended):** keep listing unloaded tools but show only `id — name` (no description). The model can still call them by id, and the prompt gets shorter. `tool_search` is kept for MCP discovery, where the catalog is large.
- **B:** stop listing unloaded tools entirely; rely on `tool_search` + the improved error. Fewer tokens but more round-trips. This is the current failure shape, so not recommended.

## Out of scope

- Ranking quality of `rankTools` (synonyms like "picture" → `create_image`); this matters much less once Phase 1 lands.
- Adding media tools to `requiredIds`; Phase 1 makes it unnecessary.

## Open questions

1. Is auto-promotion on direct call acceptable, or must `tool_search` stay a hard gate (e.g. for audit/telemetry of `capability_resolution_*` events)? If it must stay a gate, Phase 1 keeps the strict lookup and only changes the error message (the model then needs one extra turn).
2. Should the `_(Explicit user request only.)_` tools (`create_image`, recorders, `update_*`) get any extra execution-time check, given that promotion makes them one call away? Today the restriction is prompt-only.
