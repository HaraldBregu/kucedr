import type { AgentToolPermission } from '../../shared/agent_tools';
import { restrictSettingsFile } from '../shared/restrict_settings_file';
import { getMcpToolCatalog } from './mcp_catalog_get';
import { mcpCatalogStore } from './mcp_catalog_store';

export function setMcpToolPermission(
	id: string,
	toolName: string,
	permission: AgentToolPermission
): void {
	if (!['ask', 'allow', 'deny'].includes(permission)) throw new Error('Invalid tool permission.');
	if (!getMcpToolCatalog(id)?.some((tool) => tool.name === toolName))
		throw new Error(`No MCP tool "${toolName}" on "${id}".`);
	const catalogs = mcpCatalogStore.get('catalogs');
	const catalog = catalogs[id];
	mcpCatalogStore.set('catalogs', {
		...catalogs,
		[id]: { ...catalog, permissions: { ...catalog.permissions, [toolName]: permission } },
	});
	restrictSettingsFile(mcpCatalogStore.path);
}
