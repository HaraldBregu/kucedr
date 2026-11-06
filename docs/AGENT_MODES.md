# Pluggable agent modes

Status: proposed, not implemented. Plan and goal are still hard-coded in the agent today.

This document plans how to move Kucedr's agent modes into plugins. The core agent would start with no
modes, and adding a plugin would add a mode such as plan, goal, or fast.

## Why

Plan and goal are spread across about 45 source files, so the agent can't run without them and a new
mode means changing the runner.

Decisions:

- **Mode authors:** bundled and third-party plugins can both ship declarative modes. Protected
  prompts, model overrides, and host behaviors are limited to bundled plugins.
- **Plan:** becomes a bundled data plugin.
- **Goal:** becomes a bundled plugin that switches on host code. Its code stays in the host as an
  isolated module, because data can't express saved state, tools, and budget accounting.

These follow the [plugin security model](PLUGIN_SYSTEM.md#9-security-model): no plugin code runs in
the main process. A plugin declares a mode as data, and the host enforces it.

**End state:** with the `plan`, `goal`, and `fast` plugins disabled, the app behaves like today's
default mode, with no mode commands. The runner contains no reference to plan or goal.

## Mode definition

Modes are a new `modes` contribution kind, added to `PLUGIN_KINDS` in `src/shared/plugin_types.ts`.
They are discovered through `pluginDirs('modes')`, as `src/main/plugins/scripts/plugin_script_list.ts`
does for scripts, and validated in `plugins_validate_contents.ts`. Reload and enable/disable reuse the
existing plugin code.

```text
resources/plugins/plan/
  manifest.json
  modes/plan/mode.json
  modes/plan/prompt.md
```

```json
{
	"id": "plan",
	"title": "Plan",
	"description": "Inspect and propose a plan without changing anything.",
	"command": "/plan",
	"prompt": "prompt.md",
	"protectedPrompt": true,
	"tools": "read-only",
	"permissions": "deny-asks",
	"shell": "read-only",
	"output": { "envelope": "proposed_plan" },
	"action": { "label": "Implement", "prompt": "Implement the approved plan." }
}
```

| Field                        | Values                                                                                | Third-party                    |
| ---------------------------- | ------------------------------------------------------------------------------------- | ------------------------------ |
| `id`, `title`, `description` | Strings                                                                               | Yes                            |
| `command`                    | Such as `/plan`; the first plugin to claim one wins, with a warning                   | Yes                            |
| `prompt`                     | Relative path, size-capped, checked with `src/shared/plugin_path.ts`                  | Yes, normal instructions slot  |
| `protectedPrompt`            | Boolean                                                                               | Bundled only                   |
| `tools`                      | `"read-only"` (uses `planSafe`) or a tool id list; always intersected with what's allowed | Yes                            |
| `permissions`                | `"default"` or `"deny-asks"`                                                          | Yes                            |
| `shell`                      | `"default"`, `"read-only"`, or `"none"`                                               | Yes                            |
| `effort`                     | Applied only if the selected model supports it                                        | Yes                            |
| `model`                      | Model override                                                                        | Bundled only                   |
| `output`                     | `{ "envelope": "<tag>" }`                                                             | Yes                            |
| `action`                     | `{ "label", "prompt" }` on the output card                                            | Yes                            |
| `behavior`                   | `"goal"`                                                                              | Bundled only                   |

How the three planned modes use this:

| Mode | Needs                                                      | Plugin contents                 |
| ---- | ---------------------------------------------------------- | ------------------------------- |
| Fast | Effort override only                                       | `effort`                        |
| Plan | Prompt, tool filter, shell policy, and output check        | Data, using host primitives     |
| Goal | Saved state, 5 tools, lifecycle commands, budget accounting | `behavior: "goal"`, host code   |

## Safety rules

1. **Fail closed:** an unknown or disabled mode id is an error, never a silent run with full tools.
   This is the biggest trap, because `src/main/ipc/agent.ts:327` and `src/preload/agent.ts:59` turn
   anything unrecognized into `default` today.
2. **Narrow only:** no field can add a tool or relax a sandbox.
3. **Trust comes from load location, not id:** an installed plugin can override a bundled one with the
   same id. A bundled-only field in an installed plugin fails validation.
4. **Pinned per run:** modes resolve at run start, so a plugin change affects the next run only.
5. **Combining:** tools intersect, the strictest `shell` and `permissions` win, and at most one active
   mode may set `output` or `behavior`.

Known limit: if the Plan plugin is removed, `/plan foo` is plain text and runs as a normal message.
The missing chip is the only signal.

## Refactor steps

Each step should leave the app working.

### 1. Add the host mode layer, with no behavior change

- Add `src/main/agent/modes/`: schema, `resolve`, and `list`, one function per file. Resolving returns
  a policy: `tools`, `restricted`, `permissions`, `shell`, `prompt`, `output`, `effort`.
- Replace `AgentInteractionMode` with `modeIds: string[]` in `src/shared/agent_types.ts`,
  `src/main/agent/types.ts`, `session_trace_entry.ts`, and `compaction/compact.ts`. An empty list
  means no mode.
- Make runner files read the policy instead of checking for `'plan'`: `run_stream.ts`,
  `run_tool_call.ts`, `run_tool_calls.ts`, `run_builtin_tools.ts`, `system_resolve_context_mode.ts`,
  `tools/core/bash.ts`, and `sandbox.ts`.
- Move gates such as MCP loading, undo/redo, bootstrap, and `select_screen_source` to
  `policy.restricted`.
- Normalize at `src/preload/agent.ts:59`, `src/main/ipc/agent.ts:327`, and `src/main/agent/agent.ts:275`
  without coercing to default. Non-main runs get `[]`.

### 2. Make the plan code generic

- `plan/command.ts` and `wrapPlan` become read-only shell primitives.
- `plan/output.ts` becomes an envelope check taking any tag.
- `plan/tools.ts` becomes the policy filter, and `plan/context.ts` is replaced by `prompt.md`.
- `planSafe` keeps its meaning, renamed `readOnly` across the tool definitions.
- The `ask` tool stays host-owned and is available when a restricted mode has an approval window.
- Subagents inherit `tools` and `shell` but not `prompt` or `output`.

### 3. Add the bundled plugins

- `resources/plugins/plan/`: `manifest.json` plus `modes/plan/{mode.json,prompt.md}`, using today's
  prompt text.
- `resources/plugins/fast/`: `effort` only. This proves a new mode needs no host change.
- `resources/plugins/goal/`: `behavior: "goal"`.

### 4. Isolate goal

- Move `src/main/agent/goal/*` to `src/main/agent/modes/goal/`, behind one entry point exposing command
  handling, tools, context, and accounting.
- Remove direct goal calls at `agent.ts:25-27,237,313,387` and `run_stream.ts:17-19,247,506`, and the
  goal entries in `execution/capability.ts`, `agent_store.ts`, and
  `settings/pages/assistant/tools/Page.tsx` where they become plugin-driven.
- Goal stays suspended during restricted runs, as today, and those runs are no longer charged to its
  budget.
- Saved goal files keep their format, so no migration is needed. They stay inert while the plugin is
  disabled.

### 5. Update the renderer

- One generic mode chip replaces `components/plan-command.ts` and `components/goal-command.ts`. Its
  input rule reads a live list from a new IPC call, so the editor isn't rebuilt when a plugin is
  installed.
- A leading `/command ` is also recognized at submit, which covers pasted text.
- The chip becomes the only source of truth. Delete `pages/home/hooks/mode.ts` and the `Page.tsx` plan
  and goal state, and clear chips on a new chat.
- `AssistantMessage.tsx`, `components/plan.ts`, and `useHomeAgent.ts` take the envelope and action from
  the mode. Running an action removes the chip.
- Replace the `plan-prompt-frame` and `goal-prompt-frame` styles in `index.css` with one mode frame
  style.

### 6. Update tests and docs

- Move the 8 plan and goal test files to the new paths, and make only the forced edits in the other 23.
  New tests cover only the fail-closed rule and bundled-only validation.
- Update this document to describe the built state, and link it from [Plugin system](PLUGIN_SYSTEM.md).
  Update [Feature reference](FEATURES.md), [Application guide](APPLICATION.md), [Home](ui/HOME.md), and
  [chat use cases](use-cases/chat.md).

## Known plan mode issues

These come from a code review of the current implementation. The app and tests were not run, so they
are traced from the code, and issue 8 needs a packaged build to confirm.

Fixed by this refactor:

| #   | Issue                                                                                                                                | Where                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| 1   | Implement runs in default mode but leaves the Plan chip in place, so the next message runs read-only again                           | `hooks/useHomeAgent.ts:304`, `home/Page.tsx:605`    |
| 3   | Subagents inherit the plan prompt and output check, so plain findings fail and are lost                                              | `tools/core/subagents.ts:57`                        |
| 4   | A pasted `/plan ...` isn't recognized and runs in default mode with write tools                                                      | `components/plan-command.ts:25`                     |
| 5   | The saved per-session mode is overwritten on mount and never restored, and nothing clears the chip on a new chat                     | `components/text-editor.tsx:95`, `home/Page.tsx:474` |
| 6   | Plan runs count against a goal's budget even though goal is hidden during them                                                       | `agent.ts:386`, `goal/account.ts:12-25`             |

Still open after this refactor:

| #   | Issue                                                                                                                                | Where                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| 2   | Any text outside the `<proposed_plan>` envelope fails the run with no retry, and the plan isn't saved to history                     | `runner/run_stream.ts:563-572`                |
| 7   | `run_script` is marked `planSafe` but spawns plugin code outside the sandbox with the full `process.env`                             | `plugins/scripts/plugin_script_render.ts:23`  |
| 8   | The Plan shell runs `app.asar.unpacked/.../dist/cli.js`, but `asarUnpack` lists only `vendor/**`, so it may fail in packaged builds | `sandbox.ts:336`, `electron-builder.json:36`  |
| 9   | Plan sandbox settings are written to a directory the sandboxed command can write to. This is hardening, not a demonstrated exploit   | `sandbox.ts:297,320`                          |

Issue 8 matters more after this refactor, because Plan's read-only shell depends on it.

## Verification

The refactor will need the existing test suite run, which [CLAUDE.md](../CLAUDE.md) rules out unless
asked, so that run needs explicit approval at that point.

1. Typecheck, lint, and tests pass.
2. `git grep` finds no `interactionMode`, `'plan'`, or goal imports in `src/main/agent/runner`.
3. In the running app:
   - **Plugins disabled:** no commands appear, and a normal chat with file edits works.
   - **Plan enabled:** `/plan` blocks writes, renders the card, and Implement leaves Plan mode,
     including with a pasted `/plan x`.
   - **Plan disabled mid-session:** a send carrying that mode id returns an error.
   - **Goal enabled:** create, pause, resume, and clear work on an existing saved goal.
   - **Fast enabled:** the run uses the mode's effort.
4. An installed plugin with `protectedPrompt` fails validation.
5. A packaged build runs one Plan `bash` command (issue 8).

## Out of scope

Third-party modes with their own code. Adding them later would need an out-of-process hook and
session-state protocol.
