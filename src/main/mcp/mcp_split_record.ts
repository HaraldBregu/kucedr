import type { McpData } from '../../shared/mcp_types';
import type { McpOAuthState, McpRecord } from './mcp_types';

// ponytail: keys the OAuth flow owns; anything a server echoes back beyond these just lingers
const OAUTH_KEYS = [
	'redirect_uris',
	'grant_types',
	'response_types',
	'token_endpoint_auth_method',
	'client_name',
	'client_id',
	'client_secret',
	'client_id_issued_at',
	'client_secret_expires_at',
	'scope',
	'tokens',
	'tokensClientId',
	'codeVerifier',
] as const satisfies readonly (keyof McpOAuthState)[];

export function splitRecord(record: McpRecord): { data: McpData; auth: McpOAuthState } {
	const { id: _id, ...recordData } = record;
	const data = { ...recordData } as Record<string, unknown>;
	const auth: Record<string, unknown> = {};
	for (const key of OAUTH_KEYS) {
		if (key in data) auth[key] = data[key];
		delete data[key];
	}
	return { data: data as unknown as McpData, auth: auth as McpOAuthState };
}
