import type { AccountSession } from '../../../../src/main/cloud/account';
import { CredentialService } from '../../../../src/main/credentials/service';
import { LlmModel } from '../../../../src/main/models/adapters/llm/llm_model';
import type { LlmEvent } from '../../../../src/main/models/adapters/llm/llm_types';

const CONFIG = {
	url: 'https://project.supabase.co',
	publishableKey: 'sb_publishable_test',
	redirectUrl: 'kucedr://auth/callback',
};
const CREDENTIAL_ID = '11111111-2222-4333-8444-555555555555';

function auth(userId: string | undefined = 'user-a', token: string | null = 'token-a') {
	const listeners = new Set<(session: AccountSession | null) => void>();
	const state = { userId, token };
	return {
		state,
		port: {
			getAccessToken: () => state.token,
			getSignedInUserId: () => state.userId,
			onSessionChanged: (listener: (session: AccountSession | null) => void) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
		},
		switchTo(next: string | undefined, nextToken: string | null) {
			state.userId = next;
			state.token = nextToken;
			listeners.forEach((listener) =>
				listener(next ? ({ user: { id: next }, accessToken: nextToken } as AccountSession) : null)
			);
		},
	};
}

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

it('rejects every operation without a signed-in session and never calls the backend', async () => {
	const request = jest.fn();
	const signedOut = auth();
	signedOut.state.userId = undefined;
	signedOut.state.token = null;
	const service = new CredentialService(signedOut.port, CONFIG, request);
	await expect(service.list()).rejects.toThrow('Sign in');
	await expect(service.test(CREDENTIAL_ID)).rejects.toThrow('Sign in');
	expect(() => service.provider('openai', CREDENTIAL_ID)).toThrow('Sign in');
	expect(request).not.toHaveBeenCalled();
});

it('authenticates with the session token and never sends a client-chosen owner', async () => {
	const request = jest.fn(async () =>
		json({ credential: { id: CREDENTIAL_ID, service: 'openai', label: 'Work', lastFour: 'abcd' } })
	);
	const service = new CredentialService(auth().port, CONFIG, request);
	const created = await service.create({ service: 'openai', label: 'Work', secret: 'sk-test-secret-abcd' });

	const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
	expect(url).toBe('https://project.supabase.co/functions/v1/credentials');
	expect((init.headers as Record<string, string>).authorization).toBe('Bearer token-a');
	const body = JSON.parse(init.body as string);
	expect(body).toEqual({ action: 'create', service: 'openai', label: 'Work', secret: 'sk-test-secret-abcd' });
	expect(body).not.toHaveProperty('user_id');
	expect(JSON.stringify(created)).not.toContain('sk-test-secret');
});

it('supports several keys for the same service', async () => {
	const credentials = [
		{ id: CREDENTIAL_ID, service: 'openai', label: 'Work', lastFour: 'aaaa' },
		{ id: '22222222-2222-4333-8444-555555555555', service: 'openai', label: 'Personal', lastFour: 'bbbb' },
		{ id: '33333333-2222-4333-8444-555555555555', service: 'unknown', label: 'Other', lastFour: null },
	];
	const service = new CredentialService(auth().port, CONFIG, jest.fn(async () => json({ credentials })));
	expect((await service.list()).map((entry) => entry.label)).toEqual(['Work', 'Personal']);
});

it('maps backend failures to generic messages', async () => {
	const responses = [json({}, 401), json({ error: 'Credential not found' }, 404), json({}, 429)];
	const service = new CredentialService(auth().port, CONFIG, jest.fn(async () => responses.shift()!));
	await expect(service.list()).rejects.toThrow('session has expired');
	await expect(service.rename(CREDENTIAL_ID, 'x')).rejects.toThrow('no longer exists');
	await expect(service.list()).rejects.toThrow('Too many requests');
});

it('aborts in-flight requests and discards results when the account changes', async () => {
	const session = auth();
	let signal: AbortSignal | undefined;
	const request = jest.fn(
		(_url: string, init?: RequestInit) =>
			new Promise<Response>((_resolve, reject) => {
				signal = init?.signal ?? undefined;
				signal?.addEventListener('abort', () => reject(new Error('aborted')));
			})
	);
	const service = new CredentialService(session.port, CONFIG, request as typeof fetch);
	service.initialize();
	const pending = service.list();
	session.switchTo('user-b', 'token-b');
	await expect(pending).rejects.toThrow('account changed');
	expect(signal?.aborted).toBe(true);
});

