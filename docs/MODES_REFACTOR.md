# Modes refactor

Status: steps 1–4 are implemented (2026-11-10). Typecheck and lint pass on the changed files; the app
and tests were not run, so the "Verify" checks in section 4 are still to do. Sections 2 and 3 describe
the code before the change, on `dev` at `2ea2e52c3e`. One difference from the plan: `modeStop` reads the
state file through `unfinishedModes`, so it is not pure. Paths are relative to `src/main/agent/` unless they start with `src/`,
`docs/` or `resources/`.

This is the modes-only slice of [Agent state, hooks and modes](AGENT_STATE.md). It re-checks that
document's mode findings against today's tree, adds the ones it missed, and proposes a smaller refactor
that doesn't need the run state machine or the hook composer first. Section 5 says how the two fit.

## 1. The bundled modes

`resources/plugins/bootstrap/modes/<id>/` holds a `manifest.json` and a `SYSTEM_PROMPT.md`. The folder
name is the mode id. There is no mode code.

| | `plan` | `goal` |
| --- | --- | --- |
| Command | `/plan` | `/goal` |
| `persistent` (chip stays after send) | yes | yes |
| Tools | `"read-only"` | all |
| Shell | `"read-only"` | default |
| Permissions | `"deny-asks"` | default |
| `ask` | `true` | not set |
| Prompt | protected (`protectedPrompt: true`) | normal |
| Output | must be one `<proposed_plan>` envelope | free |
| Action | **Implement** button that sends a fixed prompt | none |
| Tracked state | `{}`: tracked, no evidence, no continue | `{ evidence: true, continue: true }` |

## 2. How main uses a mode

```text
renderer chip ── options.modeIds ──► ipc/agent.ts:325 (must be string[])
                                          │
agent.ts:241   resolveModes(modeIds, listModes())      main runs only; others get NO_MODE
                 └ modes/list.ts   reads every enabled plugin's modes/ folder (sync)
                 └ modes/read.ts   zod-validates the manifest; protectedPrompt/model are bundled-only
                 └ modes/resolve.ts folds the active modes into one ModePolicy (narrow-only)
agent.ts:244   mode.model overrides the model; modeEffort() applies mode.effort if the model supports it
                                          │ RuntimeInput.mode
runner/run_stream.ts  loop()
  :167  ask is forced true for every interactive run
  :173  restricted → no bootstrap            :205  restricted → context mode kept as requested
  :213  builtinTools(mode): ask tool, read-only bash, no select_screen_source when restricted
  :216  restricted → no undo/redo            :267  restricted → MCP tools are not loaded
  :225  trackedModes(listModes()) → :227 pushes update_mode_state
  :231  filterModeTools() on every tool list
  :285  children get the policy without ask, prompts and output
  :462  protectedPrompt → protected block    :480  prompt + <mode_state> → end of system prompt
  :527  final reply is not a valid envelope → one rewrite
  :541  state.continue and state still open → <mode_continue> nudge (3 total, never two in a row)
runner/run_tool_call.ts
  :120  allowsTool()                         :132  readOnlyShellError() for bash
  :143  ask needs mode.ask                   :144/:206  restricted → no screen picker, no MCP auth
  :307  deny-asks: ask → deny
ipc/agent.ts:460  agent:list-modes → modeInfo() → renderer (chips, envelope card, action button)
```

`ModePolicy` fields and who reads them:

| Field | Set by | Read at |
| --- | --- | --- |
| `readOnly`, `toolIds`, `shell: none` | `tools`, `shell` | `modes/allows.ts` (listing and call time) |
| `shell: read-only` | `shell` | `run_builtin_tools.ts:57`, `run_tool_call.ts:133`, `tools/core/bash.ts:112,128` |
| `permissions` | `permissions` | `run_tool_call.ts:307` |
| `restricted` | any of the above | seven places in `run_stream.ts`, `run_tool_call.ts`, `run_tool_calls.ts:37`, `run_builtin_tools.ts:73` |
| `ask` | `ask` | `run_stream.ts:167,334`, `run_builtin_tools.ts:53`, `run_tool_call.ts:143` |
| `prompt`, `protectedPrompt` | `SYSTEM_PROMPT.md` | `run_stream.ts:462,480` |
| `output` | `output` | `run_stream.ts:531` |
| `effort`, `model` | same | `agent.ts:244-245` |
| `ids` | — | `run_stream.ts:225,360,547` |

