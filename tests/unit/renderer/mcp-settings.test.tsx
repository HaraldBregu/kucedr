import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import McpPage from '../../../src/renderer/src/pages/settings/pages/mcp/Page';

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

function DetailTarget(): React.JSX.Element {
	const { mcpServerId } = useParams();
	return <p>Detail: {mcpServerId}</p>;
}

function renderPage(): ReturnType<typeof render> {
	return render(
		<MemoryRouter initialEntries={['/settings/agent/mcp']}>
			<Routes>
				<Route path="/settings/agent/mcp" element={<McpPage />} />
				<Route path="/settings/agent/mcp/:mcpServerId" element={<DetailTarget />} />
			</Routes>
		</MemoryRouter>
	);
}

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
	Object.defineProperty(window, 'mcp', { configurable: true, value: mcpApi });
	mcpApi.getRoot.mockResolvedValue('/home/user/.kucedr/mcp/servers');
	mcpApi.registry.mockResolvedValue({
		servers: [
			{
				id: 'remote',
				source: 'configured',
				data: { type: 'http', name: 'Remote docs', url: 'https://mcp.test', enabled: true },
			},
			{
				id: 'local',
				source: 'local',
				path: '/home/user/.kucedr/mcp/servers/local',
				data: {
					type: 'stdio',
					name: 'Local files',
					command: 'node',
					args: ['server.mjs'],
					cwd: '/local',
				},
			},
		],
		diagnostics: [],
	});
	mcpApi.importLocal.mockResolvedValue({ imported: [], skipped: [] });
	mcpApi.upsert.mockResolvedValue({});
});

describe('MCP settings', () => {
	it('shows remote and local servers in one simple list', async () => {
		renderPage();

		expect(await screen.findByText('Remote docs')).toBeInTheDocument();
		expect(screen.getByText('Local files')).toBeInTheDocument();
		expect(screen.getByText('https://mcp.test')).toBeInTheDocument();
		expect(screen.getByText('node server.mjs')).toBeInTheDocument();
		expect(screen.getAllByRole('heading', { name: 'MCP servers' })).toHaveLength(1);
		expect(screen.queryByText(/Remote services, configured commands/)).not.toBeInTheDocument();
		expect(mcpApi.getRoot).not.toHaveBeenCalled();
		expect(screen.queryByRole('heading', { name: 'Remote servers' })).not.toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Local servers' })).not.toBeInTheDocument();
		expect(screen.queryByText('/home/user/.kucedr/mcp/servers/local')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Open folder' })).toBeInTheDocument();
		expect(screen.queryByText('Open folder')).not.toBeInTheDocument();
	});

	it('opens a server detail route from the list Item', async () => {
		const user = userEvent.setup();
		renderPage();

		await user.click(await screen.findByRole('button', { name: /Local files/ }));
		expect(await screen.findByText('Detail: local')).toBeInTheDocument();
	});

	it('adds a server from an inline form', async () => {
		const user = userEvent.setup();
		renderPage();
		await screen.findByText('Local files');

		await user.click(screen.getByRole('button', { name: 'Add server' }));
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Add MCP server' })).toBeInTheDocument();
		await user.type(screen.getByLabelText('ID'), 'docs');
		await user.type(screen.getByLabelText('Server URL'), 'https://docs.test/mcp');
		await user.click(screen.getByRole('button', { name: 'Add MCP server' }));

		await waitFor(() =>
			expect(mcpApi.upsert).toHaveBeenCalledWith(
				'docs',
				expect.objectContaining({ type: 'http', url: 'https://docs.test/mcp' })
			)
		);
		expect(screen.queryByRole('heading', { name: 'Add MCP server' })).not.toBeInTheDocument();
	});

	it('uploads local packages and refreshes the unified registry', async () => {
		const user = userEvent.setup();
		renderPage();
		await screen.findByText('Local files');

		await user.click(screen.getByRole('button', { name: 'Upload' }));
		await waitFor(() => expect(mcpApi.importLocal).toHaveBeenCalledTimes(1));
		expect(mcpApi.registry).toHaveBeenCalledTimes(2);
		expect(await screen.findByText('Uploaded 0 local MCP servers.')).toBeInTheDocument();
	});
});
