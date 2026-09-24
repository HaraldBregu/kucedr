import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogService } from '../../../src/shared/provider_types';
import PluginsPage from '../../../src/renderer/src/pages/settings/pages/plugins/Page';

const catalog = [
	'gmail',
	'google-calendar',
	'google-drive',
	'google-contacts',
	'google-docs',
	'google-sheets',
	'google-maps',
	'github',
	'gitlab',
	'notion',
].map(
	(id): CatalogService => ({
		id,
		name: id,
		description: `Use ${id}.`,
		type: 'mcp',
		url: `https://${id}.example/mcp`,
		iconDarkUrl: `https://icons.example/${id}.png`,
		iconLightUrl: `https://icons.example/${id}.png`,
		provider: {
			id: [
				'gmail',
				'google-calendar',
				'google-drive',
				'google-contacts',
				'google-docs',
				'google-sheets',
				'google-maps',
			].includes(id)
				? 'google'
				: id,
			name: [
				'gmail',
				'google-calendar',
				'google-drive',
				'google-contacts',
				'google-docs',
				'google-sheets',
				'google-maps',
			].includes(id)
				? 'Google'
				: id,
			baseUrl: `https://${id}.example/mcp`,
		},
	})
);

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

jest.mock('../../../src/renderer/src/lib/providers', () => ({
	mcps: () => catalog,
}));

const mcpApi = {
	list: jest.fn(),
	upsert: jest.fn(),
	delete: jest.fn(),
};

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
	Object.defineProperty(window, 'mcp', { configurable: true, value: mcpApi });
	mcpApi.list.mockResolvedValue({
		gmail: { type: 'http', name: 'gmail', url: 'https://gmail.example/mcp', enabled: true },
	});
	mcpApi.upsert.mockResolvedValue({});
	mcpApi.delete.mockResolvedValue(undefined);
});

it('renders the plugin providers with descriptions', async () => {
	const { container } = render(<PluginsPage />);

	expect(screen.getByRole('heading', { name: 'settings.integrations.title' })).toBeInTheDocument();
	await waitFor(() =>
		expect(
			screen.getByRole('button', { name: 'settings.integrations.options' })
		).toBeInTheDocument()
	);
	expect(screen.getAllByRole('button', { name: 'settings.integrations.add' })).toHaveLength(9);
	expect(container.querySelectorAll('[data-slot="item"]')).toHaveLength(10);
	expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(0);
	expect(screen.getByText('Use gmail.')).toBeInTheDocument();
	expect(
		container.querySelector('img[src="https://icons.example/google-drive.png"]')
	).toBeInTheDocument();
	expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
});

it('enables an integration without opening configuration UI', async () => {
	const user = userEvent.setup();
	render(<PluginsPage />);

	await screen.findByRole('button', { name: 'settings.integrations.options' });
	await user.click(screen.getAllByRole('button', { name: 'settings.integrations.add' })[8]);

	await waitFor(() =>
		expect(mcpApi.upsert).toHaveBeenCalledWith('notion', {
			type: 'http',
			name: 'notion',
			url: 'https://notion.example/mcp',
			enabled: true,
		})
	);
});

it('removes the MCP server from the added plugin menu', async () => {
	const user = userEvent.setup();
	render(<PluginsPage />);

	const gmailOptions = await screen.findByRole('button', { name: 'settings.integrations.options' });
	await user.click(gmailOptions);
	await user.click(screen.getByRole('menuitem', { name: 'settings.integrations.remove' }));

	await waitFor(() => expect(mcpApi.delete).toHaveBeenCalledWith('gmail'));
	expect(mcpApi.upsert).not.toHaveBeenCalled();
	expect(screen.getAllByRole('button', { name: 'settings.integrations.add' })).toHaveLength(10);
});
