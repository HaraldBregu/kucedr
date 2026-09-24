import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProvidersOverviewPage from '../../../src/renderer/src/pages/settings/pages/providers/Overview';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

it('shows database and storage only when enabled from Plugins', async () => {
	Object.defineProperty(window, 'provider', {
		configurable: true,
		value: {
			listEnabledPlugins: jest
				.fn()
				.mockResolvedValue({
					database: ['pinecone/pinecone'],
					storage: ['supabase/supabase-storage'],
				}),
		},
	});
	render(
		<MemoryRouter>
			<ProvidersOverviewPage />
		</MemoryRouter>
	);

	expect(screen.getByRole('heading', { name: 'settings.tabs.providers' })).toBeInTheDocument();
	for (const [name, path] of [
		['settings.overview.groups.mlModels', '/settings/providers/models'],
		['settings.tabs.searchEngines', '/settings/providers/search'],
		['settings.tabs.databases', '/settings/providers/database'],
		['settings.tabs.storage', '/settings/providers/storage'],
	] as const) {
		expect((await screen.findByText(name)).closest('a')).toHaveAttribute('href', path);
	}
});

it('hides database and storage before they are enabled', async () => {
	Object.defineProperty(window, 'provider', {
		configurable: true,
		value: {
			listEnabledPlugins: jest.fn().mockResolvedValue({ database: [], storage: [] }),
		},
	});
	render(
		<MemoryRouter>
			<ProvidersOverviewPage />
		</MemoryRouter>
	);
	await screen.findByText('settings.overview.groups.mlModels');
	expect(screen.queryByText('settings.tabs.databases')).not.toBeInTheDocument();
	expect(screen.queryByText('settings.tabs.storage')).not.toBeInTheDocument();
});
