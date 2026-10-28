# Plugin Scripts

Status: implemented. It replaces the built-in charts described in [CHARTS.md](CHARTS.md). The example chart script ships in the bundled **bootstrap** plugin (`resources/plugins/bootstrap/scripts/chart/`) instead of a built-in `resources/plugins/charts`. It's a Node.js project: `src/browser.jsx` renders the chart with Recharts (React 19) and is bundled to `dist/browser.js` (about 650 KB), and `src/index.mjs` (built to `dist/index.mjs`) inlines that bundle into each chart page. The `chart-script` plugin in `electron.vite.config.ts` builds both on `npm run dev` and `npm run build`.

## Context

Kucedr should not build charts or any other renderer itself. Plugins provide scripts instead:

- Each plugin can have a `scripts/` folder with one folder per script.
- Script usage instructions live in a separate skill and its references, loaded on demand.
- The agent has **one common tool, `run_plugin_script`**, that runs any plugin script by name.
- The default system prompt contains no script catalog, instructions, or input schemas. Bootstrap provides the `run-scripts` skill to choose and call its scripts.
- A script's Node entry returns HTML+JS, which Kucedr frames in the chat reply and in the workspace editor.

The built-in charts (the `create_chart` tool, Recharts, the Chart toolbar action) are removed. The bootstrap plugin ships `chart`, `dither`, and `organui`, documented by its `run-scripts` skill.

What already exists:

- `PLUGIN_KINDS` (`src/shared/plugin_types.ts`) drives `pluginContents()` (`plugins_contents.ts`) and `pluginDirs(kind)` (`plugins_dirs.ts`) generically.
- `validatePluginContents()` checks each kind at install time.
- `buildSystemPrompt()` (`src/main/agent/system/system_build_prompt.ts`) composes `add*Prompt` sections.
- The editor's ```` ```chart ```` node view (`pages/workspace/CodeBlock.tsx`) and the chat tool-card branch in `AssistantMessage.tsx`.

## Script folder contract: `<plugin>/scripts/<script-id>/`

```text
manifest.json     title, description, author, metadata, fence, height
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
	"fence": "chart",
	"height": 320
}
```

Rules:

- **Name:** the folder name is the script name, as with apps. It must be kebab-case and unique across all enabled plugins. A duplicate is skipped and logged.
- **Fields:** `title`, `description`, `metadata.version`, `metadata.category` and `metadata.entry` are required. `author` is optional, as for apps.
- **Build:** every script is an npm workspace (here `resources/plugins/bootstrap/scripts/chart`; in the `kucedr-plugins` repo `plugins/*/scripts/*`), so dependencies install in the root `node_modules`. Kucedr never runs `npm install` or a build at runtime: it only runs `metadata.entry`.
- **Running the script:** the host runs `metadata.entry` on Electron's Node, using `process.execPath` with `ELECTRON_RUN_AS_NODE=1`, so users don't need Node installed.
  - The working directory is the script folder, there's a 10 s timeout and stdout is capped at 2 MB.
  - On invalid input the script exits non-zero with a clear message on stderr. That message is what the agent sees, so it can correct the input.
- **Self-contained HTML:** the output must inline its own JS and CSS, because the host frames it with no network access.
- **Determinism:** the same input and theme must give the same HTML. Chat and the editor re-render from the stored input, so HTML is never saved in history or sent to the model.
- **`fence`:** optional. It names the code-block language this script renders inside markdown files.
- **Usage:** document script selection, input fields, limits, and examples in a plugin skill and its references. Script manifests do not need an `inputSchema`; existing schemas remain accepted for installed plugins but are never added to the prompt.

## The agent: one common tool plus an on-demand skill

### `run_plugin_script`

`src/main/agent/tools/plugin/run.ts`, built with the `tool()` factory.

- Input: `{ name: string, input: object }`. The loaded skill documents the script names and their inputs.
- `run`:
  1. Look up `name`. An unknown name is an error that lists the valid names.
  2. Call `renderPluginScript(name, input, 'light')` to make sure the input renders.
  3. Return `{ ok: true, shown: "<title> displayed to the user" }`. The model never sees the HTML.
- `category: 'integration'`, `planSafe: true`. It's in the `READ` set in `execution/capability.ts`.
- Registered in `builtinTools()` only when at least one plugin script is enabled, and listed in `requiredIds` in `run_stream.ts` so it's always loaded and never needs `tool_search`.

### Skill loading

`resources/plugins/bootstrap/skills/run-scripts/SKILL.md` routes requests to `chart`, `dither`, or `organui`. Each script has a separate reference documenting its input and examples. Read only the reference for the chosen script.

Select the skill or explicitly ask to use it, for example "Use the run-scripts skill to chart these values." The existing `list_skills` / `load_skill` flow discovers and activates it. Its instructions enter the protected loaded-skill context for the run, and references are read only when needed. Ordinary chart requests do not automatically activate skills under the current explicit-invocation policy.