it('rejects a response that arrives after the account switched', async () => {
	const session = auth();
	let resolve!: (response: Response) => void;
	const request = jest.fn(() => new Promise<Response>((done) => (resolve = done)));
	const service = new CredentialService(session.port, CONFIG, request as typeof fetch);
	const pending = service.list();
	session.state.userId = 'user-b';
	resolve(json({ credentials: [{ id: CREDENTIAL_ID, service: 'openai', label: 'A' }] }));
	await expect(pending).rejects.toThrow('account changed');
});

it('routes chat through the gateway without the saved key and blocks it after switching users', async () => {
	const session = auth();
	const request = jest.fn(async () => new Response('{}'));
	const service = new CredentialService(session.port, CONFIG, request as typeof fetch);
	service.initialize();
	const provider = service.provider('openai', CREDENTIAL_ID);
	expect(provider.baseURL).toBe(`https://project.supabase.co/functions/v1/model-gateway/${CREDENTIAL_ID}`);
	expect(provider.apiKey).toBe('kucedr-gateway');

	await provider.fetch!('https://gateway/x', { headers: { 'x-api-key': 'kucedr-gateway' } });
	const headers = new Headers((request.mock.calls[0] as unknown as [string, RequestInit])[1].headers);
	expect(headers.get('authorization')).toBe('Bearer token-a');
	expect(headers.has('x-api-key')).toBe(false);

	session.switchTo('user-b', 'token-b');
	await expect(provider.fetch!('https://gateway/x')).rejects.toThrow('Sign in');
	expect(request).toHaveBeenCalledTimes(1);
});

function sse(chunks: unknown[], signal?: AbortSignal, hold = false): Response {
	const encoder = new TextEncoder();
	return new Response(
		new ReadableStream({
			start(controller) {
				for (const chunk of chunks) controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
				if (!hold) {
					controller.enqueue(encoder.encode('data: [DONE]\n\n'));
					controller.close();
				}
				signal?.addEventListener('abort', () => controller.error(new Error('aborted')));
			},
		}),
		{ headers: { 'content-type': 'text/event-stream' } }
	);
}

it('streams text and tool calls through the gateway with the real SDK', async () => {
	const request = jest.fn(async (_url: string, init?: RequestInit) =>
		sse(
			[
				{ choices: [{ index: 0, delta: { content: 'Hel' } }] },
				{ choices: [{ index: 0, delta: { content: 'lo' } }] },
				{
					choices: [{
						index: 0,
						delta: { tool_calls: [{ index: 0, id: 'call-1', function: { name: 'lookup', arguments: '{}' } }] },
						finish_reason: 'tool_calls',
					}],
				},
			],
			init?.signal ?? undefined
		)
	);
	const service = new CredentialService(auth().port, CONFIG, request as unknown as typeof fetch);
	const model = new LlmModel();
	const events: LlmEvent[] = [];
	for await (const event of model.stream({
		provider: service.provider('deepseek', CREDENTIAL_ID),
		model: 'deepseek-chat',
		messages: [{ role: 'user', content: 'hi' }],
		maxTokens: 50,
		streaming: true,
	})) events.push(event);

	const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
	expect(String(url)).toBe(
		`https://project.supabase.co/functions/v1/model-gateway/${CREDENTIAL_ID}/chat/completions`
	);
	expect(new Headers(init.headers).get('authorization')).toBe('Bearer token-a');
	expect(String(init.body)).not.toContain('kucedr-gateway');
	expect(events.filter((event) => event.type === 'model_call_delta').map((event) => event.delta).join('')).toBe(
		'Hello'
	);
	expect(events).toContainEqual({ type: 'model_tool_call_start', id: 'call-1', name: 'lookup' });
});

it('cancels a streaming gateway request when the run is aborted', async () => {
	let upstream: AbortSignal | undefined;
	const request = jest.fn(async (_url: string, init?: RequestInit) => {
		upstream = init?.signal ?? undefined;
		return sse([{ choices: [{ index: 0, delta: { content: 'partial' } }] }], upstream, true);
	});
	const service = new CredentialService(auth().port, CONFIG, request as unknown as typeof fetch);
	const controller = new AbortController();
	const stream = new LlmModel().stream({
		provider: service.provider('deepseek', CREDENTIAL_ID),
		model: 'deepseek-chat',
		messages: [{ role: 'user', content: 'hi' }],
		maxTokens: 50,
		streaming: true,
		signal: controller.signal,
	});
	const consume = (async () => {
		for await (const event of stream) {
			if (event.type === 'model_call_delta') controller.abort();
		}
	})();
	await expect(consume).rejects.toThrow();
	expect(upstream?.aborted).toBe(true);
});
