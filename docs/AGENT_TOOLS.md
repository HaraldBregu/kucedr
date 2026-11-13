# Agent Tools & Subagents: Analysis & Refactoring Plan

> **Status:** proposal, 2026-11-13, second full pass. It covers tool definitions, loading and discovery, execution, MCP, skills, the prompt, voice and subagents. It builds on [TOOL_SELECTION.md](TOOL_SELECTION.md) (Phases 1–2 done), [AGENT_STATE.md](AGENT_STATE.md) and [AGENT_TURN.md](AGENT_TURN.md). Line numbers are from `dev` at `5be4573a5c`. Every finding was checked in code. One reviewer claim, "`Tool.readOnly` is never read", was rejected: `modes/allows.ts:10` reads it.

## 1. How it works today

One run = one `stream()` call (`runner/run_stream.ts`). Tools are rebuilt on every run.

1. **Candidates** (`:217-233`): `builtinTools()` (`run_builtin_tools.ts:46`, about 45 tools). Some are conditional: `search_web`, `query_knowledge`, plugin scripts, and `mdl__*` from model manifests. `undo`/`redo` are bound to this session's file history. Bootstrap runs get 4 setup tools instead. Subagents pass `options.tools`.
2. **Skills** (`:259-263`): `list_skills`/`load_skill` are added only when a regex finds "skill" in the chat.
3. **MCP** (`:277`): `loadMcpTools()` reads the persisted catalog. Connections are lazy and closed at the end of the run (`:794`). At most 64 tools.
4. **Subagents** (`:290-310`): `subagent` and `subagents` are built here, around a snapshot of the parent's tools.
5. **Filter**: `filterEligibleTools` applies allow/deny, mode, settings and profile. It runs 6× per run over the full list (`:244,290,322,354,355`; `run_discovery.ts:37-38`).
6. **Discovery** (`run_discovery.ts`):
   - *active* tools are attached to the request: the hard-coded `requiredIds` (`:324-352`), plus task tools (regex), plus MCP servers named in the chat, plus ids restored from earlier `tool_search` results.
   - everything else is *eligible*: listed in the prompt and loaded by `tool_search` on the next turn.
7. **Per turn**: the prompt is rebuilt when the active set changes (`:482-497`). Calls run **sequentially** through `runToolCall` (`run_tool_call.ts`). The order is: budget → lookup → parse → mode gate → profile → permission → lock → timeout → run → output limit.
8. **Voice** (`realtime_voice/create.ts:72`) calls `builtinTools()` itself and repeats the profile filter. It has no discovery.

### Subagents: yes, we spawn them

`tools/core/subagents.ts`:
- **`subagent`**: 1 child that gets the parent's tool snapshot.
- **`subagents`**: 2–3 parallel children, limited to 4 hard-coded read tools.

Children:
- share the parent's budget, rate limits, mutex and MCP connections. At most 3 run at a time per Agent (`agent.ts:118`).
- return a summary of up to 12K characters.
- have no UI progress and no persisted session.

### Usage (`~/.kucedr/sessions`, 74 sessions, read-only count)

- **Subagents:** `subagent` was called 3 times and `subagents` 3 times. Both are attached on every turn.
- **`tool_search`:** 184 calls in `messages.json`. It most often loaded `use_web_browser` (48), `bash` (35, from before it was preloaded), Gmail and Drive MCP tools, `run_task_now`, and `create_image`/`create_sound`/`create_video` (about 19 each).
- **Over-loading:** a search returns up to 5 tools, even for an exact-id query (`run_discovery.ts:76-78`). Looking for an image tool also loaded `create_sound` and `create_video`, and every loaded schema is sent on each later turn.

### Prompt cost

The `## Tools` section in the newest saved `SYSTEM.md` (53 tools, no MCP) is **23.2 KB**:
- 3.4 KB of it is the ` Options:` suffix from `toolOptions`, which repeats what the attached schemas already carry.
- With MCP: 43 tools made a 38.5 KB section. At the 64-tool cap it would be about 50–60 KB, roughly 15k tokens.

## 2. Findings

### Correctness

