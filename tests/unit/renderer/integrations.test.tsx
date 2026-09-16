import { render, screen } from '@testing-library/react';
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

jest.mock('../../../src/renderer/src/pages/settings/pages/providers/McpCard', () => ({
	McpCard: ({ service }: { readonly service: CatalogService }) => (
		<div data-testid="integration-card">{service.provider.id}</div>
	),
}));

it('renders the five integration providers in the requested order', () => {
	render(<IntegrationsPage />);

	expect(screen.getByRole('heading', { name: 'settings.integrations.title' })).toBeInTheDocument();
	expect(screen.getAllByTestId('integration-card').map((card) => card.textContent)).toEqual([
		'gmail',
		'google-calendar',
		'google-drive',
		'github',
		'notion',
	]);
});
