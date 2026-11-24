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
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: { mcps: jest.fn().mockResolvedValue([]) },
	});
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
		expect(screen.getAllByRole('heading', { name: 'MCP servers' })).toHaveLength(1);
		expect(screen.queryByRole('heading', { name: 'Remote servers' })).not.toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Local servers' })).not.toBeInTheDocument();
		expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(2);
		expect(screen.queryByRole('button', { name: 'Open folder' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();
	});

	it('opens a server detail route from the list Item', async () => {
		const user = userEvent.setup();
		renderPage();

		await user.click(await screen.findByRole('link', { name: /Local files/ }));
		expect(await screen.findByText('Detail: local')).toBeInTheDocument();
	});

	it('enables and disables a server without opening its detail page', async () => {
		const user = userEvent.setup();
		renderPage();

		await user.click(await screen.findByRole('switch', { name: 'Disable Remote docs' }));

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
});
