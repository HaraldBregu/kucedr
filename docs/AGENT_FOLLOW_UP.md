# Agent follow-up messages

Status: implemented. The queued chips live in `useHomeAgent` state (not the chat reducer), and switching session clears them.

## Context

While the agent is running, the composer stays editable but Enter and the send button both **stop** the run (`useHomeAgent.ts:368-381`); the typed text is never sent. A "follow up" is a message typed during a run that the agent receives at its next turn, without stopping the work in progress.

Nothing like this exists today (no queue, steer or inject code). The main process would queue a second `send` for the same session as a whole new run, but the renderer cannot reach that path and assumes one run at a time.

## How other agents do it (best practice)

- **Deliver at a safe boundary, never mid-call.** A user message can only go in after an assistant message and all of its tool results. Never interrupt a streaming model call or a running tool to insert it.
- **One queue, owned by the process that runs the loop.** The loop drains it; the UI only mirrors it.
- **The run must not end while messages are waiting.** If the model gives a final answer and the queue is not empty, continue the same run instead of finishing.
- **A follow-up is a normal user message.** Saved in the transcript, visible in the UI, append-only (keeps the prompt cache valid).
- **Stop stays a separate, explicit action.** Sending text must never cancel the run.
- **Nothing is lost.** A message that could not be delivered goes back to the user or runs as the next run.

## Design

### Behaviour

- Run active + composer has text → Enter / button **queues a follow-up** (button shows Send).
- Run active + composer empty → unchanged: button is Stop, Enter stops.
- A queued follow-up shows as a chip above the composer with an X to remove it, until delivered.
- On delivery it becomes a normal user bubble in the transcript and the agent's reply continues below it, in the same run.
- Several queued follow-ups are delivered together, in order, as separate user messages.
- Undelivered follow-ups when the run ends:
  - run finished normally (budget or turn limit hit, or a race) → sent automatically as a new run;
  - run stopped or failed → text restored into the composer.

### Main process

1. **Queue on the run record.** Add `followUps: { id, text }[]` to `AgentRunRecord` (`src/main/agent/state/state_types.ts`). Two new `Agent` methods next to `cancel` (`agent.ts:560`):
   - `followUp(runId, { id, text })` → pushes; returns `false` if the run is not in the registry or not a `main` run.
   - `cancelFollowUp(runId, id)` → removes if still queued; returns whether it was removed.
2. **Hand the loop a drain function.** `Agent.process` adds `followUps: () => record.followUps.splice(0)` to `RuntimeInput` (`agent.ts:274`), for `main` category only. Subagents, tasks and health runs do not get it, so `loop()` is unchanged for them.
3. **Drain at two points in `loop()`** (`src/main/agent/runner/run_stream.ts`), both after a model call has been accepted (this avoids the `deferPersist` overwrite risk on the first call):
   - **After tool results** (after line 816, end of the iteration): the next model call sees them.
   - **At the final answer** (line 641 branch, after `addAssistantMessage` at 648): if anything is queued, add it and `continue` instead of emitting `run_finished`. This mirrors the existing `stop.kind === 'continue'` path at 624-638.
   - At each point: for every drained item call `addUserMessage(session, text)` (non-internal) and yield a new `follow_up` runtime event `{ id, text }`.
   - **Skip draining** when `finalization` is set, `budget.exhausted`, or `isExhausted(session)`. The run is wrapping up; those follow-ups stay undelivered and become the next run with a fresh budget.
4. **Event.** Add `follow_up` to `RuntimeEvent` (`src/main/agent/types.ts`) and `AgentResponseEvent` (`src/shared/agent_types.ts:299`), mapped in `runtimeEventToAgentEvents` (`agent.ts:730`). Because it goes through `emit`, it lands in `record.responseEvents` and the snapshot replay on session switch rebuilds the transcript for free.
5. **IPC.** Channels `agent:follow-up` and `agent:cancel-follow-up` (`src/shared/ipc_channels_definitions.ts`), handlers in `src/main/ipc/agent.ts`, preload methods in `src/preload/agent.ts`, types on `AgentApi` (`src/shared/api_types.ts:171`).

### Renderer

1. **State** (`src/renderer/src/pages/home/context/state.ts`, `reducer.ts`): add `queuedFollowUps: { id, text }[]` to `AgentChatState`, with actions to add and remove.
2. **`follow_up` event in `applyResponseEvent`** (`reducer.ts:114`): remove the item from `queuedFollowUps`, mark the current agent message completed, append a user message plus a new empty agent message bound to the same `runId`, and point `activeAgentId` at it.
3. **Submit** (`useHomeAgent.ts:368`): when `isLoading` and the input has text, call `agent.followUp(activeRunId, { id, text })`, add to `queuedFollowUps`, clear the input. If it returns `false` (run already gone), fall through to the normal `sendPrompt`. Empty input keeps calling `stopResponse()`.
4. **Run end** (`useHomeAgent.ts:296-302` and `stopResponse` at 126): apply the undelivered rule above (auto-send joined text, or restore to the composer), then clear `queuedFollowUps`.
5. **UI:**
   - `prompt-submit.tsx`: show Send instead of Stop when running and the input has text.
   - New `pages/home/components/FollowUps.tsx`: chips above the field, built like `ActiveSkills` (`components/Skills.tsx`, `Badge variant="secondary"` + X). X calls `agent.cancelFollowUp`.
   - Strings in `resources/i18n/en/main.json` and `resources/i18n/it/main.json`.

## Left out of v1

- Attachments, leading modes, `/skill` commands and reply-to on follow-ups: text only. Add when asked.
- Editing a queued follow-up: remove and retype.
- Resetting the turn/tool budget on delivery: a follow-up shares the run's budget (32 model turns).
- Queued chips surviving a Home page remount: the delivery event still rebuilds the transcript, only the "waiting" chip is lost.
- Follow-ups for Voice, tasks and subagents.

## To verify while implementing

- Context trimming protects "the current turn" from the latest non-internal user message (`run_model_context_budget.ts:74-79`). A follow-up moves that anchor; confirm earlier tool results of the same run are not trimmed too eagerly.
- Consecutive user messages (tool results, then follow-up) are accepted by every provider adapter. Internal notes already do this, so it is expected to work.

## Verification (after implementation)

Using the Playwright `_electron` recipe with the slow mock provider:

1. Start a run with several tool calls, type a follow-up, press Enter → run is not cancelled, chip appears.
2. After the current tool calls finish → chip disappears, user bubble appears, the next model call's input contains the follow-up after the tool results (check `~/.kucedr/sessions/<id>/messages.json` and `run.jsonl`).
3. Send a follow-up while the final answer is streaming → run continues with one more turn instead of finishing.
4. Queue a follow-up, then Stop → text returns to the composer, nothing is added to `messages.json`.
5. Remove a chip with X before delivery → it is never delivered.
6. Switch session and back mid-run → delivered follow-ups are still in the transcript.
