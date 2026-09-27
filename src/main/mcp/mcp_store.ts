import type { McpSettings } from '../../shared/mcp_types';
import { getMcpServersState, setMcpServersState } from './mcp_store_state';
import { splitRecord } from './mcp_split_record';
import type { McpOAuthState, McpRecord } from './mcp_types';
import { listLocalMcpServers } from './mcp_local_list';
import { mcpLocalRoot } from './mcp_local_root';
import { mergeMcpRecord } from './mcp_record_merge';
import { mcpCatalogIdentity } from './mcp_catalog_identity';
import { clearMcpToolCatalog } from './mcp_catalog_clear';

export function getMcpServers(): McpSettings {
	const servers: McpSettings = {};
	for (const record of getMcpServersState()) {
		servers[record.id] = splitRecord(record).data;
	}
	for (const server of listLocalMcpServers(mcpLocalRoot()).servers) {
		if (!servers[server.id]) servers[server.id] = server.data;
	}
	return servers;
}

export function setMcpServers(servers: McpSettings): void {
	const current = new Map(getMcpServersState().map((record) => [record.id, record]));
	const next: McpRecord[] = [];
	for (const [id, data] of Object.entries(servers)) {
		next.push(mergeMcpRecord(id, data, current.get(id)));
	}
	setMcpServersState(next);
	for (const [id, previous] of current) {
		const updated = next.find((record) => record.id === id);
		if (!updated || mcpCatalogIdentity(previous) !== mcpCatalogIdentity(updated))
			clearMcpToolCatalog(id);
	}
}

export function getMcpOauth(id: string): McpOAuthState {
	const record = getMcpServersState().find((entry) => entry.id === id);
	return record ? splitRecord(record).auth : {};
}

export function saveMcpOauth(id: string, state: McpOAuthState): void {
	const record = getMcpServersState().find((entry) => entry.id === id);
	if (!record) throw new Error(`No MCP server "${id}".`);
	setMcpServersState(
		getMcpServersState().map((entry) =>
			entry.id === id ? ({ id, ...splitRecord(entry).data, ...state } as McpRecord) : entry
		)
	);
}
