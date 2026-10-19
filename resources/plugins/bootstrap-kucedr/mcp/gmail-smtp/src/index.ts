import process from 'node:process';
import net from 'node:net';
import tls from 'node:tls';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';

type ToolResult = {
	content: Array<{ type: 'text'; text: string }>;
	isError?: boolean;
	structuredContent?: Record<string, unknown>;
};

type SmtpConfig = {
	host: string;
	port: number;
	secure: boolean;
	user: string;
	password: string;
};

const toolsSchema = z
	.object({
		from: z.string().describe('Sender email address.'),
		to: z
			.union([z.string(), z.array(z.string()).min(1)])
			.describe('Recipient email address or addresses.'),
		subject: z.string().describe('Email subject.'),
		text: z.string().optional().describe('Plain text body.'),
		html: z.string().optional().describe('HTML body.'),
		cc: z
			.union([z.string(), z.array(z.string()).min(1)])
			.optional()
			.describe('CC recipient address or addresses.'),
		bcc: z
			.union([z.string(), z.array(z.string()).min(1)])
			.optional()
			.describe('BCC recipient address or addresses.'),
		reply_to: z.string().optional().describe('Reply-To address.'),
	})
	.check((value) => {
		return Boolean(value.text || value.html);
	});

const toolError = (message: string): ToolResult => ({
	content: [{ type: 'text', text: message }],
	isError: true,
});

const asArray = (value: string | string[] | undefined): string[] =>
	value === undefined ? [] : Array.isArray(value) ? value : [value];

const smtpConfig = (): SmtpConfig | string => {
	const host = process.env.GMAIL_SMTP_HOST?.trim() || 'smtp.gmail.com';
	const port = Number(process.env.GMAIL_SMTP_PORT?.trim() || '587');
	const secure = process.env.GMAIL_SMTP_SECURE?.trim().toLowerCase() === 'true';
	const user = process.env.GMAIL_SMTP_USER?.trim() || '';
	const password = process.env.GMAIL_SMTP_PASSWORD || '';
	const missing: string[] = [];
	if (!user) missing.push('GMAIL_SMTP_USER');
	if (!password) missing.push('GMAIL_SMTP_PASSWORD');
	if (!Number.isInteger(port) || port <= 0) missing.push('GMAIL_SMTP_PORT');
	return missing.length > 0
		? `Missing or invalid environment variables: ${missing.join(', ')}`
		: { host, port, secure, user, password };
};

const address = (value: string): string => {
	const match = value.match(/<([^<>]+)>/);
	return (match?.[1] ?? value).trim();
};

const base64 = (value: string): string => Buffer.from(value, 'utf8').toString('base64');

const normalizeNewlines = (value: string): string => value.replace(/\r?\n/g, '\r\n');

const headerValue = (value: string): string => value.replace(/\r?\n/g, ' ').trim();

const encodedSubject = (value: string): string => `=?UTF-8?B?${base64(value)}?=`;

