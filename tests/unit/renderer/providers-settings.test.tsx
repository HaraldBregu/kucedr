import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProvidersPage from '../../../src/renderer/src/pages/settings/pages/providers/Page';
import { databaseCatalog } from '../../../src/renderer/src/pages/settings/pages/providers/database';
import {
	actionableProviderCatalog,
	actionableSearchCatalog,
} from '../../../src/renderer/src/pages/start/setupConstants';

jest.mock('react-i18next', () => {
	const translations: Record<string, string> = {
		'settings.tabs.providers': 'Providers',
		'settings.providers.description': 'Connect providers and configure models.',
		'settings.overview.groups.mlModels': 'Models',
		'settings.providers.localModels.title': 'Local models',
		'settings.providers.localModels.model': 'Ollama',
		'settings.providers.localModels.compatibility': 'OpenAI-compatible API',
		'settings.providers.localModels.url': 'URL',
		'settings.providers.localModels.token': 'API key',
		'settings.providers.localModels.connect': 'Connect',
		'settings.providers.localModels.edit': 'Edit Ollama',
		'settings.modelServices.localModels': 'Local models',
		'settings.providers.configured': 'Configured',
		'settings.providers.notConfigured': 'Not configured',
		'settings.tabs.channels': 'Channels',
		'settings.tabs.databases': 'Database',
		'common.save': 'Save',
	};
	const t = (key: string): string => translations[key] ?? key;
	return { useTranslation: () => ({ t }) };
});

jest.mock('../../../src/renderer/src/pages/settings/pages/providers/database', () => ({
	databaseCatalog: jest.fn(),
}));

jest.mock('../../../src/renderer/src/pages/start/setupConstants', () => ({
	actionableProviderCatalog: jest.fn(),
	actionableSearchCatalog: jest.fn(),
	getErrorMessage: (error: unknown, fallback: string) =>
		error instanceof Error ? error.message : fallback,
}));

beforeEach(() => {
	jest.mocked(actionableProviderCatalog).mockReturnValue([
		{
			id: 'openai',
			name: 'OpenAI',
			capabilities: 'AI provider',
			supported: true,
			apiConfigurationUrl: 'https://platform.openai.com/api-keys',
		},
	]);
	jest
		.mocked(actionableSearchCatalog)
		.mockReturnValue([{ id: 'brave', name: 'Brave', capabilities: 'Web search', supported: true }]);
	jest.mocked(databaseCatalog).mockReturnValue([
		{
			id: 'pinecone',
			name: 'Pinecone',
			capabilities: 'Vector database',
			supported: true,
			apiConfigurationUrl: 'https://app.pinecone.io',
		},
	]);
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: { openExternalUrl: jest.fn().mockResolvedValue(undefined) },
	});
	Object.defineProperty(window, 'provider', {
		configurable: true,
		value: {
			list: jest.fn().mockResolvedValue([]),
			set: jest.fn().mockResolvedValue({ id: 'pinecone', apiKey: 'database-secret' }),
			remove: jest.fn().mockResolvedValue(undefined),
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
			saveEngine: jest.fn().mockResolvedValue({
				engineId: 'brave',
				configured: { brave: true, tavily: false },
			}),
			removeEngine: jest.fn().mockResolvedValue({
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
		expect(screen.getByRole('heading', { name: 'Local models' })).toBeInTheDocument();
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
			within(modelsSection!)
				.getAllByRole('heading')
				.map((heading) => heading.textContent)
		).toEqual(['Models', 'OpenAI', 'Ollama']);
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
	expect(screen.queryByLabelText('Pinecone API key')).not.toBeInTheDocument();
	await user.click(screen.getByRole('button', { name: 'Connect', exact: true }));
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
	expect(screen.getByText('Configured')).toBeInTheDocument();
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
	expect((await screen.findAllByText('Configured')).length).toBeGreaterThan(0);
	expect(screen.queryByText('database-secret')).not.toBeInTheDocument();
	const user = userEvent.setup();
	await user.click(screen.getByRole('button', { name: 'Options for Pinecone' }));
	await user.click(screen.getByRole('menuitem', { name: 'Edit API key' }));
	expect(screen.getByLabelText('Pinecone API key')).toHaveValue('');
	expect(screen.getByLabelText('Pinecone API key')).toHaveAttribute('placeholder', '************');
	expect(
		screen.getByLabelText('Pinecone API key').closest('[data-slot="item-actions"]')
	).not.toBeNull();
});

it.each([
	['models', 'OpenAI', 'openai'],
	['databases', 'Pinecone', 'pinecone'],
] as const)('resets a saved %s API key', async (section, name, id) => {
	jest.mocked(window.provider.list).mockResolvedValue([{ id, name, apiKey: 'saved-key' }]);
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<ProvidersPage section={section} />
		</MemoryRouter>
	);
	await screen.findByText('Configured');
	await user.click(screen.getByRole('button', { name: `Options for ${name}` }));
	await user.click(screen.getByRole('menuitem', { name: 'Reset' }));
	await waitFor(() => expect(window.provider.remove).toHaveBeenCalledWith(id, section));
	const item = screen.getByRole('heading', { name }).closest('[data-slot="item"]');
	expect(item).toHaveTextContent('Not configured');
	expect(within(item!).getByRole('button', { name: 'Connect' })).toBeInTheDocument();
});

it('resets a saved local model connection', async () => {
	jest
		.mocked(window.provider.list)
		.mockResolvedValue([
			{ id: 'custom', name: 'Ollama', apiKey: 'saved-key', baseUrl: 'http://localhost:11434/api' },
		]);
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<ProvidersPage section="models" />
		</MemoryRouter>
	);
	await screen.findByText('Configured');
	await user.click(screen.getByRole('button', { name: 'Options for Ollama' }));
	await user.click(screen.getByRole('menuitem', { name: 'Reset' }));
	await waitFor(() => expect(window.provider.remove).toHaveBeenCalledWith('custom', 'models'));
	expect(
		screen.getByRole('heading', { name: 'Ollama' }).closest('[data-slot="item"]')
	).toHaveTextContent('Not configured');
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

	expect((await screen.findAllByText('Configured')).length).toBeGreaterThan(0);
	expect(screen.queryByText('model-secret')).not.toBeInTheDocument();

	const user = userEvent.setup();
	await user.click(screen.getByRole('button', { name: 'Options for OpenAI' }));
	await user.click(screen.getByRole('menuitem', { name: 'Edit API key' }));
	expect(screen.getByLabelText('OpenAI API key')).toHaveValue('');
	expect(screen.getByLabelText('OpenAI API key')).toHaveAttribute('placeholder', '************');
	expect(
		screen.getByLabelText('OpenAI API key').closest('[data-slot="item-actions"]')
	).not.toBeNull();
});

