import process from 'node:process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';

type ToolResult = {
	content: Array<{ type: 'text'; text: string }>;
	isError?: boolean;
	structuredContent?: Record<string, unknown>;
};

const apiBaseUrl = (process.env.RESEND_API_BASE_URL?.trim() || 'https://api.resend.com').replace(
	/\/$/,
	''
);

const sendEmailToolSchema = z
	.object({
		from: z
			.string()
			.describe('Sender email address, optionally formatted as "Name <sender@example.com>".'),
		to: z
			.union([z.string(), z.array(z.string()).min(1)])
			.describe('Recipient email address or addresses.'),
		subject: z.string().describe('Email subject.'),
		html: z.string().optional().describe('HTML body.'),
		text: z.string().optional().describe('Plain text body.'),
		cc: z
			.union([z.string(), z.array(z.string()).min(1)])
			.optional()
			.describe('CC recipient address or addresses.'),
		bcc: z
			.union([z.string(), z.array(z.string()).min(1)])
			.optional()
			.describe('BCC recipient address or addresses.'),
		reply_to: z
			.union([z.string(), z.array(z.string()).min(1)])
			.optional()
			.describe('Reply-To address or addresses.'),
		headers: z.record(z.unknown()).optional().describe('Custom email headers.'),
		attachments: z.array(z.unknown()).optional().describe('Resend attachment objects.'),
		tags: z.array(z.unknown()).optional().describe('Resend tag objects.'),
		template: z.record(z.unknown()).optional().describe('Published Resend template object.'),
		scheduled_at: z.string().optional().describe('Scheduled send time.'),
		idempotency_key: z
			.string()
			.optional()
			.describe('Optional Resend idempotency key for this request.'),
	})
	.check((value) => {
		if (!value.html && !value.text && !value.template) {
			return false;
		}
		if (value.template && (value.html || value.text)) {
			return false;
		}
		if (Array.isArray(value.to) && value.to.length > 50) {
			return false;
		}
		return true;
	});

const toolError = (message: string): ToolResult => ({
	content: [{ type: 'text', text: message }],
	isError: true,
});

const errorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : 'Unable to reach the Resend API.';

const sendPayload = (args: z.infer<typeof sendEmailToolSchema>): Record<string, unknown> => {
	const payload: Record<string, unknown> = {
		from: args.from,
		to: args.to,
		subject: args.subject,
	};
	for (const key of [
		'html',
		'text',
		'cc',
		'bcc',
		'reply_to',
		'headers',
		'attachments',
		'tags',
		'template',
		'scheduled_at',
	]) {
		const value = args[key as keyof typeof args];
		if (value !== undefined) payload[key] = value;
	}
	return payload;
};

const sendEmail = async (args: z.infer<typeof sendEmailToolSchema>): Promise<ToolResult> => {
	const apiKey = process.env.RESEND_API_KEY?.trim();
	if (!apiKey) return toolError('Missing RESEND_API_KEY environment variable.');

	const headers: Record<string, string> = {
		Authorization: `Bearer ${apiKey}`,
		'Content-Type': 'application/json',
	};
	if (args.idempotency_key) headers['Idempotency-Key'] = args.idempotency_key;

	const response = await fetch(`${apiBaseUrl}/emails`, {
		method: 'POST',
		headers,
		body: JSON.stringify(sendPayload(args)),
	}).catch((error: unknown) => error);
	if (!(response instanceof Response)) return toolError(errorMessage(response));

	const responseBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
	if (!response.ok) {
		const detail =
			typeof responseBody.message === 'string'
				? responseBody.message
				: `Resend API returned HTTP ${response.status}.`;
		return {
			content: [{ type: 'text', text: detail }],
			isError: true,
			structuredContent: { status: response.status, response: responseBody },
		};
	}

	const id = typeof responseBody.id === 'string' ? responseBody.id : undefined;
	return {
		content: [{ type: 'text', text: id ? `Email sent: ${id}` : 'Email sent.' }],
		structuredContent: responseBody,
	};
};

function createServer(): McpServer {
	const server = new McpServer({ name: 'resend', version: '1.0.0' });

	server.registerTool(
		'send_email',
		{
			title: 'Send one email through Resend',
			description: 'Send one email through the Resend API.',
			inputSchema: sendEmailToolSchema,
		},
		async (args) => sendEmail(args)
	);

	server.registerResource(
		'about',
		'resend://about',
		{
			title: 'About this server',
			description: 'Local MCP server to send email through Resend.',
			mimeType: 'text/plain',
		},
		async (uri) => ({
			contents: [
				{
					uri: uri.href,
					text: 'Resend MCP server. Tool: send_email(from, to, subject, html?, text?, cc?, bcc?, reply_to?, headers?, attachments?, tags?, template?, scheduled_at?, idempotency_key?).',
				},
			],
		})
	);

	return server;
}

const server = createServer();
void server.connect(new StdioServerTransport());

console.error('Resend MCP server running on stdio.');
