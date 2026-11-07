# Pluggable agent modes

Status: steps 1–5 are implemented. Modes are pure data in the bundled `bootstrap` plugin, and the
agent and chat input read them from `agent:list-modes`. Neither main nor the renderer contains code for
a specific mode. Step 6 (tests) is not done yet.

This document plans how to move Kucedr's agent modes into plugins. The core agent would start with no
modes, and adding a plugin would add a mode such as plan, goal, or fast.

## Why

Plan and goal are spread across about 45 source files, so the agent can't run without them and a new
mode means changing the runner.

Decisions:

- **Mode authors:** bundled and third-party plugins can both ship declarative modes. Protected
  prompts and model overrides are limited to bundled plugins.
- **No mode code in the host:** every mode, including Plan and Goal, is a `manifest.json` and a
  `SYSTEM_PROMPT.md`. The host only provides generic primitives: tool filters, shell and permission
  policies, effort and model overrides, output envelopes, and actions.
- **Goal:** has no saved state, goal tools, or budget. It is a persistent mode whose prompt keeps the
  objective and success criteria across messages.

These follow the [plugin security model](PLUGIN_SYSTEM.md#9-security-model): no plugin code runs in
the main process. A plugin declares a mode as data, and the host enforces it.

**End state:** with the `bootstrap` plugin disabled, the app behaves like today's
default mode, with no mode commands. `src` contains no reference to a specific mode.

## Mode definition

Modes are a new `modes` contribution kind, added to `PLUGIN_KINDS` in `src/shared/plugin_types.ts`.
They are discovered through `pluginDirs('modes')`, as `src/main/plugins/scripts/plugin_script_list.ts`
does for scripts, and validated in `plugins_validate_contents.ts`. Reload and enable/disable reuse the
existing plugin code.

Each mode lives in its own folder at `plugins/<plugin-name>/modes/<mode-name>/`, in both the bundled
root (`resources/plugins/`) and the installed root (`~/.kucedr/plugins/`). A plugin can ship several
modes, one folder each. The mode id is the folder name, like other contributions.

```text
plugins/
  <plugin-name>/
    manifest.json            plugin info; doesn't list modes, they're found from the folders
    modes/
      <mode-name>/
        manifest.json        required: the mode's definition (fields below)
        SYSTEM_PROMPT.md     required: instructions the mode adds to the system prompt
      <mode-name>/
        manifest.json
        SYSTEM_PROMPT.md
```

| File                                   | Required | Purpose                                                                 |
| -------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `<plugin-name>/manifest.json`          | Yes      | The normal plugin manifest. No new fields are needed for modes          |
| `modes/<mode-name>/manifest.json`      | Yes      | The mode's title, command, restrictions, output, and action             |
| `modes/<mode-name>/SYSTEM_PROMPT.md`   | Yes      | Non-empty text the mode adds to the system prompt, capped at 64 KB      |

The bundled modes:

```text
resources/plugins/
  bootstrap/
    manifest.json
    modes/
      plan/
        manifest.json        read-only tools and shell, output envelope, Implement action
        SYSTEM_PROMPT.md     today's plan prompt
      goal/
        manifest.json        persistent, with no restrictions
        SYSTEM_PROMPT.md     how to work toward a goal and report its criteria
```

`modes/plan/manifest.json`:

```json
{
	"title": "Plan",
	"description": "Inspect and propose a plan without changing anything.",
	"command": "/plan",
	"persistent": true,
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
| `title`, `description`       | Strings                                                                               | Yes                            |
| `command`                    | Such as `/plan`; the first plugin to claim one wins, with a warning                   | Yes                            |
| `persistent`                 | Boolean; the mode stays on after a message is sent, until removed or its action runs  | Yes                            |
| `protectedPrompt`            | Boolean; puts `SYSTEM_PROMPT.md` in the protected slot instead of the normal one      | Bundled only                   |
| `tools`                      | `"read-only"` (tools marked `readOnly`) or a tool id list; always intersected with what's allowed | Yes                  |
| `permissions`                | `"default"` or `"deny-asks"`                                                          | Yes                            |
| `shell`                      | `"default"`, `"read-only"`, or `"none"`                                               | Yes                            |
| `effort`                     | Applied only if the selected model supports it                                        | Yes                            |
| `model`                      | Model override                                                                        | Bundled only                   |
| `output`                     | `{ "envelope": "<tag>" }`                                                             | Yes                            |
| `action`                     | `{ "label", "prompt" }` on the output card; running it turns the modes off             | Yes                            |

How the bundled modes use this:

| Mode | Uses                                                                      |
| ---- | ------------------------------------------------------------------------- |
| Plan | Protected prompt, read-only tools and shell, deny-asks, envelope, action  |
| Goal | Prompt and `persistent` only                                              |

## Safety rules

1. **Fail closed:** an unknown or disabled mode id is an error, never a silent run with full tools.
   IPC rejects a malformed `modeIds` list instead of dropping it.
2. **Narrow only:** no field can add a tool or relax a sandbox.
3. **Trust comes from load location, not id:** an installed plugin can override a bundled one with the
   same id. A bundled-only field in an installed plugin fails validation.
4. **Pinned per run:** modes resolve at run start, so a plugin change affects the next run only.
5. **Combining:** tools intersect, the strictest `shell` and `permissions` win, and at most one active
   mode may set `output`.

Known limit: if the `bootstrap` plugin is disabled, `/plan foo` is plain text and runs as a normal message.
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
- `plan/tools.ts` becomes the policy filter, and `plan/context.ts` is replaced by `SYSTEM_PROMPT.md`.
- `planSafe` keeps its meaning, renamed `readOnly` across the tool definitions.
- The `ask` tool stays host-owned and is available when a restricted mode has an approval window.
- Subagents inherit `tools` and `shell` but not `prompt` or `output`.

### 3. Add the bundled modes

Each mode gets its folder under `resources/plugins/bootstrap/modes/`:

- `plan/`: `manifest.json` and `SYSTEM_PROMPT.md`, using today's prompt text.
- `goal/`: `manifest.json` and `SYSTEM_PROMPT.md`. This proves a new mode needs no host change.

### 4. Remove goal from the host

- Delete the goal module, its five tools, its tool category and settings group, and the command,
  context, and accounting calls in `agent.ts` and `run_stream.ts`.
- Saved `goal.json` files in existing sessions are no longer read.

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
| 6   | Plan runs count against a goal's budget even though goal is hidden during them (goal budgets no longer exist)                        | `agent.ts:386`, `goal/account.ts:12-25`             |

Still open after this refactor:

| #   | Issue                                                                                                                                | Where                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| 2   | Any text outside the `<proposed_plan>` envelope fails the run with no retry, and the plan isn't saved to history                     | `runner/run_stream.ts:563-572`                |
| 7   | `run_script` is marked `readOnly` but spawns plugin code outside the sandbox with the full `process.env`                             | `plugins/scripts/plugin_script_render.ts:23`  |
| 8   | The Plan shell runs `app.asar.unpacked/.../dist/cli.js`, but `asarUnpack` lists only `vendor/**`, so it may fail in packaged builds | `sandbox.ts:336`, `electron-builder.json:36`  |
| 9   | Plan sandbox settings are written to a directory the sandboxed command can write to. This is hardening, not a demonstrated exploit   | `sandbox.ts:297,320`                          |

Issue 8 matters more after this refactor, because Plan's read-only shell depends on it.

## Verification

The refactor will need the existing test suite run, which [CLAUDE.md](../CLAUDE.md) rules out unless
asked, so that run needs explicit approval at that point.

1. Typecheck, lint, and tests pass.
2. `git grep` finds no `interactionMode`, `planSafe`, or mode-specific code anywhere in `src`.
3. In the running app:
   - **`bootstrap` disabled:** no commands appear, and a normal chat with file edits works.
   - **Plan:** `/plan` blocks writes, renders the card, and Implement leaves Plan mode,
     including with a pasted `/plan x`.
   - **`bootstrap` disabled mid-session:** a send carrying a mode id returns an error.
   - **Goal:** create, pause, resume, and clear work on an existing saved goal.
   - **Fast:** the run uses the mode's effort.
4. An installed plugin with `protectedPrompt` fails validation.
5. A packaged build runs one Plan `bash` command (issue 8).

## Out of scope

Third-party modes with their own code. Adding them later would need an out-of-process hook and
session-state protocol.
