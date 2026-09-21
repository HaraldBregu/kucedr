import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProvidersPage from '../../../src/renderer/src/pages/settings/pages/providers/Page';

jest.mock('react-i18next', () => {
	const translations: Record<string, string> = {
		'settings.tabs.providers': 'Providers',
		'settings.providers.description': 'Connect providers and configure models.',
		'settings.overview.groups.mlModels': 'Models',
		'settings.providers.localModels.title': 'Local models',
		'settings.providers.localModels.model': 'Ollama',
		'settings.providers.localModels.compatibility': 'OpenAI-compatible API',
		'settings.providers.localModels.url': 'URL',
		'settings.providers.localModels.modelId': 'Model',
		'settings.providers.localModels.token': 'Token',
		'settings.providers.localModels.connect': 'Connect',
		'settings.providers.localModels.edit': 'Edit Ollama',
		'settings.providers.localModels.refresh': 'Refresh local models',
		'settings.tabs.channels': 'Channels',
		'settings.tabs.databases': 'Database',
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

jest.mock('../../../src/renderer/src/pages/start/setupConstants', () => ({
	actionableProviderCatalog: () => [
		{
			id: 'openai',
			name: 'OpenAI',
			capabilities: 'AI provider',
			supported: true,
		},
	],
	actionableSearchCatalog: () => [
		{
			id: 'brave',
			name: 'Brave',
			capabilities: 'Web search',
			supported: true,
		},
	],
	getErrorMessage: (error: unknown, fallback: string) =>
		error instanceof Error ? error.message : fallback,
}));

beforeEach(() => {
	Object.defineProperty(window, 'provider', {
		configurable: true,
	value: {
			list: jest.fn().mockResolvedValue([]),
			set: jest.fn().mockResolvedValue({ id: 'pinecone', apiKey: 'database-secret' }),
			listCustomModels: jest.fn().mockResolvedValue(['llama3.2:3b', 'qwen3:8b']),
		},
	});
	Object.defineProperty(window, 'search', {
		configurable: true,
		value: {
			listProviders: jest.fn().mockResolvedValue([]),
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

		const modelsSection = screen.getByRole('heading', { name: 'Models' }).closest('section');
		expect(modelsSection).not.toBeNull();
		expect(
			within(modelsSection!).getAllByRole('heading').map((heading) => heading.textContent)
		).toEqual(['Models', 'Ollama', 'OpenAI']);
		expect(screen.queryByRole('heading', { name: 'Local models' })).not.toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Ollama' })).toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Databases' })).not.toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Search' })).toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Channels' })).not.toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: /storage/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /storage/i })).not.toBeInTheDocument();
		await waitFor(() => expect(window.provider.list).toHaveBeenCalled());
	});
});

it('saves Database credentials in the databases collection', async () => {
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
	expect(window.provider.list).toHaveBeenCalledWith('databases');
	expect(screen.getByText('************')).toBeInTheDocument();
	expect(screen.queryByText('database-secret')).not.toBeInTheDocument();
});

it('loads and displays saved Database keys', async () => {
	jest.mocked(window.provider.list).mockResolvedValue([
		{
			id: 'pinecone',
			name: 'Pinecone',
			baseUrl: 'https://api.pinecone.io',
			apiKey: 'database-secret',
		},
	]);
	render(
		<MemoryRouter>
			<ProvidersPage section="databases" />
		</MemoryRouter>
	);
	expect(await screen.findByText('************')).toBeInTheDocument();
	expect(screen.queryByText('database-secret')).not.toBeInTheDocument();
	const user = userEvent.setup();
	await user.click(screen.getByRole('button', { name: 'Edit Pinecone API key' }));
	expect(screen.getByLabelText('Pinecone API key')).toHaveValue('database-secret');
});

it('masks saved model keys until editing', async () => {
	jest.mocked(window.provider.list).mockResolvedValue([
		{
			id: 'openai',
			name: 'OpenAI',
			apiKey: 'model-secret',
		},
	]);
	render(
		<MemoryRouter>
			<ProvidersPage section="models" />
		</MemoryRouter>
	);

	expect(await screen.findByText('************')).toBeInTheDocument();
	expect(screen.queryByText('model-secret')).not.toBeInTheDocument();

	const user = userEvent.setup();
	await user.click(screen.getByRole('button', { name: 'Edit OpenAI API key' }));
	expect(screen.getByLabelText('OpenAI API key')).toHaveValue('model-secret');
});

it('saves a custom OpenAI-compatible model provider', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<ProvidersPage section="models" />
		</MemoryRouter>
	);

	await user.click(screen.getByRole('button', { name: 'Connect', exact: true }));
	const baseUrlInput = screen.getByLabelText('URL');
	const customCard = baseUrlInput.closest('[data-slot="card"]');
	expect(customCard).not.toBeNull();
	await user.type(baseUrlInput, 'http://localhost:11434/v1');
	await user.type(screen.getByLabelText('Model'), 'llama3.2:3b');
	await user.type(screen.getByLabelText('Token'), 'ollama');
	await user.click(within(customCard!).getByRole('button', { name: 'Save', exact: true }));

	await waitFor(() =>
		expect(window.provider.set).toHaveBeenCalledWith({
			id: 'custom',
			kind: 'models',
			apiKey: 'ollama',
			baseUrl: 'http://localhost:11434/v1',
			modelId: 'llama3.2:3b',
		})
	);
	expect(screen.getByText('llama3.2:3b')).toBeInTheDocument();
});

it('loads available custom provider models', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<ProvidersPage section="models" />
		</MemoryRouter>
	);

	await user.click(screen.getByRole('button', { name: 'Connect', exact: true }));
	await user.type(screen.getByLabelText('URL'), 'http://localhost:11434/v1');
	await user.type(screen.getByLabelText('Token'), 'ollama');
	await user.click(screen.getByRole('button', { name: 'Refresh local models' }));

	await waitFor(() =>
		expect(window.provider.listCustomModels).toHaveBeenCalledWith({
			baseUrl: 'http://localhost:11434/v1',
			apiKey: 'ollama',
		})
	);
	expect(screen.getByLabelText('Model')).toHaveValue('llama3.2:3b');
	expect(document.querySelector('option[value="qwen3:8b"]')).toBeInTheDocument();
});

it('masks saved Search keys until editing', async () => {
	jest.mocked(window.search.listProviders).mockResolvedValue([
		{
			id: 'brave',
			name: 'Brave',
			apiKey: 'search-secret',
		},
	]);
	jest.mocked(window.search.getSettings).mockResolvedValue({
		engineId: 'brave',
		configured: { brave: true, tavily: false },
	});
	render(
		<MemoryRouter>
			<ProvidersPage section="search" />
		</MemoryRouter>
	);

	expect(await screen.findByText('************')).toBeInTheDocument();
	expect(screen.queryByText('search-secret')).not.toBeInTheDocument();

	const user = userEvent.setup();
	await user.click(screen.getByRole('button', { name: 'Edit Brave API key' }));
	expect(screen.getByLabelText('Brave API key')).toHaveValue('search-secret');
});

it('keeps the Database key editable when saving fails', async () => {
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
