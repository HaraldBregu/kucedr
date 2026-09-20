export function getMcpOAuthRedirectUrl(): string {
	const redirectUrl = process.env.MCP_OAUTH_REDIRECT_URL?.trim();
	if (!redirectUrl) {
		throw new Error(
			'Set MCP_OAUTH_REDIRECT_URL to the redirect URI registered with your OAuth client before connecting.'
		);
	}
	return redirectUrl;
}
