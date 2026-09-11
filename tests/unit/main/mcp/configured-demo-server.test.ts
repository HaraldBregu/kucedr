import path from 'node:path';
import { callTool } from '../../../../src/main/mcp/mcp_client_call_tool';
import { close } from '../../../../src/main/mcp/mcp_client_close';
import { connect } from '../../../../src/main/mcp/mcp_client_connect';
import { listTools } from '../../../../src/main/mcp/mcp_client_list_tools';
import { readLocalMcpServer } from '../../../../src/main/mcp/mcp_local_read';
import type { McpClient } from '../../../../src/main/mcp/mcp_types';

const directory = path.resolve('resources/mcp/configured-demo-server');
const demo = readLocalMcpServer(directory);

describe('configured demo MCP server', () => {
	let client: McpClient;

	beforeAll(async () => {
		client = await connect(demo.id, demo.data, 5_000);
	});

	afterAll(async () => {
		await close(client);
	});

	it('loads the required server values from its manifest', () => {
		expect(demo).toMatchObject({
			id: 'kucedr-configured-demo',
			data: {
				type: 'stdio',
				env: {
					DEMO_COMPANY: 'Kucedr Studio',
					DEMO_CURRENCY: 'EUR',
					DEMO_TAX_RATE: '22',
					DEMO_SIGN_OFF: 'The Kucedr Studio team',
				},
			},
		});
	});

	it('publishes tools with required call-time inputs', async () => {
		const result = await listTools(client, 5_000);
		expect(result.tools.map((tool) => tool.name)).toEqual([
			'configuration_summary',
			'create_quote',
			'compose_customer_message',
		]);
		expect(result.tools.find((tool) => tool.name === 'create_quote')?.inputSchema.required).toEqual(
			['customer', 'item', 'quantity', 'unitPrice']
		);
	});

	it('uses server values together with tool inputs', async () => {
		const configuration = await callTool(client, 'configuration_summary');
		const quote = await callTool(client, 'create_quote', {
			customer: 'Ada Lovelace',
			item: 'Consulting hour',
			quantity: 2,
			unitPrice: 100,
		});
		const message = await callTool(client, 'compose_customer_message', {
			recipient: 'Ada',
			subject: 'Your quote',
			body: 'Your requested quote is ready.',
		});

		expect(configuration.content).toEqual([
			expect.objectContaining({ text: expect.stringContaining('Company: Kucedr Studio') }),
		]);
		expect(quote.structuredContent).toEqual({
			subtotal: 200,
			tax: 44,
			total: 244,
			currency: 'EUR',
		});
		expect(message.content).toEqual([
			expect.objectContaining({ text: expect.stringContaining('The Kucedr Studio team') }),
		]);
	});
});
