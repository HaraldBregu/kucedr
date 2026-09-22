const testMcpServer = jest.fn();

jest.mock('../../../../src/main/mcp', () => ({
	configureLocalMcpServer: jest.fn(),
	createOAuthProvider: jest.fn(),
	deleteMcpServer: jest.fn(),
	getMcpOauth: jest.fn(() => ({})),
	getMcpServers: jest.fn(() => ({})),
	importLocalMcpServers: jest.fn(),
	listConfiguredMcpServers: jest.fn(() => ({})),
	listMcpRegistry: jest.fn(() => []),
	mcpLocalRoot: jest.fn(() => '/mcp'),
	saveMcpOauth: jest.fn(),
	setMcpServers: jest.fn(),
	startOauthCallbackServer: jest.fn(),
	testMcpServer,
	upsertMcpServer: jest.fn(),
}));

jest.mock('@modelcontextprotocol/sdk/client/auth.js', () => ({ auth: jest.fn() }));

import { BrowserWindow, ipcMain, shell } from 'electron';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import {
	createOAuthProvider,
	getMcpServers,
	getMcpOauth,
	startOauthCallbackServer,
} from '../../../../src/main/mcp';
import { McpChannels } from '../../../../src/shared/ipc_channels_definitions';
import { McpIpc } from '../../../../src/main/ipc/mcp';

const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

