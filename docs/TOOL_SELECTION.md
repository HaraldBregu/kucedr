# Tool Selection — Analysis & Refactoring Plan

> **Status:** Phase 1 and Phase 2 are implemented. "How tool selection works today", "Root cause" and "Contributing problems" describe the code before them, and their line numbers are stale. See "Current state" at the end.

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

1. **Actionable error.** In `runToolCalls`, when the name isn't active:
   - eligible → `Error: tool 'create_image' is not loaded. Call tool_search with query "create_image", then call it on the next turn.` Nothing is executed and the tool isn't activated.
   - not eligible → `Error: tool 'x' does not exist or is not available for this agent.`
   `runToolCall` takes `Tool | 'unloaded' | undefined`, so it can tell the two cases apart.
2. **Exact-id search is guaranteed.** `toolSearchText` already weights the id 4×, so a query equal to an id ranks it first in practice. Make it explicit in `createToolSearch`: if the query equals an eligible, unloaded tool id, select that tool first, before ranking. The recovery message above then always works.
3. **Prompt states the rule.** In `addToolsPrompt`, replace the header line with: "Only tools marked _(Loaded.)_ can be called. To use any other tool, first call `tool_search` with its id as the query; it becomes callable on the next turn. Calling an unloaded tool directly fails." Change the per-tool marker to `_(Not loaded — call tool_search first.)_`.

Verify:
- Repro on a DeepSeek (DSML) model and one native-tool model: "create an image of a red fox" in a fresh chat. Before: `unknown tool 'create_image'` and the run ends. After: either `tool_search` → `create_image` directly, or (if it calls directly) the not-loaded error → `tool_search("create_image")` → `create_image`, and an image is produced in both cases.
- A direct call to an unloaded tool never executes: check the event stream for no `create_image` run before `tool_search`.
- Disable `create_image` in Settings → Tools → `does not exist or is not available` and `tool_search("create_image")` returns nothing.
- A made-up name (`create_imagez`) → the "does not exist" message.

### Phase 2 — One owner for the run's tools

`createToolSearch` (`run_discovery.ts`) already owned `eligible` and `active` and is the only code that adds to `active` after the run starts. A separate `toolset.ts` would duplicate it, so it stays the owner:

- `ToolSearch.eligible()` exposes its eligible list. Each turn, `run_stream.ts` builds the prompt and resolves calls from the same pair, `search.active()` / `search.eligible()`, and passes it to `buildSystemPrompt` and to `runToolCalls`. Previously the prompt used the raw `tools` array, which could include MCP tools that `onChanged` added without filtering.
- `filterEligibleTools` (mode, profile, bootstrap, `toolsAllow`/`toolsDeny`, skill scopes) is now the single filter pipeline. It replaces the hand-ordered chains for the initial list, for subagents (`childTools`) and before search creation.
- `runToolCalls(…, eligible)` takes the eligible list as its last argument and passes `'unloaded'` to `runToolCall` for a tool that is eligible but not active.
- Voice is unchanged: it keeps its fixed loaded set and has no `tool_search`. Any missing tool there gets the "does not exist" message.

Verify: behavior unchanged. Compare the `run_started.tools` event and the system-prompt Tools section before/after for: normal chat, a mode (restricted), bootstrap, a subagent, a skill with `allowedTools`, and an MCP server connecting mid-run.

## Out of scope

- General ranking quality of `rankTools` (synonyms like "picture" → `create_image`). The prompt lists unloaded ids, so the model can search by exact id.
- Adding media tools to `requiredIds`. That would bypass the gate.
- Auto-activating unloaded tools on direct call (rejected, see Decision).

## Defaults taken

1. A direct call to an unloaded tool counts against the tool-call budget, as before (`budget.admit` runs before the lookup). This discourages repeated direct calls.
2. Voice keeps its fixed loaded set and doesn't use `tool_search`, to avoid adding a round-trip in real time.

## Current state

- `filterEligibleTools` in `run_stream.ts` is the single pipeline: `filterTools` (`toolsAllow`/`toolsDeny`) → `extension.allows` (modes) → `filterProfileTools` (settings) → `isAgentToolAllowedForProfile` (per-profile allowlist) → skill scopes.
- `list_skills`, `load_skill` and `tool_search` are created outside that pipeline, so `toolIdEnabled` in `run_stream.ts` applies the same allow/deny, settings and profile checks to them by id.
- **Tasks profile** (runs unattended, never prompts): `filterProfileTools` also drops tools set to `ask` and tools whose capability requires approval; MCP tools whose default is `ask` are treated as `allow` (`getAgentProfileTool`); scheduled runs deny the task-mutation tools (`SCHEDULED_TASK_TOOLS_DENY` in `agent.ts`).
- Task tools are preloaded when the message mentions tasks or schedules (`requestedTaskTools`); otherwise they load through `tool_search`.
- The MCP loader reads the persisted catalog once per run. There is no mid-run `onChanged` update; the list changes only through MCP authorization recovery.
