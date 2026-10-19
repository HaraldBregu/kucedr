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
				serverInfo: { name: 'example-text-tools', version: '1.0.0' },
			},
		});
	} else if (message.method === 'ping') {
		send({ jsonrpc: '2.0', id: message.id, result: {} });
	} else if (message.method === 'tools/list') {
		send({ jsonrpc: '2.0', id: message.id, result: { tools } });
	} else if (message.method === 'tools/call') {
		const name = message.params?.name;
		const args = message.params?.arguments;
		send({ jsonrpc: '2.0', id: message.id, result: callTool(name, args && typeof args === 'object' ? args : {}) });
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
