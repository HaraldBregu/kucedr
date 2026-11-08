# IPC and UI

## `window.plugins` (`src/preload/plugins.ts` → `src/main/ipc/plugins.ts`)

Every handler calls `TrustedRenderer.assert(event)` first. It only accepts the main frame of a known Kucedr window, so iframes and app/extension views are rejected.

| Method | Channel | Main side | Then |
|---|---|---|---|
| `list()` | `PluginsChannels.list` | `listPlugins()` | — |
| `available()` | `PluginsChannels.available` | `availablePlugins()` (fetches catalog) | — |
| `installCatalog(id)` | `PluginsChannels.installCatalog` | `installCatalogPlugin(id)` | `changed()` |
| `installUrl(url)` | `PluginsChannels.installUrl` | `downloadPlugin(url)` (no checksum) | `changed()` |
| `remove(id)` | `PluginsChannels.remove` | `removePlugin(id)` | `changed()` |
| `setEnabled(id, enabled)` | `PluginsChannels.setEnabled` | `setPluginEnabled()` | `changed()` |
| `getSettings(id)` | `PluginsChannels.getSettings` | `pluginSettings(id)` (secrets decrypted) | — |
| `saveSettings(id, values)` | `PluginsChannels.saveSettings` | checks the value map is all strings, then `savePluginSettings()` | `changed()` |

`changed()` = `refreshPlugins()` + `refreshProviderCatalog()` + broadcast `AppChannels.modelsChanged`. The same callback runs from the file watcher.

## `window.scripts` (`src/main/ipc/scripts.ts`)

| Method | Returns |
|---|---|
| `list()` | `PluginScriptInfo[]` for all types: name, title, description, type, author, version, category, inputSchema, fence, height, plugin |
| `render(name, input, theme)` | HTML string from `renderPluginScript()`; any theme other than `dark` is treated as `light` |

## Agent

`window.agent.listModes()` → `AgentModeInfo[]` (`src/main/ipc/agent.ts`). Chat requests send `options.modeIds`.

## Renderer surfaces

| Where | File(s) | Uses |
|---|---|---|
| Settings → Plugins (Installed, Available, Marketplace) | `pages/settings/pages/plugins/{Page,Installed,Available,Marketplace}.tsx` | list, available, installCatalog, setEnabled, remove |
| Plugin detail | `pages/settings/pages/plugins/{Plugin,Detail,Meta}.tsx` | settings form from `inputSchema`, enable, remove, contributions |
| Onboarding | `pages/start/components/SetupPluginsStep.tsx` | list, available, installCatalog |
| Settings → Apps / Skills / MCP / Scripts / Modes / Models / Services | `pages/settings/pages/*` | show the owning `plugin` for each item |
| Chat | `pages/home/components/PluginScriptCard.tsx`, `AssistantMessage.tsx` | script frames, mode envelopes and action buttons |
| Documents | `pages/workspace/CodeBlock.tsx`, `ScriptForm.tsx` | script fences |
| Prompt editor | `components/text-editor.tsx`, `mode-command` | slash commands → mode chips |

Renderer caches (`useModes`, `usePluginScripts`, model lists) are cleared on `window.app.onModelsChanged`.
