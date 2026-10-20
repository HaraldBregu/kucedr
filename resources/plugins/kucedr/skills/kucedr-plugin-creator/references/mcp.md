# Creating MCP servers

MCP servers give the agent tools. A plugin can bundle **local servers**, which Kucedr starts as a
separate process speaking MCP over stdio. It can also point at **remote servers** over HTTP.
Remote services that belong to a provider (with sign-in and icons) go in the provider's
`mcp_servers` list instead; see `providers.md`.

Every plugin server starts switched off. The user turns it on in Settings → MCP servers, which saves
their own copy of its settings.

## Choose the form

| Form | Use for |
| --- | --- |
| `mcp/<server-id>/mcp.json` plus the server's files | one local server with its code |
| `mcp/servers.json` | several servers in one file, including remote `http` ones |

An id lives in one place only: a folder or a `servers.json` key, never both.

## Local server: steps

1. **Pick the server id:** lowercase kebab-case. Create `mcp/<server-id>/`.
2. **Write the server.** Use Node's standard library or a fully bundled build. Kucedr never runs
   `npm install`.
   - With dependencies, install them with `npm install --no-bin-links` (or add `bin-links=false` to
     the folder's `.npmrc`), because plugins can't contain symlinks.
   - Or bundle the server into one `.mjs` file.
3. **Write `mcp.json`** next to it (fields below).
4. **Run it by hand:** start the server with `node server.mjs` from its folder and send an
   `initialize` request on stdin. It should answer on stdout.
5. **Test in Kucedr:** install the plugin, turn the server on in Settings → MCP servers, open it,
   and press Test. Its tools should be listed.

## mcp.json

```json
{
	"id": "text-tools",
	"name": "Text Tools",
	"type": "stdio",
	"command": "node",
	"args": ["server.mjs"],
	"cwd": ".",
	"env": { "TEXT_TOOLS_LOCALE": "" },
	"require_approval": "always"
}
```

| Field | Meaning |
| --- | --- |
| `id` | optional; defaults to the folder name |
| `name` | label shown in Settings |
| `type` | `stdio` (the only type allowed in a folder) |
| `command` | required; the program to start, usually `node` |
| `args` | list of strings passed to the command |
| `cwd` | working directory, relative to the server folder (defaults to the folder) |
| `env` | string-to-string map. Leave secret values empty: the user fills them in Settings, and Kucedr stores them outside the plugin |
| `require_approval` | `always` (the user confirms each tool call) or `never`. Prefer `always` |
| `defer_loading` | `true` to load the tool list only when needed |
| `enabled` | ignored for plugin servers, which always start off |

## A dependency-free stdio server

MCP over stdio is JSON-RPC 2.0, one JSON message per line. This `server.mjs` is a complete
working server with one tool:

```js
import process from 'node:process';

const tools = [
	{
		name: 'word_count',
		description: 'Count the words in a text.',
		inputSchema: {
			type: 'object',
			properties: { text: { type: 'string', description: 'Text to count.' } },
			required: ['text'],
			additionalProperties: false,
		},
	},
];

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);

const callTool = (name, args) => {
	if (name !== 'word_count' || typeof args.text !== 'string') {
		return { content: [{ type: 'text', text: 'Expected word_count with a text string.' }], isError: true };
	}
	const count = args.text.trim() ? args.text.trim().split(/\s+/).length : 0;
	return { content: [{ type: 'text', text: String(count) }], structuredContent: { count } };
};

const handle = (message) => {
	if (message?.jsonrpc !== '2.0' || typeof message.method !== 'string' || message.id === undefined) return;
	if (message.method === 'initialize') {
		send({
			jsonrpc: '2.0',
			id: message.id,
			result: {
				protocolVersion: message.params?.protocolVersion ?? '2025-06-18',
				capabilities: { tools: { listChanged: false } },
				serverInfo: { name: 'text-tools', version: '1.0.0' },
			},
		});
	} else if (message.method === 'ping') {
		send({ jsonrpc: '2.0', id: message.id, result: {} });
	} else if (message.method === 'tools/list') {
		send({ jsonrpc: '2.0', id: message.id, result: { tools } });
	} else if (message.method === 'tools/call') {
		const args = message.params?.arguments;
		send({ jsonrpc: '2.0', id: message.id, result: callTool(message.params?.name, args && typeof args === 'object' ? args : {}) });
	} else {
		send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `Method not found: ${message.method}` } });
	}
};

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
	buffer += chunk;
	for (let newline = buffer.indexOf('\n'); newline >= 0; newline = buffer.indexOf('\n')) {
		const line = buffer.slice(0, newline).trim();
		buffer = buffer.slice(newline + 1);
		if (!line) continue;
		try {
			handle(JSON.parse(line));
		} catch {
			send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error.' } });
		}
	}
});
```

- Write only protocol messages to stdout. Send logs to stderr.
- Give every tool a clear `description` and a strict `inputSchema`, because the agent picks tools
  from these.
- Return errors as `isError: true` results rather than crashing.
- For anything bigger, use the official `@modelcontextprotocol/sdk` package and bundle it, or
  follow the `mcp-builder` skill.

Quick manual check:

```sh
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
	'{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node server.mjs
```

## servers.json

```json
{
	"text-tools": {
		"name": "Text Tools",
		"type": "stdio",
		"command": "node",
		"args": ["text-tools/server.mjs"],
		"require_approval": "always"
	},
	"deepwiki": {
		"name": "DeepWiki",
		"type": "http",
		"url": "https://mcp.deepwiki.com/mcp",
		"require_approval": "always"
	}
}
```

- Keys are server ids, and values use the same fields as `mcp.json`.
- `type: "http"` needs a `url`: https, or http on `localhost` or `127.0.0.1` only.
- A stdio entry's `cwd` and paths are relative to `mcp/`.
- OAuth sign-in isn't supported for remote plugin servers, so use servers that need no sign-in, or
  a key the user enters.

## Checklist

- Each id is lowercase kebab-case and appears once.
- Local servers start with only bundled files, and write nothing but protocol messages to stdout.
- No symlinks (`find mcp -type l` prints nothing).
- Secrets aren't stored in `mcp.json` or `servers.json`.
