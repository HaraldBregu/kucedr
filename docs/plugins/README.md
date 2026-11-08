# Plugins

A plugin is a folder with a `manifest.json` and one or more **contribution folders**. It can add AI providers (models, search services, remote MCP servers), windowed apps, local MCP servers, agent skills, render scripts, and agent modes. The app has no separate extension API: each contribution kind is read by the subsystem that already handles that kind (the app list, the MCP registry, the skills registry, and so on), and that subsystem simply gets the enabled plugins' folders added to the roots it searches.

This folder describes how plugins work in the current code.

| Doc | Covers |
|---|---|
| [manifest.md](manifest.md) | Folder layout, the `manifest.json` schema, contribution kinds |
| [loading.md](loading.md) | Discovery, bundled vs user plugins, precedence, caching, file watching, enable/disable |
| [install.md](install.md) | Catalog, download, archive install, validation, removal, safety checks |
| [settings.md](settings.md) | Per-plugin settings and encrypted secrets |
| [providers.md](providers.md) | `models/`, `services/`, `mcp/<id>/manifest.json` and the provider catalog |
| [apps.md](apps.md) | `apps/`: windowed and extension apps |
| [mcp.md](mcp.md) | `mcp/`: local stdio servers and `servers.json` |
| [skills.md](skills.md) | `skills/`: agent skills |
| [scripts.md](scripts.md) | `scripts/`: `UI` render scripts and `STORAGE` sync scripts |
| [modes.md](modes.md) | `modes/`: agent modes (`/plan`, `/goal`) |
| [ipc.md](ipc.md) | Main ↔ renderer API and the Settings UI |
| [bundled.md](bundled.md) | The plugins that ship in `resources/plugins/` |

## How it fits together

```
resources/plugins/<id>/     (bundled, read-only, ship with the app)
~/.kucedr/plugins/<id>/     (user-installed)
        │
        ▼
scanPlugins()  ── readPlugin() per folder: manifest schema, icons, links,
        │         models/services/mcp → provider, contribution ids
        ▼
cached ScannedPlugin[]  (reset by refreshPlugins(); fs.watch on both roots)
        │
        ├─ listPlugins()        → Settings → Plugins (PluginInfo)
        ├─ pluginProviders()    → provider catalog (src/main/models.ts)
        └─ pluginDirs(kind)     → <plugin>/<kind> folders of enabled plugins
                 ├─ apps    → src/main/apps/app_list.ts, app_plugin_directory.ts
                 ├─ mcp     → src/main/mcp/mcp_local_root.ts, mcp_server_roots.ts
                 ├─ skills  → src/main/agent/skills/skills_registry.ts, skills_list.ts
                 ├─ scripts → src/main/plugins/scripts/plugin_script_list.ts
                 └─ modes   → src/main/agent/modes/list.ts
```

Code lives in:

- `src/shared/plugin_manifest.ts`, `src/shared/plugin_types.ts` — schema and shared types
- `src/main/plugins/` — scanning, reading, install, remove, enable, settings, scripts
- `src/main/ipc/plugins.ts`, `src/main/ipc/scripts.ts`, `src/preload/plugins.ts` — IPC
- `src/renderer/src/pages/settings/pages/plugins/` — Settings UI
- `src/main/agent/modes/` — mode loading and runtime policy
