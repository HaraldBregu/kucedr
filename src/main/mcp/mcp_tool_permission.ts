import type { AgentToolPermission } from '../../shared/agent_tools';
import { getMcpServers } from './mcp_store';
import { getMcpToolCatalog } from './mcp_catalog_get';
import { mcpCatalogStore } from './mcp_catalog_store';

export function getMcpToolPermission(id: string, toolName: string): AgentToolPermission | undefined {
	const tool = getMcpToolCatalog(id)?.find((entry) => entry.name === toolName);
	if (!tool) return undefined;
	const stored = mcpCatalogStore.get('catalogs')[id]?.permissions?.[toolName];
	if (stored) return stored;
	const approval = getMcpServers()[id]?.require_approval;
	return approval === 'never' || (approval !== 'always' && tool.annotations?.readOnlyHint === true)
		? 'allow'
		: 'ask';
}
