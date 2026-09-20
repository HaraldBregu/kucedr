import type { OAuthClientMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';

import { getMcpOAuthRedirectUrl } from './redirect';

export function clientMetadata(hasSecret: boolean): OAuthClientMetadata {
	return {
		client_name: 'Kucedr',
		redirect_uris: [getMcpOAuthRedirectUrl()],
		grant_types: ['authorization_code', 'refresh_token'],
		response_types: ['code'],
		token_endpoint_auth_method: hasSecret ? 'client_secret_post' : 'none',
	};
}
