# Plugin Tools

Status: implemented. It replaces the built-in charts described in [CHARTS.md](CHARTS.md). The example chart tool ships in the **bootstrap** plugin of the `kucedr-plugins` repo (`plugins/bootstrap/tools/chart/`, entry `index.mjs`) instead of a built-in `resources/plugins/charts`. Tool names must equal their folder name.

## Context

Kucedr should not build charts or any other renderer itself. Plugins provide tools instead:

- Each plugin can have a `tools/` folder with one folder per tool.
- Each tool brings its own **instructions**, which go into the system prompt.
- The agent has **one common tool, `run_plugin_tool`**, that runs any plugin tool by name.
- Since there can be many plugin tools, the system prompt explains clearly how to choose and call them.
- A tool's Node script returns HTML+JS, which Kucedr frames in the chat reply and in the workspace editor.

The built-in charts (the `create_chart` tool, Recharts, the Chart toolbar action) are removed. We ship one example plugin, `charts`.

What already exists:

- `PLUGIN_KINDS` (`src/shared/plugin_types.ts`) drives `pluginContents()` (`plugins_contents.ts`) and `pluginDirs(kind)` (`plugins_dirs.ts`) generically.
- `validatePluginContents()` checks each kind at install time.
- `buildSystemPrompt()` (`src/main/agent/system/system_build_prompt.ts`) composes `add*Prompt` sections.
- The editor's ```` ```chart ```` node view (`pages/workspace/CodeBlock.tsx`) and the chat tool-card branch in `AssistantMessage.tsx`.

## Tool folder contract: `<plugin>/tools/<tool-id>/`

```text
manifest.json     title, author, version, entry, input schema (same shape as an app manifest)
INSTRUCTIONS.md   when and how the agent should use it, with input examples (goes into the system prompt)
package.json      a normal Node.js project: devDependencies and a "build" script (no install scripts)
src/              sources, built into dist/
dist/             build output; metadata.entry points here (gitignored, built in CI before release)
```

`manifest.json`:

```json
{
	"title": "Chart",
	"description": "Render bar, line, area, pie or doughnut charts from data.",
	"author": "Harald Bregu",
	"metadata": { "version": "1.0.0", "category": "data", "entry": "dist/index.mjs" },
	"inputSchema": {
		"type": "object",
		"properties": { "...": "..." },
		"required": ["type", "title", "data", "xKey", "series"]
	},
	"fence": "chart",
	"height": 320
}
```

Rules:

- **Name:** the folder name is the tool name, as with apps. It must be kebab-case and unique across all enabled plugins. A duplicate is skipped and logged.
- **Fields:** `title`, `description`, `metadata.version`, `metadata.category` and `metadata.entry` are required. `author` is optional, as for apps.
- **Build:** in the `kucedr-plugins` repo every tool is an npm workspace (`plugins/*/tools/*`), so dependencies install in the root `node_modules`. `npm run build` at the root builds all tools, and CI runs it before validating and releasing. Kucedr never runs `npm install` or a build: it only runs `metadata.entry`.
- **Running the script:** the host runs `entry` on Electron's Node, using `process.execPath` with `ELECTRON_RUN_AS_NODE=1`, so users don't need Node installed.
  - The working directory is the tool folder, there's a 10 s timeout and stdout is capped at 2 MB.
  - On invalid input the script exits non-zero with a clear message on stderr. That message is what the agent sees, so it can correct the input.
- **Self-contained HTML:** the output must inline its own JS and CSS, because the host frames it with no network access.
- **Determinism:** the same input and theme must give the same HTML. Chat and the editor re-render from the stored input, so HTML is never saved in history or sent to the model.
- **`fence`:** optional. It names the code-block language this tool renders inside markdown files.
- **`INSTRUCTIONS.md`:** required, 4 KB max. It should say when to use the tool, explain the input fields, and give 1–3 example inputs.

## The agent: one common tool plus clear instructions

### `run_plugin_tool`

New file `src/main/agent/tools/plugin/run.ts`, built with the `tool()` factory.

- Input: `{ name: string, input: object }`, with `name` described as "one of the tools listed under External tools".
- `run`:
  1. Look up `name`. An unknown name is an error that lists the valid names.
  2. Call `renderPluginTool(name, input, 'light')` to make sure the input renders.
  3. Return `{ ok: true, shown: "<title> displayed to the user" }`. The model never sees the HTML.
- `category: 'integration'`, `planSafe: true`. Add it to the `READ` set in `execution/capability.ts`.
- Register it in `builtinTools()`, and only when at least one plugin tool is enabled. Add it to `requiredIds` in `run_stream.ts` so it's always loaded and never needs `tool_search`.

### System prompt section

New file `src/main/agent/system/system_add_plugin_tools_prompt.ts`, called from `buildSystemPrompt()` only when plugin tools exist:

````text
## External tools
External tools come from installed plugins. Each one renders a visual result (for example a chart) directly in the user's view.
- Call them only through run_plugin_tool with {"name": "<tool name>", "input": {...}}. Never call a tool name directly.
- Pick the tool whose "Use when" matches the request. If none matches, answer normally without a tool.
- Build input that matches the tool's input schema exactly. Use only real data from the conversation or tool results; never invent values.
- The result is shown to the user automatically. Do not repeat it as text or a table; add at most a one-line summary.
- If run_plugin_tool returns an error, fix the input using the error message and retry once, then report the problem.
- To put a tool's output into a markdown file, write a fenced code block whose language is the tool's fence and whose body is the same input JSON.

### chart (Charts plugin)
Render bar, line, area, pie or doughnut charts from data.
Fence: chart
Input schema: ```json {…} ```
<INSTRUCTIONS.md content>
````

