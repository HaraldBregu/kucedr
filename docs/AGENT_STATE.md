# Agent state, hooks and modes

Status: proposal, 2026-11-09, reviewed against the working tree of `afd036cf2e` with uncommitted changes.
Nothing here is implemented. Decisions taken: modes stay data-only and are enforced by host hooks; main owns
each chat's active modes; runs are not resumed, but unfinished runs are marked interrupted at startup. Paths are relative to `src/main/agent/` unless they
start with `src/`, `docs/` or `resources/`. Severity is High (wrong result or data/security impact), Med
(robustness or performance), or Low (cleanup).

## 1. How it works today

`Agent.send` → `admitRun` (registry) → `AgentRunScheduler` (one run per session) → `Agent.process` →
`stream()` → `loop()` (model turns) → `runToolCalls` → `runToolCall` (gates, permission, locks, execute).

| Scope | Where the state lives |
| --- | --- |
| App | `Agent` (run registry, scheduler, limiters, `KeyedMutex`, `SessionCoordinator`); module registries (pending approvals and input, process registry, browser session, recorder owners) |
| Session (disk) | `<sessions>/<uuid>/`: `info.json`, `messages.json`(+`.bak`), `run.jsonl`, `SYSTEM.md`, `attachments/`, `modes/<id>.json` |
| Run | `SessionState` (created per run), `RunContext` (file access, undo history, skills), `ExecutionBudget`, and about 15 locals in `loop()` |
| Tool call | `AsyncLocalStorage` scopes (`executionScope`, `authorizedPaths`, `approvedExecRoots`) |

Modes: `listModes()` reads the plugin folders, `resolveModes()` folds them into a `ModePolicy`, and the loop
and executor branch on its fields. Tracked state is read and written straight from `modes/<id>.json`.

## 2. Findings

### Run lifecycle and loop

| # | Sev | Issue | Where |
| --- | --- | --- | --- |
| R1 | High | Timeouts are reported as `cancelled`: the timer aborts with no reason, but the mapping only knows `TimeoutError` | `agent.ts:318`; `runner/run_stream.ts:119-123,134-138` |
| R2 | Med | The 10-minute run timer keeps counting while the user answers an approval or an `ask` (only MCP authorization pauses it) | `agent.ts:338-345` |
| R3 | Med | `responseEvents` keeps every streamed delta for the whole run, and the snapshot copies all of them | `agent.ts:384-387,401` |
| R4 | Med | The registry knows only `queued/running/cancelling`. It can't show waiting-for-approval, the turn, or the outcome, and the record is deleted on completion | `state/state_types.ts:21-24`; `state/state_complete.ts:7-8`; `agent.ts:438` |
| R5 | Med | Loop control state lives in generator locals (`finalization`, `continued`, `nudges`, tools, search, MCP), so snapshots and traces never see it | `runner/run_stream.ts:471-473,251` |
| R6 | Med | `budget.exhausted` is a public flag with five writers plus a reset. The write at `runner/run_stream.ts:648` is undone right away by `allowSynthesis()` for every non-subagent run | `execution/budget.ts:14,58,68,78,96,116`; `runner/run_stream.ts:648,654` |
| R7 | Low | The stop-reason mapping appears twice. The record → emit → persist triplet appears three times. `iteration: 0` is hard-coded in event translation | `runner/run_stream.ts:119/134, 582/603/622`; `agent.ts:724,741,783,793,847` |
| R8 | Low | `budget.outcomes` keeps a `structuredClone` of every call and nothing reads it | `execution/budget.ts:5`; `runner/run_tool_call.ts:488` |

### Modes

| # | Sev | Issue | Where |
| --- | --- | --- | --- |
| M1 | Med | `listModes()` re-reads every mode folder synchronously, twice per run. The second read can disagree with the policy pinned at run start, because `ModePolicy` doesn't keep the definitions (breaks AGENT_MODES rule 4) | `agent.ts:237`; `runner/run_stream.ts:248`; `modes/types.ts:28-41` |
| M2 | Med | Mode primitives are inlined in the core: `mode.restricted` ×5, `mode.output`, `mode.ask`, and stateful modes ×4 in the loop, plus five sites in the executor. A new primitive means editing the loop and the executor | `runner/run_stream.ts:173,239,291,364,413,513,563,579,687`; `runner/run_tool_call.ts:116,128-140,202,305`; `runner/run_tool_calls.ts:36-38` |
| M3 | Low | The `ask` manifest field does nothing in interactive runs: since `5f0d0f8` (2026-11-08) every interactive run forces `ask: true`. Goal's prompt forbids asking, yet the tool is still offered, and `ask: true` is the one field that adds a tool (against AGENT_MODES rule 2) | `runner/run_stream.ts:167-168`; `modes/resolve.ts:45` |
| M4 | Low | Two modes with different `model` or `effort` resolve silently in alphabetical order, while two `output`s are an error | `modes/resolve.ts:37-38` |
| M5 | Med | The renderer picks the envelope by trying **every** mode with an `output`, not the run's modes (the reducer ignores `run_started`). Active modes live only in component state, are lost on reload, and aren't restored from the snapshot | `src/renderer/src/pages/home/components/AssistantMessage.tsx:174-181`; `src/renderer/src/pages/home/context/reducer.ts:135`; `src/renderer/src/pages/home/hooks/useHomeAgent.ts:65,372-393` |

### Tracked mode state

| # | Sev | Issue | Where |
| --- | --- | --- | --- |
| T1 | High | Clearing a chat leaves `modes/*.json`. A still-active plan or goal from the cleared conversation keeps being injected into later runs, with its update tool | `session/session_clear_messages_by_session_id.ts:23-33`; `modes/state/tracked.ts:13` |
| T2 | Med | The `subagent` child gets the parent's `update_mode_state` (and the parent's `undo`/`redo`) bound to the parent's session, so a child can complete the parent's plan or undo the parent's edits | `runner/run_stream.ts:240-250` → `:315`; `modes/allows.ts:4`; `tools/core/subagents.ts:180-186` |
| T3 | Med | Malformed JSON crashes the run: `JSON.parse` sits outside the safe parse | `modes/state/read.ts:9` |
| T4 | Med | Updating items without `status` quietly reopens a completed or blocked state, which then stays tracked in every later run | `modes/state/tool.ts:36` |
| T5 | Med | Evidence is any non-empty string, but Goal's prompt says "the host rejects it otherwise" (AGENT_REVIEW F10 is still open) | `modes/state/tool.ts:43-47`; `resources/plugins/bootstrap/modes/goal/SYSTEM_PROMPT.md` |
| T6 | Low | Each state file is read synchronously several times per turn, and the state is written into the system prompt, so the prompt prefix changes whenever the state does | `modes/state/context.ts:9`; `modes/state/unfinished.ts:12`; `runner/run_stream.ts:513-514` |

### Tool execution and tools