Tracked state (`modes/state/`) lives in `<session>/modes/<id>.json`. It is read by `trackedModes` (run
start), `stateContext` (every turn) and `unfinishedModes` (every final turn), and written only by the
`update_mode_state` tool.

## 3. Findings

Severity: High = wrong result, data or security impact. Med = robustness or surprising behaviour.
Low = cleanup. "AS" = already listed in AGENT_STATE.md under that id; re-checked and still true.

### Bugs

| # | Sev | Issue | Where |
| --- | --- | --- | --- |
| B1 | High | Clearing a chat keeps `modes/*.json`, so an active plan or goal from the cleared conversation keeps being injected, with its tool (AS T1) | `session/session_clear_messages_by_session_id.ts:23-33`; `modes/state/tracked.ts:13` |
| B2 | High | `run_script` is `readOnly`, so Plan can run plugin script code outside the sandbox (AS K1) | `tools/plugin/run.ts:12` |
| B3 | Med | **New.** Goal's `continue` only works for the first goal in a chat. Once the state file says `completed` or `blocked`, a later `/goal` run is never nudged, even if the model never touches the state. The `<mode_state>` block for a finished state also carries no instruction to start a new one | `modes/state/unfinished.ts:12-13`; `modes/state/context.ts:27-29` |
| B4 | Med | **New.** Tracked state is model-written text (objective, items, evidence, note) pasted unescaped into the system prompt on every turn and every later run. Evidence is copied from tool output, so injected text is promoted into the system prompt, and `</mode_state>` in it closes the block | `modes/state/context.ts:16-33`; `run_stream.ts:482` |
| B5 | Med | **New.** A refused `completed` returns before writing, so the item updates sent in the same call are lost. The refusal is a normal result, not an error, and with zero items its reason ("every item must be done") is wrong | `modes/state/tool.ts:43-56` |
| B6 | Med | The `subagent` child gets the parent's `update_mode_state` bound to the parent's session: the tool is pushed at `:227`, `childTools` is taken at `:282` (AS T2) | `run_stream.ts:227,282`; `modes/allows.ts:4` |
| B7 | Med | Malformed state JSON throws from `JSON.parse` at run start, so every later run in that chat fails (AS T3) | `modes/state/read.ts:9` |
| B8 | Med | An update without `status` reopens a completed or blocked state (AS T4) | `modes/state/tool.ts:36` |
| B9 | Med | **New.** A tracked state that is never completed never goes away. Plan's state stays `active` after Implement unless the model remembers to complete it, so every later run in that chat carries the old plan and the tool | `modes/state/tracked.ts:13`; `modes/state/tool.ts` |
| B10 | Med | The renderer parses the envelope with every mode that has an `output`, not the run's modes, so the card depends on which plugins are enabled now (AS M5) | `src/renderer/src/pages/home/components/AssistantMessage.tsx:174-181` |
| B11 | Low | `ask` in the manifest does nothing: interactive runs force it on, other runs reject the tool. Goal's prompt forbids asking but the tool is offered (AS M3) | `run_stream.ts:167-168`; `run_tool_call.ts:143` |
| B12 | Low | **New.** A note can't be cleared: an empty note keeps the previous one, so a `blocked` note stays on a later active or completed state | `modes/state/tool.ts:39` |
| B13 | Low | Two modes with a different `model` or `effort` resolve in alphabetical id order, while two `output`s are an error (AS M4). **New:** `mode.model` keeps the selected provider and is never checked against the catalog | `modes/resolve.ts:37-38`; `agent.ts:243-244` |
| B14 | Low | **New.** `shell: "none"` removes `bash` but keeps `process`, which can still write to background commands started by an earlier run | `modes/allows.ts:7` |
| B15 | Low | **New.** The envelope body can't mention its own tag (a plan that quotes `<proposed_plan>` is rejected), and the rewrite is not validated | `modes/output.ts:6-7`; `run_stream.ts:529` |
| B16 | Low | **New.** `modeIds` on a non-main run are dropped silently, against the "unavailable is an error" rule | `agent.ts:241` |

