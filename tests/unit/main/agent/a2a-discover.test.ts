const mockResolver = jest.fn();
let mockResolverOptions: { fetchImpl?: typeof fetch } | undefined;
const mockDefaultAgentCardResolver = jest.fn();

jest.mock('@a2a-js/sdk/client', () => ({
	DefaultAgentCardResolver: mockDefaultAgentCardResolver,
}));

import { discoverA2aAgent } from '../../../../src/main/agent/a2a/discover';

const originalFetch = global.fetch;
const noAuthentication = { authType: 'none' as const };

beforeEach(() => {
	jest.clearAllMocks();
	mockDefaultAgentCardResolver.mockImplementation((options) => {
		mockResolverOptions = options;
		return { resolve: mockResolver };
	});
	mockResolver.mockImplementation(async (base: string) => {
		const response = await mockResolverOptions?.fetchImpl?.(
			new URL('/.well-known/agent-card.json', base),
			{ headers: { 'A2A-Version': '1.0' } }
		);
		return response?.json();
	});
	global.fetch = jest
		.fn()
		.mockResolvedValue(
			new Response(JSON.stringify({ name: 'Agent' }), {
				headers: { 'content-type': 'application/json' },
			})
		);
});

afterAll(() => {
	global.fetch = originalFetch;
});

it('preserves resolver headers and uses the root well-known path with bearer authentication', async () => {
	const controller = new AbortController();
	await discoverA2aAgent(
		' https://agent.example/a2a/ ',
		{ authType: 'bearer', credential: 'secret' },
		controller.signal
	);

	expect(mockResolver).toHaveBeenCalledWith('https://agent.example/a2a');
	const [request, init] = (global.fetch as jest.Mock).mock.calls[0] as [Request, RequestInit];
	expect(request.url).toBe('https://agent.example/.well-known/agent-card.json');
	expect(new Headers(init.headers)).toEqual(expect.objectContaining({}));
	expect(new Headers(init.headers).get('A2A-Version')).toBe('1.0');
	expect(new Headers(init.headers).get('Authorization')).toBe('Bearer secret');
	expect(init.redirect).toBe('error');
});

it.each(['file:///tmp/agent', 'relative-agent', 'https://user:pass@agent.example'])(
	'rejects unsafe base URL %s',
	async (url) => {
			await expect(discoverA2aAgent(url, noAuthentication)).rejects.toThrow();
		expect(mockDefaultAgentCardResolver).not.toHaveBeenCalled();
	}
);
