import { startOauthCallbackServer } from '../../../../src/main/mcp/mcp_oauth_callback';

it.each(['127.0.0.1', '[::1]'])(
	'reserves independent dynamic callbacks on %s and validates their states',
	async (host) => {
		const redirect = `http://${host}:0/oauth/callback`;
		const first = await startOauthCallbackServer('first', 5000, redirect);
		const second = await startOauthCallbackServer('second', 5000, redirect);
		try {
			expect(first.redirectUrl).not.toBe(second.redirectUrl);
			expect(new URL(first.redirectUrl).hostname).toBe(host);
			expect(Number(new URL(first.redirectUrl).port)).toBeGreaterThan(0);
			expect(Number(new URL(second.redirectUrl).port)).toBeGreaterThan(0);
			const invalid = await fetch(`${first.redirectUrl}?state=second&code=wrong`, {
				headers: { Connection: 'close' },
			});
			expect(invalid.status).toBe(400);
			await invalid.text();
			const responses = await Promise.all([
				fetch(`${first.redirectUrl}?state=first&code=one`, { headers: { Connection: 'close' } }),
				fetch(`${second.redirectUrl}?state=second&code=two`, { headers: { Connection: 'close' } }),
			]);
			for (const response of responses) {
				expect(response.status).toBe(200);
				await response.text();
			}
			await expect(first.code).resolves.toBe('one');
			await expect(second.code).resolves.toBe('two');
		} finally {
			first.close();
			second.close();
		}
	}
);

it('releases the loopback port when the callback expires', async () => {
	const callback = await startOauthCallbackServer(
		'expired',
		20,
		'http://127.0.0.1:0/oauth/callback'
	);
	await expect(callback.code).rejects.toThrow('Timed out');
	const replacement = await startOauthCallbackServer('replacement', 5000, callback.redirectUrl);
	expect(replacement.redirectUrl).toBe(callback.redirectUrl);
	replacement.close();
	await expect(replacement.code).rejects.toThrow('cancelled');
});