### Design

| # | Sev | Issue | Where |
| --- | --- | --- | --- |
| D1 | Med | `listModes()` hits the disk twice per run, and the second read can disagree with the pinned policy (AS M1) | `agent.ts:241`; `run_stream.ts:225` |
| D2 | Med | `restricted` is one flag for seven unrelated decisions. **New consequence:** any narrowing, even `permissions: "deny-asks"` alone, turns MCP off, so a `tools` list can never name an `mcp__…` tool. This is not documented for plugin authors | `modes/resolve.ts:43`; `run_stream.ts:267` |
| D3 | Med | Mode behaviour is inlined in the loop and executor (envelope retry, continue nudge, three gates), so it can't be read or checked in one place (AS M2) | `run_stream.ts:527-567`; `run_tool_call.ts:120-138,307` |
| D4 | Low | **New.** The read-only shell rule is enforced three times: the executor calls `readOnlyShellError` twice per call, `runExec` calls it again, then re-checks the workdir | `run_tool_call.ts:135-137`; `tools/core/bash.ts:112-132` |
| D5 | Low | `update_mode_state` claims `readOnly: true` with a `persistence` effect, only to pass the read-only filter. `HOST_TOOLS` already exists for that but is checked last (AS K1) | `modes/state/tool.ts:20-21`; `modes/allows.ts:8-9` |
| D6 | Low | **New.** Each nudge stores another copy of the whole user message in the session | `run_stream.ts:561` |
| D7 | Low | **New.** `docs/plugins/modes.md` says sub-agents use `NO_MODE`. They inherit the narrowed policy, which is the right behaviour | `docs/plugins/modes.md:56`; `run_stream.ts:285` |

Not a bug, worth knowing: an installed plugin folder named `bootstrap` with a higher version replaces the
bundled one (`src/main/plugins/plugins_scan.ts:31-43`), so its `modes/plan` can be an unrestricted mode
under the same `/plan` chip.

## 4. Plan

Four steps. Each leaves the app working and can ship alone.

### Step 1: Fix the bugs (small local edits)

| Fix | Change |
| --- | --- |
| B1 | `clearMessagesBySessionId` also removes the session's `modes/` folder, next to `attachments/`. |
| B2 | Drop `readOnly: true` from `run_script`. |
| B3 | `unfinishedModes` takes the run's start time. A `completed` or `blocked` state older than that counts as open. `stateContext` adds "Start a new state for a new objective" to a finished state of a mode that is on in this run. |
| B4 | `stateContext` escapes `<` in every model-written string. |
| B5, B8, B12 | New rules in `update_mode_state`: no `status` keeps the previous one, except that a new `objective` starts `active`; a refused `completed` saves the items as `active` and throws with the open item numbers; zero items gets its own message; a note is stored only when sent with this call's status. |
| B6 | Push `update_mode_state` after `childTools` is taken. |
| B7 | Wrap the read in `try`/`catch` and treat a bad file as no state. |
| B9 | In `update_mode_state`, a mode without `continue` completes itself when every item is done. |
| B11 | `ask` becomes narrowing, as in AGENT_STATE §4.9: default on for interactive runs, `"ask": false` removes it. Goal sets `false`, Plan drops `true`. |
| B13 | Two different `model`s are an error, like two outputs. `effort` takes the first in id order and the doc says so. Leave the provider check until a second bundled mode sets `model`. |
| B14 | `shell: "none"` also removes `process`. |
| B16 | `modeIds` on a non-main run throws. |
| D4 | Call `readOnlyShellError` once in the executor. |
| D7 | Fix the sentence in `docs/plugins/modes.md`. |

