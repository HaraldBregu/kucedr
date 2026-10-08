const getMcpServers = jest.fn();
const testMcpServer = jest.fn();
const findMcpService = jest.fn();

jest.mock('../../../../../src/main/mcp', () => ({
	getMcpServers: () => getMcpServers(),
	testMcpServer: (id: string) => testMcpServer(id),
}));
jest.mock('../../../../../src/main/mcp/manifest', () => ({
	findMcpService: (url: string) => findMcpService(url),
}));

import { requestMcpAuthorizationTool } from '../../../../../src/main/agent/tools/mcp/authorize';

beforeEach(() => {
	getMcpServers.mockReturnValue({
		docs: { type: 'http', url: 'https://mcp.example', name: 'Docs' },
	});
	findMcpService.mockReturnValue(undefined);
});

it('requests authorization when the configured MCP server rejects an unauthenticated connection', async () => {
	testMcpServer.mockResolvedValue({ ok: false, error: 'HTTP 401 Unauthorized' });
	const result = await requestMcpAuthorizationTool().run({ serverId: 'docs' });

	expect(result).toEqual({
		status: 'authorization_required',
		serverId: 'docs',
		serverName: 'Docs',
		message: expect.any(String),
	});
	expect(testMcpServer).toHaveBeenCalledWith('docs');
});

it('reports an already connected server without requesting authorization', async () => {
	testMcpServer.mockResolvedValue({ ok: true });
	await expect(requestMcpAuthorizationTool().run({ serverId: 'docs' })).resolves.toEqual({
		status: 'connected',
		serverId: 'docs',
		serverName: 'Docs',
	});
});

it('does not offer OAuth for a general connection failure', async () => {
	testMcpServer.mockResolvedValue({ ok: false, error: 'Connection timed out' });
	await expect(requestMcpAuthorizationTool().run({ serverId: 'docs' })).rejects.toThrow(
		'Connection timed out'
	);
});
