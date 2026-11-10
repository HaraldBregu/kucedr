# Plugin Script Hooks

Status: implemented. This extends [PLUGIN_SCRIPTS.md](PLUGIN_SCRIPTS.md).

## Context

Plugin scripts (`<plugin>/scripts/<id>/`) have a `type`: `UI`, `STORAGE` or `VECTOR` (`PLUGIN_SCRIPT_TYPES` in `src/shared/plugin_types.ts`). Two more types, `PRE_TOOL_USE` and `POST_TOOL_USE`, add scripts that run right before and right after every tool call, in **every agent**.

- Hooks are side-effect scripts: logging, notifying, syncing, and so on. They never change, block or break a tool call.
- Several hook scripts can be installed, and every one of the matching type runs.
- A hook that crashes, is slow or misbehaves is logged and ignored. Tools behave exactly as they do today.

## One change covers all agents

Every agent runs tools through one function, `runToolCall` (`src/main/agent/runner/run_tool_call.ts`), and `tool.run(...)` is called only there:

| Agent                                          | Path                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| chat, tasks, health (`AGENT_TOOL_PROFILE_IDS`) | `agent.ts` → `run_stream.ts` → `runToolCalls` → `runToolCall`             |
| subagents                                      | `tools/core/subagents.ts` → `run_stream.ts` → same path                   |
| MCP recovery                                   | `run_mcp_recovery.ts` → `runToolCalls`                                    |
| voice                                          | `realtime_voice/tool_runtime.ts` → `runToolCall` (`toolProfile: 'voice'`) |

So the hooks are added in `runToolCall` and nowhere else.

## Manifest

```json
{
	"title": "Audit log",
	"description": "Append every tool call to a local log.",
	"type": "PRE_TOOL_USE",
	"metadata": {
		"version": "1.0.0",
		"category": "audit",
		"entry": "dist/index.mjs"
	}
}
```

- `PLUGIN_SCRIPT_TYPES` becomes `['UI', 'STORAGE', 'VECTOR', 'PRE_TOOL_USE', 'POST_TOOL_USE', 'PRE_MODEL_TURN', 'POST_MODEL_TURN']`.
- Hook scripts are never loaded by the agent, so `metadata.instructions` is optional for the four hook types and still required for every other type (a refine in `plugin_script_read.ts`). Each hook script explains itself in a `README.md` instead.
- A script that wants both events ships as two script folders.
- There is no `tools` filter, so every hook sees every tool call. Add a `tools: string[]` matcher if the spawn cost becomes noticeable.
- Existing consumers stay correct without changes:
  - `pluginScripts()` defaults to `'UI'`, so hooks never reach the `# Scripts` prompt, `run_script` or `renderPluginScript`.
  - The renderer filters `type === 'UI'`, so hooks never appear in chat or the editor.
  - Settings → Scripts lists them through the `PLUGIN_SCRIPT_TYPES.flatMap` in `ipc/scripts.ts`.

## Script contract

- A hook runs on Electron's Node like other scripts: `process.execPath` with `ELECTRON_RUN_AS_NODE=1`, the script folder as the working directory, and a 10 s timeout.
- stdin gets one JSON event:

  ```json
  {
  	"event": "PRE_TOOL_USE",
  	"agent": "chat",
  	"runId": "…",
  	"toolCallId": "…",
  	"toolName": "bash",
  	"tool": {
  		"name": "bash",
  		"description": "…",
  		"category": "core",
  		"source": { "kind": "builtin", "id": "bash" }
  	},
  	"input": { "command": "ls" },
  	"settings": { "directory": "~/.kucedr/logs/tools" }
  }
  ```

  `POST_TOOL_USE` also has `output` (the formatted string the model sees), `isError` and `durationMs`.

