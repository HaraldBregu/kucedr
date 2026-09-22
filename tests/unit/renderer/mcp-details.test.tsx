import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { McpData, McpServerInfo } from '../../../src/shared/mcp_types';
import McpDetailsPage from '../../../src/renderer/src/pages/settings/pages/mcp/details/Page';

const mcpApi = {
	list: jest.fn(),
	get: jest.fn(),
	save: jest.fn(),
	upsert: jest.fn(),
	delete: jest.fn(),
	registry: jest.fn(),
	importLocal: jest.fn(),
	configureLocal: jest.fn(),
	getRoot: jest.fn(),
	openRoot: jest.fn(),
	test: jest.fn(),
	oauthStatus: jest.fn(),
	oauthStart: jest.fn(),
};

let server: McpServerInfo;

function renderDetails(id: string): ReturnType<typeof render> {
	return render(
		<MemoryRouter initialEntries={[`/settings/mcp/${encodeURIComponent(id)}`]}>
			<Routes>
				<Route path="/settings/mcp" element={<p>MCP list</p>} />
				<Route path="/settings/mcp/:mcpServerId" element={<McpDetailsPage />} />
			</Routes>
		</MemoryRouter>
	);
}

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
	Object.defineProperty(window, 'mcp', { configurable: true, value: mcpApi });
	mcpApi.registry.mockImplementation(async () => ({ servers: [server], diagnostics: [] }));
	mcpApi.configureLocal.mockImplementation(async (_id: string, data: McpData) => {
		server = { ...server, data };
		return server;
	});
	mcpApi.upsert.mockImplementation(async (_id: string, data: McpData) => {
		server = { ...server, data };
		return {};
	});
	mcpApi.test.mockResolvedValue({
		ok: true,
		tools: ['search', 'read'],
		toolDetails: [
			{ name: 'search', description: 'Search indexed documents.' },
			{ name: 'read', description: 'Read a document.' },
		],
		toolCount: 2,
		durationMs: 25,
	});
	mcpApi.oauthStatus.mockResolvedValue(false);
	mcpApi.delete.mockResolvedValue(undefined);
});

