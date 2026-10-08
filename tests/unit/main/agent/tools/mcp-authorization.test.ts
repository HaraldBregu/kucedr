const getMcpServers = jest.fn();
const getMcpOauth = jest.fn();
const findMcpService = jest.fn();

jest.mock('../../../../../src/main/mcp', () => ({
	getMcpServers: () => getMcpServers(),
	getMcpOauth: (id: string) => getMcpOauth(id),
}));
jest.mock('../../../../../src/main/mcp/manifest', () => ({
	findMcpService: (url: string) => findMcpService(url),
}));

import { requestMcpAuthorizationTool } from '../../../../../src/main/agent/tools/mcp/authorize';

beforeEach(() => {
	getMcpServers.mockReturnValue({
		docs: { type: 'http', url: 'https://mcp.example', name: 'Docs' },
	});
	getMcpOauth.mockReturnValue({});
	findMcpService.mockReturnValue(undefined);
});

it('requests authorization when tools are available but OAuth is missing', async () => {
	const result = await requestMcpAuthorizationTool().run({ serverId: 'docs' });

	expect(result).toEqual({
		status: 'authorization_required',
		serverId: 'docs',
		serverName: 'Docs',
		message: expect.any(String),
	});
	expect(getMcpOauth).toHaveBeenCalledWith('docs');
});

it('does not request authorization when an OAuth token is stored', async () => {
	getMcpOauth.mockReturnValue({ tokens: { access_token: 'token' } });
	await expect(requestMcpAuthorizationTool().run({ serverId: 'docs' })).resolves.toEqual({
		status: 'already_authorized',
		serverId: 'docs',
	});
});

it('does not offer OAuth for a server using a configured bearer token', async () => {
	getMcpServers.mockReturnValue({
		docs: { type: 'http', url: 'https://mcp.example', name: 'Docs', token: 'configured-token' },
	});
	await expect(requestMcpAuthorizationTool().run({ serverId: 'docs' })).resolves.toEqual({
		status: 'already_authorized',
		serverId: 'docs',
	});
});
