import type { McpServerInfo } from '@shared/mcp_types';
import type { CatalogService } from '@shared/provider_types';

/** A plugin's remote MCP service shown as a disabled server until the user adds it. */
export function catalogServer(service: CatalogService): McpServerInfo {
	return {
		id: service.id,
		source: 'configured',
		data: { type: 'http', name: service.name, url: service.url ?? '', enabled: false },
		...(service.provider.plugin ? { plugin: service.provider.plugin } : {}),
	};
}
