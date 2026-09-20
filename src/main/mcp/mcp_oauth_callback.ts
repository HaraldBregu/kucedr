import http from 'node:http';
import { getMcpOAuthRedirectUrl } from './redirect';

export function startOauthCallbackServer(timeoutMs = 300_000): Promise<{
	code: Promise<string>;
	close: () => void;
}> {
	const redirect = new URL(getMcpOAuthRedirectUrl());
	return new Promise((resolveListen, rejectListen) => {
		let resolveCode: (code: string) => void = () => {};
		let rejectCode: (err: Error) => void = () => {};
		const code = new Promise<string>((res, rej) => {
			resolveCode = res;
			rejectCode = rej;
		});
		const server = http.createServer((req, res) => {
			const url = new URL(req.url ?? '/', redirect.origin);
			if (url.pathname !== redirect.pathname) {
				res.writeHead(404).end();
				return;
			}
			const authCode = url.searchParams.get('code');
			res
				.writeHead(200, { 'Content-Type': 'text/html' })
				.end('<html><body>Authorization complete. You can close this window.</body></html>');
			if (authCode) resolveCode(authCode);
			else rejectCode(new Error(url.searchParams.get('error') ?? 'Missing authorization code.'));
		});
		const timer = setTimeout(
			() => rejectCode(new Error('Timed out waiting for the OAuth callback.')),
			timeoutMs
		);
		server.once('error', (err) => {
			clearTimeout(timer);
			rejectListen(err);
		});
		server.listen(Number(redirect.port), redirect.hostname, () => {
			resolveListen({
				code,
				close: () => {
					clearTimeout(timer);
					server.close();
				},
			});
		});
	});
}
