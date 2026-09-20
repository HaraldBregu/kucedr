export function getMcpOAuthRedirectUrl(
	value = process.env.MCP_CLIENT_REDIRECT_URL?.trim() || 'http://127.0.0.1:3001/oauth/callback'
): string {
	const url = new URL(value);
	if (
		url.protocol !== 'http:' ||
		!['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname) ||
		!url.port ||
		url.username ||
		url.password ||
		url.search ||
		url.hash
	) {
		throw new Error('MCP_CLIENT_REDIRECT_URL must be an HTTP loopback URL with an explicit port.');
	}
	return url.toString();
}
