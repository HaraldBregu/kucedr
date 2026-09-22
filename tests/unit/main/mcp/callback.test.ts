import http from 'node:http';
import { startOauthCallbackServer } from '../../../../src/main/mcp/mcp_oauth_callback';

jest.mock('../../../../src/main/mcp/redirect', () => ({
	getMcpOAuthRedirectUrl: () => 'http://localhost:4321/oauth/callback',
}));

let handle: (req: http.IncomingMessage, res: http.ServerResponse) => void;
let onError: (error: Error) => void;
const close = jest.fn();
const response = { writeHead: jest.fn(), end: jest.fn() };

beforeEach(() => {
	jest.clearAllMocks();
	jest.useFakeTimers();
	response.writeHead.mockReturnValue(response);
	jest.spyOn(http, 'createServer').mockImplementation(((listener: typeof handle) => {
		handle = listener;
		return {
			once: (_event: string, listener: typeof onError) => {
				onError = listener;
			},
			listen: (_port: number, _host: string, listener: () => void) => listener(),
			address: () => ({ port: 3001 }),
			close,
		} as unknown as http.Server;
	}) as typeof http.createServer);
});

afterEach(() => {
	jest.useRealTimers();
});

it.each([
	'code=attacker',
	'code=attacker&state=wrong',
	'code=attacker&state=expected&state=wrong',
	'state=expected',
])('ignores invalid callbacks and accepts a later valid callback: %s', async (query) => {
	const callback = await startOauthCallbackServer('expected');
	handle(
		{ method: 'GET', url: `/oauth/callback?${query}` } as http.IncomingMessage,
		response as unknown as http.ServerResponse
	);
	expect(response.writeHead).toHaveBeenLastCalledWith(400);
	expect(close).not.toHaveBeenCalled();
	handle(
		{ method: 'GET', url: '/oauth/callback?code=valid&state=expected' } as http.IncomingMessage,
		response as unknown as http.ServerResponse
	);
	await expect(callback.code).resolves.toBe('valid');
	expect(close).toHaveBeenCalledTimes(1);
	expect(jest.getTimerCount()).toBe(0);
});

it('rejects provider errors only after checking state and closes the listener', async () => {
	const callback = await startOauthCallbackServer('expected');
	handle(
		{
			method: 'GET',
			url: '/oauth/callback?error=access_denied&state=wrong',
		} as http.IncomingMessage,
		response as unknown as http.ServerResponse
	);
	expect(close).not.toHaveBeenCalled();
	handle(
		{
			method: 'GET',
			url: '/oauth/callback?error=access_denied&state=expected',
		} as http.IncomingMessage,
		response as unknown as http.ServerResponse
	);
	await expect(callback.code).rejects.toThrow('access_denied');
	expect(close).toHaveBeenCalledTimes(1);
});

it('closes the listener when authorization times out', async () => {
	const callback = await startOauthCallbackServer('expected', 100);
	jest.advanceTimersByTime(100);
	await expect(callback.code).rejects.toThrow('Timed out');
	expect(close).toHaveBeenCalledTimes(1);
});

it('settles the callback when explicitly closed', async () => {
	const callback = await startOauthCallbackServer('expected');
	callback.close();
	await expect(callback.code).rejects.toThrow('cancelled');
	expect(jest.getTimerCount()).toBe(0);
});

it('rejects callback errors after the listener starts', async () => {
	const callback = await startOauthCallbackServer('expected');
	onError(new Error('Listener failed'));
	await expect(callback.code).rejects.toThrow('Listener failed');
	expect(jest.getTimerCount()).toBe(0);
});