| # | Sev | Finding | Evidence |
|---|---|---|---|
| C1 | High | **Voice gets paid `mdl__*` tools.** They have no `policy`, so they're checked as builtins, and `MODEL_BACKED_TOOL_IDS` lists only `create_*` and `query_knowledge`. This breaks the "no model-backed tools in Voice" rule. | `shared/agent_tools.ts:84-98`; `run_builtin_tools.ts:62`; `realtime_voice/create.ts:72-81` |
| C2 | Med | **A subagent child gets the parent's `undo`/`redo`** and can undo the parent's edits. This is what's left of AGENT_STATE T2. | `run_stream.ts:228-233,290` |
| C3 | Med | **Subagents hold dead MCP tools after authorization.** The uncatalogued-server path closes the old loader (`:442`), but `childTools` was captured from it at `:290`, so child MCP calls fail with "MCP run has ended". | `run_stream.ts:290,307-310,442`; `tools/mcp/loader.ts:55` |
| C4 | Med | **A skill's `allowed-tools` blocks `tool_search`**, because only `load_skill` is exempt. Scope names are also compared byte-for-byte with internal ids, so `Read` or `Bash(git:*)` from other ecosystems match nothing. | `run_skill_tools.ts:8-9`; `run_stream.ts:685-693` |
| C5 | Med | **The budget is charged before validation.** A call that is invalid, gated by the mode, blocked by the profile or denied still uses a call slot, and a denied `create_image` uses one of the 3 paid slots. Unloaded calls being charged is intentional (TOOL_SELECTION "Defaults taken" 1); the rest isn't. | `run_tool_call.ts:105` before `:109-131` and permission |
| C6 | Med | **The tool timeout includes the lock wait**, and it leaks if `directoryPermissionTargets` or `acquire` throws, because the timer is set outside the `try`. | `run_tool_call.ts:385-405` |
| C7 | Med | **MCP recovery `continue`s past post-processing.** It skips the `budget.exhausted` check, the `capability_resolution_result` event and the recorder finalization. | `run_stream.ts:712-728` vs `740-791` |
| C8 | Med | **The resource mutex keys don't line up.** `read` locks `dirname(file)`, `write` locks the file, and `bash` locks its roots, so a read and a write of the same file, or bash and a write inside its workdir, never serialize. | `directory_permission_targets.ts:35-48`; `mutex.ts:9` |
| C9 | Med | **A stdio MCP server whose catalog backfill failed stays tool-less, with no diagnostic,** until the user re-tests it. The backfill promise is memoized. | `mcp_catalog_backfill.ts:5-8`; `tools/mcp/loader.ts:39-42` |
| C10 | Low | **Scheduled tasks can't use the background browser.** `use_web_browser` isn't in the tasks allowlist, so the headless swap only reaches background subagents. Meanwhile `select_screen_source` is in that allowlist but always fails without a window. | `shared/agent_tools.ts:49-83`; `run_stream.ts:101,227` |
| C11 | Low | **An abort during `tool.run` rethrows before `tool_call_end`.** The POST hook doesn't fire, and the budget's output count is skipped. A timed-out write that keeps running is never recorded in file history, so undo misses it. | `run_tool_call.ts:437-446,462-468` |
| C12 | Low | **`limitToolOutput` truncates JSON as a string.** That breaks the JSON, can split a UTF-8 character, and puts the marker past `maxBytes`. MCP output is truncated twice (`mcp/output.ts:26` and the generic limit). | `run_limit_output.ts:11-12` |
| C13 | Low | **MCP name-collision suffixes depend on load order.** An id restored from history can resolve to a different server's tool after a server is removed. | `tools/mcp/name.ts:25-33`; `run_discovered.ts` |

### Classification (`execution/capability.ts`)

| # | Finding |
|---|---|
| K1 | `search_web` and `fetch_web_page` are classed as `read`, but they send queries and URLs off the machine. `use_web_browser` is classed `external`. |
| K2 | `query_knowledge` calls an embedding model but is classed as plain `read`. |
| K3 | `run_task_now` is classed as write+persistence, but it starts an agent run. `subagent` is classed as `read`, but its child can write and run bash. |
| K4 | `select_screen_source` has no entry; it only works because `run_tool_call` handles it before the capability check. The `RECORD` set only ever matches the camera, because mic and screen return earlier (`:55-58`). |
| K5 | Only `paid` and `approval` are enforced. `external`, `execute`, `sensor` and `persistence` are descriptive only. That's fine, but then the fixes K1–K3 only matter for the UI and the `paid` budget. |

### Simplification and cost