it('keeps Connect and the API setup website available on model provider items', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<ProvidersPage section="models" />
		</MemoryRouter>
	);

	const openaiItem = screen.getByRole('heading', { name: 'OpenAI' }).closest('[data-slot="item"]');
	expect(openaiItem).not.toBeNull();
	await user.click(within(openaiItem!).getByRole('button', { name: 'Open OpenAI API setup' }));
	expect(window.app.openExternalUrl).toHaveBeenCalledWith('https://platform.openai.com/api-keys');
	const connect = within(openaiItem!).getByRole('button', { name: 'Connect' });
	expect(connect).toHaveClass('hover:bg-transparent', 'dark:hover:bg-transparent');
	await user.click(connect);
	expect(within(openaiItem!).getByLabelText('OpenAI API key')).toBeInTheDocument();
});

it('saves a custom OpenAI-compatible model provider', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<ProvidersPage section="models" />
		</MemoryRouter>
	);

	const ollamaItem = screen.getByRole('heading', { name: 'Ollama' }).closest('[data-slot="item"]');
	expect(ollamaItem).not.toBeNull();
	await user.click(within(ollamaItem!).getByRole('button', { name: 'Connect' }));
	const baseUrlInput = screen.getByLabelText('URL');
	const customItem = baseUrlInput.closest('[data-slot="item"]');
	expect(customItem).not.toBeNull();
	await user.type(baseUrlInput, 'http://localhost:11434/api');
	await user.type(screen.getByLabelText('API key'), 'ollama');
	await user.click(within(customItem!).getByRole('button', { name: 'Save', exact: true }));

	await waitFor(() =>
		expect(window.provider.set).toHaveBeenCalledWith({
			id: 'custom',
			kind: 'models',
			apiKey: 'ollama',
			baseUrl: 'http://localhost:11434/api',
		})
	);
	expect(screen.queryByLabelText('Model')).not.toBeInTheDocument();
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

	expect(await screen.findByText('Configured')).toBeInTheDocument();
	expect(screen.queryByText('search-secret')).not.toBeInTheDocument();

	const user = userEvent.setup();
	await user.click(screen.getByRole('button', { name: 'Options for Brave' }));
	await user.click(screen.getByRole('menuitem', { name: 'Edit API key' }));
	expect(screen.getByLabelText('Brave API key')).toHaveValue('');
	expect(screen.getByLabelText('Brave API key')).toHaveAttribute('placeholder', '************');
});

