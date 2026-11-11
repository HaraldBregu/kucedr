# Chat Sessions — Concurrency Analysis & Plan

> **Status:** analysis and plan, 2026-11-11. Nothing here is implemented.
>
> Short paths: `agent.ts`, `agent_scheduler.ts`, `limiter.ts`, `mutex.ts`, `state/`, `session/` and `runner/` are under `src/main/agent/`. `useHomeAgent.ts`, `reducer.ts` and `Sidebar.tsx` are under `src/renderer/src/pages/home/`. Every other path starts at the repo root.

## Scope

How several main chat sessions run at the same time, what happens to a run when the user leaves its chat, why an answer sometimes stops before it is finished, and what to change.

## Summary

- **The main process runs chats in parallel correctly.** One run per chat, up to three at once. The saved traces hold four cases of two chats running together, and all four ended with `end_turn`.
- **The unfinished answers come from the renderer.** A run's life and its live stream both belong to the `useHomeAgent` instance that started it. When the Home page unmounts (opening Workspace or Settings), the hook cancels one run, and that run can belong to a chat that is not on screen. A run that survives is shown frozen when the user comes back.
- **Switching between chats while staying on the Home page did not fail** in any text-only test. With a tool call in the run, the in-flight answer is drawn twice.
- **Plan:** steps 1 to 3 fix every fault reproduced here and should ship together. Step 4 is recommended. Step 5 is optional cleanup.

## Method

- Read the path end to end: `agent.ts`, `agent_scheduler.ts`, `state/`, `session/coordinator.ts`, `src/main/ipc/agent.ts`, `src/preload/agent.ts`, `useHomeAgent.ts` (in `hooks/`), `reducer.ts` (in `context/`) and `Sidebar.tsx`.
- Mined the local run traces (`~/.kucedr/sessions/*/run.jsonl`, read-only): 354 runs in 53 chats.
- Reproduced in the real app: Playwright `_electron`, isolated profile (`KUCEDR_E2E_DATA_ROOT`), the dev renderer, the `out/main` build of 2026-11-11 15:28. The provider was a local OpenAI-compatible mock that streams 40 chunks at 250 ms and records whether the app closed the connection early. No real provider and no stored key were used.

## How it works today

### Main process

| Piece | Where | What it does |
| --- | --- | --- |
| Run registry | `src/main/agent/state/` | One record per run: request, `AbortController`, every event emitted so far (`responseEvents`), status `queued` / `running` / `cancelling`. Deleted when the run completes. |
| Scheduler | `agent_scheduler.ts`, `agent.ts:114` | One run per session id at a time. Three runs in total, shared by chats, tasks and health. Chats have priority; every fourth dequeue lets a lower priority through. |
| Provider limiter | `limiter.ts`, `agent.ts:117` | Three model calls at once per provider. Subagents call `stream()` directly, so they take no scheduler slot. |
| Resource mutex | `mutex.ts`, `runner/run_tool_call.ts:400` | Tool calls that touch the same directory run one after the other. |
| Session lease | `session/coordinator.ts` | Clearing, deleting or editing a conversation aborts the run that holds it. |
| Events | `src/main/ipc/agent.ts:410-418` | Sent only to the window that started the run. |
| Snapshot | `agent.ts:409-426` | Messages read from disk, plus all events of the session's active run. |

A run ends when it finishes, on `agent.cancel(runId)`, when its window closes (`bootstrap.ts:100`), when its lease is invalidated, or after ten idle minutes.

### Renderer

- There is one chat state, for the chat on screen (`agentChatReducer`, provided inside the Home page).
- **Send.** `sendPrompt` calls `window.agent.send(prompt, options, onEvent)`. The preload registers an IPC listener for that one call and removes it when the call settles (`src/preload/agent.ts:76-104`). `onEvent` dispatches into the reducer only while the run's chat is the one on screen. The answer is marked complete when the `send()` promise resolves.
- **Switch chat.** The hook fetches the snapshot, replaces the state with the stored history, and replays the active run's events if there is one (`useHomeAgent.ts:359-403`). Live events keep arriving through the `onEvent` closure of the original `send()` call.
- **Sidebar.** Polls `listSessions` every 1.5 s. A chat with a run shimmers.

