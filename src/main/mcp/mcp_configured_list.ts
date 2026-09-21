import type { McpData, McpSettings } from '../../shared/mcp_types';
import { MCP_SECRET_KEYS } from './mcp_secret_keys';
import { getMcpServersState } from './mcp_store_state';

export function listConfiguredMcpServers(): McpSettings {
	const servers: McpSettings = {};
	for (const record of getMcpServersState()) {
		const { id } = record;
		const data = { ...record } as Record<string, unknown>;
		delete data.id;
		delete data.tokensClientId;
		for (const key of MCP_SECRET_KEYS) delete data[key];
		servers[id] = data as unknown as McpData;
	}
	return servers;
}
