import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProvidersPage from '../../../src/renderer/src/pages/settings/pages/providers/Page';

jest.mock('react-i18next', () => {
	const translations: Record<string, string> = {
		'settings.tabs.providers': 'Providers',
		'settings.providers.description': 'Connect providers and configure models.',
		'settings.overview.groups.mlModels': 'Models',
		'settings.tabs.channels': 'Channels',
	};
	const t = (key: string): string => translations[key] ?? key;
	return { useTranslation: () => ({ t }) };
});

beforeEach(() => {
	Object.defineProperty(window, 'provider', {
		configurable: true,
		value: {
			list: jest.fn().mockResolvedValue([]),
			vaultStatus: jest.fn().mockResolvedValue({
				persistence: 'encrypted',
				cloudConfigured: false,
				unlocked: false,
				pending: 0,
			}),
		},
	});
	Object.defineProperty(window, 'search', {
		configurable: true,
		value: {
			getSettings: jest.fn().mockResolvedValue({
				engineId: null,
				configured: { brave: false, tavily: false },
			}),
		},
	});
	Object.defineProperty(window, 'mcp', {
		configurable: true,
		value: { list: jest.fn().mockResolvedValue({}) },
	});
});

describe('Providers settings', () => {
	it('removes the settings shell padding when embedded', () => {
		const { container } = render(
			<MemoryRouter>
				<ProvidersPage embedded section="models" />
			</MemoryRouter>
		);

		expect(container.firstElementChild).toHaveClass('p-0', 'sm:p-0');
	});

	it('shows provider connections without object storage', async () => {
		render(
			<MemoryRouter>
				<ProvidersPage />
			</MemoryRouter>
		);

		expect(screen.getByRole('heading', { name: 'Models' })).toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Databases' })).not.toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Search' })).toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Channels' })).not.toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: /storage/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /storage/i })).not.toBeInTheDocument();
		await waitFor(() => expect(window.provider.list).toHaveBeenCalled());
	});
});
