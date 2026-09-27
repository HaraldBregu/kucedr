const getMcpServers = jest.fn();
const getMcpToolCatalog = jest.fn();
const testMcpServer = jest.fn();

jest.mock('../../../../src/main/mcp/mcp_store', () => ({ getMcpServers }));
jest.mock('../../../../src/main/mcp/mcp_catalog_get', () => ({ getMcpToolCatalog }));
jest.mock('../../../../src/main/mcp/mcp_server_test', () => ({ testMcpServer }));

import { startMcpCatalogBackfill } from '../../../../src/main/mcp/mcp_catalog_backfill';

it('fills missing enabled catalogs only once per startup', async () => {
	getMcpServers.mockReturnValue({
		cached: { type: 'http', url: 'https://cached.example' },
		missing: { type: 'http', url: 'https://missing.example' },
		disabled: { type: 'http', url: 'https://disabled.example', enabled: false },
	});
	getMcpToolCatalog.mockImplementation((id: string) => (id === 'cached' ? [] : undefined));
	testMcpServer.mockResolvedValue({ ok: true });

	const first = startMcpCatalogBackfill();
	expect(startMcpCatalogBackfill()).toBe(first);
	await first;
	expect(testMcpServer).toHaveBeenCalledTimes(1);
	expect(testMcpServer).toHaveBeenCalledWith('missing');
});
