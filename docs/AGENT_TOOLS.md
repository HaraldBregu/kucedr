# Agent Tools & Subagents — Analysis & Refactoring Plan

> **Status:** proposal, 2026-11-13. Builds on [TOOL_SELECTION.md](TOOL_SELECTION.md) (Phases 1–2 done) and finding T2 in [AGENT_STATE.md](AGENT_STATE.md). Line numbers are from `dev` at `5be4573a5c`.

## How tools are loaded today

One run = one call to `stream()` in `src/main/agent/runner/run_stream.ts`. Tools are rebuilt on every run:

1. **Candidates** (`run_stream.ts:217-233`)
   - normal run: `builtinTools()` (`run_builtin_tools.ts:46`). This is a flat list of about 45 tools. Some are conditional: `search_web` only if a search engine is configured, `query_knowledge` only if RAG is enabled and consented, plugin scripts only if any exist, and `mdl__*` from model manifests (`tools/model/tools.ts`). After that, `undo`/`redo` are added, bound to this session's file history.
   - bootstrap run: only the 4 profile-setup tools.
   - caller-supplied `options.tools`: used by subagents only.
2. **Skills**: `list_skills`/`load_skill` are added only when a regex sees "skill" in the chat (`run_skill_request.ts`) (`:259-263`).
3. **MCP**: `loadMcpTools()` reads the persisted catalog (`:277`).
4. **Subagents**: `subagent` + `subagents` are built here, not in `builtinTools`, with a snapshot of the parent's filtered tools as `childTools` (`:290-310`).
5. **Filter**: `filterEligibleTools` (allow/deny, mode `extension.allows`, settings, profile). It is called at `:244`, `:290`, `:322` and twice at `:354-355`.
6. **Progressive discovery** (`run_discovery.ts`): `createToolSearch` splits tools into *active* and *eligible*:
   - *active* means attached to the request. That is the hard-coded `requiredIds` (`:324-352`), plus task tools when a regex sees "task/schedule" (`run_task_request.ts`), plus MCP servers named in the chat, plus tools restored from earlier `tool_search` results.
   - everything else is *eligible*. It is listed in the prompt and loadable through `tool_search` on the next turn.
7. **Per turn**: the prompt is rebuilt when the active set changes (`:482-497`). Calls run **sequentially** (`run_tool_calls.ts:18`).

Voice (`realtime_voice/create.ts:72`) calls `builtinTools()` itself with a fixed set and no discovery.

## Subagents: yes, we spawn them

`tools/core/subagents.ts`:

| Tool | Children | Tools the child gets | Limit |
|---|---|---|---|
| `subagent` | 1 | parent's `childTools` minus `subagent(s)`, `ask`, `load_skill` | `subagentLimiter` (3 per Agent, `agent.ts:118`) |
| `subagents` | 2–3 in parallel | hard-coded `PARALLEL_TOOL_IDS` = `read`, `search_web`, `fetch_web_page`, `query_knowledge` | same limiter |

`runChild` makes a fresh in-memory session with `contextMode: 'minimal'` and calls `stream()` again with `options.tools` and `progressiveDiscovery: true`. It shares the parent's **budget**, provider limiter, resource mutex and MCP connections. It returns the final text (capped at 12K) plus a status. Child events are not forwarded to the UI, and child sessions are never persisted.

**Usage** (all 74 sessions in `~/.kucedr/sessions`, read-only count): `subagent` was called 3 times and `subagents` 3 times. For comparison, `tool_search` was called 581 times, `bash` 2036 and `use_web_browser` 520. Both subagent tools are still in `requiredIds`, so their schemas and descriptions go out on **every turn of every chat**.

## Findings

| # | Sev | Finding | Where |
|---|---|---|---|
| F1 | Med | **Child gets the parent's `undo`/`redo`.** `childTools` is taken after `undo`/`redo` were pushed, and only `ask` is filtered out. A subagent can undo the parent's edits. This is what remains of AGENT_STATE T2; the mode-state leak is already gone because `extensionTools` are pushed after `:290`. | `run_stream.ts:228-233,290`; `subagents.ts:191-197` |
| F2 | Low | **Two delegation tools for about 6 uses.** `subagents` exists only because tool calls run sequentially. Its read-only restriction is a second hard-coded id list, even though tools already carry a `readOnly` flag. | `subagents.ts:174,218-275` |
| F3 | Low | **Always loaded, almost never used.** `subagent`/`subagents` are in `requiredIds`, so they cost prompt tokens and schema on every turn. They also change the cache prefix whenever they're filtered differently. | `run_stream.ts:344-345` |
| F4 | Low | **The `delegation` category is dead.** Both tools declare `category: 'core'`, so the prompt lists them under "Core — find tools, read files…", and the `delegation` section never renders. | `subagents.ts:180,227`; `tools/category.ts:47` |
| F5 | Low | **The limiter is passed twice.** `childRuntime.subagentLimiter` is already set, but `subagentsTool` also takes `options.subagentLimiter` as a 4th argument with its own fallback. | `run_stream.ts:296,309`; `subagents.ts:219-222` |
| F6 | Low | **Tool-id lists are scattered.** Ids are hard-coded in `requiredIds` (`run_stream.ts:324`), `capability.ts` READ/WRITE/… sets, `run_skill_tools.ts:9`, `subagents.ts:174,191`, `modes/allows.ts:4` and `shared/agent_tools.ts`. Adding a tool means touching up to 5 files, and a missed one fails silently: wrong capability, or not preloaded. | listed |
| F7 | Low | **`filterEligibleTools` runs 5× per run** on mostly the same list. That's harmless but noisy, and it hides which list is meant at each point. | `run_stream.ts:244,290,322,354,355` |
| F8 | Info | **Spawning is classified as `read`** (`capability.ts:21`) while the child can `write`/`bash`. This is safe today because the child runs without `approvalWindowId`, so tools set to `ask` are denied. But a user who sets `subagent` → allow is not opting into "child writes without asking", and the UI doesn't say so. | `capability.ts:21`; `subagents.ts:65` |
| F9 | Info | **Children are invisible.** There are no progress events, no persisted child session, and only the summary comes back. That's fine at 6 uses; it becomes the first problem if delegation gets used more. | `subagents.ts:84-91` |