const messageBody = (args: z.infer<typeof toolsSchema>): string => {
	const boundary = `kucedr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
	const headers = [
		`From: ${headerValue(args.from)}`,
		`To: ${asArray(args.to as string | string[])
			.map(headerValue)
			.join(', ')}`,
		...asArray(args.cc as string | string[] | undefined).map((cc) => `Cc: ${headerValue(cc)}`),
		typeof args.reply_to === 'string' ? `Reply-To: ${headerValue(args.reply_to)}` : undefined,
		`Subject: ${encodedSubject(args.subject)}`,
		'MIME-Version: 1.0',
	].filter((line): line is string => typeof line === 'string');

	if (typeof args.text === 'string' && typeof args.html === 'string') {
		return normalizeNewlines(
			[
				...headers,
				`Content-Type: multipart/alternative; boundary="${boundary}"`,
				'',
				`--${boundary}`,
				'Content-Type: text/plain; charset=UTF-8',
				'Content-Transfer-Encoding: 8bit',
				'',
				args.text,
				`--${boundary}`,
				'Content-Type: text/html; charset=UTF-8',
				'Content-Transfer-Encoding: 8bit',
				'',
				args.html,
				`--${boundary}--`,
				'',
			].join('\n')
		);
	}

	const contentType = typeof args.html === 'string' ? 'text/html' : 'text/plain';
	return normalizeNewlines(
		[
			...headers,
			`Content-Type: ${contentType}; charset=UTF-8`,
			'Content-Transfer-Encoding: 8bit',
			'',
			(typeof args.html === 'string' ? args.html : args.text) as string,
			'',
		].join('\n')
	);
};

class SmtpSession {
	private socket: net.Socket | tls.TLSSocket;
	private buffer = '';
	private readonly config: SmtpConfig;

	constructor(config: SmtpConfig) {
		this.config = config;
		this.socket = config.secure
			? tls.connect({ host: config.host, port: config.port, servername: config.host })
			: net.connect({ host: config.host, port: config.port });
		this.socket.setEncoding('utf8');
		this.socket.on('data', (chunk: string) => {
			this.buffer += chunk;
		});
	}

	close() {
		this.socket.end();
	}

	async send(command: string, expected: number | number[]): Promise<string> {
		this.socket.write(`${command}\r\n`);
		return this.read(expected);
	}

	async read(expected: number | number[]): Promise<string> {
		const allowed = Array.isArray(expected) ? expected : [expected];
		const response = await this.readResponse();
		const code = Number(response.slice(0, 3));
		if (!allowed.includes(code)) throw new Error(response);
		return response;
	}

	async upgrade(): Promise<void> {
		this.socket = tls.connect({ socket: this.socket, servername: this.config.host });
		this.socket.setEncoding('utf8');
		this.socket.on('data', (chunk: string) => {
			this.buffer += chunk;
		});
		await new Promise<void>((resolve, reject) => {
			this.socket.once('secureConnect', resolve);
			this.socket.once('error', reject);
		});
	}

	private async readResponse(): Promise<string> {
		for (;;) {
			const response = this.completeResponse();
			if (response) return response;
			await new Promise<void>((resolve, reject) => {
				const done = () => {
					this.socket.off('data', done);
					this.socket.off('error', fail);
					resolve();
				};
				const fail = (error: Error) => {
					this.socket.off('data', done);
					this.socket.off('error', fail);
					reject(error);
				};
				this.socket.once('data', done);
				this.socket.once('error', fail);
			});
		}
	}

	private completeResponse(): string | undefined {
		const lines = this.buffer.split(/\r?\n/);
		if (lines.length < 2) return undefined;
		for (let index = 0; index < lines.length - 1; index += 1) {
			if (/^\d{3} /.test(lines[index])) {
				const response = lines.slice(0, index + 1).join('\n');
				this.buffer = lines.slice(index + 1).join('\n');
				return response;
			}
		}
		return undefined;
	}
}

const sendSmtpEmail = async (
	config: SmtpConfig,
	args: z.infer<typeof toolsSchema>
): Promise<void> => {
	const session = new SmtpSession(config);
	try {
		await session.read(220);
		await session.send(`EHLO ${config.host}`, 250);
		if (!config.secure) {
			await session.send('STARTTLS', 220);
			await session.upgrade();
			await session.send(`EHLO ${config.host}`, 250);
		}
		await session.send('AUTH LOGIN', 334);
		await session.send(base64(config.user), 334);
		await session.send(base64(config.password), 235);
		await session.send(`MAIL FROM:<${address(args.from)}>`, 250);
		for (const recipient of [
			...asArray(args.to as string | string[]),
			...asArray(args.cc as string | string[] | undefined),
			...asArray(args.bcc as string | string[] | undefined),
		]) {
			await session.send(`RCPT TO:<${address(recipient)}>`, [250, 251]);
		}
		await session.send('DATA', 354);
		await session.send(`${messageBody(args)}\r\n.`, 250);
		await session.send('QUIT', 221).catch(() => undefined);
	} finally {
		session.close();
	}
};

const sendEmail = async (args: z.infer<typeof toolsSchema>): Promise<ToolResult> => {
	const config = smtpConfig();
	if (typeof config === 'string') return toolError(config);
	try {
		await sendSmtpEmail(config, args);
		return {
			content: [{ type: 'text', text: 'Email sent.' }],
			structuredContent: { host: config.host, port: config.port, secure: config.secure },
		};
	} catch (error) {
		return toolError(
			error instanceof Error ? error.message : 'Unable to send email through Gmail SMTP.'
		);
	}
};

function createServer(): McpServer {
	const server = new McpServer({ name: 'gmail-smtp', version: '1.0.0' });

	server.registerTool(
		'send_email',
		{
			title: 'Send email through Gmail SMTP',
			description: 'Send one email through Gmail SMTP.',
			inputSchema: toolsSchema,
		},
		async (args: z.infer<typeof toolsSchema>) => sendEmail(args)
	);

	server.registerResource(
		'about',
		'gmail://about',
		{
			title: 'About this server',
			description: 'Local MCP server to send email through Gmail SMTP.',
			mimeType: 'text/plain',
		},
		async (uri) => ({
			contents: [
				{
					uri: uri.href,
					text: 'Gmail SMTP MCP server. Tool: send_email(from, to, subject, text?, html?, cc?, bcc?, reply_to?).',
				},
			],
		})
	);

	return server;
}

const server = createServer();
void server.connect(new StdioServerTransport());

console.error('Gmail SMTP MCP server running on stdio.');
