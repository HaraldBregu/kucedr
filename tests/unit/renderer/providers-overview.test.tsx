import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProvidersOverviewPage from '../../../src/renderer/src/pages/settings/pages/providers/Overview';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

it('links to every provider configuration from the Providers overview', () => {
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
		expect(screen.getByText(name).closest('a')).toHaveAttribute('href', path);
	}
});
