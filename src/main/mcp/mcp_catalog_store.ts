import path from 'node:path';
import Store from 'electron-store';
import { userDataLocation } from '../shared/user_data_location';
import { restrictSettingsFile } from '../shared/restrict_settings_file';
import type { McpToolCatalogSchema } from './mcp_types';

export const mcpCatalogStore = new Store<{ catalogs: McpToolCatalogSchema }>({
	name: 'tools',
	cwd: path.resolve(userDataLocation(), 'mcp'),
	accessPropertiesByDotNotation: false,
	defaults: { catalogs: {} },
});

restrictSettingsFile(mcpCatalogStore.path);
