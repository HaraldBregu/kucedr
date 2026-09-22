import http from 'node:http';
import { getMcpOAuthRedirectUrl } from './redirect';

export function startOauthCallbackServer(
	expectedState: string,
	timeoutMs = 300_000,
	redirectUrl = getMcpOAuthRedirectUrl()
): Promise<{
	redirectUrl: string;
	code: Promise<string>;
	close: () => void;
}> {
	const redirect = new URL(getMcpOAuthRedirectUrl(redirectUrl));
	return new Promise((resolveListen, rejectListen) => {
		let resolveCode: (code: string) => void = () => {};
		let rejectCode: (err: Error) => void = () => {};
		let settled = false;
		let closed = false;
		const code = new Promise<string>((res, rej) => {
			resolveCode = res;
			rejectCode = rej;
		});
		void code.catch(() => {});
		const close = (): void => {
			if (closed) return;
			closed = true;
			clearTimeout(timer);
			server.close();
			if (!settled) {
				settled = true;
				rejectCode(new Error('OAuth authorization was cancelled.'));
			}
		};
		const server = http.createServer((req, res) => {
			const url = new URL(req.url ?? '/', redirect.origin);
			if (url.pathname !== redirect.pathname) {
				res.writeHead(404).end();
				return;
			}
			if (
				settled ||
				req.method !== 'GET' ||
				!expectedState ||
				url.searchParams.getAll('state').length !== 1 ||
				url.searchParams.get('state') !== expectedState
			) {
				res.writeHead(400).end('Invalid OAuth state.');
				return;
			}
			const authCode = url.searchParams.get('code');
			const error = url.searchParams.get('error');
			if (!authCode && !error) {
				res.writeHead(400).end('Missing authorization code.');
				return;
			}
			settled = true;
			if (error) {
				res.writeHead(400).end('Authorization failed. You can close this window.');
				rejectCode(new Error(`OAuth authorization failed: ${error}`));
			} else {
				res
					.writeHead(200, { 'Content-Type': 'text/html' })
					.end(
						'<html><body>Authorization response received. Return to Kucedr to finish connecting.</body></html>'
					);
				resolveCode(authCode!);
			}
			close();
		});
		const timer = setTimeout(() => {
			settled = true;
			rejectCode(new Error('Timed out waiting for the OAuth callback.'));
			close();
		}, timeoutMs);
		server.once('error', (err) => {
			settled = true;
			rejectCode(err);
			rejectListen(err);
			close();
		});
		server.listen(Number(redirect.port), redirect.hostname.replace(/^\[|\]$/g, ''), () => {
			const address = server.address() as import('node:net').AddressInfo;
			redirect.port = String(address.port);
			resolveListen({ redirectUrl: redirect.toString(), code, close });
		});
	});
}
