import type { AgentToolPermission } from '../../shared/agent_tools';
import { restrictSettingsFile } from '../shared/restrict_settings_file';
import { getMcpToolCatalog } from './mcp_catalog_get';
import { mcpCatalogStore } from './mcp_catalog_store';
import { mcpToolHash } from './mcp_catalog_tool_hash';

export function setMcpToolPermission(
	id: string,
	toolName: string,
	permission: AgentToolPermission
): void {
	if (!['ask', 'allow', 'deny'].includes(permission)) throw new Error('Invalid tool permission.');
	const tool = getMcpToolCatalog(id)?.find((entry) => entry.name === toolName);
	if (!tool) throw new Error(`No MCP tool "${toolName}" on "${id}".`);
	const catalogs = mcpCatalogStore.get('catalogs');
	const catalog = catalogs[id];
	mcpCatalogStore.set('catalogs', {
		...catalogs,
		[id]: {
			...catalog,
			permissions: { ...catalog.permissions, [toolName]: permission },
			permissionHashes: { ...catalog.permissionHashes, [toolName]: mcpToolHash(tool) },
		},
	});
	restrictSettingsFile(mcpCatalogStore.path);
}
