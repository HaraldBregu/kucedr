# services

Each folder here is one service the plugin offers. The folder name is the service id.

```
services/
  <id>/
    manifest.json
```

## manifest.json

| Field | Required | Description |
|---|---|---|
| `id` | yes | Must match the folder name. |
| `name` | yes | Name shown in Settings → Services. |
| `type` | yes | Where the app uses the service. One of: `SEARCH_ENGINE`. |
| `url` | yes | The service endpoint. |
| `authentication` | yes | How requests are authenticated, e.g. `api-key`. |
| `settings` | no | Values the user sets up before the service works. Each one has a `key`, a `label`, a `type` (`text` or `password`) and `required`. |
| `metadata` | no | Documentation links and the inputs the API accepts. |

Example:

```json
{
	"id": "web-search",
	"name": "Web Search",
	"type": "SEARCH_ENGINE",
	"url": "https://api.search.brave.com/res/v1/web/search",
	"authentication": "api-key",
	"settings": [{ "key": "apiKey", "label": "API key", "type": "password", "required": true }]
}
```
