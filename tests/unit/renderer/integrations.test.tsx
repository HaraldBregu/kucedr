import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogService } from '../../../src/shared/provider_types';
import IntegrationsPage from '../../../src/renderer/src/pages/settings/pages/integrations/Page';

const catalog = ['gmail', 'google-calendar', 'google-drive', 'github', 'notion'].map(
	(id): CatalogService => ({
		id,
		name: id,
		type: 'mcp',
		url: `https://${id}.example/mcp`,
		provider: {
			id,
			name: id,
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

it('renders the five integration providers as model-provider cards', async () => {
	const { container } = render(<IntegrationsPage />);

	expect(screen.getByRole('heading', { name: 'settings.integrations.title' })).toBeInTheDocument();
	expect(screen.getAllByRole('switch').map((control) => control.getAttribute('aria-label'))).toEqual([
		'gmail',
		'google-calendar',
		'google-drive',
		'github',
		'notion',
	]);
	await waitFor(() => expect(screen.getByRole('switch', { name: 'gmail' })).toBeChecked());
	expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(5);
	expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
});

it('enables an integration without opening configuration UI', async () => {
	const user = userEvent.setup();
	render(<IntegrationsPage />);

	await user.click(screen.getByRole('switch', { name: 'notion' }));

	await waitFor(() =>
		expect(mcpApi.upsert).toHaveBeenCalledWith('notion', {
			type: 'http',
			name: 'notion',
			url: 'https://notion.example/mcp',
			enabled: true,
		})
	);
});

it('removes the MCP server when an integration is disabled', async () => {
	const user = userEvent.setup();
	render(<IntegrationsPage />);

	const gmailSwitch = screen.getByRole('switch', { name: 'gmail' });
	await waitFor(() => expect(gmailSwitch).toBeChecked());
	await user.click(gmailSwitch);

	await waitFor(() => expect(mcpApi.delete).toHaveBeenCalledWith('gmail'));
	expect(mcpApi.upsert).not.toHaveBeenCalled();
	expect(gmailSwitch).not.toBeChecked();
});
