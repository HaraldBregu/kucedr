import path from 'node:path';
import { callTool } from '../../../../src/main/mcp/mcp_client_call_tool';
import { close } from '../../../../src/main/mcp/mcp_client_close';
import { connect } from '../../../../src/main/mcp/mcp_client_connect';
import { listTools } from '../../../../src/main/mcp/mcp_client_list_tools';
import { readLocalMcpServer } from '../../../../src/main/mcp/mcp_local_read';
import type { McpClient } from '../../../../src/main/mcp/mcp_types';

const directory = path.resolve('resources/mcp/gmail-smtp');
const gmail = readLocalMcpServer(directory);

describe('gmail smtp MCP server', () => {
	let client: McpClient;

	beforeAll(async () => {
		client = await connect(gmail.id, gmail.data, 5_000);
	});

	afterAll(async () => {
		await close(client);
	});

	it('is configured with empty SMTP credential placeholders', () => {
		expect(gmail).toMatchObject({
			id: 'gmail-smtp',
			data: {
				type: 'stdio',
				command: 'node',
				args: ['--experimental-strip-types', 'src/index.ts'],
				cwd: directory,
				env: {
					GMAIL_SMTP_HOST: '',
					GMAIL_SMTP_PORT: '',
					GMAIL_SMTP_SECURE: '',
					GMAIL_SMTP_USER: '',
					GMAIL_SMTP_PASSWORD: '',
				},
			},
		});
		expect(gmail.data.type === 'stdio' ? gmail.data.env?.GMAIL_SMTP_USER : undefined).toBe('');
		expect(gmail.data.type === 'stdio' ? gmail.data.env?.GMAIL_SMTP_PASSWORD : undefined).toBe('');
	});

	it('publishes the send email tool over MCP', async () => {
		const result = await listTools(client, 5_000);
		const sendEmail = result.tools.find((tool) => tool.name === 'send_email');

		expect(result.tools.map((tool) => tool.name)).toEqual(['send_email']);
		expect(sendEmail?.inputSchema.required).toEqual(['from', 'to', 'subject']);
		expect(sendEmail?.inputSchema.properties).toEqual(
			expect.objectContaining({
				from: expect.objectContaining({ type: 'string' }),
				to: expect.objectContaining({ anyOf: expect.any(Array) }),
				subject: expect.objectContaining({ type: 'string' }),
				text: expect.objectContaining({ type: 'string' }),
				html: expect.objectContaining({ type: 'string' }),
			})
		);
	});

	it('requires the client to provide Gmail SMTP credentials', async () => {
		const result = await callTool(client, 'send_email', {
			from: 'Sender <sender@example.com>',
			to: 'recipient@example.com',
			subject: 'Hello',
			text: 'It works',
		});

		expect(result).toMatchObject({
			isError: true,
			content: [
				{
					type: 'text',
					text: 'Missing or invalid environment variables: GMAIL_SMTP_USER, GMAIL_SMTP_PASSWORD',
				},
			],
		});
	});
});