## What the tests show

| # | Scenario | Result |
| --- | --- | --- |
| S0 | Ask and stay | Complete. |
| S1 | Ask, open a new chat, return after the run ended | Complete. |
| S2 | Ask, open a new chat, return mid-run | Keeps streaming, complete. |
| S3 | Two chats running, switch between them | Both complete. |
| S10 | Fourteen switches in three seconds between two running chats | Both complete. |
| S11 | Switch to another chat and send at once | Complete. |
| S9 | Four chats at once | The fourth is `queued` until a slot frees. Its chat shows the normal thinking indicator, with no sign that it is waiting. |
| S4 | Ask, open Settings | **Run cancelled.** The app closed the provider connection after 3 of 40 chunks. Back on Home, the three chunks are shown as a finished answer. |
| S5 | Ask in chat A, open chat B, open Settings | **A's run cancelled** after 6 of 40 chunks, although A was not on screen. |
| S6 | A and B running, open Settings, come back, open A | **B's run cancelled** after 2 chunks. A runs to the end in main, but its chat stays frozen at chunk 11 and keeps saying "responding" until the chat is opened again. |
| S7 | Run with a tool call, leave, return mid-run | Completes, but the answer is drawn as two assistant blocks. It is one block when the user never left and one after a reload. |
| S8 | First chat in a fresh profile | Nothing streams. The whole answer appears when the run ends. |

Traces: of 354 runs, 19 ended `cancelled`. None of them coincides with a run starting in another chat, and the four overlapping pairs all ended `end_turn`. The traces record 130 approval and question prompts, and none of them expired.

## Findings

| # | Sev | Problem | Where | Evidence |
| --- | --- | --- | --- | --- |
| F1 | High | Leaving the Home page cancels a run. The unmount cleanup calls `agent.cancel(activeRunIdRef.current)`. `/home` is a route, so Workspace and Settings unmount it. The ref is not per chat: it holds the last run started or re-attached and is not cleared on a chat switch, so the run it cancels can be another chat's. | `useHomeAgent.ts:420-431`, `:359-403`; `router.tsx:239` | S4, S5, S6 |
| F2 | High | The live stream belongs to the `send()` call. After the Home page remounts there is no listener for a run that is still going. The snapshot replay shows it up to that moment, and then nothing moves and `isLoading` never clears. | `src/preload/agent.ts:86-103`; `useHomeAgent.ts:231-266` | S6 |
| F3 | Med | The snapshot draws the same turns twice. The history from disk already contains the turns the run has persisted, and the replay builds them again from events. The same would happen to a whole answer in the short window after `run_finished` while `memory.capture` runs. | `agent.ts:396-400`, `:409-426`; `session/session_add_assistant_message.ts` | S7; the capture window by reading |
| F4 | Med | The default session id `home` is not a UUID. Main resolves it to a real id, and `onEvent` then compares the id on screen with the resolved one and drops every event until the run ends. | `contexts/chat-session.ts:3`; `session/session_resolve_session_id.ts`; `useHomeAgent.ts:261` | S8 |
| F5 | Med | A chat in the background that needs the user cannot say so. An approval expires after 120 s and the tool is denied; a question expires after ten minutes. The card is only inside that chat, and the sidebar shows the same shimmer as for a working run. A waiting run also holds one of the three slots. | `runner/run_tool_call.ts:308`, `:162`; `Sidebar.tsx:460` | By reading. No prompt has expired in the traces so far. |
| F6 | Low | The fourth run queues silently. Tasks and health share the three slots. | `agent.ts:114` | S9. The longest queue delay in the traces is 43 ms. |
| F7 | Low | Rename, pin, archive and categorize go through the run scheduler. They wait for that chat's run to end, and all of them wait while three runs are active. Each is one synchronous read and write of `info.json`. | `agent.ts:464-494` | By reading |
| F8 | Low | `listSessions` runs every 1.5 s on the main thread, which every stream shares. For a chat without a stored title it parses the whole `messages.json`. | `Sidebar.tsx:91`; `session/session_list_sessions.ts:13-36` | This profile: 37 of 59 chats, 7.9 MB, 16–23 ms per call |
| F9 | Low | `responseEvents` keeps every delta, and each `tool_call_args_delta` carries the cumulative text. The snapshot copies all of it and the renderer replays one dispatch per event. | `agent.ts:404-407` | By reading. Same as AGENT_STATE R3 and AGENT_TURN correctness 7. |
| F10 | Low | The trace does not say who cancelled a run, so the 19 cancelled runs cannot be split into Stop and navigation. A cancelled answer is stored as an ordinary assistant message, so after a reload nothing shows that it was cut. | `agent.ts:556-564` | Traces; S4 |

