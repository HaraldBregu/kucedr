import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProvidersOverviewPage from '../../../src/renderer/src/pages/settings/pages/providers/Overview';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

it('keeps every provider category visible even when no plugins are enabled', () => {
	render(
		<MemoryRouter>
			<ProvidersOverviewPage />
		</MemoryRouter>
	);

	expect(screen.getByRole('heading', { name: 'settings.tabs.providers' })).toBeInTheDocument();
	expect(screen.getByText('settings.tabs.databases').closest('a')).toHaveAttribute(
		'href',
		'/settings/providers/database'
	);
	expect(screen.queryByText('settings.tabs.storage')).not.toBeInTheDocument();
	expect(screen.queryByText('settings.overview.groups.mlModels')).not.toBeInTheDocument();
	expect(screen.queryByText('settings.tabs.searchEngines')).not.toBeInTheDocument();
});
