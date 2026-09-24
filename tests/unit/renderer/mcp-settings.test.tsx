import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import McpPage from '../../../src/renderer/src/pages/settings/pages/mcp/Page';

jest.mock('../../../src/renderer/src/lib/providers', () => ({
	mcps: () => [
		{
			id: 'remote',
			url: 'https://mcp.test',
			description: 'Search repository documentation.',
			iconDarkUrl: '/icon-dark.png',
			iconLightUrl: '/icon-light.png',
			provider: {
				id: 'remote-provider',
				name: 'Remote provider',
				baseUrl: 'https://mcp.test',
				iconDarkUrl: '/icon-dark.png',
				iconLightUrl: '/icon-light.png',
			},
		},
	],
}));

const mcpApi = {
	list: jest.fn(),
	get: jest.fn(),
	save: jest.fn(),
	upsert: jest.fn(),
	delete: jest.fn(),
	registry: jest.fn(),
	importLocal: jest.fn(),
	configureLocal: jest.fn(),
	test: jest.fn(),
	oauthStatus: jest.fn(),
	oauthStart: jest.fn(),
};

function DetailTarget(): React.JSX.Element {
	const { mcpServerId } = useParams();
	return <p>Detail: {mcpServerId}</p>;
}

function renderPage(): ReturnType<typeof render> {
	return render(
		<MemoryRouter initialEntries={['/settings/mcp']}>
			<Routes>
				<Route path="/settings/mcp" element={<McpPage />} />
				<Route path="/settings/mcp/:mcpServerId" element={<DetailTarget />} />
			</Routes>
		</MemoryRouter>
	);
}

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
	Object.defineProperty(window, 'mcp', { configurable: true, value: mcpApi });
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
	mcpApi.upsert.mockResolvedValue({});
});

describe('MCP settings', () => {
	it('shows remote and local servers in one simple list', async () => {
		const { container } = renderPage();

		expect(await screen.findByText('Remote docs')).toBeInTheDocument();
		expect(screen.getByText('Local files')).toBeInTheDocument();
		expect(screen.getByText('Search repository documentation.')).toBeInTheDocument();
		expect(container).toHaveTextContent('Local MCP server.');
		expect(screen.getAllByRole('heading', { name: 'MCP servers' })).toHaveLength(1);
		expect(screen.queryByText(/Remote services, configured commands/)).not.toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Remote servers' })).not.toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Local servers' })).not.toBeInTheDocument();
		expect(
			screen.queryByRole('heading', { name: 'Available remote servers' })
		).not.toBeInTheDocument();
		expect(container.querySelectorAll('[data-slot="item"]')).toHaveLength(2);
		expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(0);
		expect(container.querySelector('img[src="/icon-light.png"]')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Open folder' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();
	});

	it('opens a server detail route from the list Item', async () => {
		const user = userEvent.setup();
		renderPage();

		await user.click(await screen.findByRole('button', { name: 'Open Local files' }));
		expect(await screen.findByText('Detail: local')).toBeInTheDocument();
	});

	it('enables and disables a server without opening its detail page', async () => {
		const user = userEvent.setup();
		renderPage();

		await user.click(await screen.findByRole('button', { name: 'Options for Remote docs' }));
		await user.click(screen.getByRole('menuitem', { name: 'Disable server' }));

		await waitFor(() =>
			expect(mcpApi.upsert).toHaveBeenCalledWith('remote', {
				type: 'http',
				name: 'Remote docs',
				url: 'https://mcp.test',
				enabled: false,
			})
		);
		expect(screen.queryByText('Detail: remote')).not.toBeInTheDocument();
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

		await waitFor(() =>
			expect(mcpApi.upsert).toHaveBeenCalledWith(
				'docs',
				expect.objectContaining({ type: 'http', url: 'https://docs.test/mcp' })
			)
		);
		expect(screen.queryByRole('heading', { name: 'Add MCP server' })).not.toBeInTheDocument();
	});
});
