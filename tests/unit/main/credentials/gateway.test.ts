import { forward } from '../../../../supabase/functions/_shared/forward';
import { probe } from '../../../../supabase/functions/_shared/probe';
import { services } from '../../../../supabase/functions/_shared/services';

const KEY = 'sk-saved-provider-secret-9876';

function request(path: string, init: RequestInit = {}): Request {
	return new Request(`https://project.supabase.co/model-gateway/id${path}`, init);
}

function post(path: string, headers: Record<string, string> = {}): Request {
	const body = JSON.stringify({ model: 'gpt', stream: true });
	return request(path, {
		method: 'POST',
		body,
		headers: { 'content-type': 'application/json', 'content-length': String(body.length), ...headers },
	});
}

it('sends the saved key only to the approved origin and replaces client auth headers', async () => {
	const send = jest.fn(async () => new Response('data: {}\n\n', { headers: { 'content-type': 'text/event-stream' } }));
	const response = await forward(
		services.openai,
		KEY,
		'/chat/completions',
		post('/chat/completions', {
			authorization: 'Bearer attacker',
			'x-api-key': 'attacker',
			'x-forwarded-host': 'evil.test',
		}),
		send as unknown as typeof fetch
	);
	expect(response.status).toBe(200);
	const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
	expect(url).toBe('https://api.openai.com/v1/chat/completions');
	expect(init.redirect).toBe('manual');
	const headers = new Headers(init.headers);
	expect(headers.get('authorization')).toBe(`Bearer ${KEY}`);
	expect(headers.has('x-api-key')).toBe(false);
	expect(headers.has('x-forwarded-host')).toBe(false);
});

it.each([
	['/../../evil', 'POST'],
	['/files', 'POST'],
	['/models', 'POST'],
	['/chat/completions', 'GET'],
])('refuses unapproved operation %s %s without contacting any provider', async (path, method) => {
	const send = jest.fn();
	const response = await forward(
		services.openai,
		KEY,
		path,
		method === 'POST' ? post(path) : request(path),
		send as unknown as typeof fetch
	);
	expect(response.status).toBe(403);
	expect(send).not.toHaveBeenCalled();
});

it('refuses provider redirects so the key cannot follow them', async () => {
	const send = jest.fn(async () => new Response(null, { status: 302, headers: { location: 'https://evil.test' } }));
	const response = await forward(services.openai, KEY, '/models', request('/models'), send as unknown as typeof fetch);
	expect(response.status).toBe(502);
	expect(response.headers.get('location')).toBeNull();
});

it('never returns the saved key in provider errors', async () => {
	const rejected = await forward(
		services.openai,
		KEY,
		'/models',
		request('/models'),
		(async () => new Response(`Incorrect API key provided: ${KEY}`, { status: 401 })) as unknown as typeof fetch
	);
	expect(rejected.status).toBe(401);
	expect(await rejected.text()).not.toContain(KEY);

	const failed = await forward(
		services.openai,
		KEY,
		'/models',
		request('/models'),
		(async () => new Response(`upstream echoed ${KEY}`, { status: 500 })) as unknown as typeof fetch
	);
	expect(await failed.text()).toBe('upstream echoed [redacted]');
});

it('rejects oversized request bodies', async () => {
	const send = jest.fn();
	const response = await forward(
		services.openai,
		KEY,
		'/responses',
		post('/responses', { 'content-length': String(64 * 1024 * 1024) }),
		send as unknown as typeof fetch
	);
	expect(response.status).toBe(413);
	expect(send).not.toHaveBeenCalled();
});

it('tests a key with a free model listing and reports rejection', async () => {
	const send = jest
		.fn()
		.mockResolvedValueOnce(new Response('{}', { status: 200 }))
		.mockResolvedValueOnce(new Response('{}', { status: 401 }));
	await expect(probe(services.anthropic, KEY, send)).resolves.toBe(true);
	await expect(probe(services.anthropic, KEY, send)).resolves.toBe(false);
	const [url, init] = send.mock.calls[0] as [string, RequestInit];
	expect(url).toBe('https://api.anthropic.com/v1/models');
	expect((init.headers as Record<string, string>)['x-api-key']).toBe(KEY);
});