afterAll(() => {
	if (originalGoogleClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
	else process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
	if (originalGoogleClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
	else process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
});

describe('MCP IPC', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('rejects app views before testing a server', async () => {
		const mainFrame = {};
		const mainSender = { id: 21, mainFrame };
		const appFrame = {};
		const appSender = { id: 22, mainFrame: appFrame };
		const window = { id: 1, webContents: mainSender };
		jest
			.mocked(BrowserWindow.fromWebContents)
			.mockImplementation((sender) => (sender === mainSender ? (window as never) : null));
		const windows = { has: (id: number) => id === window.id };
		const apps = { has: (sender: unknown) => sender === appSender };
		new McpIpc().register({ windows, apps } as never, {} as never);

		const handler = jest
			.mocked(ipcMain.handle)
			.mock.calls.find(([channel]) => channel === McpChannels.test)?.[1] as (
			event: unknown,
			id: string
		) => Promise<{ success: boolean }>;

		await expect(
			handler({ sender: appSender, senderFrame: appFrame } as never, 'unsafe')
		).resolves.toMatchObject({ success: false });
		expect(testMcpServer).not.toHaveBeenCalled();

		await expect(
			handler({ sender: mainSender, senderFrame: mainFrame } as never, 'safe')
		).resolves.toMatchObject({ success: true });
		expect(testMcpServer).toHaveBeenCalledWith('safe');
	});
});

it.each(['exchange', 'refresh', 'discovery failure', 'browser failure', 'port busy'])(
	'owns and cleans up the generic OAuth callback on %s',
	async (scenario) => {
		jest.clearAllMocks();
		const mainFrame = {};
		const sender = { id: 21, mainFrame };
		jest.mocked(BrowserWindow.fromWebContents).mockReturnValue({
			id: 1,
			webContents: sender,
			isMinimized: () => false,
			show: jest.fn(),
			focus: jest.fn(),
		} as never);
		new McpIpc().register(
			{ windows: { has: () => true }, apps: { has: () => false } } as never,
			{} as never
		);
		jest
			.mocked(getMcpServers)
			.mockReturnValue({ generic: { type: 'http', url: 'https://generic.example/mcp' } });
		jest.mocked(getMcpOauth).mockReturnValue({ client_id: 'registered-client' });
		const close = jest.fn();
		const boundUrl = 'http://127.0.0.1:49201/oauth/callback';
		jest.mocked(startOauthCallbackServer).mockImplementation(async () => {
			if (scenario === 'port busy') throw new Error('Port busy');
			return { redirectUrl: boundUrl, code: Promise.resolve('verified-code'), close };
		});
		const provider = { redirectUrl: boundUrl };
		let redirect: ((url: URL) => void) | undefined;
		jest.mocked(createOAuthProvider).mockImplementation((options) => {
			expect(startOauthCallbackServer).toHaveBeenCalled();
			expect(options.redirectUrl).toBe(boundUrl);
			expect(options.state).toBe(jest.mocked(startOauthCallbackServer).mock.calls[0][0]);
			expect(options.clientId).toBeUndefined();
			redirect = options.onRedirect;
			return provider as never;
		});
		jest.mocked(auth).mockImplementation(async (actual, options) => {
			expect(actual).toBe(provider);
			if (scenario === 'discovery failure') throw new Error('Discovery failed');
			if (scenario === 'refresh' || options.authorizationCode) return 'AUTHORIZED';
			redirect!(new URL('https://issuer.example/authorize'));
			return 'REDIRECT';
		});
		jest.mocked(shell.openExternal).mockImplementation(async () => {
			if (scenario === 'browser failure') throw new Error('Browser failed');
		});
		const handler = jest
			.mocked(ipcMain.handle)
			.mock.calls.find(([channel]) => channel === McpChannels.oauthStart)![1];
		const result = await handler({ sender, senderFrame: mainFrame } as never, 'generic');
		expect(result.success).toBe(scenario === 'exchange' || scenario === 'refresh');
		expect(close).toHaveBeenCalledTimes(scenario === 'port busy' ? 0 : 1);
		if (scenario === 'exchange') {
			expect(auth).toHaveBeenLastCalledWith(provider, {
				serverUrl: 'https://generic.example/mcp',
				authorizationCode: 'verified-code',
			});
			const window = jest.mocked(BrowserWindow.fromWebContents).mock.results[0].value;
			expect(window.show).toHaveBeenCalled();
			expect(window.focus).toHaveBeenCalled();
		}
		if (scenario === 'port busy') expect(auth).not.toHaveBeenCalled();
	}
);

it('cancels a pending OAuth callback before retrying', async () => {
	jest.clearAllMocks();
	const mainFrame = {};
	const sender = { id: 21, mainFrame };
	jest
		.mocked(BrowserWindow.fromWebContents)
		.mockReturnValue({ id: 1, webContents: sender } as never);
	new McpIpc().register(
		{ windows: { has: () => true }, apps: { has: () => false } } as never,
		{} as never
	);
	jest
		.mocked(getMcpServers)
		.mockReturnValue({ gmail: { type: 'http', url: 'https://generic.example/mcp' } });

	let rejectFirstCode!: (error: Error) => void;
	let rejectSecondCode!: (error: Error) => void;
	const first = {
		redirectUrl: 'http://127.0.0.1:3001/oauth/callback',
		code: new Promise<string>((_resolve, reject) => {
			rejectFirstCode = reject;
		}),
		close: jest.fn(() => rejectFirstCode(new Error('OAuth authorization was cancelled.'))),
	};
	const second = {
		redirectUrl: 'http://127.0.0.1:3001/oauth/callback',
		code: new Promise<string>((_resolve, reject) => {
			rejectSecondCode = reject;
		}),
		close: jest.fn(() => rejectSecondCode(new Error('OAuth authorization was cancelled.'))),
	};
	jest.mocked(startOauthCallbackServer).mockResolvedValueOnce(first).mockResolvedValueOnce(second);
	jest.mocked(createOAuthProvider).mockImplementation((options) => {
		options.onRedirect?.(new URL('https://issuer.example/authorize'));
		return {} as never;
	});
	jest.mocked(auth).mockResolvedValue('REDIRECT');

	const handler = jest
		.mocked(ipcMain.handle)
		.mock.calls.find(([channel]) => channel === McpChannels.oauthStart)![1];
	const firstAttempt = handler({ sender, senderFrame: mainFrame } as never, 'gmail');
	await Promise.resolve();
	const secondAttempt = handler({ sender, senderFrame: mainFrame } as never, 'gmail');
	await Promise.resolve();

	expect(first.close).toHaveBeenCalled();
	expect(startOauthCallbackServer).toHaveBeenCalledTimes(2);

	second.close();
	await Promise.all([firstAttempt, secondAttempt]);
});

it('reports whether OAuth credentials exist without returning them', async () => {
	const mainFrame = {};
	const sender = { id: 21, mainFrame };
	jest
		.mocked(BrowserWindow.fromWebContents)
		.mockReturnValue({ id: 1, webContents: sender } as never);
	jest.mocked(getMcpOauth).mockReturnValue({
		tokens: { access_token: 'secret-access-token', token_type: 'Bearer' },
	});
	new McpIpc().register(
		{ windows: { has: () => true }, apps: { has: () => false } } as never,
		{} as never
	);

	const handler = jest
		.mocked(ipcMain.handle)
		.mock.calls.find(([channel]) => channel === McpChannels.oauthStatus)![1];

	await expect(handler({ sender, senderFrame: mainFrame } as never, 'gmail')).resolves.toEqual({
		success: true,
		data: true,
	});
});

it.each(['gmailmcp', 'calendarmcp', 'drivemcp'])(
	'connects %s with environment credentials',
	async (host) => {
		jest.clearAllMocks();
		process.env.GOOGLE_CLIENT_ID = 'environment-google-id';
		process.env.GOOGLE_CLIENT_SECRET = 'environment-google-secret';
		const mainFrame = {};
		const sender = { id: 21, mainFrame };
		jest
			.mocked(BrowserWindow.fromWebContents)
			.mockReturnValue({ id: 1, webContents: sender } as never);
		new McpIpc().register(
			{ windows: { has: () => true }, apps: { has: () => false } } as never,
			{} as never
		);
		jest.mocked(getMcpServers).mockReturnValue({
			google: {
				type: 'http',
				url: `https://${host}.googleapis.com/mcp/v1`,
				client_id: 'configured-google-id',
				client_secret: 'configured-google-secret',
			},
		});
		jest
			.mocked(getMcpOauth)
			.mockReturnValue({ client_id: 'saved-google-id', client_secret: 'saved-google-secret' });
		jest.mocked(startOauthCallbackServer).mockResolvedValue({
			redirectUrl: 'http://127.0.0.1:3001/oauth/callback',
			code: Promise.resolve('code'),
			close: jest.fn(),
		});
		const invalidateCredentials = jest.fn();
		jest.mocked(createOAuthProvider).mockReturnValue({ invalidateCredentials } as never);
		jest.mocked(auth).mockResolvedValue('AUTHORIZED');
		const handler = jest
			.mocked(ipcMain.handle)
			.mock.calls.find(([channel]) => channel === McpChannels.oauthStart)![1];
		const result = await handler({ sender, senderFrame: mainFrame } as never, 'google');
		expect(result.success).toBe(true);
		expect(createOAuthProvider).toHaveBeenCalledWith(
			expect.objectContaining({
				clientId: 'environment-google-id',
				clientSecret: 'environment-google-secret',
			})
		);
		expect(invalidateCredentials).toHaveBeenCalledWith('tokens');
		expect(invalidateCredentials.mock.invocationCallOrder[0]).toBeLessThan(
			jest.mocked(auth).mock.invocationCallOrder[0]
		);
	}
);
