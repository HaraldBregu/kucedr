import path from 'node:path';
import { callTool } from '../../../../src/main/mcp/mcp_client_call_tool';
import { close } from '../../../../src/main/mcp/mcp_client_close';
import { connect } from '../../../../src/main/mcp/mcp_client_connect';
import { listTools } from '../../../../src/main/mcp/mcp_client_list_tools';
import { readLocalMcpServer } from '../../../../src/main/mcp/mcp_local_read';
import type { McpClient } from '../../../../src/main/mcp/mcp_types';

const directory = path.resolve('resources/mcp/resend');
const resend = readLocalMcpServer(directory);

describe('resend MCP server', () => {
	let client: McpClient;

	beforeAll(async () => {
		client = await connect(resend.id, resend.data, 5_000);
	});

	afterAll(async () => {
		await close(client);
	});

	it('is configured with an empty API key placeholder', () => {
		expect(resend).toMatchObject({
			id: 'resend',
			data: {
				type: 'stdio',
				command: 'node',
				args: ['--experimental-strip-types', 'src/index.ts'],
				cwd: directory,
				env: {
					RESEND_API_BASE_URL: '',
					RESEND_API_KEY: '',
				},
			},
		});
		expect(resend.data.type === 'stdio' ? resend.data.env?.RESEND_API_KEY : undefined).toBe('');
	});

	it('publishes the send email tool', async () => {
		const result = await listTools(client, 5_000);
		const sendEmail = result.tools.find((tool) => tool.name === 'send_email');

		expect(result.tools.map((tool) => tool.name)).toEqual(['send_email']);
		expect(sendEmail?.inputSchema.required).toEqual(['from', 'to', 'subject']);
		expect(sendEmail?.inputSchema.properties).toEqual(
			expect.objectContaining({
				from: expect.objectContaining({ type: 'string' }),
				to: expect.objectContaining({ anyOf: expect.any(Array) }),
				subject: expect.objectContaining({ type: 'string' }),
				idempotency_key: expect.objectContaining({ type: 'string' }),
			})
		);
	});

	it('requires the client to provide RESEND_API_KEY', async () => {
		const result = await callTool(client, 'send_email', {
			from: 'Acme <onboarding@example.com>',
			to: 'delivered@example.com',
			subject: 'Hello',
			text: 'It works',
		});

		expect(result).toMatchObject({
			isError: true,
			content: [{ type: 'text', text: 'Missing RESEND_API_KEY environment variable.' }],
		});
	});
});
