import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { restrictSettingsFile } from '../shared/restrict_settings_file';
import { getMcpServers } from './mcp_store';
import { mcpCatalogIdentity } from './mcp_catalog_identity';
import { mcpCatalogStore } from './mcp_catalog_store';

export function saveMcpToolCatalog(id: string, tools: Tool[]): void {
	const data = getMcpServers()[id];
	if (!data) throw new Error(`No MCP server "${id}".`);
	mcpCatalogStore.set('catalogs', {
		...mcpCatalogStore.get('catalogs'),
		[id]: { identity: mcpCatalogIdentity(data), tools },
	});
	restrictSettingsFile(mcpCatalogStore.path);
}
