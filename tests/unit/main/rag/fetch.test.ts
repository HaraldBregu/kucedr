import { vectorFetch } from '../../../../src/main/database/fetch';

beforeEach(() => {
	global.fetch = jest.fn();
});

it.each(['operation', 'request'] as const)(
	'preserves the SDK signal and indexing signal when the %s is cancelled',
	async (cancelled) => {
		const operation = new AbortController();
		const request = new AbortController();
		const reason = new Error('Cancelled');
		jest.mocked(global.fetch).mockImplementation(
			async (_url, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
						once: true,
					});
				})
		);
		const result = vectorFetch(operation.signal)('https://api.example.test', {
			signal: request.signal,
		});
		({ operation, request })[cancelled].abort(reason);
		await expect(result).rejects.toBe(reason);
	}
);

it('does not dispatch an HTTP request after cancellation', async () => {
	const controller = new AbortController();
	controller.abort(new Error('Already cancelled'));
	await expect(vectorFetch(controller.signal)('https://api.example.test')).rejects.toThrow(
		'Already cancelled'
	);
	expect(global.fetch).not.toHaveBeenCalled();
});

it('preserves an SDK Request signal when no init signal is supplied', async () => {
	const controller = new AbortController();
	const request = new Request('https://api.example.test', { signal: controller.signal });
	jest.mocked(global.fetch).mockResolvedValue(new Response('ok'));
	await vectorFetch()(request);
	expect(jest.mocked(global.fetch).mock.calls[0][1]?.signal).toBe(request.signal);
});