## Plan

Ordered by value. Each step stands on its own.

### Step 1: Fix the undo/redo leak (F1)

In `run_stream.ts:290`, filter `undo` and `redo` out of `childTools` next to `ask`. The child runs with `options.tools`, so it never builds its own `undo`/`redo` (`:228`), and it has nothing to undo anyway.

→ verify: run a `subagent` from chat and check that the child's `run_started.tools` has no `undo`/`redo`. A parent `undo` after the child finishes still undoes the parent's last edit.

### Step 2: One delegation tool (F2, F4, F5)

Replace `subagent` + `subagents` with a single `subagent` tool:

- input: `tasks: [{ id, task }]`, 1–3 items.
- 1 task: the child gets `childTools`, as `subagent` does today.
- 2–3 tasks: they run in parallel, and each child gets `childTools.filter(t => t.readOnly === true)`. This replaces `PARALLEL_TOOL_IDS` with the flag that already exists. MCP tools with `readOnlyHint` qualify too.
- `category: 'delegation'`, so the prompt section finally renders.
- It takes the limiter from `runtime` only. Drop the 4th argument and the duplicate fallback.
- One instruction string. The read-only sentence is added only for parallel children.

Then delete `subagentsTool`, `PARALLEL_TOOL_IDS` and the second instructions string, and drop `'subagents'` from `capability.ts`, `shared/agent_tools.ts`, `run_skill_tools.ts` and `requiredIds`. Saved settings that mention `subagents` are ignored: `getToolConfiguration` falls back to defaults for unknown ids. Old transcripts still render, because `tool-label.ts`/`tool.tsx` read the output shape. Check that a single-task result renders in the UI as an array of one.

→ verify: in chat, one task returns a summary. "Research A, B, C in parallel" runs 3 children concurrently: the limiter allows 3, and wall time is about the max of the three, not the sum. A parallel child has no `write`/`bash` in `run_started.tools`. In plan (read-only) mode the tool is still offered and children are read-only.

### Step 3: Load delegation on demand (F3)

Remove `subagent` from `requiredIds`. It stays eligible and listed under **Delegation**, so the model loads it through `tool_search("subagent")` when it needs it. With 6 calls in the history, an extra search turn on those rare runs is cheaper than paying for the schema on every turn.

→ verify: `run_started.tools` for a plain chat no longer contains `subagent`. `tool_search("subagent")` then a call works. Compare prompt size on turn 1 before and after.

### Step 4: Preload flag on the tool, not a list in the runner (F6, F7)

- Add `preload?: boolean` to `ToolConfig`/`Tool` (`types.ts`, `tools/tool.ts`). Set it on the tools now in `requiredIds`: `read`, `write`, `edit`, `patch`, `bash`, `process`, the web and media tools, `undo`/`redo`, the bootstrap tools, plugin scripts. `requiredIds` then becomes `tool.preload || taskToolIds || skill/ask/extension ids`.
- Compute `const eligible = filterEligibleTools(tools)` once after MCP + delegation are added. Reuse it for `childTools` (minus the exclusions) and for both `createToolSearch` arguments.
- Leave `capability.ts` and `shared/agent_tools.ts` as they are. They're shared with the renderer and settings, and moving them is churn with no behavior gain.

→ verify: for normal chat, a read-only mode, bootstrap, a subagent child, and a skill with `allowedTools`, `run_started.tools` and the prompt's Tools section match before and after the change, except for `subagent(s)` per steps 2–3.

## Not doing (and when to)

- **Child progress events and persisted child sessions (F9).** Add them once delegation shows up in traces at more than a handful of uses. Forward the child's `tool_call_*` events tagged with the task id.
- **Approval passthrough for children (F8).** Today a child silently loses tools set to `ask`. Route its permission requests to the parent's window only if users hit that. Until then, add one line to the `subagent` description: "Tools that need approval are unavailable to the subagent."
- **Running tool calls in parallel.** It would make a separate parallel delegation path unnecessary, but it touches locks, approvals and ordering in `run_tool_call.ts`. It's a separate project.
- **Replacing the keyword regexes** (`requestedTaskTools`, `requestsSkillTools`). They work and are cheap. Revisit them with the `tool_search` share in [AGENT_TURN.md](AGENT_TURN.md).
- **Voice** keeps its own fixed `builtinTools()` call. It has no discovery and no subagents.
