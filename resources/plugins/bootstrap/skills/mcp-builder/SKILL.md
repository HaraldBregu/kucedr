---
name: mcp-builder
description: Build a local MCP (Model Context Protocol) server that runs over stdio and register it in Kucedr so its tools become available to the agent. Use when the user wants to give the agent a new tool backed by their own code, wrap a local program, file format or private API as MCP tools, add an existing stdio MCP server to Kucedr, or debug a local server that is not listed, will not start or shows no tools.
license: MIT
---

# MCP builder

You scaffold a small stdio MCP server in the user's Kucedr data folder, test it from the shell, and hand it to the user to switch on. Kucedr starts the server as a child process and talks to it over stdin and stdout.

## How Kucedr finds local servers

- User servers live in `~/.kucedr/mcp/servers/`. Each child folder with an `mcp.json` is one server. The folder name is the server id unless `mcp.json` sets `id`.
- A file `~/.kucedr/mcp/servers/servers.json` can declare several servers in one object keyed by id. Only entries in that file may use `"type": "http"` with a `url`.
- Ids are lowercase letters, digits and single hyphens. Two servers with the same id in that folder is an error shown in Settings. A server the user added through Settings with the same id wins, and the folder is ignored.
- A folder that has `manifest.json` but no `mcp.json` is skipped. Do not put a `manifest.json` in a local server folder.
- A new local server is listed but **off**. Writing `"enabled": true` in `mcp.json` does not start it: the user must turn it on in Settings → MCP servers. Never edit `~/.kucedr/mcp/settings.json` or `tools.json`; the app owns them.
- The agent sees each tool as `mcp__<server-id>__<tool-name>`. Names longer than 64 characters are shortened with a hash, so keep ids and tool names short.

## Step 1: Agree on the tools

Ask the user (with `ask` when available) until you can list, for each tool:

- a name in `snake_case` and one sentence on what it does;
- its inputs with types, and which are required;
- what it returns;
- whether it only reads, or changes something (files, a remote service).

Prefer a few task-shaped tools ("search_invoices") over many thin wrappers. If the user needs secrets such as an API key, note the variable names now; step 5 covers where they go.

## Step 2: Check the runtime

The template below needs Node.js 18 or newer and no packages.

```bash
command -v node && node --version
```

If Node is missing, stop and tell the user to install it; do not install it yourself. If the user prefers another language, check that interpreter the same way and port the template: the protocol in step 4 is all the server has to speak.

Record the absolute path that `command -v node` prints. Use it as `command` in step 5. Kucedr starts servers with the app's own environment, which may not include the shell `PATH`, so a bare `node` can fail to start.

## Step 3: Create the folder

Pick the id, then make sure it is free:

```bash
ls ~/.kucedr/mcp/servers 2>/dev/null
```

Create `~/.kucedr/mcp/servers/<id>/` by writing the two files below with `write`. If the folder exists, read it and ask before changing anything.

## Step 4: Write server.mjs

Replace the example tool with the agreed ones. Keep the rest unchanged.

```js
import { createInterface } from 'node:readline';

const tools = [
	{
		name: 'add',
		description: 'Add two numbers and return the sum.',
		inputSchema: {
			type: 'object',
			properties: { a: { type: 'number' }, b: { type: 'number' } },
			required: ['a', 'b'],
		},
		annotations: { readOnlyHint: true },
		run: async ({ a, b }) => String(a + b),
	},
];

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);

async function handle({ method, params }) {
	if (method === 'initialize') {
		return {
			protocolVersion: params.protocolVersion,
			capabilities: { tools: {} },
			serverInfo: { name: '<id>', version: '1.0.0' },
		};
	}
	if (method === 'ping') return {};
	if (method === 'tools/list') return { tools: tools.map(({ run, ...tool }) => tool) };
	if (method === 'tools/call') {
		const tool = tools.find((entry) => entry.name === params.name);
		if (!tool) throw { code: -32602, message: `Unknown tool: ${params.name}` };
		try {
			const text = await tool.run(params.arguments ?? {});
			return { content: [{ type: 'text', text }] };
		} catch (error) {
			return { content: [{ type: 'text', text: String(error?.message ?? error) }], isError: true };
		}
	}
	throw { code: -32601, message: `Method not found: ${method}` };
}

createInterface({ input: process.stdin }).on('line', async (line) => {
	if (!line.trim()) return;
	const request = JSON.parse(line);
	if (request.id === undefined) return;
	try {
		send({ jsonrpc: '2.0', id: request.id, result: await handle(request) });
	} catch (error) {
		send({
			jsonrpc: '2.0',
			id: request.id,
			error: { code: error?.code ?? -32603, message: String(error?.message ?? error) },
		});
	}
});
```

