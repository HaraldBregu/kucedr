import { restrictSettingsFile } from '../shared/restrict_settings_file';
import { mcpCatalogStore } from './mcp_catalog_store';

export function clearMcpToolCatalog(id: string): void {
	const catalogs = { ...mcpCatalogStore.get('catalogs') };
	if (!(id in catalogs)) return;
	delete catalogs[id];
	mcpCatalogStore.set('catalogs', catalogs);
	restrictSettingsFile(mcpCatalogStore.path);
}