B15 stays as documented behaviour: one rewrite, then the answer is shown without the card.

Verify: typecheck, then in the app: clear a chat with an active plan and send a message (no `<mode_state>`
in `SYSTEM.md`); run `/goal` twice in one chat with a model reply that skips the state tool (second run is
nudged); in Plan, `run_script` is refused; corrupt a `modes/goal.json` by hand and send (run works).

### Step 2: Pin the definitions (D1)

- `resolveModes` returns the policy plus the definitions it was built from: `ModePolicy.available`, the
  full list read once in `agent.ts`.
- `run_stream.ts:225` uses `mode.available` instead of calling `listModes()` again.

- `resolveModes` loses its `available = listModes()` default, so the list is always passed in.

Verify: `git grep -n "listModes()" src/main` shows `agent.ts` and `ipc/agent.ts` only.

### Step 3: Move mode decisions out of the loop and executor (D3, D5)

Two new functions in `modes/`, one file each. Both are pure, so they can be read and checked without
running a model.

- **`modes/stop.ts`: `modeStop(turn, policy, state)`** returns `accept`, `retry` with an instruction, or
  `continue` with a hidden message. It holds the envelope check and the unfinished check, and replaces
  `run_stream.ts:527-567`. The caps (one retry, three nudges, never two in a row) stay in the loop,
  because they are loop state. The nudge message no longer repeats the user's request (D6).
- **`modes/gate.ts`: `modeGate(policy, tool, input, workspace)`** returns an error string or nothing. It
  merges `allowsTool` and the read-only shell check, and replaces the two executor branches at
  `run_tool_call.ts:120-122,132-138`. `HOST_TOOLS` is checked first, so `update_mode_state` drops its
  false `readOnly` flag.

`filterModeTools` stays as the listing-time filter. `deny-asks` stays one line in the executor.

Verify: Plan still blocks `write`, `edit` and a `bash` call with `background: true`; Plan still renders
the card; Goal still continues. `git grep -n "mode\.output\|isEnvelopeValid\|unfinishedModes" src/main/agent/runner`
returns nothing.

### Step 4: Envelope by run (B10)

- The reducer keeps `modeIds` from `run_started` on the assistant message, and `messages.json` stores it.
- `AssistantMessage` parses the envelope only with that run's modes. Messages without the field keep
  today's behaviour.

Verify: disable `bootstrap`, reload: an old plan message shows as markdown and no other message changes.

### Left out on purpose

- **D2, splitting `restricted`.** Document that a narrowed mode has no MCP. Split the flag when a mode
  needs MCP tools in its `tools` list.
- **Chips that survive a reload** (session-owned modes): AGENT_STATE §3.6. It is a feature, not a fix.
- **Evidence refs** (AS T5): AGENT_STATE §3.4.
- **Replacing `readOnly` with effects** across all tools (AS K1): AGENT_STATE step 6. Step 1 only fixes
  `run_script`.
- **Tests.** No tests cover `modes/**` (AS X2), and AGENT_STATE X1 reports stale test files. Writing or
  running tests needs an explicit request, per [CLAUDE.md](../CLAUDE.md).

## 5. How this fits AGENT_STATE.md

| AGENT_STATE step | This plan |
| --- | --- |
| 1. Quick fixes | Step 1 covers its mode items (T1–T4, M3, `run_script`) and adds B3, B4, B5, B9, B12–B16. R1, K4, R8 and the stale tests are not modes and stay there. |
| 2. Run state machine | Not needed here. |
| 3. Hooks and mode primitives | Step 3 gets the same result for modes with two functions instead of a composer and six hook kinds. If the hooks are built later, `modeStop` and `modeGate` become the bodies of the `stop` and `gate` hooks unchanged. |
| 4. State store and evidence refs | Step 1 fixes the state rules in place. The store and refs stay there. |
| 5. Session-owned modes | Step 4 takes only the per-message `modeIds`. |
| 6. Tool contract | Left there. |