| # | Sev | Issue | Where |
| --- | --- | --- | --- |
| K1 | High | `readOnly` and `capability.effects` disagree. `run_script` is read-only but spawns plugin code outside the sandbox. `update_mode_state` is read-only but persists. MCP `readOnlyHint` tools never get `readOnly`. `search_web` and `query_knowledge` call keyed remote APIs but are classed `read` | `tools/plugin/run.ts:13`; `src/main/plugins/scripts/plugin_script_render.ts:23`; `modes/state/tool.ts:20-21`; `tools/mcp/tool.ts:14-35`; `execution/capability.ts:8-28` |
| K2 | High | Shared registries have no owner scope. Process `get`/`remove` are unscoped and entries are never removed. Background `bash` isn't registered. One browser session serves every run, so any run can close another's tabs (AGENT_REVIEW F3) | `tools/core/process.ts:37,52`; `tools/core/bash.ts:183-241`; `tools/web/browser/session.ts:15`; `tools/web/use_web_browser.ts:300,323` |
| K3 | Med | `runToolCall` is a 450-line if/else chain with tool-id special cases. The `ask`, `select_screen_source` and `request_mcp_authorization` UI flows live in the executor, not in the tools | `runner/run_tool_call.ts:70,135-270,315,420,431,457` |
| K4 | Med | `complete_bootstrap`, `update_identity`, `update_soul` and `update_user` are "required" in every normal run, so they're sent on every turn | `runner/run_stream.ts:349-361`; `runner/run_builtin_tools.ts:77-90` |
| K5 | Med | Effects outlive abort: recorder status `wait`, detached `run_task_now`, `run_script` (no signal), non-atomic multi-file `patch`, browser `press/stop/close` | `tools/system/camera_recorder_status.ts:23`; `src/main/tasks/tasks_fire.ts:18`; `tools/core/patch.ts:26-47`; `tools/web/use_web_browser.ts:211,300,323` |
| K6 | Low | The loop parses `tool_search`'s JSON output to build an event, and `TOOL_SEARCH_ID` is imported but literals are used anyway | `runner/run_stream.ts:211-213,660,717-750` |
| K7 | Low | Error contracts are mixed: throw, `{status}` objects, JSON strings, `undefined` | `tools/mcp/tool.ts:65-69`; `tools/system/screen_recorder.ts:80-94`; `modes/state/tool.ts:42-57`; `tools/tasks/delete_task.ts:12-14` |
| K8 | Low | Duplication: three recorder start/status/stop triplets, the media tools, undo/redo, the get/update pairs, and `readFileBounded(2 MiB)` ×3 | `tools/system/*`; `tools/media/*`; `tools/core/{read,edit,patch}.ts` |
| K9 | Low | Things that grow without bound: `recordingOwners`, the `renderPluginScript` cache, voice tool-runtime maps | `recordings/store.ts:4`; `src/main/plugins/scripts/plugin_script_render.ts:7-8`; `realtime_voice/tool_runtime.ts:48-57` |

### Tests and docs

| # | Sev | Issue | Where |
| --- | --- | --- | --- |
| X1 | High | About 20 unit test files and one e2e spec still import deleted modules or use `interactionMode`/`planSafe`, so `npm test` can't pass | e.g. `tests/unit/main/agent/plan/*.test.ts`, `tests/unit/renderer/{goal,plan}-command.test.ts`, `run-stream-prompt.test.ts:527…`, `tests/e2e/navigation.spec.ts:1014` |
| X2 | Med | No tests cover `modes/**`, `modes/state/**`, `src/renderer/src/pages/home/components/envelope.ts`, `src/renderer/src/pages/home/hooks/leading.ts` or `src/renderer/src/components/mode-command.ts` | `tests/` |

## 3. Target design

What "state of the art" means here, as shared by today's agent runtimes: a run is an explicit state
machine; one pure reducer is the only writer of run state; behavior plugs in through a small, fixed set of
lifecycle hooks; and tool gating comes from declared effects, not from id lists. OpenAI's Agents SDK keeps a
serializable `RunState`. LangGraph reduces state on each step. The Claude Agent SDK has
`PreToolUse`/`Stop` hooks, and the Vercel AI SDK has `prepareStep`/`stopWhen`. Each is a variant of this
pattern. No new dependency is needed.

Principles:
1. **One writer per state.**
   - Run state: `reduceRun`.
   - Tracked mode state: `ModeStateStore`.
   - A session's active modes: `Agent` (main).
2. **Plain data.** Run state is serializable, and its transitions are recorded in `run.jsonl`. The
   interrupted sweep relies on that.
3. **Narrow only.** A hook can remove tools, refuse calls, or tighten a permission. It can never add a tool to
   the base set or relax a permission. The composer enforces this, not each hook.
4. **Modes are data; primitives are host code.** Each manifest field switches on one host hook. Plugins
   still ship no code.
5. **Run-local tools aren't inherited.** Tools a hook provides (`update_mode_state`) and tools bound to the
   run (`undo`/`redo`) are never passed to children. `ask` stays filtered out of children, as it is today.

### 3.1 Run state machine

```text
queued ─begin→ preparing ─run_started→ thinking ⇄ using_tools ⇄ awaiting_approval | awaiting_input
   │               │                        │ (run_finalize / run_continue → thinking)
   └──── cancel ───┴──────────→ cancelling ─┴──────── run_finished ──→ finished (stopReason)
```

- `stream()` reduces every event before yielding it, so the registry record and the loop share one
  `{ current }` ref.
- The loop reads `finalize`, `continues` and `continued` from that state instead of its own locals.
- New internal events: `run_finalize` and `run_continue`. They are written to `run.jsonl` but not sent to
  the renderer.
- The timer pauses whenever `state.waiting` is set (fixes R2).

### 3.2 Run hooks

These are the lifecycle points the loop and executor call: `provide` (run-local tools), `tools` (filter the
base set), `prompt` (system / protected / context slots), `gate` (refuse a call), `permission` (tighten) and
`stop` (accept, retry with an instruction, or continue with a hidden message). `composeHooks` applies the
rules:
- tool filters and permissions can only narrow;
- the first `gate` error wins;
- the first non-accept `stop` wins;
- prompt parts are joined in hook order.

Caps (one retry while finalizing, three continues, never two continues in a row) live in `decide()`, not in
the hooks. That keeps hooks stateless.

The `context` prompt slot holds volatile text (tracked state). It's appended last for now. Because it's a
separate slot, moving it later into a trailing per-turn reminder, which keeps the system prompt stable for
prefix caching, needs no change to any hook (T6).

### 3.3 Modes as hooks

| Manifest field | Host hook | Replaces |
| --- | --- | --- |
| `tools`, `shell: "none"` | `filterHook` (`tools` + `gate`) | `filterModeTools`, `allowsTool` call in the executor |
| `shell: "read-only"` | `readOnlyHook` (`gate` on `bash` input) | executor branch `runner/run_tool_call.ts:128-134` |
| `permissions: "deny-asks"` | `denyHook` (`permission`) | `runner/run_tool_call.ts:305` |
| `SYSTEM_PROMPT.md`, `protectedPrompt` | `promptHook` (`prompt.system` / `prompt.protected`) | `runner/run_stream.ts:494,512` |
| `output.envelope` | `envelopeHook` (`stop` → retry) | `runner/run_stream.ts:559-571` |
| `state`, `state.continue` | `stateHook` (`provide` tool, `prompt.context`, `stop` → continue) | `runner/run_stream.ts:245-250,513-514,573-599`; `modes/state/unfinished.ts` |
| `effort`, `model` | run config at admission (data, not a hook) | unchanged |
| `action` | renderer only | unchanged |
| `ask` | becomes narrowing (M3): interactive runs have `ask` by default, and `"ask": false` removes it. Goal sets it; Plan drops its `"ask": true` | `runner/run_stream.ts:167-168`; `modes/resolve.ts:45`; `modes/types.ts:47` |

`policy.restricted` stays a plain flag for decisions that must happen before any tool exists: skip MCP
discovery (discovery starts stdio servers), skip undo/redo, skip bootstrap. Bootstrap, budget finalization
and the recorder notice are candidates for hooks later. They move only when someone touches them.

### 3.4 Tracked mode state