## Example plugin: `resources/plugins/charts/`

It's built in and can be disabled.

- `manifest.json`: schemaVersion 5, id `charts`, title "Charts".
- `tools/chart/tool.json`: as above. The input schema is the current `create_chart` schema, with `type` extended to `bar`, `line`, `area`, `pie` and `doughnut`.
- `tools/chart/INSTRUCTIONS.md`:
  - Use it for trends over time (line or area), comparisons across categories (bar) and shares of a whole (pie or doughnut).
  - Explain `xKey` and `series`.
  - Give three example inputs: a bar chart with one series, a line chart with two series, and a pie chart.
- `tools/chart/index.js`: about 60 lines.
  - Read stdin and validate the required fields (a non-zero exit with a message on error).
  - Map `type` to a Chart.js config. `area` is a line chart with `fill: true`.
  - Choose a palette and text and grid colors per `theme`.
  - Print `<!doctype html>` with the Chart.js source inlined from `chart.umd.js`, a canvas, and `new Chart(…)`.
- `tools/chart/chart.umd.js`: copied from `chart.js/dist/chart.umd.js` (MIT), so no build step is needed.

## Host: main process

- **`plugin_types.ts`**: add `'tools'` to `PLUGIN_KINDS`.
- **`src/main/plugins/tools/`** (new, one function per file):
  - `plugin_tool_read.ts`: zod validation of `tool.json`, plus reading `INSTRUCTIONS.md` and checking its size.
  - `plugin_tool_list.ts`: `pluginTools()` reads every enabled plugin's tools through `pluginDirs('tools')`, skipping duplicate names.
  - `plugin_tool_render.ts`: `renderPluginTool(name, input, theme)` spawns the script as described above and caches results in memory by name, input and theme.
- **`plugins_validate_contents.ts`**: for each `tools/<id>`, `tool.json` and `INSTRUCTIONS.md` must be valid and `entry` must exist.
- **IPC** (channel definitions, preload and `src/main/ipc/plugins.ts`):
  - `plugins:tools` returns `{ name, title, fence?, height, plugin }[]`.
  - `plugins:render-tool(name, input, theme)` returns HTML.
  - The renderer refetches the list on the existing plugins-changed broadcast.

## Host: renderer

- **`components/plugin-tool/Frame.tsx` (new)**: `<PluginToolFrame name input />`.
  - It calls `plugins:render-tool` with the current theme and renders `<iframe sandbox="allow-scripts" srcdoc={html}>` at the tool's `height`.
  - It prepends a CSP meta tag: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:`.
  - It shows a `Skeleton` while loading and the error text on failure.
- **`hooks/usePluginTools.ts` (new)**: lookups `byName` and `byFence`.
- **Chat**: `ChartCard.tsx` becomes `PluginToolCard.tsx`. In `AssistantMessage.tsx`, the branch becomes `tool.type === 'run_plugin_tool'`, and the card renders `<PluginToolFrame name={input.name} input={input.input} />`. The skeleton-while-streaming and error-fallback behaviour stays.
- **Editor**: `CodeBlock.tsx` looks up `byFence.get(language)` and renders `<PluginToolFrame>` with the parsed JSON. Click-to-edit and the invalid-JSON message stay.

## Remove

- **Main:** `src/main/agent/tools/chart/create.ts`, its registration, its `capability.ts` and `requiredIds` entries, and the chart line in `system_add_base_prompt.ts`.
- **Renderer:** `components/chart/`, `components/ui/chart.tsx`, the `recharts` dependency, and the Chart toolbar action.

## Files touched

- New:
  - `resources/plugins/charts/**`
  - `src/main/plugins/tools/*`
  - `src/main/agent/tools/plugin/run.ts`
  - `system_add_plugin_tools_prompt.ts`
  - `components/plugin-tool/Frame.tsx`
  - `hooks/usePluginTools.ts`
- Changed:
  - `plugin_types.ts`, `plugins_validate_contents.ts`
  - `system_build_prompt.ts`, `run_builtin_tools.ts`, `run_stream.ts`, `capability.ts`
  - the IPC, preload and channel files
  - `AssistantMessage.tsx`, `ChartCard.tsx` → `PluginToolCard.tsx`, `CodeBlock.tsx`, `Toolbar.tsx`
  - `docs/PLUGINS.md` (adds `tools` to the kinds table)

## Skipped

- **Auto-height frames.** Fixed `height` for now.
- **Interactive tools that call back into the app.**
- **Per-tool permissions in Settings.** Disabling the plugin turns its tools off.
- **Sandboxing the Node script.** It has the same trust as a plugin's stdio MCP servers.
- **Host-side JSON-schema validation.** The script validates and reports errors.

## Verification

1. Settings → Plugins should show **Charts** (built-in, enabled). The system prompt (debug log) should contain `## External tools` with the `chart` entry and its instructions.
2. **Chat:**
   - "bar chart of 10,20,15,30 for Jan–Apr", "line chart of revenue and cost by quarter: …", "pie chart of market share: …". Each should produce `run_plugin_tool` with `name: "chart"` and render in a frame.
   - Switch themes: the charts should re-render. Reload: they should still render.
3. **Bad input:** a call with a missing `xKey` should return the script's error, and the agent should retry once with fixed input.
4. **Editor:** a ```` ```chart ```` block should render through the same tool. Edit the JSON and it re-renders; the saved file changes only where you edited.
5. **Disable the plugin:** `run_plugin_tool` and the External tools section should both disappear, and ```` ```chart ```` blocks should show as code. Enable it again and they come back with no restart.
6. **Sandbox:** a `fetch` from inside the frame should be blocked by the CSP.
7. Run `npm run typecheck:app` and lint.