`buildSystemPrompt()` does not read plugin scripts or append a `Plugin scripts` section. The shared `run_plugin_script` tool remains available when scripts are enabled.

## Example: `resources/plugins/bootstrap/scripts/chart/`

- `manifest.json`: runtime and display metadata, as above.
- `skills/run-scripts/references/chart.md`:
  - Use it for trends over time (line or area), comparisons across categories (bar) and shares of a whole (pie or doughnut).
  - Explain `xKey` and `series`.
  - Give example inputs.
- `package.json`: devDependencies `recharts`, `react`, `react-dom` and `esbuild`. The `build` script bundles both sources into `dist/`.
- `src/browser.jsx`: defines `window.renderChart(element, input, palette)`. It renders a Recharts chart inside a `ResponsiveContainer`, with animations off. It's bundled as a minified IIFE to `dist/browser.js`.
- `src/index.mjs`, built to `dist/index.mjs`:
  - Read stdin and validate the required fields (a non-zero exit with a message on error).
  - Choose the series colors, plus text, grid and tooltip colors, per `theme`.
  - Print `<!doctype html>` with the title, `dist/browser.js` inlined, and `renderChart(…)` called with the input and palette.

## Host: main process

- **`plugin_types.ts`**: `'scripts'` is in `PLUGIN_KINDS`.
- **`src/main/plugins/scripts/`** (one function per file):
  - `plugin_script_read.ts`: zod validation of `manifest.json` and checking that its entry exists.
  - `plugin_script_list.ts`: `pluginScripts()` reads every enabled plugin's scripts through `pluginDirs('scripts')`, skipping duplicate names.
  - `plugin_script_render.ts`: `renderPluginScript(name, input, theme)` spawns the script as described above and caches results in memory by name, input and theme.
- **`plugins_validate_contents.ts`**: for each `scripts/<id>`, `manifest.json` must be valid and `metadata.entry` must exist.
- **IPC** (channel definitions, preload and `src/main/ipc/plugins.ts`):
  - `plugins:scripts` returns `{ name, title, author?, version, category, fence?, height, plugin }[]`.
  - `plugins:render-script(name, input, theme)` returns HTML.
  - The renderer refetches the list on the existing models-changed broadcast.

## Host: renderer

- **`components/plugin-script/Frame.tsx`**: `<PluginScriptFrame script input />`.
  - It calls `plugins:render-script` with the current theme and renders `<iframe sandbox="allow-scripts" srcdoc={html}>` at the script's `height`.
  - It prepends a CSP meta tag (`components/plugin-script/document.ts`): `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:`.
  - It shows a `Skeleton` while loading and the error text on failure.
- **`hooks/use-plugin-scripts.ts`**: `usePluginScripts()` with lookups `byName` and `byFence`.
- **Chat**: `PluginScriptCard.tsx`. In `AssistantMessage.tsx`, the branch is `tool.type === 'run_plugin_script'`, and the card renders `<PluginScriptFrame script={…} input={input.input} />`. The skeleton-while-streaming and error-fallback behaviour stays.
- **Editor**: `CodeBlock.tsx` looks up `byFence.get(language)` and renders `<PluginScriptFrame>` with the parsed JSON. Click-to-edit and the invalid-JSON message stay.

## Skipped

- **Auto-height frames.** Fixed `height` for now.
- **Interactive scripts that call back into the app.**
- **Per-script permissions in Settings.** Disabling the plugin turns its scripts off.
- **Sandboxing the Node script.** It has the same trust as a plugin's stdio MCP servers.
- **Host-side JSON-schema validation.** The script validates and reports errors.

## Verification

1. Settings → Plugins should show **Bootstrap** (built-in, enabled). The default system prompt (debug log) should contain no `## Plugin scripts` section or per-script input schemas.
2. **Chat:** select `run-scripts` or explicitly ask to use that skill, then try:
   - "bar chart of 10,20,15,30 for Jan–Apr", "line chart of revenue and cost by quarter: …", "pie chart of market share: …". Each should produce `run_plugin_script` with `name: "chart"` and render in a frame.
   - Switch themes: the charts should re-render. Reload: they should still render.
3. **Bad input:** a call with a missing `xKey` should return the script's error, and the agent should retry once with fixed input.
4. **Editor:** a ```` ```chart ```` block should render through the same script. Edit the JSON and it re-renders; the saved file changes only where you edited.
5. **Disable the plugin:** `run_plugin_script` and the Bootstrap skills should disappear from discovery, and ```` ```chart ```` blocks should show as code. Enable it again and they come back with no restart.
6. **Sandbox:** a `fetch` from inside the frame should be blocked by the CSP.
7. Run `npm run typecheck:app` and lint.
