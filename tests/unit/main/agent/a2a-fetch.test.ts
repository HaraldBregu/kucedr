import { createA2aFetch } from '../../../../src/main/agent/a2a/fetch';

const originalFetch = global.fetch;

afterAll(() => {
	global.fetch = originalFetch;
});

it.each([
	[
		{ authType: 'bearer' as const, credential: 'bearer-secret' },
		'Authorization',
		'Bearer bearer-secret',
	],
	[
		{ authType: 'api-key' as const, credential: 'api-secret', apiKeyHeader: 'X-API-Key' },
		'X-API-Key',
		'api-secret',
	],
])('injects configured authentication and rejects redirects', async (authentication, name, value) => {
	global.fetch = jest.fn().mockResolvedValue(new Response('{}'));
	await createA2aFetch(authentication)('https://agent.example/a2a', {
		headers: { 'A2A-Version': '1.0' },
	});
	const [request, init] = (global.fetch as jest.Mock).mock.calls[0] as [Request, RequestInit];
	expect(request.url).toBe('https://agent.example/a2a');
	expect(new Headers(init.headers).get(name)).toBe(value);
	expect(new Headers(init.headers).get('A2A-Version')).toBe('1.0');
	expect(init.redirect).toBe('error');
});

it('rejects a stored credential before any cleartext request is sent', async () => {
	global.fetch = jest.fn();
	await expect(
		createA2aFetch({ authType: 'bearer', credential: 'secret' })('http://agent.example/a2a')
	).rejects.toThrow('must use HTTPS');
	expect(global.fetch).not.toHaveBeenCalled();
});

it('rejects an oversized streamed response without a content-length header', async () => {
	global.fetch = jest.fn().mockResolvedValue(new Response('x'.repeat(256_001)));
	const response = await createA2aFetch({ authType: 'none' })('https://agent.example/a2a');
	await expect(response.text()).rejects.toThrow('256 KB wire limit');
});