describe('MCP details', () => {
	it('uses the router-decoded server ID without decoding it twice', async () => {
		server = {
			id: 'remote%docs',
			source: 'configured',
			data: { type: 'http', name: 'Percent ID server', url: 'https://mcp.test' },
		};

		renderDetails('remote%docs');

		expect(await screen.findByRole('heading', { name: 'Percent ID server' })).toBeInTheDocument();
		expect(mcpApi.registry).toHaveBeenCalledTimes(1);
	});

	it('edits and saves a discovered package through its local manifest API', async () => {
		const user = userEvent.setup();
		server = {
			id: 'local',
			source: 'local',
			path: '/home/user/.kucedr/mcp/servers/local',
			data: {
				type: 'stdio',
				name: 'Local files',
				command: 'node',
				args: ['server.mjs'],
				env: { MODE: 'dev' },
				cwd: '/local',
				require_approval: 'always',
			},
		};
		renderDetails('local');

		expect(await screen.findByRole('heading', { name: 'Local files' })).toBeInTheDocument();
		expect(screen.getByLabelText('Command')).toHaveValue('node');
		expect(screen.getByLabelText('Working directory (optional)')).toHaveValue('/local');
		const envKey = screen.getByLabelText('Environment variables (optional)');
		const envValue = screen.getByLabelText('Value', { selector: '#mcp-env-value' });
		await user.type(envKey, 'DEMO_COMPANY');
		await user.type(envValue, 'Kucedr Studio');
		await user.click(screen.getByRole('button', { name: 'Add environment variable' }));
		await waitFor(() =>
			expect(mcpApi.configureLocal).toHaveBeenCalledWith(
				'local',
				expect.objectContaining({
					type: 'stdio',
					env: { MODE: 'dev', DEMO_COMPANY: 'Kucedr Studio' },
					cwd: '/local',
					require_approval: 'always',
				})
			)
		);
		expect(await screen.findByText('MCP server saved.')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Remove MCP server' })).not.toBeInTheDocument();
	});

	it('tests, saves, and removes a configured remote server', async () => {
		const user = userEvent.setup();
		server = {
			id: 'remote',
			source: 'configured',
			data: { type: 'http', name: 'Remote docs', url: 'https://old.test', enabled: true },
		};
		renderDetails('remote');
		await screen.findByRole('heading', { name: 'Remote docs' });

		expect(screen.queryByRole('button', { name: 'All servers' })).not.toBeInTheDocument();
		const testButton = screen.getByRole('button', { name: 'Test' });
		expect(screen.getByLabelText('Server URL')).toHaveClass('h-8');
		await user.click(testButton);
		expect(await screen.findByText('2 tools · 25 ms')).toBeInTheDocument();
		expect(screen.getByText('search')).toBeInTheDocument();
		expect(screen.getByText(/Search indexed documents/)).toBeInTheDocument();

		const url = screen.getByLabelText('Server URL');
		await user.clear(url);
		await user.type(url, 'https://new.test');
		await waitFor(() =>
			expect(mcpApi.upsert).toHaveBeenCalledWith(
				'remote',
				expect.objectContaining({ type: 'http', url: 'https://new.test' })
			)
		);

		const removeButton = screen.getByRole('button', { name: 'Remove MCP server' });
		await user.click(removeButton);
		await user.click(screen.getByRole('button', { name: 'Delete' }));
		await waitFor(() => expect(mcpApi.delete).toHaveBeenCalledWith('remote'));
		expect(await screen.findByText('MCP list')).toBeInTheDocument();
	});

	it('uses PAT authentication instead of unsupported OAuth registration for GitHub', async () => {
		const user = userEvent.setup();
		server = {
			id: 'github',
			source: 'configured',
			data: {
				type: 'http',
				name: 'GitHub',
				url: 'https://api.githubcopilot.com/mcp/',
				enabled: true,
			},
		};
		renderDetails('github');

		const token = await screen.findByLabelText('GitHub personal access token');
		expect(screen.queryByRole('button', { name: 'Connect with OAuth' })).not.toBeInTheDocument();
		await user.type(token, 'github-token');
		await waitFor(() =>
			expect(mcpApi.upsert).toHaveBeenCalledWith(
				'github',
				expect.objectContaining({ token: 'github-token' })
			)
		);
	});
});

it.each(['gmailmcp', 'calendarmcp', 'drivemcp'])(
	'shows only OAuth controls for %s and clears stored credentials',
	async (host) => {
		const user = userEvent.setup();
		server = {
			id: 'google',
			source: 'configured',
			data: {
				type: 'http',
				url: `https://${host}.googleapis.com/mcp/v1`,
				token: 'old-token',
				client_id: 'old-client',
				client_secret: 'old-secret',
			},
		};
		mcpApi.oauthStart.mockResolvedValue({ status: 'authorized' });
		renderDetails('google');
		const connect = await screen.findByRole('button', { name: 'Connect with OAuth' });
		expect(screen.queryByLabelText(/Access token/i)).not.toBeInTheDocument();
		expect(screen.queryByLabelText(/Client ID/i)).not.toBeInTheDocument();
		expect(screen.queryByLabelText(/Client secret/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET/)).not.toBeInTheDocument();
		expect(screen.queryByText('Advanced')).not.toBeInTheDocument();
		await user.click(connect);
		await screen.findByText('Authenticated');
		expect(mcpApi.upsert).toHaveBeenCalledTimes(1);
		expect(mcpApi.upsert).toHaveBeenCalledWith(
			'google',
			expect.objectContaining({
				type: 'http',
				url: `https://${host}.googleapis.com/mcp/v1`,
				token: undefined,
				client_id: undefined,
				client_secret: undefined,
			})
		);
		expect(mcpApi.oauthStart).toHaveBeenCalledWith('google');
	}
);

it('shows saved OAuth credentials as authenticated without exposing them', async () => {
	server = {
		id: 'google',
		source: 'configured',
		data: { type: 'http', name: 'Gmail', url: 'https://gmailmcp.googleapis.com/mcp/v1' },
	};
	mcpApi.oauthStatus.mockResolvedValue(true);
	renderDetails('google');

	expect(await screen.findByText('Authenticated')).toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'Connect with OAuth' })).not.toBeInTheDocument();
});