Two more unmount triggers lead to F1 and F2, both by reading and not reproduced: `StartupGate` swaps the whole tree for a placeholder when the onboarding phase returns to `checking` (`src/renderer/src/auth/Gate.tsx:16`), and in development Fast Refresh re-runs effect cleanups when the hook's file changes.

Checked and sound: the scheduler's one-run-per-chat rule, subagents (no slot, own limiter), the provider limiter, and lease handling on clear, delete and edit.

## Target

Three rules. Everything in the plan follows from them.

1. **A run belongs to its chat, not to a component.** It ends when it finishes, when the user presses Stop in its chat, when its conversation is cleared, deleted or edited, on timeout, or when the window closes. Navigation never ends a run.
2. **Main publishes each run as an ordered log.** Every event carries `sessionId` and a per-run `seq`, and each run emits exactly one `run_finished`. The window subscribes to the channel once. Who called `send()` does not matter.
3. **A chat on screen is the conversation as it stood when the active run started, plus that run's events folded by the reducer.** Live events and a snapshot go through the same path, so the picture is the same whether the user stayed, left and returned, or the page remounted.

The renderer keeps one reducer for the chat on screen and rebuilds it on a switch, as it does now.

## Plan

### Step 1 — Stop cancelling on unmount (F1)

- `useHomeAgent.ts`: remove the `agent.cancel` call from the unmount cleanup. Clear `activeRunIdRef` when the chat changes, so Stop can only reach the run of the chat on screen.
- Verify: S4 and S5 — the mock sees no early close, and the answer is complete when the user returns.

On its own this step leaves a returning user with the frozen chat of S6, so it ships with step 2.

### Step 2 — One event subscription per window (F2, F4)

- `src/main/agent/agent.ts` `emit`: stamp `sessionId` and `seq` on every event. Both are optional fields on `AgentResponseEvent`, so the SDK type and the voice path stay compatible.
- `src/preload/agent.ts`: add `onResponse(listener)`, returning an unsubscribe function.
- `useHomeAgent.ts`: subscribe once per mount. Apply an event when `event.sessionId` is the chat on screen. `sendPrompt` stops passing `onEvent`, and the `resolvedSessionId` bookkeeping goes away.
- Completion comes from the `run_finished` event, not from the `send()` promise. The reducer settles the active message by `stopReason`. `run_finished` carries the final text, which main already has in `result.text`, for an answer that produced no deltas. The promise is kept only to report a rejection that produced no `run_finished`.
- `contexts/chat-session.ts`: `readPersistedChatSessionId` creates and stores a UUID when nothing is stored, so the renderer never sends `home`.
- Verify: S6 — chat A keeps advancing after the remount and ends "ready". S8 — chunks appear while the first chat streams.

