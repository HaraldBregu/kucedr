# Mode contributions

A mode changes how one chat run behaves: it adds a system prompt and can narrow tools, permissions, shell access, reasoning effort and the reply format. The user turns it on by typing its slash command in the prompt box, which inserts a mode chip.

Modes apply to chat runs only, not to tasks. A mode can only narrow a run, never widen it.

## Folder

```
modes/<id>/
  manifest.json
  SYSTEM_PROMPT.md     required, non-empty, at most 64 KB
```

The folder name is the mode id: lowercase letters, digits and single hyphens.

## manifest.json

The smallest valid mode:

```json
{
	"title": "Short",
	"description": "Answer briefly, without long explanations.",
	"command": "/short"
}
```

The object is strict: unknown keys fail.

| Field | Required | Rule and effect |
|---|---|---|
| `title` | yes | 1-40 characters. Display name. |
| `description` | yes | 1-1024 characters. Shown in the command menu and Settings → Modes. |
| `command` | yes | `/` followed by lowercase letters, digits and single hyphens, for example `/review`. |
| `persistent` | no | Boolean. Shown as a badge in Settings → Modes. |
| `ask` | no | Boolean. `false` removes the `ask` tool, so the agent cannot put structured questions to the user. |
| `tools` | no | `"read-only"`: only tools that change nothing. Or an array of tool ids: only those tools. |
| `permissions` | no | `"default"` or `"deny-asks"`. `deny-asks` turns every "ask the user for approval" into a refusal. |
| `shell` | no | `"default"`, `"read-only"` or `"none"`. `none` removes `bash` and `process`. `read-only` rejects `bash` calls that set environment variables, run in the background, run elevated, use a terminal, reach external hosts, or work outside the workspace. |
| `effort` | no | `none`, `instant`, `minimal`, `low`, `medium`, `high`, `xhigh` or `max`. Applied only when the selected model supports it. |
| `output` | no | `{ "envelope": "<tag>" }`. The final answer must be exactly one non-empty `<tag>...</tag>` block. The tag is a lowercase letter followed by lowercase letters, digits or `_`. |
| `action` | no | `{ "label": "...", "prompt": "..." }`. A button under an envelope reply that sends `prompt`. `label` at most 40 characters, `prompt` at most 1024. |
| `state` | no | `{ "evidence": bool, "continue": bool }`. Turns on a tracked checklist. See below. |

Do not use `protectedPrompt` or `model`. They are accepted only in plugins that ship with the app, and make a user plugin's mode invalid.

## Choosing limits

Add only the limits the mode needs. Any `tools`, `permissions` or `shell` limit makes the run restricted, and a restricted run loads no MCP tools; a `tools` list therefore cannot name `mcp__...` tools.

| Goal | Fields |
|---|---|
| Change tone or format only | none beyond `title`, `description`, `command` |
| Look but do not touch (review, planning) | `"tools": "read-only"`, `"shell": "read-only"`, `"permissions": "deny-asks"` |
| No command execution | `"shell": "none"` |
| A fixed toolset | `"tools": ["read", "search_web", "fetch_web_page"]` |
| A reply the app shows specially, with a follow-up button | `output` and `action` |
| Work autonomously through a checklist | `"ask": false`, `"state": { "evidence": true, "continue": true }` |

Built-in tool ids you can list: `bash`, `process`, `read`, `write`, `edit`, `patch`, `undo`, `redo`, `ask`, `subagent`, `search_web`, `fetch_web_page`, `use_web_browser`, `query_knowledge`, `create_task`, `list_tasks`, `update_task`, `delete_task`, `run_task_now`, `create_image`, `create_sound`, `create_video`, `load_script`, `run_script`, `get_user`, `update_user`, `get_health`, `update_health`.

When several modes are active together, the limits combine to the strictest: tool lists intersect, the tightest shell setting wins, `deny-asks` wins, and `ask` is removed if any mode removes it. At most one active mode may define `output`.

Sub-agents inherit a mode's tool, shell and permission limits, but not its prompt. If the mode's rules must hold in delegated work, say in `SYSTEM_PROMPT.md` that they must be repeated in every `subagent` prompt.

## Tracked state

A mode with `state` (even `{}`) gets an `update_mode_state` tool and a per-chat checklist: an objective, items with `pending`, `in_progress` or `done` status, and a note. The current state is shown to the agent on every turn.

- `evidence: true`: an item counts as done only with evidence text.
- `continue: true`: if the agent stops without marking the state `completed` or `blocked`, the app nudges it to keep going, up to three times.
- Without `continue`, the state completes by itself once every item is done.

Use `state` only for modes that drive multi-step work to completion. In the prompt, tell the agent to record its objective and items with `update_mode_state` first and to keep them current.

## SYSTEM_PROMPT.md

This text is added to the system prompt after the workspace context whenever the mode is on. Write it as direct instructions to the agent:

```markdown
<review_mode>
You are in Review mode. The user wants a code review, not changes.
- Read the files involved before you comment.
- Report problems in order of severity, each with its file and line.
- Do not edit files or run commands that change anything.
- Review mode limits what you do, not how carefully you read.
</review_mode>
```

Guidelines:

- Wrap the prompt in one tag named after the mode so its scope is clear.
- State what the mode changes and, just as important, what stays the same.
- Keep it short; it is sent with every request while the mode is on.
- The prompt must agree with the manifest. Do not ask for edits in a mode whose `tools` are read-only. If `output.envelope` is set, tell the agent to put its whole final answer inside that tag and nothing outside it.
- Do not try to grant abilities in the prompt. The manifest limits are enforced by the app regardless of the prompt.

## Checks

1. `manifest.json` parses and has only keys from the table.
2. `command` starts with `/` and is not already used. The app ships `/plan`, `/goal` and `/short` among others; ask the user to look at Settings → Modes when unsure. A clash makes the later mode disappear without a message.
3. `SYSTEM_PROMPT.md` exists, is not empty, and is under 64 KB:

```bash
wc -c <id>/modes/<mode-id>/SYSTEM_PROMPT.md
```

4. Every id in a `tools` array is in the list above, and none starts with `mcp__`.

After install, the mode appears in Settings → Modes, and typing its command in the prompt box offers it. Ask the user to try one request with the mode on and report whether the behaviour matches.
