const getMcpServersState = jest.fn();

jest.mock('../../../../src/main/mcp/mcp_store_state', () => ({
	getMcpServersState,
}));

import { listConfiguredMcpServers } from '../../../../src/main/mcp/mcp_configured_list';

describe('configured MCP renderer settings', () => {
	it('redacts bearer and OAuth secrets', () => {
		getMcpServersState.mockReturnValue([
			{
				id: 'remote',
				type: 'http',
				url: 'https://example.test/mcp',
				token: 'bearer-secret',
				client_id: 'public-client-id',
				client_secret: 'client-secret',
				refresh_token: 'refresh-secret',
				tokens: { access_token: 'oauth-secret' },
				codeVerifier: 'verifier',
				tokensClientId: 'public-client-id',
			},
		]);

		expect(listConfiguredMcpServers()).toEqual({
			remote: {
				type: 'http',
				url: 'https://example.test/mcp',
				client_id: 'public-client-id',
			},
		});
	});
});