it('resets a saved Search API key', async () => {
	jest.mocked(window.search.getSettings).mockResolvedValue({
		engineId: 'brave',
		configured: { brave: true, tavily: false },
	});
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<ProvidersPage section="search" />
		</MemoryRouter>
	);
	await screen.findByText('Configured');
	await user.click(screen.getByRole('button', { name: 'Options for Brave' }));
	await user.click(screen.getByRole('menuitem', { name: 'Reset' }));
	await waitFor(() => expect(window.search.removeEngine).toHaveBeenCalledWith('brave'));
	expect(screen.getByText('Not configured')).toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
});

it('edits Search provider credentials in the item row', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<ProvidersPage section="search" />
		</MemoryRouter>
	);

	await user.click(screen.getByRole('button', { name: 'Connect', exact: true }));
	const input = screen.getByLabelText('Brave API key');
	const item = input.closest('[data-slot="item"]');
	expect(item).not.toBeNull();
	expect(input.closest('[data-slot="item-actions"]')).not.toBeNull();
	await user.type(input, 'brave-secret');
	await user.click(within(item!).getByRole('button', { name: 'Save', exact: true }));
	await waitFor(() =>
		expect(window.search.saveEngine).toHaveBeenCalledWith('brave', { apiKey: 'brave-secret' })
	);
});

it('keeps the Database key editable when saving fails', async () => {
	jest.mocked(window.provider.set).mockRejectedValue(new Error('Could not store database key'));
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<ProvidersPage section="databases" />
		</MemoryRouter>
	);
	await user.click(screen.getByRole('button', { name: 'Connect', exact: true }));
	await user.type(await screen.findByLabelText('Pinecone API key'), 'database-secret');
	await user.click(screen.getByRole('button', { name: 'Save', exact: true }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Could not store database key');
	expect(screen.getByLabelText('Pinecone API key')).toHaveValue('database-secret');
});

it('places connected model providers before unconnected ones', async () => {
	jest.mocked(actionableProviderCatalog).mockReturnValue([
		{ id: 'openai', name: 'OpenAI', capabilities: '', supported: true },
		{ id: 'anthropic', name: 'Anthropic', capabilities: '', supported: true },
		{ id: 'deepseek', name: 'DeepSeek', capabilities: '', supported: true },
	]);
	jest
		.mocked(window.provider.list)
		.mockResolvedValue([{ id: 'anthropic', name: 'Anthropic', apiKey: 'saved-key' }]);
	render(
		<MemoryRouter>
			<ProvidersPage section="models" />
		</MemoryRouter>
	);
	await screen.findByText('Configured');
	expect(
		Array.from(document.querySelectorAll('[data-slot="item"] h2')).map(
			(heading) => heading.textContent
		)
	).toEqual(['Anthropic', 'OpenAI', 'DeepSeek']);
});

it.each([false, true])(
	'keeps connected local models below hosted models when embedded is %s',
	async (embedded) => {
		jest.mocked(window.provider.list).mockResolvedValue([
			{
				id: 'custom',
				name: 'Ollama',
				apiKey: 'saved-key',
				baseUrl: 'http://localhost:11434/api',
			},
		]);
		render(
			<MemoryRouter>
				<ProvidersPage embedded={embedded} section="models" />
			</MemoryRouter>
		);
		await screen.findByText('Configured');
		expect(
			screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
		).toEqual(['Models', 'OpenAI', 'Local models']);
	}
);

it('places connected search providers before unconnected ones', async () => {
	jest.mocked(actionableSearchCatalog).mockReturnValue([
		{ id: 'brave', name: 'Brave', capabilities: '', supported: true },
		{ id: 'tavily', name: 'Tavily', capabilities: '', supported: true },
	]);
	jest.mocked(window.search.getSettings).mockResolvedValue({
		engineId: 'tavily',
		configured: { brave: false, tavily: true },
	});
	render(
		<MemoryRouter>
			<ProvidersPage section="search" />
		</MemoryRouter>
	);
	await screen.findByText('Configured');
	expect(
		Array.from(document.querySelectorAll('[data-slot="item"] h2')).map(
			(heading) => heading.textContent
		)
	).toEqual(['Tavily', 'Brave']);
});

it('places connected database providers before unconnected ones', async () => {
	jest.mocked(databaseCatalog).mockReturnValue([
		{ id: 'pinecone', name: 'Pinecone', capabilities: '', supported: true },
		{ id: 'weaviate', name: 'Weaviate', capabilities: '', supported: true },
	]);
	jest
		.mocked(window.provider.list)
		.mockResolvedValue([{ id: 'weaviate', name: 'Weaviate', apiKey: 'saved-key' }]);
	render(
		<MemoryRouter>
			<ProvidersPage section="databases" />
		</MemoryRouter>
	);
	await screen.findByText('Configured');
	expect(
		Array.from(document.querySelectorAll('[data-slot="item"] h2')).map(
			(heading) => heading.textContent
		)
	).toEqual(['Weaviate', 'Pinecone']);
});
