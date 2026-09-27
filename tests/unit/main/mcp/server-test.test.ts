const connect = jest.fn();
const listTools = jest.fn();
const close = jest.fn();
const getMcpServers = jest.fn();
const saveMcpToolCatalog = jest.fn();

jest.mock('../../../../src/main/mcp/mcp_client_connect', () => ({ connect }));
jest.mock('../../../../src/main/mcp/mcp_client_list_tools', () => ({ listTools }));
jest.mock('../../../../src/main/mcp/mcp_client_close', () => ({ close }));
jest.mock('../../../../src/main/mcp/mcp_store', () => ({ getMcpServers }));
jest.mock('../../../../src/main/mcp/mcp_catalog_save', () => ({ saveMcpToolCatalog }));

import { testMcpServer } from '../../../../src/main/mcp/mcp_server_test';

beforeEach(() => {
	jest.clearAllMocks();
	getMcpServers.mockReturnValue({ remote: { type: 'http', url: 'https://mcp.test' } });
	connect.mockResolvedValue({});
	close.mockResolvedValue(undefined);
});

describe('MCP connection test', () => {
	it('lists tools with bounded timeouts and closes the client', async () => {
		listTools.mockResolvedValue({ tools: [{ name: 'read' }, { name: 'write' }] });

		await expect(testMcpServer('remote')).resolves.toMatchObject({
			ok: true,
			tools: ['read', 'write'],
			toolCount: 2,
		});
		expect(connect).toHaveBeenCalledWith('remote', expect.any(Object), 15_000);
		expect(listTools).toHaveBeenCalledWith(expect.any(Object), 15_000, undefined, undefined);
		expect(close).toHaveBeenCalledTimes(1);
		expect(saveMcpToolCatalog).toHaveBeenCalledWith('remote', [
			{ name: 'read' },
			{ name: 'write' },
		]);
	});

	it('stores all pages and complete tool schemas', async () => {
		const first = { name: 'find', description: 'Find invoices', inputSchema: { type: 'object' } };
		const second = { name: 'send', inputSchema: { type: 'object' }, annotations: { readOnlyHint: false } };
		listTools
			.mockResolvedValueOnce({ tools: [first], nextCursor: 'page-2' })
			.mockResolvedValueOnce({ tools: [second] });

		await expect(testMcpServer('remote')).resolves.toMatchObject({ ok: true, toolCount: 2 });
		expect(listTools).toHaveBeenNthCalledWith(1, expect.any(Object), 15_000, undefined, undefined);
		expect(listTools).toHaveBeenNthCalledWith(2, expect.any(Object), 15_000, undefined, 'page-2');
		expect(saveMcpToolCatalog).toHaveBeenCalledWith('remote', [first, second]);
	});

	it('returns an actionable failure and still closes the client', async () => {
		listTools.mockRejectedValue(new Error('server unavailable'));

		await expect(testMcpServer('remote')).resolves.toMatchObject({
			ok: false,
			error: 'server unavailable',
		});
		expect(close).toHaveBeenCalledTimes(1);
		expect(saveMcpToolCatalog).not.toHaveBeenCalled();
	});
});
