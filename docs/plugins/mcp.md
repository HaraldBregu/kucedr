# Local MCP server contributions (`mcp/`)

`mcp/` holds two kinds of server:

| Shape | Kind | Read by |
|---|---|---|
| `mcp/<id>/manifest.json` (no `mcp.json`) | Remote server, part of the plugin's provider | `readPluginMcpServers()`, see [providers.md](providers.md) |
| `mcp/<id>/mcp.json` | Local server started as a process | the local MCP registry |
| `mcp/servers.json` | Several local servers keyed by id | the local MCP registry |

## Discovery roots

`mcpLocalDiscoveryRoots()` (`src/main/mcp/mcp_local_root.ts`) and `mcpServerRoots()` (`mcp_server_roots.ts`) return:

1. `~/.kucedr/mcp/servers` (user)
2. `<plugin>/mcp` for each enabled plugin with MCP contributions

`listLocalMcpServers(roots)` (`mcp_local_list.ts`) walks each root once. Folders are read in name order, then `servers.json` entries. The first server per id across roots wins. Two servers with the same id inside one root is an error. Errors become `diagnostics`, which install-time validation treats as fatal.

## `mcp.json` / `servers.json` entry

Parsed by `parseLocalMcpServer()` (`mcp_local_parse.ts`):

| Field | Rule |
|---|---|
| `id` | Optional; defaults to the folder name or the `servers.json` key. Lowercase kebab-case. |
| `type` | `stdio` (default). `http` is allowed only in `servers.json` entries, and then needs `url`. |
| `command` | Required for stdio. |
| `args` | String array. |
| `env` | String → string object. |
| `cwd` | String. |
| `name` | Display name. |
| `require_approval` | `always` or `never`. |
| `enabled` | Boolean. |
| `defer_loading` | Boolean. |

```json
// mcp/servers.json
{
	"files": { "command": "node", "args": ["server.mjs"] },
	"docs": { "type": "http", "url": "https://example.com/mcp" }
}
```

## Plugin servers start disabled

`pluginServerDisabled()` (`mcp_plugin_disabled.ts`) uses `pluginOwner(server.path)` to tag each plugin server with its `plugin` and force `enabled: false`. Enabling one in Settings → MCP saves the user's own copy of its config, so a plugin can't start a process until the user turns it on.
