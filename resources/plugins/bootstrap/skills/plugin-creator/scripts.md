# Script contributions

A script is a small program in `scripts/<name>/` that Kucedr runs on its own built-in Node runtime. The user does not need Node installed to run a script, only to build or test one.

The folder name is the script name: lowercase letters, digits and single hyphens.

## Types

| `type` | Runs | Use for |
|---|---|---|
| `UI` (default) | When the agent calls `run_script`, and when a matching code fence is shown | Turning JSON input into an HTML view in the chat or a document |
| `PRE_TOOL_USE` | Before every agent tool call | Logging, notifying, auditing |
| `POST_TOOL_USE` | After every agent tool call | The same, with the tool output |
| `PRE_MODEL_TURN` | Before every model call | Usage tracking |
| `POST_MODEL_TURN` | After every successful model call | Usage tracking, with token counts |

`STORAGE` and `VECTOR` also exist (cloud backup and vector-database sync). They are not covered here; tell the user so if they ask for one.

A script that needs two events ships as two script folders.

## How every script is run

- Command: the app's Node runtime with the `metadata.entry` file, working directory set to the script folder.
- Input: one JSON document on stdin.
- Environment: only basic variables such as `PATH`, `HOME`, `USER`, `LANG`, `TMPDIR` and their Windows equivalents. Do not expect other variables.
- Limits: 10 seconds, then the process is killed. stdout is capped at 2 MB.
- The app never installs dependencies. The entry must run as shipped: use only Node built-ins, or bundle dependencies into the entry file. Do not ship `node_modules`.

## manifest.json

```json
{
	"title": "Badge",
	"description": "Render a short status label as a coloured badge.",
	"type": "UI",
	"metadata": {
		"version": "1.0.0",
		"category": "data",
		"entry": "index.mjs",
		"instructions": "instructions.md"
	},
	"fence": "badge",
	"height": 120
}
```

The object and its `metadata` are strict: unknown keys fail.

| Field | Required | Rule |
|---|---|---|
| `title` | yes | Non-empty. |
| `description` | yes | 1-1024 characters. For `UI` scripts this is what the agent reads to choose a script. |
| `author` | no | Non-empty. |
| `type` | no | One of the types above. Default `UI`. |
| `metadata.version` | yes | Non-empty. |
| `metadata.category` | yes | Non-empty, for example `data`, `logs`. |
| `metadata.entry` | yes | Relative path to an existing file. |
| `metadata.instructions` | `UI`: yes. Hooks: no | Relative path to an existing `.md` file. |
| `inputSchema` | no | `{ "type": "object", ... }` with any JSON Schema keys. Used for forms in the app; never shown to the agent. |
| `settings` | no | User setup. See "Hook settings". |
| `fence` | no | Lowercase-hyphen code-fence language that renders this script in markdown. |
| `height` | no | Integer 80-2000. Initial frame height. Default 320. |

## UI scripts

### Contract

- stdin: `{"input": <object from the agent>, "theme": "light" | "dark"}`.
- stdout: one complete HTML document. Exit code 0.
- On bad input: write a clear message to stderr and exit non-zero. The agent sees that message and retries, so say which field is wrong and what is expected.
- Be deterministic. The same input and theme must give the same HTML; results are cached and the view is re-rendered from the stored input later. Do not read the clock, random numbers or the network.

### Entry template (`index.mjs`)

```js
import fs from 'node:fs';

const { input } = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
if (typeof input?.text !== 'string' || !input.text.trim()) {
	process.stderr.write('text is required and must be a non-empty string.');
	process.exit(1);
}
const escape = (value) =>
	value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);

process.stdout.write(`<!doctype html>
<html>
<head>
<style>
	body { margin: 0; padding: 16px; font: 14px system-ui; background: var(--background); color: var(--foreground); }
	.badge { display: inline-block; padding: 4px 12px; border-radius: 999px; background: var(--primary); color: var(--primary-foreground); }
</style>
</head>
<body>
<span class="badge">${escape(input.text)}</span>
<script>
	parent.postMessage({ type: 'kucedr:script-height', height: document.documentElement.scrollHeight }, '*');
</script>
</body>
</html>`);
```

### What the page can do

The HTML is shown in a sandboxed frame with scripts allowed and nothing else:

- No network. All JavaScript, CSS, fonts and images must be inline (`data:` URLs for images and fonts). A `fetch` or an external `<script src>` is blocked.
- The app injects its theme colours into `<head>` as CSS variables: `--background`, `--foreground`, `--card`, `--primary`, `--primary-foreground`, `--muted`, `--muted-foreground`, `--border`, `--ring` and the rest of the theme tokens, plus `color-scheme`. Style with these so the view matches light and dark mode. Include a `<head>` element.
- To resize the frame, post `{ type: 'kucedr:script-height', height }` to `parent`. The height is clamped to 80-2000.
- Always escape input before placing it in HTML.

### instructions.md

The agent loads this file with `load_script` before it calls `run_script`. Write it for that reader:

```markdown
# badge

Use when the user wants a status shown as a coloured label.

Input fields:

- `text`: required. The label, at most 40 characters.

Example:

{"text":"Passed"}
```

State when to use the script, every input field with type, limits and default, and one complete example input. Put the example in a `json` code fence.

## Hook scripts

### Contract

- stdin: one JSON event (below). stdout is ignored.
- A hook cannot change, block or fail a tool call or model call. A non-zero exit or a timeout is logged by the app and otherwise ignored.
- `PRE_*` hooks are awaited, so the agent waits for them: keep them fast. `POST_*` hooks run in the background.
- Every hook of a type runs for every event; there is no filter. Filter inside the script, for example on `toolName`.
- `metadata.instructions` is not needed. Add a `README.md` to the script folder that explains what the hook does and what it stores.

Tool events:

```json
{
	"event": "PRE_TOOL_USE",
	"agent": "chat",
	"runId": "...",
	"toolCallId": "...",
	"toolName": "bash",
	"tool": { "name": "bash", "description": "...", "category": "...", "source": { "kind": "builtin", "id": "bash" } },
	"input": { "command": "ls" },
	"settings": { "directory": "/path" }
}
```

`POST_TOOL_USE` adds `output` (the text the model sees), `isError` and `durationMs`. `agent` is `chat`, `tasks`, `health` or `voice`. For an MCP tool, `source` is `{ "kind": "mcp", "serverId", "toolName" }`.

Model-turn events carry `agent`, `agentId`, `runId`, `sessionId`, `model`, `estimatedInputTokens`, `messageCount` and `toolCount`. `POST_MODEL_TURN` adds `stopReason`, `usage`, `retryCount`, `durationMs`, `firstTokenLatencyMs`, `content` and `toolCalls`. Voice sessions send no model-turn events.

### Hook settings

Declare what the user must configure under `settings` in the script manifest:

```json
"settings": {
	"inputSchema": {
		"type": "object",
		"required": ["enabled", "directory"],
		"properties": {
			"enabled": { "type": "boolean", "title": "Enabled", "default": false },
			"directory": { "type": "string", "title": "Directory", "description": "Absolute folder for the log files." }
		}
	}
}
```

- Property types are `string` (text field) or `boolean` (switch, optional `default`). Other keys such as `title` and `description` are allowed.
- The user fills them in under Settings → Scripts → the script.
- Values reach the script as strings in `event.settings`; a boolean is `"true"` or `"false"`.
- The hook does not run while any `required` setting is empty or `"false"`. A required boolean with `"default": false` therefore makes the hook opt-in. Do this for every hook that records data.

### Entry template (`index.mjs`)

```js
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

let data = '';
process.stdin.on('data', (chunk) => (data += chunk));
process.stdin.on('end', () => {
	const { settings, ...event } = JSON.parse(data);
	mkdirSync(settings.directory, { recursive: true });
	appendFileSync(
		path.join(settings.directory, 'events.jsonl'),
		`${JSON.stringify({ time: new Date().toISOString(), ...event })}\n`
	);
});
```

Tool inputs and model content can contain private data. Tell the user exactly what a hook stores or sends, and where.

## Checks

With Node available, run each script by hand from its folder.

UI script:

```bash
cd <id>/scripts/<name>
echo '{"input":{"text":"Passed"},"theme":"light"}' | node index.mjs > ../../../out.html; echo "exit $?"
echo '{"input":{},"theme":"light"}' | node index.mjs; echo "exit $?"
```

The first must exit 0 and leave an HTML document in `out.html` beside the plugin folder; `read` it, then delete it. The second must print your error message and a non-zero exit. Do not leave test output inside the plugin folder.

Hook script: pipe a sample event with a `settings` object pointing at a scratch folder and confirm the side effect.

After install, the user finds the script under Settings → Scripts. For a `UI` script, ask them to request it in a new chat; you can then call `load_script` and `run_script` with its name.