- **`ModeStateStore`**, one per run, is the only reader and writer. It caches reads, so a file is read once
  per run (fixes T6's repeated reads). It survives malformed JSON (fixes T3).
- **Status transitions:**
  - with no `status`, the previous status is kept;
  - a new objective starts a fresh `active` state;
  - `blocked` needs a note.

  This fixes T4.
- **Evidence:**
  - an item can cite `ref`, the id of the tool call that proves it;
  - a `ref` must resolve to a successful call in the session's messages, or the update is refused;
  - a resolved `ref` stores `verified: true`.

  Text-only evidence is still accepted, so models that can't cite ids don't get stuck. It just stays
  unverified, and the UI can label it (T5 and AGENT_REVIEW F10).
- **Clearing a chat deletes `modes/`** (fixes T1).
- **Children never see the tool**, because it's run-local (fixes T2).

### 3.5 Tool contract

- **Effects are the only source of truth.** `readOnly` is removed from `Tool`. "Allowed in a read-only mode"
  means every declared effect is `read`. It's checked at listing time with `{}` and again at call time with
  the real input. Host tools (`tool_search`, `ask`, `update_mode_state`) are exempt.
  - `bash` built for a read-only shell declares `effects: ['read']`.
  - `run_script` moves to `execute` (K1, AGENT_MODES issue 7).
- **Run-local tools.** `hooks.provide()` tools and undo/redo join the run after `childTools` is taken, so
  children never get them.
- **Later (step 6): `ToolContext`.** `run(input, signal, context?)`, where `context.ask(questions)` emits the
  input request/result through the executor. `ask`, `select_screen_source` and `request_mcp_authorization`
  move their flows into their own files, which deletes `runner/run_tool_call.ts:135-270` (K3). `tool_search` emits
  its own `capability_resolution_result` (K6).

### 3.6 Session-owned modes

**Storage.** The persistent subset of a chat's active modes lives in an optional `modeIds` field in `info.json`,
next to `title` and `pinned`. Why there:
- pin, rename and archive already read, merge and atomically write that file (`session/session_pin_session.ts:6-16`);
- clear chat doesn't touch it, and deleting the folder removes it;
- no field means no modes, so nothing needs migrating.

**Writers.** Every write goes through the per-session scheduler, so an edit made during a run lands after that
run's own write.
- **Send:** main stores the persistent subset of the run's `modeIds`. An action run sends `[]`
  (`src/renderer/src/pages/home/hooks/useHomeAgent.ts:300`), which clears them.
- **Chip edit:** a new `agent:set-session-modes` call stores the persistent subset. If `info.json` doesn't
  exist yet, it does nothing, so toggling a chip never creates a chat.
- **Clear chat:** `[]`, and `modes/` is removed (T1).

**Readers.** The session snapshot returns the stored ids. The chip starts from them on load and after the
compaction refresh. An unavailable mode then fails loudly at send, which is the fail-closed rule.

**Messages.** Each assistant message records its run's `modeIds`: live from `run_started`, and from
`messages.json` in history. The envelope card then parses only with the run's own mode (M5). Old messages
without the field keep today's behavior of trying every mode.

### 3.7 Interrupted runs

**What it buys.** After a restart no spinner can show today, because the run registry lives in memory and
nothing reads `run.jsonl` back. The conversation is also already safe: the LLM adapter turns a missing tool
result into an error reply (`src/main/models/adapters/llm/llm_shared.ts:47-52`). So the sweep's value is a
truthful trace, for diagnostics and as a correct base if the UI ever shows run outcomes. It's about 40 lines.

**Rule.** If the last line of a `run.jsonl` isn't a parseable `run_finished` or `run_error`, the run never
finished.
- The sweep appends `run_finished` with `stopReason: 'interrupted'`.
- It restores the file's mtime, so the chat list order doesn't change.

**Write gap.** Traces are flushed only every 16 entries or at the end of a run
(`session/session_append_run.ts:8,20-25`). A run that crashes early leaves no `run_started` on disk, so
`run_started` must flush too. That's one extra write per run.

**When and cost.**
- It runs first thing in `Agent.start()`. That runs before the IPC handlers are registered
  (`src/main/runtime.ts:81,89`), so nothing is writing a trace yet.
- Cost: one stat and at most a 4 KiB tail read per session folder, once per launch.

`'interrupted'` stays a trace-only string. Add it to `AgentRunStopReason` and `normalizeStopReason` only when a
typed reader appears.

## 4. Refactoring code

### 4.1 Run state (`state/`)

`state/state_types.ts`: `lifecycle` becomes reduced state shared with `stream()`.

```ts
import type { AgentResponseEvent, AgentRunStopReason } from '../../../shared/agent_types';
import type { SessionCategory, SessionResult, SessionState } from '../session';
import type { RuntimeEvent } from '../types';

export interface AgentRunOutcome {
	text: string;
	stopReason: AgentRunStopReason;
	result?: SessionResult;
}

export interface AgentRunRequest<TOptions = unknown> {
	readonly id: string;
	readonly agentId: string;
	readonly sessionId: string;
	readonly category: SessionCategory;
	readonly message: string;
	readonly options: TOptions;
	readonly queuedAt: number;
	readonly windowId?: number;
}

export type AgentRunStatus =
	| 'queued'
	| 'preparing'
	| 'thinking'
	| 'using_tools'
	| 'awaiting_approval'
	| 'awaiting_input'
	| 'cancelling'
	| 'finished';

/** Everything a run has decided so far, as plain data. Only `reduceRun` makes new values. */
export interface AgentRunState {
	readonly status: AgentRunStatus;
	readonly turn: number;
	readonly modeIds: readonly string[];
	readonly waiting?: {
		readonly kind: 'approval' | 'input';
		readonly id: string;
		readonly toolCallId: string;
	};
	readonly finalize?: { readonly instruction: string; readonly stopReason?: string };
	readonly continues: number;
	readonly continued: boolean;
	readonly stopReason?: AgentRunStopReason;
}

export type AgentRunAction = RuntimeEvent | { type: 'run_begin' } | { type: 'run_cancel' };

export const INITIAL_RUN: AgentRunState = {
	status: 'queued',
	turn: 0,
	modeIds: [],
	continues: 0,
	continued: false,
};

export interface AgentRunRecord<TOptions = unknown> {
	readonly request: Readonly<AgentRunRequest<TOptions>>;
	readonly controller: AbortController;
	readonly responseEvents: AgentResponseEvent[];
	readonly state: { current: AgentRunState };
	session?: SessionState;
	completion?: Promise<AgentRunOutcome>;
}

export type AgentRunRegistry<TOptions = unknown> = Map<string, AgentRunRecord<TOptions>>;
```

`state/state_reduce.ts` (new):

```ts
import { runStopReason } from './state_stop_reason';
import type { AgentRunAction, AgentRunState, AgentRunStatus } from './state_types';

/** Folds one event into a run's state. A finished run never changes; a cancelling run stays cancelling. */
export function reduceRun(state: AgentRunState, action: AgentRunAction): AgentRunState {
	if (state.status === 'finished') return state;
	const to = (status: AgentRunStatus): AgentRunStatus =>
		state.status === 'cancelling' ? 'cancelling' : status;
	switch (action.type) {
		case 'run_begin':
			return state.status === 'queued' ? { ...state, status: 'preparing' } : state;
		case 'run_cancel':
			return { ...state, status: 'cancelling', waiting: undefined };
		case 'run_started':
			return { ...state, status: to('thinking'), modeIds: action.modeIds };
		case 'model_call_start':
			return { ...state, status: to('thinking') };
		case 'model_call_end':
			return { ...state, turn: state.turn + 1 };
		case 'assistant_message':
			return { ...state, continued: false };
		case 'tool_call_start':
			return { ...state, status: to('using_tools') };
		case 'tool_permission_request':
			return {
				...state,
				status: to('awaiting_approval'),
				waiting: { kind: 'approval', id: action.approvalId, toolCallId: action.toolCallId },
			};
		case 'user_input_request':
			return {
				...state,
				status: to('awaiting_input'),
				waiting: { kind: 'input', id: action.requestId, toolCallId: action.toolCallId },
			};
		case 'user_input_result':
		case 'tool_call_end':
			return state.waiting?.toolCallId === action.toolCallId
				? { ...state, status: to('using_tools'), waiting: undefined }
				: state;
		case 'run_finalize':
			return {
				...state,
				finalize: {
					instruction: action.instruction,
					...(action.stopReason ? { stopReason: action.stopReason } : {}),
				},
			};
		case 'run_continue':
			return { ...state, continues: state.continues + 1, continued: true };
		case 'run_finished':
			return {
				...state,
				status: 'finished',
				waiting: undefined,
				stopReason: runStopReason(action.result.stopReason),
			};
		default:
			return state;
	}
}
```

`state/state_stop_reason.ts` is `normalizeStopReason` moved out of `agent.ts:575-584`, unchanged. Changes
elsewhere:
- `state/state_admit.ts` sets `state: { current: INITIAL_RUN }`.
- `state/state_begin.ts` reduces `run_begin` and stores `session`.
- `state/state_cancel.ts` reduces `run_cancel`, then aborts.

`types.ts` (`RuntimeEvent`) gains two internal events:

```ts
	| { type: 'run_finalize'; instruction: string; stopReason?: string }
	| { type: 'run_continue' }
```

`session/session_trace_entry.ts` already writes unknown events as `{ type }` (`:249`). It should also keep
`stopReason` for `run_finalize`. The instruction text stays out, because traces exclude model-facing content.

`runner/run_stream.ts`, `stream()`: one reducer call per event, and one helper for the duplicated mapping (R7):

```ts
export async function* stream(config, session, input, signal, options: StreamOptions = {}) {
	const state = options.state ?? { current: INITIAL_RUN };
	const emit = (event: RuntimeEvent): RuntimeEvent => {
		state.current = reduceRun(state.current, event);
		tryAppendRun(session, event);
		return event;
	};
	// …loop(config, session, input, signal, options, state, browser?.tool): every `yield event`
	// becomes `yield emit(event)`. Both terminal paths use `session.stopReason = stopped(signal)`.
}
```

`runner/stopped.ts` (new) replaces `runner/run_stream.ts:119-123` and `:134-138`:

```ts
export function stopped(signal: AbortSignal): 'timeout' | 'cancelled' | 'error' {
	if (!signal.aborted) return 'error';
	return signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError'
		? 'timeout'
		: 'cancelled';
}
```

`agent.ts`, in `process()`: timeout reason (R1), pause while waiting (R2), shared state:

```ts
			const startTimeout = (): void => {
				clearTimeout(timeoutTimer);
				timeoutTimer = setTimeout(
					() => timeoutController.abort(new DOMException('Run timed out.', 'TimeoutError')),
					10 * 60_000
				);
			};
			// …
			const events = stream(this.config, session, input, runSignal, { …, state: record.state });
			let waiting = false;
			for await (const event of events) {
				// replaces the MCP-only pause at agent.ts:338-345
				if (Boolean(record.state.current.waiting) !== waiting) {
					waiting = !waiting;
					if (waiting) clearTimeout(timeoutTimer);
					else startTimeout();
				}
				// …unchanged event handling
			}
```

`agent.ts`, `emit()`: bounded replay buffer (R3). New file `state/state_append.ts`:

```ts
import type { AgentResponseEvent } from '../../../shared/agent_types';

/** Keeps the replay buffer small: consecutive deltas are merged into one event. */
export function appendEvent(events: AgentResponseEvent[], event: AgentResponseEvent): void {
	const last = events.at(-1);
	if (event.type === 'text_delta' && last?.type === 'text_delta') {
		events[events.length - 1] = { ...event, delta: last.delta + event.delta };
	} else if (
		event.type === 'tool_call_args_delta' &&
		last?.type === 'tool_call_args_delta' &&
		last.toolCallId === event.toolCallId
	) {
		events[events.length - 1] = { ...event, jsonDelta: last.jsonDelta + event.jsonDelta };
	} else events.push(event);
}
```

Other `agent.ts` reads move to the state:
- `runStatus` and the snapshot `status` read `record.state.current.status`;
- the cancelled-before-start check (`:209`) becomes `status === 'cancelling' && !record.session`;
- `runningSkill()` reads `record.session?.runContext`;
- `iteration: 0` (R7) becomes `record.state.current.turn`.

The shared coarse status (`AgentSessionSummary.runStatus` and the snapshot `status`,
`src/shared/agent_types.ts:204,212`) gains one value, `'awaiting_input'`, so the sidebar can show "needs you".
The other values are unchanged:
- preparing, thinking and using_tools map to `'running'`;
- both awaiting states map to `'awaiting_input'`;
- the mapping is one switch in a new `state/state_summary.ts`.

Existing renderer code and tests that use `'running'` keep working
(`tests/unit/renderer/home-sidebar.test.tsx:109,129`).

### 4.2 Hooks (`hooks/`, new)

`hooks/types.ts`:

```ts
import type { Tool, ToolCall } from '../types';
import type { AgentRunState } from '../state';

export type HookPermission = 'allow' | 'ask' | 'deny';

export type HookStop =
	| { readonly kind: 'accept' }
	| { readonly kind: 'retry'; readonly instruction: string }
	| { readonly kind: 'continue'; readonly message: string };

export interface HookPrompt {
	readonly system?: string;
	readonly protected?: string;
	readonly context?: string;
}

/** A host primitive plugged into one run. Every member is optional; hooks can only narrow a run. */
export interface RunHook {
	readonly id: string;
	readonly provide?: () => readonly Tool[];
	readonly tools?: (tools: readonly Tool[]) => readonly Tool[];
	readonly prompt?: (run: AgentRunState) => HookPrompt;
	readonly gate?: (call: ToolCall, tool: Tool) => string | undefined;
	readonly permission?: (current: HookPermission, call: ToolCall, tool: Tool) => HookPermission;
	readonly stop?: (answer: string, run: AgentRunState) => HookStop;
}

export type RunHooks = { readonly [K in keyof RunHook]-?: NonNullable<RunHook[K]> };
```

`hooks/compose.ts`:

```ts
import type { Tool } from '../types';
import type { HookPermission, HookPrompt, RunHook, RunHooks } from './types';

const STRICTNESS: Record<HookPermission, number> = { allow: 0, ask: 1, deny: 2 };

/** A run's hooks as one. Filters and permissions only narrow; the first refusal or non-accept stop wins. */
export function composeHooks(hooks: readonly RunHook[]): RunHooks {
	return {
		id: hooks.map((hook) => hook.id).join(','),
		provide: () => hooks.flatMap((hook) => hook.provide?.() ?? []),
		tools: (tools) =>
			hooks.reduce<readonly Tool[]>((kept, hook) => {
				const next = hook.tools?.(kept) ?? kept;
				return kept.filter((tool) => next.includes(tool));
			}, tools),
		prompt: (run) => {
			const parts = hooks.map((hook) => hook.prompt?.(run) ?? {});
			const join = (slot: keyof HookPrompt): string =>
				parts
					.map((part) => part[slot])
					.filter(Boolean)
					.join('\n\n');
			return { system: join('system'), protected: join('protected'), context: join('context') };
		},
		gate: (call, tool) => {
			for (const hook of hooks) {
				const error = hook.gate?.(call, tool);
				if (error) return error;
			}
			return undefined;
		},
		permission: (current, call, tool) =>
			hooks.reduce((strictest, hook) => {
				const next = hook.permission?.(strictest, call, tool) ?? strictest;
				return STRICTNESS[next] > STRICTNESS[strictest] ? next : strictest;
			}, current),
		stop: (answer, run) => {
			for (const hook of hooks) {
				const decision = hook.stop?.(answer, run);
				if (decision && decision.kind !== 'accept') return decision;
			}
			return { kind: 'accept' };
		},
	};
}
```

### 4.3 Mode primitives (`modes/`)

`modes/hooks.ts` (new): the only place that maps manifest fields to hooks.

```ts
import type { RunHook } from '../hooks/types';
import type { Message } from '../types';
import { denyHook } from './deny';
import { envelopeHook } from './envelope';
import { filterHook } from './filter';
import { promptHook } from './prompt';
import { readOnlyHook } from './readonly';
import { stateHook } from './state/hook';
import type { ModeStateStore } from './state/store';
import type { ModeDefinition, ModePolicy } from './types';

/** Each manifest field switches on one host primitive. The envelope check runs before tracked state. */
export function modeHooks(
	policy: ModePolicy,
	tracked: readonly ModeDefinition[],
	store: ModeStateStore,
	context: { workspace: string; request: string; messages: () => readonly Message[] }
): RunHook[] {
	return [
		...(policy.ids.length > 0 ? [filterHook(policy)] : []),
		...(policy.shell === 'read-only' ? [readOnlyHook(context.workspace)] : []),
		...(policy.permissions === 'deny-asks' ? [denyHook] : []),
		...(policy.prompt || policy.protectedPrompt ? [promptHook(policy)] : []),
		...(policy.output ? [envelopeHook(policy.output.envelope)] : []),
		...(tracked.length > 0
			? [stateHook(store, tracked, policy.ids, context.request, context.messages)]
			: []),
	];
}
```

The small primitives (one per file):

```ts
// modes/filter.ts
export function filterHook(policy: ModePolicy): RunHook {
	return {
		id: 'mode-tools',
		tools: (tools) => tools.filter((tool) => allowsTool(policy, tool)),
		gate: (call, tool) =>
			allowsTool(policy, tool, call.args)
				? undefined
				: `tool '${call.name}' is unavailable in the active mode`,
	};
}

// modes/readonly.ts
export function readOnlyHook(workspace: string): RunHook {
	return {
		id: 'mode-shell',
		gate: (call, tool) => (tool.id === 'bash' ? readOnlyShellError(call.args, workspace) : undefined),
	};
}

// modes/deny.ts
export const denyHook: RunHook = {
	id: 'mode-permissions',
	permission: (current) => (current === 'ask' ? 'deny' : current),
};

// modes/prompt.ts
export function promptHook(policy: ModePolicy): RunHook {
	return {
		id: 'mode-prompt',
		prompt: () => ({ system: policy.prompt, protected: policy.protectedPrompt }),
	};
}

// modes/envelope.ts
export function envelopeHook(tag: string): RunHook {
	return {
		id: 'mode-output',
		stop: (answer) =>
			isEnvelopeValid(answer, tag)
				? { kind: 'accept' }
				: {
						kind: 'retry',
						instruction: `Your previous final response was rejected. The response must contain exactly one non-empty <${tag}> envelope and no other text. Write the complete final response again in that form.`,
					},
	};
}
```

`modes/allows.ts`: effects replace `readOnly` (K1), and host tools come first so honest capabilities don't
filter them out:

```ts
import { isInert } from '../execution/inert';
import type { Tool } from '../types';
import type { ModePolicy } from './types';

const HOST_TOOLS = new Set(['tool_search', 'ask', 'update_mode_state']);

export function allowsTool(mode: ModePolicy, tool: Tool, input: Record<string, unknown> = {}): boolean {
	if (HOST_TOOLS.has(tool.id)) return true;
	if (mode.shell === 'none' && tool.id === 'bash') return false;
	if (mode.readOnly && !isInert(tool, input)) return false;
	return !mode.toolIds || mode.toolIds.includes(tool.id);
}
```

`execution/inert.ts` (new):

```ts
import type { Tool } from '../types';

/** A call that only reads. Checked with `{}` when listing tools and with the real input before running. */
export function isInert(tool: Tool, input: Record<string, unknown> = {}): boolean {
	const capability = typeof tool.capability === 'function' ? tool.capability(input) : tool.capability;
	return capability !== undefined && capability.effects.every((effect) => effect === 'read');
}
```

`modes/resolve.ts` returns the definitions it pinned, so the loop never calls `listModes()` again (M1). One
`listModes()` per run, in `agent.ts`:

```ts
export interface ResolvedModes {
	readonly policy: ModePolicy;
	readonly available: readonly ModeDefinition[];
}
// RuntimeInput.mode?: ModePolicy  →  RuntimeInput.modes?: ResolvedModes
```

### 4.4 Tracked state (`modes/state/`)

`modes/state/store.ts` (new):

```ts
import { readState } from './read';
import type { ModeState } from './types';
import { writeState } from './write';

/** One run's view of the session's tracked states: each file is read once and written through. */
export class ModeStateStore {
	private readonly cache = new Map<string, ModeState | undefined>();

	constructor(private readonly directory: string) {}

	read(modeId: string): ModeState | undefined {
		if (!this.cache.has(modeId)) this.cache.set(modeId, readState(this.directory, modeId));
		return this.cache.get(modeId);
	}

	write(state: ModeState): ModeState {
		writeState(this.directory, state);
		this.cache.set(state.mode, state);
		return state;
	}
}
```

`modes/state/read.ts`: the `JSON.parse` moves inside the guard (T3):

```ts
export function readState(sessionDirectory: string, modeId: string): ModeState | undefined {
	const file = statePath(sessionDirectory, modeId);
	if (!fs.existsSync(file)) return undefined;
	try {
		return stateSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
	} catch {
		console.warn(`[modes] Ignoring invalid state for "${modeId}".`);
		return undefined;
	}
}
```

`modes/state/schema.ts`: one optional field each, so existing files still parse:

```ts
export const itemSchema = z
	.object({
		text: z.string().trim().min(1).max(500),
		status: z.enum(['pending', 'in_progress', 'done']),
		evidence: z.string().trim().min(1).max(1000).optional(),
		ref: z.string().trim().min(1).max(200).optional(),
		verified: z.boolean().optional(),
	})
	.strict();
```

`modes/state/tool.ts`: store instead of a directory, kept status (T4), checked refs (T5), honest effects (K1):

```ts
export function modeStateTool(
	store: ModeStateStore,
	modes: readonly ModeDefinition[],
	messages: () => readonly Message[]
): Tool {
	const ids = modes.map((mode) => mode.id) as [string, ...string[]];
	return tool({
		id: MODE_STATE_TOOL_ID,
		category: 'system',
		name: MODE_STATE_TOOL_ID,
		description:
			'Create or update the tracked state of an active mode: its objective, its ordered items with their status and evidence, and the overall status. Items replace the previous list. An item can cite `ref`, the id of the tool call that proves it; refs are checked.',
		capability: { effects: ['persistence'] },
		inputSchema: z
			.object({
				mode: z.enum(ids),
				objective: z.string().trim().min(1).max(2000).optional(),
				items: z.array(itemSchema.omit({ verified: true })).max(30).optional(),
				status: z.enum(['active', 'completed', 'blocked']).optional(),
				note: z.string().trim().max(1000).optional(),
			})
			.strict(),
		execute: ({ mode: id, objective, items, status, note }) => {
			const mode = modes.find((candidate) => candidate.id === id)!;
			const previous = store.read(id);
			const kept =
				previous && (objective === undefined || objective === previous.objective)
					? previous
					: undefined;
			const known = new Set(kept?.items.flatMap((item) => (item.verified && item.ref ? [item.ref] : [])));
			const checked = (items ?? kept?.items ?? []).map((item) => {
				if (!item.ref) return { ...item, verified: undefined };
				if (known.has(item.ref)) return { ...item, verified: true };
				const call = findCall(messages(), item.ref);
				if (!call?.result || call.result.isError || call.name === MODE_STATE_TOOL_ID)
					throw new Error(`ref "${item.ref}" is not a successful tool call in this chat.`);
				return { ...item, verified: true };
			});
			const keptNote = note || kept?.note;
			const next = {
				mode: id,
				status: status ?? kept?.status ?? 'active',
				objective: objective ?? kept?.objective,
				items: checked,
				...(keptNote ? { note: keptNote } : {}),
				updatedAt: Date.now(),
			};
			if (!next.objective) throw new Error('A new mode state needs an objective.');
			if (next.status === 'completed') {
				const open = next.items.flatMap((item, index) =>
					item.status !== 'done' || (mode.state?.evidence && !item.evidence && !item.ref)
						? [index + 1]
						: []
				);
				if (next.items.length === 0 || open.length > 0) {
					return {
						completed: false,
						reason: mode.state?.evidence
							? 'Every item must be done with evidence before completing.'
							: 'Every item must be done before completing.',
						openItems: open,
					};
				}
			}
			if (next.status === 'blocked' && !next.note) throw new Error('A blocked state needs a note.');
			return store.write({ ...next, objective: next.objective });
		},
	});
}
```

`modes/state/find.ts` (new) is `findCall(messages, id)`, which scans `messages[].toolCalls`.
- Tool calls are stored by reference (`session/session_add_assistant_message.ts:23`), so calls made earlier
  in the same batch resolve too.
- `messages` is a getter because `persist()` can swap `session.messages` (`session/session_persist.ts:22`).
- A ref is checked only the first time it's cited. After that it stays verified, even once compaction has
  removed the call from the history.
- `MODE_STATE_TOOL_ID` moves to `modes/state/types.ts` to avoid an import cycle.

`modes/state/hook.ts` (new) replaces `modes/state/unfinished.ts`:

```ts
/** Tracked state as hooks: the update tool, the state in the prompt, and keep going while a `continue` mode is open. */
export function stateHook(
	store: ModeStateStore,
	tracked: readonly ModeDefinition[],
	activeIds: readonly string[],
	request: string,
	messages: () => readonly Message[]
): RunHook {
	return {
		id: 'mode-state',
		provide: () => [modeStateTool(store, tracked, messages)],
		prompt: () => ({ context: stateContext(store, tracked) }),
		stop: () => {
			const open = tracked.filter((mode) => {
				const status = store.read(mode.id)?.status;
				return (
					mode.state?.continue &&
					activeIds.includes(mode.id) &&
					status !== 'completed' &&
					status !== 'blocked'
				);
			});
			if (open.length === 0) return { kind: 'accept' };
			return {
				kind: 'continue',
				message: `<mode_continue>\nNot finished: the ${open.map((mode) => mode.id).join(', ')} state is still open. Keep working on the user's request below without asking the user anything. If the state has no items yet, first record the objective and success criteria with update_mode_state. Set its status to "completed" once every item is done, or "blocked" with a note if something concretely prevents progress.\n\nUser's request:\n${request}\n</mode_continue>`,
			};
		},
	};
}
```

`stateContext` and `trackedModes` take the store instead of a directory. When `ref` is present, the context
lines print `(verified)`.

`resources/plugins/bootstrap/modes/goal/SYSTEM_PROMPT.md` changes two lines so the prompt matches what the
host enforces:

```text
- Work toward the criteria step by step, and verify each one with tool output, not assumptions. Mark an item done as soon as it is verified, with `evidence` (what the output showed) and `ref` (the id of the tool call that showed it).
- Set the state to completed only when every criterion is done with evidence. The host checks every `ref` and refuses completion while an item is open.
```

### 4.5 Wiring the loop and executor

`runner/run_stream.ts`, `loop()`, after the base tools are built:

```ts
	const modes = input.modes ?? { policy: NO_MODE, available: [] };
	const policy =
		input.approvalWindowId === undefined ? { ...modes.policy, ask: false } : modes.policy;
	const store = new ModeStateStore(sessionDir(session));
	const tracked =
		!options.tools && !bootstrap && session.category === 'main'
			? trackedModes(store, policy.ids, modes.available)
			: [];
	const hooks = composeHooks(
		modeHooks(policy, tracked, store, {
			workspace: agentLocation(),
			request: input.message,
			messages: () => session.messages,
		})
	);
	const filterEligibleTools = (candidates: Tool[]): Tool[] => {
		let filtered = filterRuntimeTools([
			...hooks.tools(filterTools(candidates, input.toolsAllow, input.toolsDeny)),
		]);
		for (const allowedTools of skillToolScopes) filtered = selectSkillTools(filtered, allowedTools);
		return filtered;
	};
	// Replaces runner/run_stream.ts:239-250. Run-local tools wait in `runTools`; they don't go into `tools` yet.
	const runTools = [
		...hooks.provide(),
		...(!options.tools && !bootstrap && !policy.restricted
			? [undoFileTool(session.runContext.fileHistory), redoFileTool(session.runContext.fileHistory)]
			: []),
	];
	// …skills and MCP discovery unchanged…
	// At runner/run_stream.ts:315, after MCP tools are in `tools`:
	const childTools = filterEligibleTools(tools).filter((tool) => tool.id !== 'ask');
	tools.push(...runTools);
	// requiredIds: `mode.ask ? ['ask']` and `MODE_STATE_TOOL_ID` become `...runTools.map((tool) => tool.id)`
```

Notes on that wiring:
- Children keep the MCP tools they get today, but `childTools` is taken **before** run-local tools are added
  (fixes T2).
- MCP discovery, MCP authorization and bootstrap keep reading `policy.restricted`.
- `modes/tools.ts` (`filterModeTools`) and `modes/state/unfinished.ts` become unused and are deleted.

In the turn, prompt and protected prompt come from `hooks.prompt(state.current)`:
- `system` and `context` replace `mode.prompt` and `stateContext` (`runner/run_stream.ts:512-514`);
- `protected` replaces `mode.protectedPrompt` (`:494`).

`runner/run_tool_call.ts`: the security context gains `hooks`. It keeps `mode` for the `ask` and
`restricted` checks (`:139-140,202`) and for `runner/run_tool_calls.ts:37`.

```ts
	} else if ((gateError = security.hooks?.gate(toolCall, tool))) {
		output = `Error: ${gateError}`;
		isError = true;
	} else if (
```

- This one branch replaces the `allowsTool` (`:116`) and read-only shell (`:128-134`) branches.
- `if (mode.permissions === 'deny-asks' && permission === 'ask') permission = 'deny';` (`:305`) becomes
  `permission = security.hooks?.permission(permission, toolCall, tool) ?? permission;`.

### 4.6 Turn decision (`runner/decide.ts`, new)

One pure function replaces the six branches at `runner/run_stream.ts:540-658`. It has been checked
branch by branch against today's behavior (notes below the code).

```ts
import type { HookStop } from '../hooks/types';
import type { AgentRunState } from '../state';

export type TurnDecision =
	| { readonly kind: 'tools' }
	| { readonly kind: 'finish'; readonly stopReason?: string }
	| { readonly kind: 'retry'; readonly instruction: string }
	| { readonly kind: 'continue'; readonly message: string }
	| {
			readonly kind: 'skip';
			readonly instruction: string;
			readonly stopReason: 'budget_exhausted' | 'max_iterations';
	  }
	| { readonly kind: 'fail'; readonly message: string };

const MAX_CONTINUES = 3;

/** What to do with one model turn. Pure: the caller records, emits and saves. `turns` is counted before this turn is recorded. */
export function decide(
	run: AgentRunState,
	turn: { readonly content: string; readonly toolCalls: readonly unknown[] },
	stop: (answer: string) => HookStop,
	limits: {
		readonly synthesis: boolean;
		readonly turns: number;
		readonly maxTurns: number;
		readonly budgetExceeded: () => boolean;
	}
): TurnDecision {
	const calls = turn.toolCalls.length > 0;
	const empty = !turn.content.trim();
	if (limits.synthesis && (calls || empty))
		return { kind: 'fail', message: 'Agent did not produce a non-empty final answer without tool calls.' };
	if (!calls && empty)
		return { kind: 'retry', instruction: 'The previous model response was empty. Answer the user now.' };
	if (!calls) {
		if (run.finalize)
			return {
				kind: 'finish',
				...(run.finalize.stopReason ? { stopReason: run.finalize.stopReason } : {}),
			};
		const verdict = stop(turn.content);
		if (verdict.kind === 'retry') return verdict;
		const nudge = !run.continued && run.continues < MAX_CONTINUES && limits.turns < limits.maxTurns;
		return verdict.kind === 'continue' && nudge ? verdict : { kind: 'finish' };
	}
	if (limits.budgetExceeded())
		return {
			kind: 'skip',
			stopReason: 'budget_exhausted',
			instruction:
				'Execution budget exhausted; remaining actions were not executed. Explain the available results and limitations.',
		};
	if (limits.turns + 1 >= limits.maxTurns)
		return {
			kind: 'skip',
			stopReason: 'max_iterations',
			instruction:
				'Turn limit reached; remaining actions were not executed. Explain the available results and limitations.',
		};
	return { kind: 'tools' };
}
```

The caller in `loop()` replaces `runner/run_stream.ts:540-658`. `synthesisOnly` is still computed at `:476`, from
`state.current.finalize` instead of the `finalization` local.

```ts
			const decision = decide(state.current, turn, (answer) => hooks.stop(answer, state.current), {
				synthesis: synthesisOnly,
				turns: session.numTurns,
				maxTurns: session.maxTurns,
				budgetExceeded: () =>
					budget.wouldExceed(
						turn.toolCalls.map((call) => ({
							tool: turnTools.find((tool) => tool.id === call.name),
							input: call.args,
						}))
					),
			});
			recordTurn(session, turn);
			if (decision.kind === 'fail') {
				if (turn.toolCalls.length > 0) {
					addAssistantMessage(session, turn.content, turn.toolCalls, turn.providerItems);
					yield* skipToolCalls(turn.toolCalls, 'Final answer required; this action was not executed.');
					addToolResults(session, turn.toolCalls);
				}
				throw new Error(decision.message);
			}
			if (decision.kind === 'retry') {
				yield { type: 'run_finalize', instruction: decision.instruction };
				continue;
			}
			yield { type: 'assistant_message', content: turn.content, toolCalls: turn.toolCalls };
			addAssistantMessage(session, turn.content, turn.toolCalls, turn.providerItems, {
				context: turn.usage?.context,
				inputTokens: turn.usage?.inputTokens ?? 0,
				outputTokens: turn.usage?.outputTokens ?? 0,
			});
			if (decision.kind === 'continue') {
				addUserMessage(session, [{ type: 'text', internal: true, text: decision.message }]);
				yield { type: 'run_continue' };
				continue;
			}
			if (decision.kind === 'finish') {
				if (decision.stopReason) session.stopReason = decision.stopReason;
				const subtype = decision.stopReason === 'max_iterations' ? 'error_max_turns' : 'success';
				yield { type: 'run_finished', result: toResult(session, subtype) };
				return;
			}
			if (decision.kind === 'skip') {
				yield* skipToolCalls(turn.toolCalls, decision.instruction);
				addToolResults(session, turn.toolCalls);
				if (decision.stopReason === 'budget_exhausted') {
					if (input.agentId === 'subagent') {
						budget.exhaust();
						session.stopReason = decision.stopReason;
						yield { type: 'run_finished', result: toResult(session, 'success') };
						return;
					}
					budget.allowSynthesis();
				}
				yield { type: 'run_finalize', instruction: decision.instruction, stopReason: decision.stopReason };
				continue;
			}
			// 'tools': unchanged from :660 on. Exhaustion found while running, the subagent exit (:753) and the
			// recorder notice (:763) stay after the calls; their `finalization = …` becomes `yield { type: 'run_finalize', … }`.
```

Why this matches today's behavior:
- **Turn counts.**
  - `turns` is read before `recordTurn`.
  - The continue guard used `isExhausted` before recording (`:578`) and the skip check after it (`:640`).
  - That's why one test is `turns < maxTurns` and the other `turns + 1 >= maxTurns`.
- **Ordering.**
  - In synthesis turns, failure comes first.
  - The envelope retry fires at most once, because any `finalize` turns the next answer into a finish.
  - The envelope hook runs before the state hook, so an invalid envelope with open state gets a retry, not a
    continue.
  - Only tool turns hit limits. The budget beats the turn limit (`:641`).
- **Stop reasons.** A finish keeps the model's own stop reason (for example `max_tokens` from `recordTurn`)
  unless finalization set one (`:614`).
- **`continued` resets** on every `assistant_message`. That covers finish, tools, skip and the continue's own
  message, which `run_continue` then sets back to true. Retry and fail emit none, as today.
- **The subagent budget skip** still marks the shared budget, because the parent reads it at `:752`. For
  everyone else, today's set-then-reset at `:648/654` was a no-op and goes away (R6). `exhausted` becomes a
  getter over a private field, and `exhaust()` is the only outside writer.
- **Two harmless differences.**
  - `stop` is now consulted even when a continue would be capped. The store's cache makes that read free.
  - The budget check now runs before `assistant_message` is yielded. For parallel children sharing a budget,
    a sibling's call landing in between only changes "refused" to "skipped" in the tool text.

### 4.7 Session-owned modes

Types:
- `src/shared/agent_types.ts`: `modeIds?: string[]` on `AgentHistoryMessage` (`:180-191`) and on
  `AgentSessionSnapshot` (`:207-215`).
- `types.ts`: `modeIds?: string[]` on `Message` (`:101-107`).
- `session/session_types.ts`: `modeIds?: readonly string[]` on `SessionState`.
- `session/session_add_assistant_message.ts:19-25` stamps every assistant message with
  `...(state.modeIds ? { modeIds: [...state.modeIds] } : {})`. `isMessage` keeps unknown fields
  (`session/session_is_message.ts:6-21`), so the field survives save and load.

`modes/persistent.ts` (new):

```ts
import { listModes } from './list';
import type { ModeDefinition } from './types';

export function persistentModes(
	ids: readonly string[],
	available: readonly ModeDefinition[] = listModes()
): string[] {
	return [...new Set(ids)].filter((id) =>
		available.some((mode) => mode.id === id && mode.persistent === true)
	);
}
```

`session/session_set_session_modes.ts` (new). Same shape as `session/session_pin_session.ts`, but it does nothing
when the chat doesn't exist yet, and skips no-op writes so the folder's mtime (the chat's "updated" time)
doesn't move:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { atomicWriteFile } from './session_atomic_write';
import { infoFile } from './session_info_file';
import { sessionsRoot } from './session_sessions_root';

export function setSessionModes(sessionId: string, location: string, modeIds: readonly string[]): void {
	const filePath = infoFile(sessionsRoot(location), sessionId);
	if (!existsSync(filePath)) return;
	let info: Record<string, unknown>;
	try {
		info = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
	} catch {
		info = {};
	}
	if (JSON.stringify(info.modeIds ?? []) === JSON.stringify(modeIds)) return;
	atomicWriteFile(filePath, `${JSON.stringify({ ...info, modeIds }, null, '\t')}\n`);
}
```

`session/session_session_modes.ts` (new) is the reader. It has the shape of `session/session_session_type.ts` and
returns the `string[]` from `info.json`, or `[]` on a missing file or malformed JSON.

`session/session_clear_messages_by_session_id.ts`, after `:33` (T1):

```ts
	const modesPath = sessionPath(root, sessionFolderName(sessionId), 'modes');
	if (existsSync(modesPath)) rmSync(modesPath, { recursive: true, force: true });
	setSessionModes(sessionId, location, []);
```

`agent.ts`:

```ts
			// :236-237: one listModes() per run (M1); the loop gets the same definitions
			const available = request.category === 'main' ? listModes() : [];
			const policy = request.category === 'main' ? resolveModes(options.modeIds ?? [], available) : NO_MODE;
			// RuntimeInput: `mode` → `modes: { policy, available }`
			// after init(…) at :309
			if (request.category === 'main') {
				session.modeIds = policy.ids;
				setStoredSessionModes(session.id, this.config.location, persistentModes(options.modeIds ?? [], available));
			}
			// the same call again in `finally` (guarded by session.id): a first message with attachments
			// creates info.json only after the model answers (session/session_init.ts:45-59)

	// getSessionSnapshot (:393)
	modeIds: sessionModes(sessionsRoot(this.config.location), sessionId),

	// new method next to pinSession; imported as `setSessionModes as setStoredSessionModes`, like `pinStoredSession`
	setSessionModes(sessionId: string, modeIds: string[]): Promise<void> {
		return this.scheduler.run(
			sessionId,
			async () => setStoredSessionModes(sessionId, this.config.location, persistentModes(modeIds)),
			{ priority: 'high' }
		);
	}

	// toHistoryMessages, assistant entry (:608-616)
	...(Array.isArray(message.modeIds) ? { modeIds: message.modeIds } : {}),
```

IPC follows the existing `pinSession` pattern:
- `src/shared/ipc_channels_definitions.ts`: `setSessionModes: 'agent:set-session-modes'`;
- `src/main/ipc/agent.ts`, next to `:544`: validate an array of strings and a UUID with
  `requireUuidSessionId`, then call `agent.setSessionModes`;
- `src/preload/agent.ts:155-159`: copy `pinSession`;
- `src/shared/api_types.ts:181`: add `setSessionModes: (sessionId: string, modeIds: string[]) => Promise<void>`.

Renderer:
- `src/renderer/src/pages/home/context/state.ts`: `readonly modeIds?: readonly string[]` on `AgentMessage`.
- `src/renderer/src/pages/home/context/reducer.ts:135`. `run_started` is ignored today; store
  `event.modeIds` on the agent message instead. The history merge and push branches carry `modeIds` too.
  Merging is safe, because consecutive assistant entries come from one run and the internal
  `<mode_continue>` turns are dropped (`agent.ts:597-602`).
- `src/renderer/src/pages/home/components/AssistantMessage.tsx:174`: filter with
  `.filter((mode) => !message.modeIds || message.modeIds.includes(mode.id))` before the `flatMap`.
  `undefined` (old history, voice) keeps today's behavior, and `[]` means the run had no modes.
- `src/renderer/src/pages/home/hooks/useHomeAgent.ts`:
  - call `setModeIds(snapshot.modeIds ?? [])` after the restore at `:376` and in the refresh at `:410`;
  - return a `changeModeIds` callback as the hook's `setModeIds`. It updates local state and calls
    `setSessionModes`, and its only consumer is `src/renderer/src/pages/home/Page.tsx:803`.
  - It can't loop back, because `src/renderer/src/components/text-editor.tsx:79-82` reports only real chip
    changes.

### 4.8 Interrupted runs

`session/session_append_run.ts:20-24`: flush on `run_started` too:

```ts
	const flush =
		entry !== null &&
		typeof entry === 'object' &&
		!Array.isArray(entry) &&
		['run_started', 'run_finished', 'run_error'].includes(String((entry as Record<string, unknown>).type));
	if (!flush && state.runTraceBuffer.length < TRACE_BUFFER_SIZE) return;
```

`session/session_interrupt_runs.ts` (new), called first thing in `Agent.start()`:

```ts
import { appendFileSync, closeSync, existsSync, openSync, readdirSync, readSync, statSync, utimesSync } from 'node:fs';
import { isUuid } from './session_is_uuid';
import { sessionPath } from './session_session_path';
import { sessionsRoot } from './session_sessions_root';
import { stringifyRunEntry } from './session_stringify_run_entry';

const TAIL_BYTES = 4096;

/** Closes the trace of every run that never finished, keeping the file's mtime so chat order doesn't change. */
export function interruptRuns(location: string): void {
	const root = sessionsRoot(location);
	if (!existsSync(root)) return;
	const terminal = stringifyRunEntry({ type: 'run_finished', result: { stopReason: 'interrupted' } });
	if (!terminal) return;
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		if (!entry.isDirectory() || !isUuid(entry.name)) continue;
		const file = sessionPath(root, entry.name, 'run.jsonl');
		try {
			const stats = statSync(file);
			const length = Math.min(stats.size, TAIL_BYTES);
			const buffer = Buffer.alloc(length);
			const descriptor = openSync(file, 'r');
			try {
				readSync(descriptor, buffer, 0, length, stats.size - length);
			} finally {
				closeSync(descriptor);
			}
			const tail = buffer.toString('utf8');
			const last = tail.trimEnd().split('\n').at(-1);
			if (!last) continue;
			let type: unknown;
			try {
				type = (JSON.parse(last) as { event?: { type?: unknown } }).event?.type;
			} catch {
				type = undefined;
			}
			if (type === 'run_finished' || type === 'run_error') continue;
			appendFileSync(file, `${tail.endsWith('\n') ? '' : '\n'}${terminal}\n`, 'utf8');
			utimesSync(file, stats.atime, stats.mtime);
		} catch {
			continue;
		}
	}
}
```

### 4.9 Smaller fixes

- **Clear chat** (T1): covered in §4.7.
- **Budget flag** (R6): `exhausted` becomes a getter over a private field. `exhaust()` replaces the outside
  write. Only the subagent budget skip in §4.6 calls it.
- **Bootstrap tools** (K4): drop `complete_bootstrap`, `update_identity`, `update_soul` and `update_user`
  from `requiredIds` (`runner/run_stream.ts:356-359`). Discovery still finds them.
- **`run_script`** (K1): move it from `READ` to `execute` in `execution/capability.ts:27`. Then
  `execTool(sandbox, true)` declares `capability: { effects: ['read'] }`, and the `readOnly` fields go away
  across the tools, `types.ts:49,69,85` and `tools/tool.ts:19,37,62,85`.
- **`budget.outcomes`** (R8): delete it and its two writers.
- **`ask` becomes a narrowing field** (M3). This keeps the strict schema, so installed manifests that set
  `ask` still validate:
  - `NO_MODE.ask` becomes `true` (`modes/types.ts:47`);
  - `modes/resolve.ts:45` becomes `ask: active.every((mode) => mode.ask !== false)`;
  - `runner/run_stream.ts:167-168` becomes
    `input.approvalWindowId === undefined ? { ...pinnedMode, ask: false } : pinnedMode` (as in §4.5);
  - Goal's manifest gets `"ask": false`, and Plan's `"ask": true` goes away;
  - update the `ask` row in `docs/AGENT_MODES.md`.

## 5. Steps

Each step leaves the app working and can ship alone.

1. **Unbreak and quick fixes.**
   - Port or delete the stale tests (X1).
   - Fix R1 (abort reason), T1 (remove `modes/` on clear), T2, T3, T4, K4 and R8, plus the `run_script`
     capability. Each is a small local edit.
2. **Run state machine.** §4.1: reducer, shared ref, timer pause, `appendEvent`, `stopped()`, the
   `'awaiting_input'` summary status.
3. **Hooks and mode primitives.** §4.2–4.3, §4.5 and §4.6.
   - The loop and executor stop reading mode fields, except `policy.restricted`.
   - `decide()` replaces the turn branches, and `budget.exhaust()` comes with it (R6).
   - Pinned definitions (M1).
   - `ask` becomes a narrowing field (M3).
4. **Tracked state store and evidence refs.** §4.4. Update
   `resources/plugins/bootstrap/modes/goal/SYSTEM_PROMPT.md` to cite `ref`.
5. **Session-owned modes and interrupted runs.** §3.6–3.7 and §4.7–4.8.
6. **Tool contract.**
   - Effects replace `readOnly`.
   - `ToolContext` moves the `ask`/`select_screen_source`/`request_mcp_authorization` flows into their tools
     (K3, K6).
   - After that: registry scoping (K2) and abort handling (K5).

## 6. Verification (for the implementation, later)

- `npm run typecheck`, `npm run lint`, `npm run test:main:agent`, `npm run test:renderer`. Per CLAUDE.md,
  tests are written or run only when you ask. Step 1 needs that approval, because the suite is currently
  broken.
- In the app (`npm run dev`):
  - `/plan …` blocks writes and renders the card. Implement updates the plan items.
  - A pasted `/plan x` works.
  - `/goal …` keeps going until completed, with at most three nudges.
  - A bad `ref` is refused.
  - Clearing the chat removes the plan state and the chips.
  - Mode chips:
    - a persistent chip survives a window reload and an app restart;
    - Implement clears it;
    - a chip removed without sending stays removed after a reload.
  - A plan card renders only on the Plan run's own message.
  - Waiting more than 10 minutes on an approval doesn't time the run out.
  - A forced timeout shows `timeout`.
  - Kill the app mid-run. After restart, that chat's `run.jsonl` ends with `run_finished` / `interrupted`, and
    the chat list order hasn't changed.
  - With `bootstrap` disabled, a normal chat with edits works and no commands appear.
- `git grep -n "mode\.\(output\|prompt\|protectedPrompt\|permissions\|readOnly\|toolIds\)" src/main/agent/runner`
  returns nothing after step 3.

## 7. Out of scope

- Resuming runs after a restart (you chose interruption only).
- Plugin-shipped hook code.
- Moving bootstrap, budget and recorder behavior into hooks before someone touches them.
- Voice using the run registry.
