# Tool Selection — Analysis & Refactoring Plan

## Symptom

In chat, asking the agent to do something (typically "make an image of …") sometimes fails with:

```
Error: unknown tool 'create_image'
```

The tool exists, is enabled, and is allowed by mode/profile. It just isn't *loaded* for the turn in which the model calls it.

## Decision

`tool_search` is the only way to load a tool that isn't loaded. Calling an unloaded tool directly is never executed. The fix is to make the model use `tool_search` reliably and to recover in one turn when it doesn't, not to bypass the gate.

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

The model is pushed to call unloaded tools directly, and when it does, the error doesn't tell it how to recover:

- The system prompt advertises `create_image` by exact id with its full description, as if it were usable. The only hint that it isn't is a trailing `_(Available through tool_search.)_`.
- On the DSML/text tool-call path (`models/adapters/llm/dsml.ts` → `invokes.ts:19`), any `<invoke name="…">` is parsed without checking it against the schema, so the provider can't stop the call. Native tool-calling models also do this sometimes, when they trust the prompt over the schema.
- The executor only knows `search.active()`, so the call ends as `Error: unknown tool 'create_image'`. That message is wrong (the tool is known and allowed), and it says nothing about `tool_search`. The model usually apologizes or gives up instead of searching.

It's intermittent because it depends on whether the model calls `tool_search` first.

### Contributing problems

- **Filter pipeline duplicated 4×** with different orderings (L249, L254, L316, L349, plus `search.replaceEligible` on MCP changes and skill activation). It's hard to tell what "eligible" means at any given point, and subagents (`childTools`) get a different list than the parent.
- **Three lists, no owner.** `tools`, `search.active()` and `eligibleTurnTools` are all live, mutated from several callbacks (`applyActivatedSkill`, MCP `onChanged`, MCP recovery). Nothing can answer "is this name *unloaded* or *nonexistent*?", which is what the error needs.
- **Voice path** (`realtime_voice/create.ts:82`, `tool_runtime.ts`) builds and resolves its own list separately.

## Refactoring plan

### Phase 1 — Fix the bug (small, safe)

Keep the strict lookup. Make the gate clear before the call, and make recovery take one turn.

1. **Actionable error.** `ToolSearch` gets `isEligible(name): boolean`. In `runToolCalls`, when the name isn't active:
   - eligible → `Error: tool 'create_image' is not loaded. Call tool_search with query "create_image", then call it on the next turn.` Nothing is executed and the tool isn't activated.
   - not eligible → `Error: tool 'x' does not exist or is not available for this agent.`
   `runToolCall` needs the reason, so `runToolCalls` passes it instead of only `undefined` (e.g. `{ tool } | { missing: 'unloaded' | 'unknown' }`).
2. **Exact-id search is guaranteed.** `toolSearchText` already weights the id 4×, so a query equal to an id ranks it first in practice. Make it explicit in `createToolSearch`: if the query equals an eligible, unloaded tool id, select that tool first, before ranking. The recovery message above then always works.
3. **Prompt states the rule.** In `addToolsPrompt`, replace the header line with: "Only tools marked _(Loaded.)_ can be called. To use any other tool, first call `tool_search` with its id as the query; it becomes callable on the next turn. Calling an unloaded tool directly fails." Change the per-tool marker to `_(Not loaded — call tool_search first.)_`.

Verify:
- Repro on a DeepSeek (DSML) model and one native-tool model: "create an image of a red fox" in a fresh chat. Before: `unknown tool 'create_image'` and the run ends. After: either `tool_search` → `create_image` directly, or (if it calls directly) the not-loaded error → `tool_search("create_image")` → `create_image`, and an image is produced in both cases.
- A direct call to an unloaded tool never executes: check the event stream for no `create_image` run before `tool_search`.
- Disable `create_image` in Settings → Tools → `does not exist or is not available` and `tool_search("create_image")` returns nothing.
- A made-up name (`create_imagez`) → the "does not exist" message.

### Phase 2 — One owner for the run's tools

New module `src/main/agent/runner/toolset.ts`, built once per run, replacing the scattered `tools` / `filterEligibleTools` / `search` juggling in `run_stream.ts`:

```ts
interface ToolSet {
  eligible(): Tool[];                  // single filter pipeline, applied in one place
  active(): Tool[];                    // provider schema + executor; only these run
  lookup(name: string): { tool: Tool } | { missing: 'unloaded' | 'unknown' };
  activate(ids: string[]): void;       // called only by tool_search (and requiredIds at start)
  replaceMcp(entries: DiscoveredMcpTool[]): void;
  restrict(allowedTools?: string[]): void; // skill tool scopes
  forChild(): Tool[];                  // subagents: same pipeline, minus `ask`
}
```

- One `eligibleTools(candidates, { mode, profile, toolsAllow, toolsDeny, bootstrap, skillScopes })` function, same order everywhere. Replaces L249–250, L254–260, L316–318, L349–350.
- `createToolSearch` keeps only ranking (plus the exact-id rule) and becomes the `tool_search` tool on top of `ToolSet`. It no longer has its own `eligible` / `active` maps. `activate` is the only way into `active`.
- `buildSystemPrompt` gets `toolset.active()` and `toolset.eligible()` from the same object, and `runToolCalls` uses `toolset.lookup`, so the prompt, the schema and the executor share one source.
- MCP `onChanged`, MCP recovery and `applyActivatedSkill` call `toolset.replaceMcp` / `toolset.restrict` instead of rewriting `tools` and calling `search.replaceEligible`.
- Voice (`realtime_voice/create.ts`) builds its list with the same `eligibleTools` function (profile `voice`) and resolves through `ToolSet.lookup`.

Verify: behavior unchanged. Compare the `run_started.tools` event and the system-prompt Tools section before/after for: normal chat, a mode (restricted), bootstrap, a subagent, a skill with `allowedTools`, an MCP server connecting mid-run, and voice.

## Out of scope

- General ranking quality of `rankTools` (synonyms like "picture" → `create_image`). The prompt lists unloaded ids, so the model can search by exact id.
- Adding media tools to `requiredIds`. That would bypass the gate.
- Auto-activating unloaded tools on direct call (rejected, see Decision).

## Open questions

1. Should a direct call to an unloaded tool count against the turn/tool budget the same as a real call? Today `budget.admit` runs before the lookup, so it does. Proposal: keep that, since it discourages repeated direct calls.
2. Voice is real-time, and the `tool_search` round-trip adds latency there. Does voice also go through `tool_search`, or keep a fixed loaded set (its current behavior)?
