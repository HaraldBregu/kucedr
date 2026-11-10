# Mode contributions (`modes/`)

A mode changes how one main-chat agent run behaves: extra system prompt, tool limits, permission and shell policy, effort/model, a required output format, and optional tracked state. The user turns modes on by typing their slash command in the prompt editor, which inserts a mode chip.

## Folder

```
modes/<id>/
  manifest.json
  SYSTEM_PROMPT.md     required, non-empty, ≤ 64 KB
```

The folder name is the mode id (kebab-case).

## Manifest

`readMode()` (`src/main/agent/modes/read.ts`), strict schema:

| Field | Type | Effect |
|---|---|---|
| `title` | string ≤ 40 | Display name. |
| `description` | string ≤ 1024 | Shown in the command menu and in Settings → Modes. |
| `command` | `/kebab-name` | Slash command that turns the mode on. |
| `persistent` | bool | Exposed to the renderer and shown as a badge in Settings → Modes. |
| `ask` | bool | Interactive runs have the `ask` tool (structured questions to the user) by default. `false` removes it. |
| `protectedPrompt` | bool | **Bundled only.** Puts the prompt in the protected section, next to loaded skills, instead of after the workspace context. |
| `tools` | `"read-only"` or string[] | `read-only`: only tools marked `readOnly`. A list: only those tool ids. |
| `permissions` | `default` \| `deny-asks` | `deny-asks` turns every "ask for approval" into "deny". |
| `shell` | `default` \| `read-only` \| `none` | `none` removes `bash` and `process`. `read-only` rejects bash calls with env overrides, background, elevated, PTY, external hosts, extra roots, or a workdir outside the workspace (`shell.ts`). |
| `effort` | `none` … `max` | Reasoning effort, used only if the selected model supports it (`effort.ts`). |
| `model` | string | **Bundled only.** Overrides the model id for the run. |
| `output` | `{ envelope: "tag" }` | The final answer must be exactly one non-empty `<tag>…</tag>`. |
| `action` | `{ label, prompt }` | Button under an envelope reply; clicking it sends `prompt`. |
| `state` | `{ evidence?, continue? }` | Turns on tracked state (see below). |

User-installed plugins can't use `protectedPrompt` or `model`: `modes/<id>: "<field>" is limited to bundled plugins.` Trust comes from where the plugin was loaded from (`builtIn`), not from its id.

## Discovery

`listModes()` (`list.ts`) reads `pluginDirs('modes')`. The first plugin to claim an id **or** command wins, and invalid modes are skipped with a console warning. `agent.listModes` IPC returns `modeInfo()` objects (`AgentModeInfo`: id, title, description, command, persistent, plugin name, output, action). The renderer's `useModes()` reloads them on `modelsChanged`.

## Combining modes

The chat sends `options.modeIds`. For `request.category === 'main'`, `resolveModes(ids, listModes())` (`resolve.ts`) builds one `ModePolicy`. The mode folders are read once per run, and the policy keeps that list as `available`. Each mode can only **narrow** the run:

- an unknown id is an error (`Mode "x" is unavailable. Enable its plugin or remove the mode.`), never silently ignored
- at most one active mode may define `output`, and active modes may not name different `model`s
- `toolIds` = intersection of all tool lists; `readOnly` if any mode is `read-only`
- `permissions` = `deny-asks` if any mode sets it
- `shell` = the strictest (`none` > `read-only` > `default`)
- `ask` unless any mode sets it to `false`; runs without an approval window never have it
- `effort` = from the first mode (in id order) that sets it
- prompts are joined in id order, split into normal and protected
- `restricted` = any tool, permission, or shell limit is active. A restricted run loads no MCP tools, so a `tools` list can't name `mcp__…` tools

Task and health runs use `NO_MODE`, and sending `modeIds` to one is an error. Sub-agents inherit the parent's tool, shell and permission limits, but not its prompts, output, `ask`, or `update_mode_state`.

## Runtime effects (`src/main/agent/runner/`)

- **Tools:** `filterModeTools()` / `allowsTool()` apply `shell`, `readOnly`, and `toolIds` when tools are listed. `tool_search`, `ask`, and `update_mode_state` are always allowed. Undo/redo file tools are left out when the policy is restricted.
- **Prompt:** `mode.prompt` goes after the workspace context; `mode.protectedPrompt` goes in the protected block.
- **Gate:** in `run_tool_call.ts`, `modeGate()` (`gate.ts`) refuses a call the modes don't allow, including read-only bash violations. `deny-asks` turns `ask` into `deny`.
- **Final reply:** `modeStop()` (`stop.ts`) decides whether a reply with no tool calls is accepted, rewritten, or continued.
- **Output envelope:** if a final reply isn't a valid envelope (`output.ts`: exactly one opening tag at the start, one closing tag at the end, non-empty body), the turn is rejected and the model is asked to rewrite it once. The rewrite is not checked again. Each assistant message stores its run's `modeIds`, and the renderer parses the envelope only with those modes (`AssistantMessage.tsx`), shows its content, and adds the `action` button. Messages saved before this field existed are tried against every mode.
- **Effort/model:** `mode.model` overrides the chosen model; `modeEffort()` applies the mode's effort only if the model supports it.

## Tracked state

A mode with `state` gets per-session state at `<session>/modes/<mode-id>.json` (`state/`):

```json
{
	"mode": "goal",
	"status": "active | completed | blocked",
	"objective": "…",
	"items": [{ "text": "…", "status": "pending | in_progress | done", "evidence": "…" }],
	"note": "…",
	"updatedAt": 0
}
```

- `trackedModes()` = stateful modes active in this run, plus any whose saved state is still `active`. Clearing the chat deletes the state files. A file that can't be read counts as no state.
- These modes get the `update_mode_state` tool (`state/tool.ts`):
  - given `items` replace the whole list;
  - a new state needs an objective;
  - without a `status` the previous one is kept, except that a new objective starts `active`;
  - `blocked` needs a note, and a note carries over only while the status stays the same;
  - `completed` needs at least one item and every item done, with evidence when `state.evidence` is set. Otherwise the update is saved as `active` and the call fails with the open item numbers;
  - a mode without `state.continue` becomes `completed` by itself once every item is done.
- Each turn, `stateContext()` adds a `<mode_state>` block to the system prompt with the objective, a checklist, the note, and the completion rule. The state text is model-written, so `<` is escaped.
- `state.continue`: if the model ends a turn with no tool calls and this run has not set the mode's state to `completed` or `blocked`, the runner adds an internal `<mode_continue>` message and keeps going, up to three nudges and never two in a row (`unfinishedModes()`). A finished state left by an earlier run counts as open.

## Bundled modes (`bootstrap/modes`)

| Mode | Command | Config |
|---|---|---|
| `plan` | `/plan` | persistent, `ask`, protected prompt, `tools: read-only`, `permissions: deny-asks`, `shell: read-only`, `output.envelope: proposed_plan`, empty `state` (tracked, no evidence/continue), action **Implement**. |
| `goal` | `/goal` | persistent, `state: { evidence: true, continue: true }`. Keeps working autonomously until every success criterion is done with evidence, or the state is blocked. |