### Step 3 — One drawing path for a run in flight (F3, F9)

- `agent.ts` `process`: after `init`, keep the conversation as it stood (`record.base`). `getSessionSnapshot` returns `base` plus the events while a run is registered, and the disk history otherwise.
- `agent.ts` `send`: when a run completes without having emitted `run_finished` (cancelled while queued, or failed before the stream started), emit one with the outcome. Every admitted run then has exactly one terminal event.
- `agent.ts` `emit`: coalesce in the stored log only. Append a text delta to the previous text delta, and keep the latest `tool_call_args_delta` per tool call. Events sent live are unchanged.
- `useHomeAgent.ts`: one `applyEvent` function for replayed and live events. While a snapshot is loading, queue the live events of that chat, then apply those whose `seq` is above the snapshot's last one. This does not depend on the order in which Electron delivers an invoke reply and a `send`.
- Verify: S7 — one assistant block mid-run, after the run and after a reload. S2 and S10 still pass.

### Step 4 — Background chats that wait for the user (F5)

- `agent.ts`: mark the record as waiting while an approval or a question is pending. The loop already sees both events at `:363`. `listSessions` reports `runStatus: 'waiting'`.
- `Sidebar.tsx`: show `waiting` differently from the shimmer, with the design system's existing badge.
- `runner/run_tool_call.ts:308`: raise the approval expiry from 120 s to ten minutes, the same as a question. The approval still needs a click in the same window and is still bound to the run and the input fingerprint.
- Verify: trigger an approval in chat A and open chat B. The sidebar marks A, and approving after three minutes still runs the tool.

This is the part of AGENT_STATE §3.1 that parallel chats need. The rest of that state machine is not required here.

### Step 5 — Cleanup (F6, F7, F8, F10), optional

1. Call rename, pin, archive and categorize directly, without the scheduler.
2. Sidebar: reload on `run_started` and `run_finished` from the window subscription and slow the poll to ten seconds. Memoize the derived title by the `messages.json` modification time.
3. Emit `run_state: 'queued'` on admission and show it as the activity label.
4. Write a `run_cancel` entry with its source (`stop`, `window_closed`, `conversation_changed`, `shutdown`) to `run.jsonl`.

### Order and size

Steps 1 to 3 touch `agent.ts`, `state/state_types.ts`, `src/preload/agent.ts`, `src/shared/agent_types.ts`, `useHomeAgent.ts`, `context/reducer.ts` and `contexts/chat-session.ts`. No new module, no new dependency, no change to stored data.

## Not planned

- **A chat state per session in the renderer.** Switching would need no snapshot, but it copies state that main already holds. Revisit only if snapshot and replay become a measurable cost after step 3.
- **A higher run cap or a separate lane for tasks.** The traces show four overlaps in 354 runs and no queueing.
- **An unread mark or a notification when a background chat finishes.**
- **Showing "Stopped" on a cut answer after a reload.** It needs the stop reason stored with the message.
- **Tool state shared between parallel runs** (one browser session, unscoped process registry). Tracked as AGENT_STATE K2.
- **Live streaming to a second window.** Events still go to the window that started the run.
- **The Code page.** `src/renderer/src/pages/code/useSessions.ts:40` has the same cancel-on-unmount, but `/code/*` redirects to `/workspace` today.

## Re-running the check

The scenarios above came from a throwaway script, not from the test suite. To rebuild it, follow `tests/e2e/context.spec.ts`: start a local server that answers `/v1/models` and streams `/v1/chat/completions` slowly, save it as the `custom` provider through `window.provider.set`, and launch the app with `cwd` set to the repo root. Treat a `close` on the response before the last chunk as "the app cancelled the run". Read the chat from `[data-chat-response]`, the busy state from the `role="status"` element in `[data-slot="home-workspace"]`, and switch chats through `[data-slot="home-sidebar"]`.
