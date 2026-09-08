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
	oauthStart: jest.fn(),
	oauthFinish: jest.fn(),
};

let server: McpServerInfo;

function renderDetails(id: string): ReturnType<typeof render> {
	return render(
		<MemoryRouter initialEntries={[`/settings/agent/mcp/${encodeURIComponent(id)}`]}>
			<Routes>
				<Route path="/settings/agent/mcp" element={<p>MCP list</p>} />
				<Route path="/settings/agent/mcp/:mcpServerId" element={<McpDetailsPage />} />
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
		toolCount: 2,
		durationMs: 25,
	});
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
		await user.click(screen.getByRole('button', { name: 'Save and trust' }));

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

		await user.click(screen.getByRole('button', { name: 'Test' }));
		expect(await screen.findByText('2 tools · 25 ms')).toBeInTheDocument();

		const url = screen.getByLabelText('Server URL');
		await user.clear(url);
		await user.type(url, 'https://new.test');
		await user.click(screen.getByRole('button', { name: 'Save' }));
		await waitFor(() =>
			expect(mcpApi.upsert).toHaveBeenCalledWith(
				'remote',
				expect.objectContaining({ type: 'http', url: 'https://new.test' })
			)
		);

		await user.click(screen.getByText('Advanced'));
		await user.click(screen.getByRole('button', { name: 'Remove MCP server' }));
		await user.click(screen.getByRole('button', { name: 'Delete' }));
		await waitFor(() => expect(mcpApi.delete).toHaveBeenCalledWith('remote'));
		expect(await screen.findByText('MCP list')).toBeInTheDocument();
	});
});
