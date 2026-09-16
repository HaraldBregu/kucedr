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
};

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'mcp', { configurable: true, value: mcpApi });
	mcpApi.list.mockResolvedValue({
		gmail: { type: 'http', name: 'gmail', url: 'https://gmail.example/mcp', enabled: true },
	});
	mcpApi.upsert.mockResolvedValue({});
});

it('renders the five integration providers as standard switch rows', async () => {
	render(<IntegrationsPage />);

	expect(screen.getByRole('heading', { name: 'settings.integrations.title' })).toBeInTheDocument();
	expect(screen.getAllByRole('switch').map((control) => control.getAttribute('aria-label'))).toEqual([
		'gmail',
		'google-calendar',
		'google-drive',
		'github',
		'notion',
	]);
	await waitFor(() => expect(screen.getByRole('switch', { name: 'gmail' })).toBeChecked());
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
