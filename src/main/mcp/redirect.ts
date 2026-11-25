export function getMcpOAuthRedirectUrl(value?: string, port = 3001): string {
	const url = new URL(
		value || process.env.CLIENT_REDIRECT_URL?.trim() || `http://127.0.0.1:${port}/oauth/callback`
	);
	if (
		url.protocol !== 'http:' ||
		!['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname) ||
		!url.port ||
		url.username ||
		url.password ||
		url.search ||
		url.hash
	) {
		throw new Error('CLIENT_REDIRECT_URL must be an HTTP loopback URL with an explicit port.');
	}
	return url.toString();
}
