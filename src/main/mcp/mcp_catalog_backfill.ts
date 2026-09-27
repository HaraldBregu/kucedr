import { getMcpServers } from './mcp_store';
import { getMcpToolCatalog } from './mcp_catalog_get';
import { testMcpServer } from './mcp_server_test';

let pending: Promise<void> | undefined;

export function startMcpCatalogBackfill(): Promise<void> {
	if (pending) return pending;
	pending = (async () => {
		const servers = getMcpServers();
		await Promise.all(
			Object.entries(servers)
				.filter(([id, data]) => data.enabled !== false && !getMcpToolCatalog(id))
				.map(async ([id]) => {
					await testMcpServer(id);
				})
		);
	})();
	return pending;
}
