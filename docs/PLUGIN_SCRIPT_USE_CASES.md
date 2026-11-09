# Plugin Script Use Cases

Status: planned. This extends [PLUGIN_SCRIPTS.md](PLUGIN_SCRIPTS.md).

## Context

Today the app decides where a script can be used from implicit signals:

- **`type: "UI" | "STORAGE"`** (`src/shared/plugin_types.ts`) mixes what a script *is* with where it *goes*.
- **Chat:** every `UI` script. `pluginScripts()` defaults to `'UI'` and feeds `load_script`, `run_script`, the `# Scripts` prompt and `run_builtin_tools.ts`.
- **Editor:** every `UI` script with a `fence`. `use-plugin-scripts.ts` builds `byFence`, which feeds the Toolbar's "Insert script" menu and `CodeBlock.tsx`.
- **Storage:** the first `STORAGE` script (`src/main/storage/fork.ts`). Settings pages also branch on `type === 'STORAGE'`.

So a script can't say "editor only" (for example a map for the workspace) or "chat only". Each script should declare explicitly where it can be used, in a single list:

```json
"useCases": ["CHAT", "EDITOR"]
```

- `CHAT`: the agent can call it through `load_script` and `run_script`, and it renders in the reply.
- `EDITOR`: it can be inserted into, and renders inside, workspace markdown documents as a fenced block.
- `STORAGE`: the cloud sync runner (`storage/fork.ts`) uses it.

`useCases` replaces `type`. `POST_TOOL` (rendering or processing after another tool's result) is left out until its behaviour is designed. Adding it later means adding one value to the list plus its consumer.

## Manifest contract

```json
{
	"title": "Maps",
	"description": "…",
	"useCases": ["CHAT", "EDITOR"],
	"metadata": { "version": "1.0.0", "category": "web", "entry": "dist/index.mjs", "instructions": "instructions.md" },
	"fence": "maps",
	"height": 320
}
```

Rules:

- `PLUGIN_SCRIPT_USE_CASES = ['CHAT', 'EDITOR', 'STORAGE'] as const` replaces `PLUGIN_SCRIPT_TYPES`, and `PluginScriptUseCase` replaces `PluginScriptType`.
- `useCases` is required and must be a non-empty array with unique values.
- `EDITOR` requires `fence`, because the editor needs a code-block language. Without one the manifest is invalid (a zod refine).
- **Legacy manifests:** already-installed remote plugins may still have `type`. When `useCases` is missing, `readPluginScript` derives it from `type`:
  - `STORAGE` → `["STORAGE"]`
  - `UI`, or no type → `["CHAT"]`, plus `"EDITOR"` if `fence` is set (today's behaviour)

  `type` is accepted only for this mapping and isn't part of the parsed result.

## Changes

1. **`src/shared/plugin_types.ts`:** add the use-case const and type. In `PluginScriptInfo`, replace `type` with `useCases: readonly PluginScriptUseCase[]`.
2. **`src/main/plugins/scripts/plugin_script_read.ts`:** add the `useCases` schema, the legacy `type` mapping and the `EDITOR` ⇒ `fence` refine.
3. **`src/main/plugins/scripts/plugin_script_list.ts`:** change the signature to `pluginScripts(useCase?: PluginScriptUseCase)`. With an argument it keeps only scripts whose `useCases` include it. Without one it returns all scripts.
4. **Main-process callers:**
   - `agent/tools/plugin/load.ts`, `agent/tools/plugin/run.ts`, `agent/runner/run_builtin_tools.ts` and `agent/system/system_build_prompt.ts` call `pluginScripts('CHAT')`.
   - `plugins/scripts/plugin_script_render.ts` looks the name up in `pluginScripts()` and refuses scripts with neither `CHAT` nor `EDITOR`. Chat and the editor both render through it, and storage scripts must never be rendered.
   - `storage/fork.ts` calls `pluginScripts('STORAGE')`.
   - `ipc/scripts.ts` returns `pluginScripts()` once (no more `flatMap` over types) and maps `useCases` instead of `type`.
5. **Renderer:**
   - `hooks/use-plugin-scripts.ts` keeps all scripts. `byName` holds the `CHAT` scripts (chat card), and `byFence` holds the `EDITOR` scripts (Toolbar menu, `CodeBlock.tsx`). This replaces the `type === 'UI'` filter.
   - Every `type === 'STORAGE'` check becomes `useCases.includes('STORAGE')`: `settings/pages/plugins/Plugin.tsx`, `settings/pages/scripts/Page.tsx`, `settings/pages/scripts/details/Page.tsx` and `settings/pages/cloud/Provider.tsx`.
   - `settings/pages/scripts/details/Page.tsx` gets a "Use cases" meta row next to `fence`, with an i18n key.
6. **Bundled manifests** (`resources/plugins/bootstrap/scripts/*/manifest.json`) replace `type`:
   - `chart`, `dither`, `draw`, `maps`, `organui`: `["CHAT", "EDITOR"]`, which matches today's behaviour. Narrow any of them, such as `maps` to `["EDITOR"]`, if wanted.
   - `backup-s3`: `["STORAGE"]`.
7. **`docs/PLUGIN_SCRIPTS.md`:** update the manifest example, the rules (`useCases`, `EDITOR` ⇒ `fence`, the legacy mapping) and the host sections.
8. **`packages/sdk` and the `kucedr-plugins` repo template:** replace any `type` field the same way.

## Verification

1. `npm run typecheck:app` and lint pass. Afterwards, `grep -rn "PluginScriptType\|PLUGIN_SCRIPT_TYPES\|\.type === 'UI'\|type === 'STORAGE'" src` finds nothing.
2. Run `npm run dev` and check:
   - The `# Scripts` prompt section lists only `CHAT` scripts.
   - The editor's "Insert script" menu lists only `EDITOR` scripts, and inserting `maps` renders a map.
   - Cloud sync backup still works.
3. Set `maps` to `["EDITOR"]`. It leaves the chat prompt and stays in the editor menu. Revert afterwards.
4. A manifest with `"useCases": ["EDITOR"]` and no `fence` is rejected at install, and skipped with a log line when scanned.
5. A legacy manifest with `"type": "UI"` and a `fence` still appears in both chat and the editor.
