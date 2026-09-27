import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getMcpServers } from './mcp_store';
import { mcpCatalogIdentity } from './mcp_catalog_identity';
import { mcpCatalogStore } from './mcp_catalog_store';

export function getMcpToolCatalog(id: string): Tool[] | undefined {
	const data = getMcpServers()[id];
	const catalog = mcpCatalogStore.get('catalogs')[id];
	return data && catalog?.identity === mcpCatalogIdentity(data) ? catalog.tools : undefined;
}
