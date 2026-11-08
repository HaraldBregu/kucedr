# Script contributions (`scripts/`)

A script is a small Node program a plugin ships. It has one of two types (`PLUGIN_SCRIPT_TYPES`):

| Type | Runs | Purpose |
|---|---|---|
| `UI` (default) | `child_process.spawn` with Electron as Node, one run per render | Turns JSON input into a self-contained HTML document shown in chats and documents |
| `STORAGE` | `utilityProcess.fork`, one run per operation | Backs up and restores folders to cloud storage |

## Folder

```
scripts/<name>/
  manifest.json
  instructions.md      loaded by the agent through load_script
  dist/index.mjs       the entry (any relative path)
  src/, package.json   build sources; not read by the app
```

The folder name is the script `name` and must be kebab-case. Ship the **built** entry: the app runs it as-is and never installs dependencies or builds anything.

## Manifest

`readPluginScript()` (`src/main/plugins/scripts/plugin_script_read.ts`), strict schema:

| Field | Required | Rule |
|---|---|---|
| `title` | yes | Non-empty. |
| `description` | yes | 1–1024 chars. Shown to the agent in the Scripts list. |
| `author` | no | |
| `type` | no | `UI` (default) or `STORAGE`. |
| `metadata.version` | yes | Non-empty. Stored in the script ref. |
| `metadata.category` | yes | Non-empty, e.g. `data`, `sync`. |
| `metadata.entry` | yes | Relative path; file must exist. |
| `metadata.instructions` | yes | Relative path to a `.md` file; must exist. |
| `inputSchema` | no | `{ type: "object", … }`, any extra JSON Schema keys. Used by Settings and the document script form. |
| `fence` | no | Kebab-case code-fence language that renders this script in markdown. |
| `height` | no | Initial frame height, 80–2000, default 320. |

Example (`bootstrap/scripts/chart/manifest.json`, abridged):

```json
{
	"title": "Chart",
	"description": "Render bar, line, pie, … charts from data, with an optional title.",
	"type": "UI",
	"metadata": { "version": "1.0.0", "category": "data", "entry": "dist/index.mjs", "instructions": "instructions.md" },
	"inputSchema": { "type": "object", "required": ["type", "xKey", "series", "data"], "properties": { "…": {} } },
	"fence": "chart",
	"height": 320
}
```

`pluginScripts(type)` (`plugin_script_list.ts`) lists the scripts of enabled plugins. The first plugin to claim a name wins, and scripts that fail to read are skipped with a console warning.

## UI scripts

### Render contract

`renderPluginScript(name, input, theme)` (`plugin_script_render.ts`):

- runs `process.execPath <entry>` with `ELECTRON_RUN_AS_NODE=1`, cwd set to the script folder
- writes `{"input": …, "theme": "light" | "dark"}` to **stdin**
- expects a complete HTML document on **stdout** and exit code 0
- on a non-zero exit, rejects with stderr (or `exited with code N`). Scripts validate their input and write a clear message to stderr; the agent sees it and can fix the input.
- 10 s timeout, 2 MB output cap
- results are cached in memory by `(directory, name, input, theme)`. Failures are not cached.

Minimal entry:

```js
import fs from 'node:fs';
const { input, theme } = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
if (!input?.text) { process.stderr.write('text is required'); process.exit(1); }
process.stdout.write(`<!doctype html><html><body>${input.text}</body></html>`);
```

### Display

`PluginScriptFrame` (`src/renderer/src/components/plugin-script/Frame.tsx`):

- calls `window.scripts.render(name, input, theme)` and re-renders when the app theme changes
- `pluginScriptDocument()` (`document.ts`) adds, right after `<head>` (or at the top if there is no head):
  - a CSP: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https://tile.openstreetmap.org; font-src data:`
  - `:root { color-scheme; --<token>: <value>; … }` with the app's theme colors as CSS variables (`--background`, `--foreground`, `--ring`, …)
- shows the result in `<iframe sandbox="allow-scripts" srcdoc>`. There is no same-origin access and no network apart from OpenStreetMap tiles. All JS and CSS must be inlined.
- resizes the frame when the page posts `{ type: 'kucedr:script-height', height }` to its parent (clamped to 80–2000)

### Agent use

When at least one UI script is enabled:

- `addScriptsPrompt()` (`src/main/agent/system/system_add_scripts_prompt.ts`) adds a `# Scripts` section to the system prompt. It lists each script's name, title, description, fence, ref JSON, and instructions path, plus usage rules.
- `run_builtin_tools.ts` adds two read-only tools:
  - `load_script { name }` → returns `instructions.md`
  - `run_script { name, input }` → renders once (light theme) to validate, then returns `{ ok, shown, script: PluginScriptRef }`

The chat shows a `run_script` result as a `PluginScriptCard`, which renders the frame from the tool call's `name` and `input`.

### In markdown and documents

A fenced block whose language is a script's `fence` renders that script (`src/renderer/src/pages/workspace/CodeBlock.tsx`):

````markdown
```chart
{"script": {"name": "chart", "version": "1.0.0", "plugin": "bootstrap", "pluginVersion": "1.4.0"}, "input": { … }}
```
````

`script` is a `PluginScriptRef` (`src/shared/plugin_script_ref.ts`): which script and plugin version produced the block, kept so stored content can be migrated when scripts change.

## STORAGE scripts

`forkSync(operation)` (`src/main/storage/fork.ts`) takes the **first** `STORAGE` script (`pluginScripts('STORAGE')[0]`) and runs it with `utilityProcess.fork`. Contract:

- parent → child, one message: `{ operation: 'backup' | 'restore', provider, roots: [{ path, prefix }], protectedRoot }`
- child → parent, one message on `process.parentPort`: `{ result }` or `{ error: string }`
- the parent kills the child after the reply; an exit with no reply rejects

`protectedRoot` is the Kucedr data folder. The script must never read or write its settings, providers, or storage subfolders. Bundled implementation: `bootstrap/scripts/cloud-sync-s3`.

## Bundled scripts

`bootstrap/scripts`: `chart` (Recharts), `maps` (OpenStreetMap), `draw`, `dither`, `organui` (all `UI`), and `cloud-sync-s3` (`STORAGE`).
