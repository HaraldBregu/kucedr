import type { AgentToolPermission } from '../../shared/agent_tools';
import { getMcpServers } from './mcp_store';
import { getMcpToolCatalog } from './mcp_catalog_get';
import { mcpCatalogStore } from './mcp_catalog_store';
import { mcpToolHash } from './mcp_catalog_tool_hash';

export function getMcpToolPermission(id: string, toolName: string): AgentToolPermission | undefined {
	const tool = getMcpToolCatalog(id)?.find((entry) => entry.name === toolName);
	if (!tool) return undefined;
	const catalog = mcpCatalogStore.get('catalogs')[id];
	const stored = catalog?.permissions?.[toolName];
	if (stored && catalog?.permissionHashes?.[toolName] === mcpToolHash(tool)) return stored;
	// A server's own readOnlyHint is not trusted: only the user's choice allows a tool without asking.
	return getMcpServers()[id]?.require_approval === 'never' ? 'allow' : 'ask';
}