| # | Finding | Evidence |
|---|---|---|
| S1 | **Two delegation tools for 6 uses.** Both are always attached, both are in category `core` while `delegation` never renders, the limiter is passed twice, and the read-only child list is hard-coded. | `subagents.ts:174,180,219-227`; `category.ts:47` |
| S2 | **`tool_search` over-loads.** Up to 5 tools per call, even on an exact id, and all of them stay attached for the rest of the run. | `run_discovery.ts:76-78` |
| S3 | **The prompt's Tools section is 23 KB.** It includes `toolOptions` (3.4 KB, a duplicate of the schemas), full descriptions for tools that aren't loaded, and long example requests in the task tools (about 2 KB). | `system_add_tools_prompt.ts:32`; `system_tool_options.ts`; `tasks/*.ts` |
| S4 | **Filtering and settings I/O are repeated.** `filterEligibleTools` runs 6×. `getAgentProfileTool` re-reads the profile JSON per tool. `getMcpToolPermission` calls `getMcpServers()` (safeStorage decrypt plus a plugin-directory scan) twice per unconfigured MCP tool. The loader calls `getMcpServers()` once per server. | `run_stream.ts`; `agent_profiles.ts:283`; `mcp_tool_permission.ts:7-11`; `loader.ts:20,38` |
| S5 | **Tool-id lists are scattered** across `requiredIds`, `capability.ts`, `shared/agent_tools.ts`, `run_skill_tools.ts`, `subagents.ts` and `modes/allows.ts`. A missed list fails silently. | listed |
| S6 | **The recorder triplets are near-copies:** 9 files, about 330 lines. The `directory`/`filename`/`duration`/`path` field descriptions are copied verbatim into up to 6 tools. | `tools/system/*`; `create_*.ts`; `read.ts:18` |
| S7 | **Dead code:** `selectedCanonicalIds` and `canonical.ts` (no consumer); `budget.limits.web` (never set); `budget.outcomes` (write-only, AGENT_STATE R8); voice `PAID_TOOLS` (`create_*` is already excluded); the `serverName` hint comparison (`run_stream.ts:391-394`); the `loadedSkills` parameter of `buildSystemPrompt`; `pending.get(freshUUID)` in `permissions_pending.ts:39`. | listed |
| S8 | **`rankTools` indexes the full JSON schema** (up to 64 KB for MCP tools), so tokens like `string`/`object` add noise. It also recomputes document frequency for every document and term. | `rank.ts:45-47,69` |
| S9 | **Voice repeats chat's profile filter.** | `realtime_voice/create.ts:73-81` vs `run_stream.ts:173-176` |
| S10 | **Small cleanups:** pretty-printed JSON results (`search_web`, `fetch_web_page`, `query_knowledge`); `2*1024*1024` repeated in read/edit/patch; duplicate script lookup in `load_script`/`run_script`; `ask.ts` lives in `core/` but has category `system`. | per file |

### Still open from earlier docs
- **AGENT_STATE:** R6 (`exhausted` set, then cleared by `allowSynthesis`), R8, K3 (the per-tool if/else chain in `run_tool_call.ts:133-268`) and M2.
- **AGENT_TURN:** MCP connections are closed every run, the 64-tool cap fills in server-id order, any error text containing "401" triggers re-auth, and the 30 s MCP timeout also covers connecting.

## 3. Plan

The steps are ordered by value and risk. Each one can land on its own. Steps 1–2 are fixes; 3–6 are refactors that must leave behavior the same.

### Step 1: Correctness fixes (C1–C7, C10)

Small, local changes:
1. **C1:** in `isAgentToolAllowedForProfile`, return `false` for voice when the id starts with `mdl__`. Better: give `mdl__` tools a policy and reject any tool with the `paid` effect in voice. That also lets the dead voice `PAID_TOOLS` go (S7).
2. **C2, C3:** build `childTools` once, from the final eligible list, after any MCP refresh, excluding `ask`, `undo` and `redo`. In practice: build the subagent tool from a getter (`() => childTools`) instead of a snapshot, so the refresh at `:444-449` covers it.
3. **C4:** exempt `tool_search` in `selectSkillTools`. When a skill is read, warn about any `allowed-tools` entries that match no tool id; don't guess mappings.
4. **C5:** move `budget.admit` after the profile check and the permission decision. Keep charging unloaded calls.
5. **C6:** start the timeout timer inside the `try`, after `acquire`.
6. **C7:** replace the `continue` after MCP recovery with a fall-through to the shared post-processing.
7. **C10:** add `use_web_browser` to the tasks allowlist, and remove `select_screen_source` from it.

→ verify:
- Voice session: no `mdl__*` in its tools list.
- After a subagent run, the parent's `undo` still undoes the parent's own edit.
- Connect an uncatalogued MCP server mid-run, then delegate a task that uses it: the call succeeds.
- A skill with `allowed-tools: [read]` can still call `tool_search`.
- A denied `create_image` leaves `paid` at 0.
- A scheduled task that browses uses the headless browser.

### Step 2: Locking and output (C8, C11, C12)

- **C8:** compare lock keys by path prefix: a key locks its whole subtree. `KeyedMutex.acquire` checks prefix overlap instead of exact equality. Keys stay sorted, so there's still no deadlock.
- **C11:** emit `tool_call_end` and the POST hook in a `finally`, and record file history in `execution.finally`.
- **C12:** truncate on a character boundary and leave room for the marker. Drop the second MCP truncation, because `mcp/output.ts` already applies the limit.

→ verify:
- A parallel subagent `read` of a file waits while the parent `write`s that file.
- Abort a long `bash`: the UI shows the call as ended.
- A truncated MCP result ends with exactly one marker and stays within `maxBytes`.

### Step 3: One delegation tool, loaded on demand (S1)

