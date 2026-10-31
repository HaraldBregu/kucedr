# mcp

Each folder here is one MCP server the plugin offers. The folder name is the server id.

```
mcp/
  <id>/
    manifest.json   remote server, reached over HTTP
    mcp.json        local server, started as a process (use one or the other)
```

## manifest.json (remote server)

| Field | Required | Description |
|---|---|---|
| `id` | yes | Must match the folder name. Ids are shared across plugins, so keep them unique. |
| `name` | yes | Name shown in Settings. |
| `description` | no | One line about what the server does. |
| `url` | yes | The MCP endpoint. |
| `authentication` | yes | `oauth2`, `api-key` or `none`. |
| `scopes` | yes | OAuth scopes to request. Use `[]` when the server doesn't need any. |
| `oauth` | no | OAuth options: `client_id_setting`, `client_secret_setting`, `authorization_params`, `credentials_required`. Leave it out to let the app register itself with the server. |
| `icon_dark_url`, `icon_light_url` | no | `/assets/` paths. The plugin icon is used when they're missing. |

Example:

```json
{
	"id": "web-search",
	"name": "Web Search",
	"description": "Search, extract, crawl, and map the web with Tavily.",
	"authentication": "oauth2",
	"url": "https://mcp.tavily.com/mcp/",
	"scopes": []
}
```
