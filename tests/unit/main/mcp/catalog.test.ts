const catalogs: Record<string, { identity: string; tools: unknown[] }> = {};
const getMcpServers = jest.fn();
const set = jest.fn((_key: string, value: typeof catalogs) => {
	for (const id of Object.keys(catalogs)) delete catalogs[id];
	Object.assign(catalogs, value);
});

jest.mock('../../../../src/main/mcp/mcp_store', () => ({ getMcpServers }));
jest.mock('../../../../src/main/mcp/mcp_catalog_store', () => ({
	mcpCatalogStore: { get: () => catalogs, set, path: '/tmp/mcp-tools.json' },
}));
jest.mock('../../../../src/main/shared/restrict_settings_file', () => ({
	restrictSettingsFile: jest.fn(),
}));

import { getMcpToolCatalog } from '../../../../src/main/mcp/mcp_catalog_get';
import { saveMcpToolCatalog } from '../../../../src/main/mcp/mcp_catalog_save';
import { clearMcpToolCatalog } from '../../../../src/main/mcp/mcp_catalog_clear';

beforeEach(() => {
	for (const id of Object.keys(catalogs)) delete catalogs[id];
	jest.clearAllMocks();
	getMcpServers.mockReturnValue({ remote: { type: 'http', url: 'https://mcp.example' } });
});

it('keeps complete schemas across reads and ignores display-only settings edits', () => {
	const tool = { name: 'search', description: 'Search invoices', inputSchema: { type: 'object' } };
	saveMcpToolCatalog('remote', [tool]);
	getMcpServers.mockReturnValue({
		remote: { type: 'http', url: 'https://mcp.example', name: 'Renamed', enabled: false },
	});
	expect(getMcpToolCatalog('remote')).toEqual([tool]);
});

it('rejects stale catalogs after connection changes and clears deleted entries', () => {
	saveMcpToolCatalog('remote', []);
	expect(getMcpToolCatalog('remote')).toEqual([]);
	getMcpServers.mockReturnValue({ remote: { type: 'http', url: 'https://other.example' } });
	expect(getMcpToolCatalog('remote')).toBeUndefined();
	clearMcpToolCatalog('remote');
	expect(catalogs.remote).toBeUndefined();
});
