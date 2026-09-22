import process from 'node:process';

const configuration = {
	company: process.env.DEMO_COMPANY?.trim() ?? '',
	currency: process.env.DEMO_CURRENCY?.trim() ?? '',
	taxRate: Number(process.env.DEMO_TAX_RATE),
	signOff: process.env.DEMO_SIGN_OFF?.trim() ?? '',
};

const tools = [
	{
		name: 'configuration_summary',
		description: 'Show the non-secret values supplied to this demo server through mcp.json.',
		inputSchema: { type: 'object', properties: {}, additionalProperties: false },
	},
	{
		name: 'create_quote',
		description: 'Create a sample quote using configured company, currency, and tax values.',
		inputSchema: {
			type: 'object',
			properties: {
				customer: { type: 'string', description: 'Customer name.' },
				item: { type: 'string', description: 'Product or service being quoted.' },
				quantity: { type: 'number', exclusiveMinimum: 0, description: 'Number of units.' },
				unitPrice: { type: 'number', minimum: 0, description: 'Price for one unit.' },
			},
			required: ['customer', 'item', 'quantity', 'unitPrice'],
			additionalProperties: false,
		},
	},
	{
		name: 'compose_customer_message',
		description: 'Compose a customer message using the configured company and sign-off.',
		inputSchema: {
			type: 'object',
			properties: {
				recipient: { type: 'string', description: 'Recipient name.' },
				subject: { type: 'string', description: 'Message subject.' },
				body: { type: 'string', description: 'Main message text.' },
			},
			required: ['recipient', 'subject', 'body'],
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

const configurationError = () => {
	const missing = [];
	if (!configuration.company) missing.push('DEMO_COMPANY');
	if (!configuration.currency) missing.push('DEMO_CURRENCY');
	if (!Number.isFinite(configuration.taxRate)) missing.push('DEMO_TAX_RATE');
	if (!configuration.signOff) missing.push('DEMO_SIGN_OFF');
	return missing.length > 0 ? `Missing or invalid server values: ${missing.join(', ')}` : undefined;
};

const callTool = (name, args) => {
	const invalidConfiguration = configurationError();
	if (invalidConfiguration) return toolError(invalidConfiguration);

	if (name === 'configuration_summary') {
		return {
			content: [
				{
					type: 'text',
					text: [
						`Company: ${configuration.company}`,
						`Currency: ${configuration.currency}`,
						`Tax rate: ${configuration.taxRate}%`,
						`Sign-off: ${configuration.signOff}`,
					].join('\n'),
				},
			],
			structuredContent: configuration,
		};
	}

	if (name === 'create_quote') {
		if (
			typeof args.customer !== 'string' ||
			typeof args.item !== 'string' ||
			typeof args.quantity !== 'number' ||
			typeof args.unitPrice !== 'number' ||
			!Number.isFinite(args.quantity) ||
			!Number.isFinite(args.unitPrice) ||
			args.quantity <= 0 ||
			args.unitPrice < 0
		) {
			return toolError('customer and item must be strings; quantity and unitPrice must be valid numbers.');
		}
		const subtotal = args.quantity * args.unitPrice;
		const tax = subtotal * (configuration.taxRate / 100);
		const total = subtotal + tax;
		const money = new Intl.NumberFormat('en', {
			style: 'currency',
			currency: configuration.currency,
		});
		return {
			content: [
				{
					type: 'text',
					text: [
						`# Quote from ${configuration.company}`,
						'',
						`Customer: ${args.customer}`,
						`Item: ${args.item}`,
						`Quantity: ${args.quantity}`,
						`Subtotal: ${money.format(subtotal)}`,
						`Tax (${configuration.taxRate}%): ${money.format(tax)}`,
						`Total: ${money.format(total)}`,
					].join('\n'),
				},
			],
			structuredContent: { subtotal, tax, total, currency: configuration.currency },
		};
	}

	if (name === 'compose_customer_message') {
		if (
			typeof args.recipient !== 'string' ||
			typeof args.subject !== 'string' ||
			typeof args.body !== 'string'
		) {
			return toolError('recipient, subject, and body must be strings.');
		}
		return {
			content: [
				{
					type: 'text',
					text: [
						`Subject: ${args.subject}`,
						'',
						`Hello ${args.recipient},`,
						'',
						args.body,
						'',
						`Regards,`,
						configuration.signOff,
						configuration.company,
					].join('\n'),
				},
			],
		};
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
				serverInfo: { name: 'kucedr-configured-demo', version: '1.0.0' },
				instructions: 'Demo tools using values supplied through the local MCP environment.',
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
