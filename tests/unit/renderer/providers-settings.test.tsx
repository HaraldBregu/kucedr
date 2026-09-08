import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProvidersPage from '../../../src/renderer/src/pages/settings/pages/providers/Page';

jest.mock('react-i18next', () => {
	const translations: Record<string, string> = {
		'settings.tabs.providers': 'Providers',
		'settings.providers.description': 'Connect providers and configure models.',
		'settings.overview.groups.mlModels': 'Models',
		'settings.tabs.channels': 'Channels',
		'settings.tabs.databases': 'Vector DB',
		'common.save': 'Save',
	};
	const t = (key: string): string => translations[key] ?? key;
	return { useTranslation: () => ({ t }) };
});

jest.mock('../../../src/renderer/src/pages/settings/pages/providers/database', () => ({
	databaseCatalog: () => [
		{
			id: 'pinecone',
			name: 'Pinecone',
			capabilities: 'Vector database',
			supported: true,
			apiConfigurationUrl: 'https://app.pinecone.io',
		},
	],
}));

beforeEach(() => {
	Object.defineProperty(window, 'provider', {
		configurable: true,
		value: {
			list: jest.fn().mockResolvedValue([]),
			set: jest.fn().mockResolvedValue({ id: 'pinecone', configured: true }),
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

it('saves Vector DB credentials in the databases collection', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<ProvidersPage section="databases" />
		</MemoryRouter>
	);
	const input = await screen.findByLabelText('Pinecone API key');
	await user.type(input, '  database-secret  ');
	await user.click(screen.getByRole('button', { name: 'Save', exact: true }));
	await waitFor(() =>
		expect(window.provider.set).toHaveBeenCalledWith({
			id: 'pinecone',
			apiKey: 'database-secret',
			kind: 'databases',
		})
	);
	expect(await screen.findByRole('button', { name: 'Edit Pinecone API key' })).toBeInTheDocument();
	expect(window.provider.list).toHaveBeenCalledWith('databases');
	expect(screen.queryByLabelText('Pinecone API key')).not.toBeInTheDocument();
});

it('loads saved Vector DB status and opens a blank editor', async () => {
	jest
		.mocked(window.provider.list)
		.mockResolvedValue([
			{
				id: 'pinecone',
				name: 'Pinecone',
				kind: 'databases',
				baseUrl: 'https://api.pinecone.io',
				configured: true,
				syncStatus: 'local',
			},
		]);
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<ProvidersPage section="databases" />
		</MemoryRouter>
	);
	await user.click(await screen.findByRole('button', { name: 'Edit Pinecone API key' }));
	expect(screen.getByLabelText('Pinecone API key')).toHaveValue('');
});

it('keeps the Vector DB key editable when saving fails', async () => {
	jest.mocked(window.provider.set).mockRejectedValue(new Error('Could not store database key'));
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<ProvidersPage section="databases" />
		</MemoryRouter>
	);
	await user.type(await screen.findByLabelText('Pinecone API key'), 'database-secret');
	await user.click(screen.getByRole('button', { name: 'Save', exact: true }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Could not store database key');
	expect(screen.getByLabelText('Pinecone API key')).toHaveValue('database-secret');
});
