const getMcpServersState = jest.fn();
const setMcpServersState = jest.fn();

jest.mock('../../../../src/main/mcp/mcp_store_state', () => ({
	getMcpServersState,
	setMcpServersState,
}));

import { upsertMcpServer } from '../../../../src/main/mcp/mcp_server_upsert';
import { setMcpServers } from '../../../../src/main/mcp/mcp_store';

beforeEach(() => {
	jest.clearAllMocks();
	getMcpServersState.mockReturnValue([
		{
			id: 'remote',
			type: 'http',
			url: 'https://old.example/mcp',
			client_id: 'client',
			tokens: { access_token: 'secret', token_type: 'bearer' },
			codeVerifier: 'verifier',
		},
	]);
});

describe('MCP server upsert', () => {
	it('preserves OAuth state for non-identity changes', () => {
		upsertMcpServer('remote', {
			type: 'http',
			url: 'https://old.example/mcp',
			client_id: 'client',
			enabled: false,
		});

		expect(setMcpServersState).toHaveBeenCalledWith([
			expect.objectContaining({
				tokens: expect.any(Object),
				codeVerifier: 'verifier',
				enabled: false,
			}),
		]);
	});

	it('clears OAuth state when the endpoint changes', () => {
		upsertMcpServer('remote', {
			type: 'http',
			url: 'https://new.example/mcp',
			client_id: 'client',
		});

		expect(setMcpServersState).toHaveBeenCalledWith([
			{ id: 'remote', type: 'http', url: 'https://new.example/mcp', client_id: 'client' },
		]);
	});

	it('clears credentials during bulk save when the endpoint changes', () => {
		setMcpServers({
			remote: { type: 'http', url: 'https://new.example/mcp', client_id: 'client' },
		});

		expect(setMcpServersState).toHaveBeenCalledWith([
			{ id: 'remote', type: 'http', url: 'https://new.example/mcp', client_id: 'client' },
		]);
	});

	it('preserves credentials during bulk save when the endpoint is unchanged', () => {
		setMcpServers({
			remote: { type: 'http', url: 'https://old.example/mcp', client_id: 'client', enabled: false },
		});

		expect(setMcpServersState).toHaveBeenCalledWith([
			expect.objectContaining({
				tokens: expect.any(Object),
				codeVerifier: 'verifier',
				enabled: false,
			}),
		]);
	});

	it('clears environment secrets when a stdio command changes', () => {
		getMcpServersState.mockReturnValue([
			{
				id: 'local',
				type: 'stdio',
				command: 'trusted-command',
				args: ['serve'],
				cwd: '/trusted',
				env: { SECRET: 'value' },
			},
		]);

		setMcpServers({
			local: { type: 'stdio', command: 'other-command', args: ['serve'], cwd: '/trusted' },
		});

		expect(setMcpServersState).toHaveBeenCalledWith([
			{
				id: 'local',
				type: 'stdio',
				command: 'other-command',
				args: ['serve'],
				cwd: '/trusted',
			},
		]);
	});
});

it('keeps a redacted client secret when the settings form submits an undefined value', () => {
	getMcpServersState.mockReturnValue([
		{
			id: 'remote',
			type: 'http',
			url: 'https://old.example/mcp',
			client_id: 'client',
			client_secret: 'saved-secret',
		},
	]);
	upsertMcpServer('remote', {
		type: 'http',
		url: 'https://old.example/mcp',
		client_id: 'client',
		client_secret: undefined,
	});
	expect(setMcpServersState).toHaveBeenCalledWith([
		expect.objectContaining({ client_secret: 'saved-secret' }),
	]);
	upsertMcpServer('remote', {
		type: 'http',
		url: 'https://old.example/mcp',
		client_id: 'different-client',
		client_secret: undefined,
	});
	expect(setMcpServersState.mock.calls[1][0][0].client_secret).toBeUndefined();
});
