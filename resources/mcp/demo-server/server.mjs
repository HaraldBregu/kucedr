import process from 'node:process';

const tools = [
	{
		name: 'echo',
		description: 'Return a message unchanged. Useful for testing MCP connectivity.',
		inputSchema: {
			type: 'object',
			properties: { message: { type: 'string', description: 'Message to return.' } },
			required: ['message'],
			additionalProperties: false,
		},
	},
	{
		name: 'add_numbers',
		description: 'Add two finite numbers and return the result.',
		inputSchema: {
			type: 'object',
			properties: {
				a: { type: 'number', description: 'First number.' },
				b: { type: 'number', description: 'Second number.' },
			},
			required: ['a', 'b'],
			additionalProperties: false,
		},
	},
	{
		name: 'create_checklist',
		description: 'Format a title and list of items as a Markdown checklist.',
		inputSchema: {
			type: 'object',
			properties: {
				title: { type: 'string', description: 'Checklist heading.' },
				items: {
					type: 'array',
					description: 'Checklist entries.',
					items: { type: 'string' },
					minItems: 1,
				},
			},
			required: ['title', 'items'],
			additionalProperties: false,
		},
	},
];

const send = (message) => {
	process.stdout.write(`${JSON.stringify(message)}\n`);
};

const toolError = (message) => ({
	content: [{ type: 'text', text: message }],
	isError: true,
});

const callTool = (name, args) => {
	if (name === 'echo') {
		return typeof args.message === 'string'
			? { content: [{ type: 'text', text: args.message }] }
			: toolError('message must be a string.');
	}

	if (name === 'add_numbers') {
		return typeof args.a === 'number' &&
			typeof args.b === 'number' &&
			Number.isFinite(args.a) &&
			Number.isFinite(args.b)
			? {
					content: [{ type: 'text', text: String(args.a + args.b) }],
					structuredContent: { result: args.a + args.b },
				}
			: toolError('a and b must be finite numbers.');
	}

	if (name === 'create_checklist') {
		if (
			typeof args.title !== 'string' ||
			!Array.isArray(args.items) ||
			args.items.length === 0 ||
			args.items.some((item) => typeof item !== 'string')
		) {
			return toolError('title must be a string and items must be a non-empty string array.');
		}
		const checklist = [`## ${args.title}`, '', ...args.items.map((item) => `- [ ] ${item}`)].join(
			'\n'
		);
		return { content: [{ type: 'text', text: checklist }] };
	}

	return toolError(`Unknown tool: ${name}`);
};

const handle = (message) => {
	if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
		if (message?.id !== undefined) {
			send({ jsonrpc: '2.0', id: message.id, error: { code: -32600, message: 'Invalid request.' } });
		}
		return;
	}
	if (message.id === undefined) return;

	if (message.method === 'initialize') {
		send({
			jsonrpc: '2.0',
			id: message.id,
			result: {
				protocolVersion: message.params?.protocolVersion ?? '2025-06-18',
				capabilities: { tools: { listChanged: false } },
				serverInfo: { name: 'kucedr-demo', version: '1.0.0' },
				instructions: 'Harmless demo tools for testing Kucedr MCP integration.',
			},
		});
		return;
	}

	if (message.method === 'ping') {
		send({ jsonrpc: '2.0', id: message.id, result: {} });
		return;
	}

	if (message.method === 'tools/list') {
		send({ jsonrpc: '2.0', id: message.id, result: { tools } });
		return;
	}

	if (message.method === 'tools/call') {
		const name = message.params?.name;
		const args = message.params?.arguments;
		send({
			jsonrpc: '2.0',
			id: message.id,
			result: callTool(typeof name === 'string' ? name : '', args && typeof args === 'object' ? args : {}),
		});
		return;
	}

	send({
		jsonrpc: '2.0',
		id: message.id,
		error: { code: -32601, message: `Method not found: ${message.method}` },
	});
};

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
	buffer += chunk;
	let newline = buffer.indexOf('\n');
	while (newline >= 0) {
		const line = buffer.slice(0, newline).replace(/\r$/, '');
		buffer = buffer.slice(newline + 1);
		if (line.trim()) {
			try {
				handle(JSON.parse(line));
			} catch {
				send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error.' } });
			}
		}
		newline = buffer.indexOf('\n');
	}
});