Rules for tool code:

- stdout carries protocol messages only: one JSON object per line. Never `console.log`; write diagnostics with `console.error`.
- `run` returns a string. Return JSON as `JSON.stringify(value)`. Keep results short; cap lists and say when you truncated.
- Validate inputs inside `run` and throw an `Error` with a message that tells the caller how to fix the call. It is returned as a tool error, not a crash.
- Set `annotations: { readOnlyHint: true }` only on tools that change nothing. Kucedr runs those without asking; every other tool asks the user first.
- Read secrets from `process.env`. Never hard-code them.
- Take file paths from the tool input as absolute paths. Kucedr starts the process with the server folder as its working directory, so only files shipped beside `server.mjs` may be opened by relative path.

## Step 5: Write mcp.json

```json
{
	"name": "<Display name>",
	"command": "<absolute path to node>",
	"args": ["server.mjs"]
}
```

Fields Kucedr accepts:

| Field | Rule |
|---|---|
| `command` | Required non-empty string. |
| `args` | Array of strings. |
| `cwd` | String, resolved against the server folder. Defaults to the server folder, so `server.mjs` above resolves correctly. |
| `env` | Object of string values. Read the note on secrets below before using it. |
| `name` | Display name in Settings. |
| `id` | Overrides the folder name. Leave it out. |
| `type` | Only `"stdio"`, the default. Leave it out. |
| `require_approval` | `"always"` asks before every tool; `"never"` asks for none. Leave it out to ask only for tools without `readOnlyHint`. Do not set `"never"` unless the user asks for it. |
| `defer_loading` | Boolean. |
| `enabled` | Boolean. Has no effect until the user turns the server on. |

On Windows, write the command path with forward slashes or doubled backslashes so the JSON stays valid.

Secrets: do not write API keys into `mcp.json`; the file is plain text. Leave `env` out, and tell the user to open the server in Settings → MCP servers and add the environment variables there. Kucedr then stores them encrypted and passes them to the process. Have each tool fail with a clear message, for example `Set EXAMPLE_API_KEY in Settings → MCP servers → <name>`, when a variable is missing.

## Step 6: Test from the shell

Run the server by hand and feed it the handshake, a tool listing and one call per tool:

```bash
cd ~/.kucedr/mcp/servers/<id> && printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"check","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"add","arguments":{"a":2,"b":3}}}' \
  | node server.mjs
```

Expect exactly three lines of JSON: the `initialize` result, the tool list, and a `content` result without `isError`. Also send one call with bad arguments and confirm it returns `isError: true` with a useful message. Fix and rerun until all of this holds. Check that `mcp.json` parses:

```bash
node -e "JSON.parse(require('fs').readFileSync('mcp.json','utf8'))" && echo ok
```

Use the `bash` tool for these. If a tool changes real data, test it against a throwaway target or ask the user first.

## Step 7: Hand over

You cannot switch the server on. Tell the user to:

1. Open Settings → MCP servers. The server is listed among the local servers; a problem with `mcp.json` shows as a red notice there with the reason.
2. Turn it on, open it, and press **Test**. It lists the tools the server reported.
3. Set per-tool permissions on that page if they want something other than the defaults.
4. Ask for the tools in a chat. If they do not appear, start a new chat.

Also tell them the folder path, the tools you built, and any environment variables they must enter.

## Troubleshooting

| Symptom | Check |
|---|---|
| Not listed | Folder is directly under `~/.kucedr/mcp/servers/` and contains `mcp.json`, not `manifest.json`. |
| "mcp.json is not valid JSON" | Trailing commas, comments, single backslashes in Windows paths. |
| "Server ID must use lowercase letters, numbers, and single hyphens" | Rename the folder. |
| "Local server at ... is ignored" | A server with the same id was added through Settings. Pick another id or have the user remove that one. |
| Test fails or times out (15 seconds) | `command` is not an absolute path, the script prints non-JSON to stdout, or it exits on start. Rerun step 6. |
| Tools listed but calls fail | Missing environment variable, or `run` did not return a string. |