- Replace `subagent` and `subagents` with one `subagent` tool taking `tasks: [{ id, task }]`, 1–3 items.
  - 1 task: the child gets `childTools`.
  - 2–3 tasks: the children run in parallel, each with `childTools.filter(t => t.readOnly)`. That replaces `PARALLEL_TOOL_IDS`; MCP `readOnlyHint` tools qualify.
- Use `category: 'delegation'`, and take the limiter from `runtime` only.
- Add to its description: "Tools that need approval are unavailable to the subagent."
- Remove it from `requiredIds`; it loads through `tool_search`.
- Delete `subagentsTool`, the second instructions string, and `'subagents'` from `capability.ts`, `shared/agent_tools.ts` and `run_skill_tools.ts`.
- Saved settings for `subagents` are harmless: they're looked up by id only (`agent_profiles.ts:284`). The UI already renders both output shapes (`tool-label.ts:35`, `tool.tsx:137`).

→ verify:
- A plain chat's `run_started.tools` has no `subagent`.
- `tool_search("subagent")` then 3 tasks: they run concurrently, and wall time is about the max of the three, not the sum.
- Parallel children have no `write`/`bash`.
- In plan mode, the children are read-only.

### Step 4: Tool metadata on the tool, not in lists (S5, S4, K1–K4)

- Add `preload?: boolean` to `ToolConfig`/`Tool`, and set it on today's `requiredIds` tools. `requiredIds` then becomes `preload || task regex || skill/ask/extension`.
- Set `capability` on the tool definitions that `capability.ts` misclassifies (K1–K4). Leave the id fallback for everything else; moving all of it is churn.
- In `run_stream.ts`, call `filterEligibleTools` once. Reuse the result for `childTools` and `createToolSearch`, and stop re-filtering inside `createToolSearch` except in `replaceEligible`.
- Read the profile JSON once per run and pass it into `filterProfileTools`. Read `getMcpServers()` once in the loader and in `getMcpToolPermission` callers.
- Voice calls the same `filterRuntimeTools(profile)` helper as chat (S9).

→ verify: for plain chat, a read-only mode, bootstrap, a subagent child, a skill with `allowed-tools`, and a run with MCP, `run_started.tools` and the prompt's Tools section are byte-identical to before (except step 3's change).

### Step 5: Prompt and discovery cost (S2, S3, S8)

1. **S2:** an exact-id `tool_search` query loads only that tool. The default `limit` drops from 5 to 3.
2. **S3:**
   - Drop `toolOptions` from the prompt; the attached schemas already carry it.
   - List tools that aren't loaded as id + name + one line; the full description arrives when the tool loads (already proposed in AGENT_TURN).
   - Cut the example requests from the 5 task-tool descriptions.
3. **S8:** rank on id, name, description and parameter names/descriptions, not raw schema JSON. Precompute document frequency once.

→ verify:
- `## Tools` size in a fresh `SYSTEM.md`: target under 12 KB for 53 tools without MCP, down from 23.2 KB.
- Replay the top 15 `tool_search` queries from §1 against the new ranking; each should still return the tool previously selected first.
- One image request: `create_image` is the only tool loaded.

### Step 6: Deletions (S6, S7, S10)

- **S6:** one `recorderTools(kind)` factory builds start/status/stop for camera, mic and screen; screen keeps its source-selection branch. Put the shared field descriptions in one const each.
- **S7:** delete `selectedCanonicalIds` and `canonical.ts`, `budget.limits.web`/`webCalls`, `budget.outcomes` (R8), voice `PAID_TOOLS`, the `serverName` hint clause, the `loadedSkills` parameter, and the dead `pending.get`.
- **S10:** compact JSON in the three web/knowledge tools; one `MAX_READ_BYTES` const; one script-lookup helper; move `ask.ts` to `tools/system/`.

→ verify: typecheck passes. The prompt Tools section and `run_started.tools` match step 5's output, and recorder start/status/stop works for all three devices.

## 4. Not doing (and when to)

- **Parallel tool calls inside a turn.** These would remove the main reason for a parallel delegation path, but they touch locks, approvals and ordering. Do it after step 2 makes locking correct.
- **Child progress events, persisted child sessions, and approval passthrough for children.** Do these once delegation shows up in traces at more than a handful of uses.
- **Enforcing `external`/`execute`/`sensor`/`persistence` effects (K5).** Only if users ask for per-effect permissions.
- **Keeping MCP connections across runs; fairer 64-tool cap ordering; stricter 401 detection.** These are tracked in AGENT_TURN.md, so they're not repeated here.
- **Replacing the task/skill keyword regexes.** They're cheap and work; revisit after step 5 lowers the cost of a `tool_search` turn.
- **Splitting `run_tool_call.ts`'s per-tool special cases (AGENT_STATE K3).** That belongs to the AGENT_STATE plan.