- `settings` holds the values saved in Settings → Scripts (see [Setup](#setup)).
- stdout is ignored. A non-zero exit or a timeout is logged with its stderr (`console.warn('[plugins] hook …')`) and has no other effect.

## Setup

A script declares what the user must set up in its manifest, under `settings.inputSchema`. It uses the same shape as a plugin's `settings`, limited to string properties:

```json
"settings": {
	"inputSchema": {
		"type": "object",
		"required": ["directory"],
		"properties": {
			"directory": { "type": "string", "title": "Directory", "description": "…" }
		}
	}
}
```

- **Settings → Scripts → <script>** shows one field per property (`details/Setup.tsx`), with a notice while a required field is empty.
- The values are saved per script name in the plugins store under `scriptSettings`. `pluginScriptSettings(name)` reads them, and `savePluginScriptSettings(name, values)` saves them, rejecting keys the manifest doesn't declare. The IPC channels are `scripts:get-settings` and `scripts:save-settings`.
- Properties are `string` (a text field) or `boolean` (a switch that saves on toggle, with an optional `default`). Values are stored as strings, so booleans are `"true"` or `"false"`.
- A script that declares an `enabled` boolean runs only while it is `"true"`. The four bundled log scripts declare it with `default: false`, so they are off until the user turns them on.
- `runPluginHooks` also skips a script while any `required` setting is empty. Otherwise it sends the values, with boolean defaults filled in, as `settings` in the event.

## Host changes

1. **`src/main/plugins/scripts/plugin_script_spawn.ts`** (new): `spawnPluginScript(script, payload): Promise<string>`. The spawn, timeout, 2 MB cap and stderr handling move here from `plugin_script_render.ts`, and `renderPluginScript` calls it. The render cache stays in `plugin_script_render.ts`.
2. **`src/main/plugins/scripts/plugin_script_hooks.ts`** (new): `runPluginHooks(type, event): Promise<void>` runs `Promise.allSettled(pluginScripts(type).map((script) => spawnPluginScript(script, event)))` and logs each rejection. It never throws. `pluginScripts(type)` keeps only scripts whose `type` equals the given one, so before a tool call only `PRE_TOOL_USE` scripts run and after it only `POST_TOOL_USE` scripts run. `UI`, `STORAGE` and `VECTOR` scripts never run as hooks. Export it from `src/main/plugins/index.ts`, like `pluginScripts`.
3. **`src/main/agent/runner/run_tool_call.ts`** is the only agent change:
   - **PRE:** in the execution branch, once the permission is `allow` and before `tool.run` (inside the `try`, before `resources.acquire`), call `await runPluginHooks('PRE_TOOL_USE', { … })`. It is awaited so it really runs before the tool, and its errors are already swallowed. Only calls that are about to execute trigger it, not denied, invalid or unloaded ones.
   - **POST:** right after `toolCall.result` is set, call `void runPluginHooks('POST_TOOL_USE', { … })`. It isn't awaited, so the agent never waits for it. It runs after both successful and failed executions, and is skipped on abort, because that path rethrows first.
   - `agent` is `security.toolProfile ?? 'chat'`.
4. **Bundled scripts:** the bootstrap plugin ships `pre-tool-log`, `post-tool-log`, `pre-model-log` and `post-model-log`. Each appends the event as a JSON line to `<directory>/<event>-YYYY-MM-DD.jsonl`, where `directory` is the required setting the user saves in Settings → Scripts. Nothing is logged until it is set. They have no dependencies, so `metadata.entry` is `index.mjs` and there is no build step.
5. **`docs/PLUGIN_SCRIPTS.md`:** add the two types and link to this doc.

## Model turn hooks

`PRE_MODEL_TURN` and `POST_MODEL_TURN` work the same way around every model call. Every agent's model call goes through `runModelTurn` (`src/main/agent/runner/run_model_turn.ts`), called from `run_stream.ts` (chat, tasks, health, subagents) and `compaction/compact.ts`. Voice uses a realtime session instead and has no model turn hooks.

- **PRE** is awaited once per turn, after the context is fitted and before the first attempt. The event has `agent`, `agentId`, `runId`, `sessionId`, `model`, `estimatedInputTokens`, `messageCount` and `toolCount`.
- **POST** isn't awaited, and runs once a turn succeeds. It also has `stopReason`, `usage`, `retryCount`, `durationMs`, `firstTokenLatencyMs`, `content` and `toolCalls` (`id` and `name`). A turn that fails after its retries sends no POST event.
- `model` is `{ id, provider, effort, contextWindow, maxTokens, options }`. In POST, `id` is the model the provider answered with.

## Skipped

- **Blocking or rewriting input or output.** Add it when a hook needs to act as a gate.
- **Tool matchers.**
- **Ordering between hooks.** They run in parallel.
- **A Settings UI for hooks** beyond the existing script list.

## Verification

1. `npm run typecheck:app` and lint pass.
2. Add two test scripts to a local plugin, `scripts/log-pre` (`PRE_TOOL_USE`) and `scripts/log-post` (`POST_TOOL_USE`), whose entry appends stdin to `/tmp/kucedr-hooks.log`.
3. Run `npm run dev`, and in **chat** ask for a `read` and a `bash` call. The log should get a PRE line before and a POST line after each call, with a matching `toolCallId`, and the POST line should have `output`.
4. Repeat from a **task** run, a **subagent** call and a **voice** session. The lines should show `agent` as `tasks`, `chat` and `voice`.
5. Make the PRE script `process.exit(1)`, then make it hang with `setTimeout(() => {}, 60000)`. In both cases tools should still run and return normally (the hang adds at most 10 s), and a warning should be logged.
6. Disable the plugin. No new log lines should appear, and no restart should be needed.
7. Settings → Scripts should list both hook scripts. They should not appear in the chat `# Scripts` prompt or the editor's "Insert script" menu.
