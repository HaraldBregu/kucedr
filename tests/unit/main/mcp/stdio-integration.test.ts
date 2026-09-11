import path from 'node:path';

const getMcpServers = jest.fn(() => ({
	fixture: {
		type: 'stdio',
		command: process.execPath,
		args: [path.resolve('tests/fixtures/mcp-server.mjs')],
	},
}));

jest.mock('../../../../src/main/mcp/mcp_store', () => ({
	getMcpServers,
	getMcpOauth: () => ({}),
	saveMcpOauth: () => undefined,
}));

import { testMcpServer } from '../../../../src/main/mcp/mcp_server_test';

describe('local stdio MCP integration', () => {
	it('connects to a real process and discovers its tools', async () => {
		await expect(testMcpServer('fixture')).resolves.toMatchObject({
			ok: true,
			tools: ['ping'],
			toolCount: 1,
		});
	}, 10_000);
});
