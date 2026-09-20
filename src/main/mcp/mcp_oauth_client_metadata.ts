import type { OAuthClientMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';

export function clientMetadata(hasSecret: boolean, redirectUrl: string): OAuthClientMetadata {
	return {
		client_name: 'Kucedr',
		redirect_uris: [redirectUrl],
		grant_types: ['authorization_code', 'refresh_token'],
		response_types: ['code'],
		token_endpoint_auth_method: hasSecret ? 'client_secret_post' : 'none',
	};
}
