import type { McpData } from '../../shared/mcp_types';
import type { McpRecord } from './mcp_types';

export function mergeMcpRecord(
	id: string,
	data: McpData,
	existing: McpRecord | undefined
): McpRecord {
	const preserveHttpSecrets =
		existing?.type === 'http' &&
		data.type === 'http' &&
		existing.url === data.url &&
		existing.client_id === data.client_id &&
		(data.token === undefined || existing.token === data.token) &&
		(data.client_secret === undefined || existing.client_secret === data.client_secret) &&
		(data.refresh_token === undefined || existing.refresh_token === data.refresh_token);
	const preserveStdioSecrets =
		existing?.type === 'stdio' &&
		data.type === 'stdio' &&
		existing.command === data.command &&
		(existing.cwd ?? '') === (data.cwd ?? '') &&
		JSON.stringify(existing.args ?? []) === JSON.stringify(data.args ?? []);

	return {
		...(preserveHttpSecrets || preserveStdioSecrets ? existing : undefined),
		id,
		...data,
		...(preserveHttpSecrets && {
			token: data.token ?? existing.token,
			client_secret: data.client_secret ?? existing.client_secret,
			refresh_token: data.refresh_token ?? existing.refresh_token,
		}),
	} as McpRecord;
}
