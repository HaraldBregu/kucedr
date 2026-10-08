import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import KnowledgePage from '../../../src/renderer/src/pages/settings/pages/knowledge/Page';

jest.mock('@/components/ui/select', () => {
	const React = jest.requireActual<typeof import('react')>('react');
	const Context = React.createContext({
		value: null as string | null,
		disabled: false,
		onValueChange: (_value: string) => {},
	});
	return {
		Select: ({
			value,
			disabled,
			onValueChange,
			children,
		}: {
			value: string | null;
			disabled: boolean;
			onValueChange: (value: string) => void;
			children: React.ReactNode;
		}) => (
			<Context.Provider value={{ value, disabled, onValueChange }}>{children}</Context.Provider>
		),
		SelectTrigger: ({
			children,
			size: _size,
			...props
		}: React.ComponentProps<'button'> & { size?: string }) => {
			const { disabled } = React.useContext(Context);
			return (
				<button {...props} role="combobox" disabled={disabled}>
					{children}
				</button>
			);
		},
		SelectValue: ({
			children,
			placeholder,
		}: {
			children: React.ReactNode;
			placeholder?: string;
		}) => <>{children || placeholder}</>,
		SelectContent: ({ children }: { children: React.ReactNode }) => (
			<div role="listbox">{children}</div>
		),
		SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
			const context = React.useContext(Context);
			return (
				<button
					role="option"
					aria-selected={context.value === value}
					disabled={context.disabled}
					onClick={() => context.onValueChange(value)}
				>
					{children}
				</button>
			);
		},
	};
});

jest.mock('react-i18next', () => {
	const translations: Record<string, string> = {
		'settings.knowledge.title': 'Knowledge',
		'settings.knowledge.enabled': 'Enable Knowledge',
		'settings.knowledge.embeddingTitle': 'Embedding',
		'settings.knowledge.configureModels': 'Configure models',
		'settings.knowledge.configureDatabases': 'Configure databases',
		'settings.knowledge.embeddingModelTitle': 'Embedding model',
		'settings.knowledge.embeddingConsent': 'Send document text for embeddings',
		'settings.knowledge.storageTitle': 'Storage',
		'settings.knowledge.databaseTitle': 'Vector database',
		'settings.knowledge.databasePlaceholder': 'Select database',
		'settings.knowledge.localDatabase': 'Local SQLite',
		'settings.knowledge.mirrorConsent': 'Store plaintext knowledge in the vector database',
		'settings.knowledge.indexName': 'Index name',
		'settings.knowledge.sourceFolder': 'Source folders',
		'settings.knowledge.pickFolder': 'Choose folder',
		'settings.knowledge.removeFolderPath': 'Remove {{folder}}',
		'settings.knowledge.index': 'Generate index',
		'settings.knowledge.indexingTitle': 'Indexing',
		'settings.knowledge.scheduleFrequency': 'Indexing frequency',
		'settings.knowledge.scheduleOptions.off': 'Off',
		'settings.knowledge.scheduleOptions.every4h': 'Every 4 hours',
		'settings.knowledge.scheduleOptions.every12h': 'Every 12 hours',
		'settings.knowledge.scheduleOptions.every1d': 'Every day',
		'settings.knowledge.scheduleOptions.every7d': 'Every week',
		'settings.knowledge.scheduleOptions.custom': 'Custom schedule',
		'settings.knowledge.cronExpression': 'Cron expression',
		'settings.knowledge.timezone': 'Time zone',
		'settings.knowledge.status.idle': 'Not indexed',
		'settings.knowledge.status.running': 'Indexing in progress',
		'settings.knowledge.status.completed': 'Index up to date',
		'settings.knowledge.status.failed': 'Indexing failed',
		'settings.knowledge.status.stale': 'Rebuild required',
		'settings.knowledge.cancel': 'Cancel',
		'settings.knowledge.cancelling': 'Cancelling',
		'settings.knowledge.retry': 'Retry',
		'settings.knowledge.searchQuery': 'Test query',
		'settings.knowledge.search': 'Search',
		'settings.knowledge.searching': 'Searching',
		'settings.knowledge.minimumScore': 'Minimum similarity',
		'settings.knowledge.modelChanged': 'The embedding model changed.',
		'settings.knowledge.configurationChanged': 'The embedding service or source folders changed.',
		'settings.modelServices.modelPlaceholder': 'Select model',
		'settings.dataControls.title': 'Data management',
		'settings.dataControls.export': 'Export',
		'settings.dataControls.purge': 'Purge',
		'settings.dataControls.ragIndex': 'Full local knowledge index',
		'settings.dataControls.ragNamespace': 'Active local namespace',
		'settings.dataControls.remoteNamespace': 'Remote vector database namespace',
		'settings.dataControls.remoteAllNamespaces': 'All remote vector namespaces',
	};
	const t = (key: string, options?: Record<string, unknown>): string =>
		(translations[key] ?? key).replace(/{{(\w+)}}/g, (_, token: string) =>
			String(options?.[token] ?? '')
		);
	return { useTranslation: () => ({ t, i18n: { language: 'en' } }) };
});

jest.mock('@/lib/providers', () => ({
	modelsFor: () => [
		{
			id: 'text-embedding-3-small',
			name: 'Text Embedding 3 Small',
			type: 'embedding',
			provider: { id: 'openai', name: 'OpenAI' },
		},
		{
			id: 'voyage-3',
			name: 'Voyage 3',
			type: 'embedding',
			provider: { id: 'voyage', name: 'Voyage' },
		},
	],
}));

const agentApi = {
	ragGetConfiguration: jest.fn(),
	ragSaveConfiguration: jest.fn(),
	ragGetStatus: jest.fn(),
	ragCancelIndex: jest.fn(),
	ragIndex: jest.fn(),
	ragSearch: jest.fn(),
	ragPickFolder: jest.fn(),
};
const databaseApi = { list: jest.fn(), getConfiguration: jest.fn(), saveConfiguration: jest.fn() };
const embeddingApi = {
	getProviderId: jest.fn(),
	getModelId: jest.fn(),
	setProviderId: jest.fn(),
	setModelId: jest.fn(),
};
const dataControls = {
	listScopes: jest.fn(),
	export: jest.fn(),
	previewPurge: jest.fn(),
	purge: jest.fn(),
};
let configuration: import('../../../src/shared/rag_types').RagConfiguration;
let status: import('../../../src/shared/rag_status').RagStatus;

beforeEach(() => {
	jest.clearAllMocks();
	configuration = {
		enabled: false,
		indexName: 'kucedr',
		databaseProviderId: '',
		databaseId: '',
		embeddingProviderId: 'openai',
		embeddingModelId: 'text-embedding-3-small',
		embeddingConsent: null,
		mirrorConsent: null,
		folders: [],
		scheduleEnabled: false,
		cronExpression: '0 3 * * *',
		timezone: 'Europe/Rome',
		minimumScore: 0,
	};
	status = {
		running: false,
		trigger: null,
		startedAt: null,
		finishedAt: null,
		outcome: 'idle',
		error: null,
		result: null,
		nextRunAt: null,
		timezone: 'Europe/Rome',
		index: null,
	};
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
	Object.defineProperty(window, 'database', { configurable: true, value: databaseApi });
	Object.defineProperty(window, 'agent', { configurable: true, value: agentApi });
	Object.defineProperty(window, 'models', {
		configurable: true,
		value: { embedding: embeddingApi },
	});
	Object.defineProperty(window, 'dataControls', { configurable: true, value: dataControls });
	databaseApi.list.mockResolvedValue([
		{
			providerId: 'pinecone',
			databaseId: 'pinecone',
			providerName: 'Pinecone',
			databaseName: 'Pinecone Vector Database',
		},
	]);
	agentApi.ragGetConfiguration.mockImplementation(async () => configuration);
	agentApi.ragGetStatus.mockImplementation(async () => status);
	agentApi.ragSaveConfiguration.mockImplementation(async (next) => {
		configuration = {
			...next,
			embeddingConsent: next.embeddingConsent
				? { ...next.embeddingConsent, recipient: 'embedding-recipient' }
				: null,
			mirrorConsent: next.mirrorConsent
				? { ...next.mirrorConsent, recipient: 'mirror-recipient' }
				: null,
		};
		return configuration;
	});
	agentApi.ragIndex.mockResolvedValue({ files: 1, vectors: 2 });
	agentApi.ragCancelIndex.mockResolvedValue(undefined);
	agentApi.ragSearch.mockResolvedValue([]);
	agentApi.ragPickFolder.mockResolvedValue('/Users/example/docs');
	dataControls.listScopes.mockResolvedValue([
		{ kind: 'rag', mode: 'local_index', indexName: 'kucedr' },
		{ kind: 'rag', mode: 'local_namespace', indexName: 'kucedr', generation: 'generation' },
		{ kind: 'rag', mode: 'remote_namespace', indexName: 'kucedr', generation: 'generation' },
		{ kind: 'rag', mode: 'remote_all_namespaces', indexName: 'kucedr' },
	]);
	dataControls.export.mockResolvedValue(undefined);
	dataControls.previewPurge.mockResolvedValue({ confirmationId: 'confirmation-id' });
	dataControls.purge.mockResolvedValue(undefined);
});

it('organizes Knowledge into source, embedding, storage, indexing and search controls', async () => {
	configuration.folders = ['/Users/example/docs'];
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	await screen.findByText('/Users/example/docs');
	for (const name of ['Source folders', 'Embedding', 'Storage', 'Indexing']) {
		expect(screen.getByRole('heading', { name })).toBeInTheDocument();
	}
	expect(screen.getByRole('combobox', { name: 'Embedding model' })).toHaveTextContent(
		'OpenAI / Text Embedding 3 Small'
	);
	expect(screen.getByLabelText('Index name')).toHaveValue('kucedr');
	expect(screen.getByLabelText('Test query')).toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'Remove /Users/example/docs' })).toBeInTheDocument();
});

it('preserves an unavailable embedding selection without changing it on load', async () => {
	configuration.embeddingProviderId = 'removed';
	configuration.embeddingModelId = 'previous-model';
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	const model = await screen.findByRole('combobox', { name: 'Embedding model' });
	expect(model).toHaveTextContent('Select model');
	expect(agentApi.ragSaveConfiguration).not.toHaveBeenCalled();
	expect(embeddingApi.setProviderId).not.toHaveBeenCalled();
	expect(embeddingApi.setModelId).not.toHaveBeenCalled();
});

it('saves the embedding provider and model together and clears its old disclosure', async () => {
	configuration.embeddingConsent = {
		providerId: 'openai',
		modelId: 'text-embedding-3-small',
		version: 1,
		recipient: 'old',
	};
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	await screen.findByRole('combobox', { name: 'Embedding model' });
	fireEvent.click(screen.getByRole('option', { name: 'Voyage / Voyage 3' }));
	await waitFor(() =>
		expect(agentApi.ragSaveConfiguration).toHaveBeenCalledWith(
			expect.objectContaining({
				embeddingProviderId: 'voyage',
				embeddingModelId: 'voyage-3',
				embeddingConsent: null,
			})
		)
	);
	await waitFor(() =>
		expect(screen.getByRole('combobox', { name: 'Embedding model' })).toHaveTextContent(
			'Voyage / Voyage 3'
		)
	);
	expect(embeddingApi.setProviderId).not.toHaveBeenCalled();
	expect(embeddingApi.setModelId).not.toHaveBeenCalled();
	expect(
		screen.getByRole('switch', { name: 'Send document text for embeddings' })
	).not.toBeChecked();
});

it('keeps the persisted model selected when a model save fails', async () => {
	agentApi.ragSaveConfiguration.mockRejectedValueOnce(new Error('Unable to save model'));
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	const model = await screen.findByRole('combobox', { name: 'Embedding model' });
	fireEvent.click(screen.getByRole('option', { name: 'Voyage / Voyage 3' }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save model');
	expect(model).toHaveTextContent('OpenAI / Text Embedding 3 Small');
	expect(model).toBeEnabled();
});

it('leaves the database unselected until the user explicitly chooses local or remote', async () => {
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	const database = await screen.findByRole('combobox', { name: 'Vector database' });
	expect(database).toHaveTextContent('Select database');
	expect(databaseApi.saveConfiguration).not.toHaveBeenCalled();
	expect(agentApi.ragSaveConfiguration).not.toHaveBeenCalled();
	expect(
		screen.queryByRole('switch', { name: 'Store plaintext knowledge in the vector database' })
	).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole('option', { name: 'Local SQLite' }));
	await waitFor(() =>
		expect(agentApi.ragSaveConfiguration).toHaveBeenCalledWith(
			expect.objectContaining({
				databaseProviderId: 'local',
				databaseId: 'sqlite',
				mirrorConsent: null,
			})
		)
	);
});

it('saves the remote selection atomically and shows its disclosure beside storage', async () => {
	configuration.databaseProviderId = 'local';
	configuration.databaseId = 'sqlite';
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	await screen.findByRole('combobox', { name: 'Vector database' });
	fireEvent.click(screen.getByRole('option', { name: 'Pinecone / Pinecone Vector Database' }));
	await waitFor(() =>
		expect(agentApi.ragSaveConfiguration).toHaveBeenCalledWith(
			expect.objectContaining({
				databaseProviderId: 'pinecone',
				databaseId: 'pinecone',
				mirrorConsent: null,
			})
		)
	);
	expect(
		await screen.findByRole('switch', { name: 'Store plaintext knowledge in the vector database' })
	).not.toBeChecked();
	expect(databaseApi.saveConfiguration).not.toHaveBeenCalled();
});

it('enables Knowledge and records consent for the selected embedding model', async () => {
	const user = userEvent.setup();
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	await user.click(await screen.findByRole('switch', { name: 'Enable Knowledge' }));
	await waitFor(() => expect(configuration.enabled).toBe(true));
	await user.click(screen.getByRole('switch', { name: 'Send document text for embeddings' }));
	await waitFor(() =>
		expect(agentApi.ragSaveConfiguration).toHaveBeenLastCalledWith(
			expect.objectContaining({
				embeddingConsent: { providerId: 'openai', modelId: 'text-embedding-3-small', version: 1 },
			})
		)
	);
});

it('does not display disclosure without a recipient as accepted', async () => {
	configuration.embeddingConsent = {
		version: 1,
		providerId: 'openai',
		modelId: 'text-embedding-3-small',
	};
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	expect(
		await screen.findByRole('switch', { name: 'Send document text for embeddings' })
	).not.toBeChecked();
});

it('allows indexing in explicitly selected local SQLite without remote storage consent', async () => {
	configuration = {
		...configuration,
		enabled: true,
		databaseProviderId: 'local',
		databaseId: 'sqlite',
		folders: ['/Users/example/docs'],
		embeddingConsent: {
			version: 1,
			providerId: 'openai',
			modelId: 'text-embedding-3-small',
			recipient: 'embedding-recipient',
		},
	};
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	const index = await screen.findByRole('button', { name: 'Generate index' });
	expect(index).toBeEnabled();
	fireEvent.click(index);
	await waitFor(() => expect(agentApi.ragIndex).toHaveBeenCalledTimes(1));
	expect(
		screen.queryByRole('switch', { name: 'Store plaintext knowledge in the vector database' })
	).not.toBeInTheDocument();
});

it('requires remote mirror consent before indexing in a selected remote database', async () => {
	configuration = {
		...configuration,
		enabled: true,
		databaseProviderId: 'pinecone',
		databaseId: 'pinecone',
		folders: ['/Users/example/docs'],
		embeddingConsent: {
			version: 1,
			providerId: 'openai',
			modelId: 'text-embedding-3-small',
			recipient: 'embedding-recipient',
		},
	};
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	const index = await screen.findByRole('button', { name: 'Generate index' });
	expect(index).toBeDisabled();
	fireEvent.click(
		screen.getByRole('switch', { name: 'Store plaintext knowledge in the vector database' })
	);
	await waitFor(() => expect(index).toBeEnabled());
});

it('saves index-name and source-folder changes immediately', async () => {
	const user = userEvent.setup();
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	const index = await screen.findByLabelText('Index name');
	await user.clear(index);
	await user.type(index, 'knowledge-base');
	await user.tab();
	await waitFor(() => expect(configuration.indexName).toBe('knowledge-base'));
	await user.click(screen.getByRole('button', { name: 'Choose folder' }));
	await waitFor(() => expect(configuration.folders).toEqual(['/Users/example/docs']));
	await user.click(screen.getByRole('button', { name: 'Remove /Users/example/docs' }));
	await waitFor(() => expect(configuration.folders).toEqual([]));
});

it('saves schedule presets and supports a custom expression and timezone', async () => {
	const user = userEvent.setup();
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	await screen.findByRole('combobox', { name: 'Indexing frequency' });
	fireEvent.click(screen.getByRole('option', { name: 'Every 4 hours' }));
	await waitFor(() =>
		expect(configuration).toEqual(
			expect.objectContaining({
				scheduleEnabled: true,
				cronExpression: '0 */4 * * *',
			})
		)
	);
	fireEvent.click(screen.getByRole('option', { name: 'Custom schedule' }));
	const cron = screen.getByLabelText('Cron expression');
	await waitFor(() => expect(cron).toBeEnabled());
	await user.clear(cron);
	await user.type(cron, '0 8 * * 1');
	await user.tab();
	await waitFor(() => expect(configuration.cronExpression).toBe('0 8 * * 1'));
	const timezone = screen.getByLabelText('Time zone');
	await user.clear(timezone);
	await user.type(timezone, 'America/New_York');
	await user.tab();
	await waitFor(() => expect(configuration.timezone).toBe('America/New_York'));
});

it('displays a background run, locks edits and data changes, and allows cancellation', async () => {
	status.running = true;
	status.outcome = 'running';
	status.trigger = 'scheduled';
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	expect(await screen.findByText('Indexing in progress')).toBeInTheDocument();
	expect(screen.getByRole('combobox', { name: 'Embedding model' })).toBeDisabled();
	expect(screen.getByLabelText('Index name')).toBeDisabled();
	expect(screen.getByRole('button', { name: 'Choose folder' })).toBeDisabled();
	const scope = await screen.findByText('Full local knowledge index');
	const row = scope.closest('[class*="grid"]') as HTMLElement;
	expect(within(row).getByRole('button', { name: 'Purge' })).toBeDisabled();
	fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
	await waitFor(() => expect(agentApi.ragCancelIndex).toHaveBeenCalledTimes(1));
});

it('blocks test search when the published index uses a different embedding model', async () => {
	configuration.enabled = true;
	configuration.embeddingConsent = {
		version: 1,
		providerId: 'openai',
		modelId: 'text-embedding-3-small',
		recipient: 'embedding-recipient',
	};
	status.index = {
		indexName: 'kucedr',
		providerId: 'voyage',
		modelId: 'voyage-3',
		dimensions: 1024,
		completedAt: '2026-10-08T12:00:00Z',
	};
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	const query = await screen.findByLabelText('Test query');
	fireEvent.change(query, { target: { value: 'a question' } });
	expect(screen.getByText('Rebuild required')).toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
	expect(agentApi.ragSearch).not.toHaveBeenCalled();
});

it('submits labeled test search with Enter and displays returned source snippets', async () => {
	const user = userEvent.setup();
	configuration.enabled = true;
	configuration.embeddingConsent = {
		version: 1,
		providerId: 'openai',
		modelId: 'text-embedding-3-small',
		recipient: 'embedding-recipient',
	};
	status.index = {
		indexName: 'kucedr',
		providerId: 'openai',
		modelId: 'text-embedding-3-small',
		dimensions: 1536,
		completedAt: '2026-10-08T12:00:00Z',
	};
	agentApi.ragSearch.mockResolvedValue([
		{ path: '/Users/example/docs/guide.md', text: 'Relevant source passage', score: 0.82 },
	]);
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	await user.type(await screen.findByLabelText('Test query'), 'what is this?{Enter}');
	await waitFor(() => expect(agentApi.ragSearch).toHaveBeenCalledWith('what is this?'));
	expect(await screen.findByText('Relevant source passage')).toBeInTheDocument();
	expect(screen.getByText('/Users/example/docs/guide.md')).toBeInTheDocument();
});

it('saves the minimum similarity threshold', async () => {
	const user = userEvent.setup();
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	const threshold = await screen.findByLabelText('Minimum similarity');
	await user.clear(threshold);
	await user.type(threshold, '0.35');
	await user.tab();
	await waitFor(() =>
		expect(agentApi.ragSaveConfiguration).toHaveBeenCalledWith(
			expect.objectContaining({ minimumScore: 0.35 })
		)
	);
});

it('exports local data and only shows remote data controls for the remote selection', async () => {
	const user = userEvent.setup();
	configuration.databaseProviderId = 'pinecone';
	configuration.databaseId = 'pinecone';
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	const local = await screen.findByText('Full local knowledge index');
	const localRow = local.closest('[class*="grid"]') as HTMLElement;
	await user.click(within(localRow).getByRole('button', { name: 'Export' }));
	await waitFor(() =>
		expect(dataControls.export).toHaveBeenCalledWith({
			kind: 'rag',
			mode: 'local_index',
			indexName: 'kucedr',
		})
	);
	const remote = screen.getByText('All remote vector namespaces');
	const remoteRow = remote.closest('[class*="grid"]') as HTMLElement;
	await user.click(within(remoteRow).getByRole('button', { name: 'Purge' }));
	await waitFor(() =>
		expect(dataControls.purge).toHaveBeenCalledWith(
			{ kind: 'rag', mode: 'remote_all_namespaces', indexName: 'kucedr' },
			'confirmation-id'
		)
	);
});

it('provides a retry when loading Knowledge settings fails', async () => {
	agentApi.ragGetConfiguration.mockRejectedValueOnce(new Error('Unable to load'));
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load');
	fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
	expect(await screen.findByRole('combobox', { name: 'Embedding model' })).toBeInTheDocument();
});

it('blocks test search and marks the index stale when source folders or the embedding endpoint changed', async () => {
	configuration.enabled = true;
	configuration.embeddingConsent = {
		version: 1,
		providerId: 'openai',
		modelId: 'text-embedding-3-small',
		recipient: 'embedding-recipient',
	};
	status.outcome = 'completed';
	status.requiresIndexing = true;
	status.index = {
		indexName: 'kucedr',
		providerId: 'openai',
		modelId: 'text-embedding-3-small',
		dimensions: 1536,
		completedAt: '2026-10-08T12:00:00Z',
	};
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	const query = await screen.findByLabelText('Test query');
	fireEvent.change(query, { target: { value: 'a question' } });
	expect(screen.getByText('Rebuild required')).toBeInTheDocument();
	expect(screen.getByText('The embedding service or source folders changed.')).toBeInTheDocument();
	expect(screen.queryByText('Index up to date')).not.toBeInTheDocument();
	expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
});

it('refreshes status for an indexing run started while the page is open', async () => {
	jest.useFakeTimers();
	try {
		render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
		await screen.findByText('Not indexed');
		status = { ...status, running: true, outcome: 'running', trigger: 'scheduled' };
		await act(async () => {
			jest.advanceTimersByTime(2_000);
		});
		expect(screen.getByText('Indexing in progress')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
		expect(screen.getByRole('combobox', { name: 'Vector database' })).toBeDisabled();
	} finally {
		jest.useRealTimers();
	}
});

it('does not fall back to local SQLite when the saved remote database is unavailable', async () => {
	configuration.databaseProviderId = 'removed-remote';
	configuration.databaseId = 'old-database';
	configuration.enabled = true;
	configuration.folders = ['/Users/example/docs'];
	configuration.embeddingConsent = {
		version: 1,
		providerId: 'openai',
		modelId: 'text-embedding-3-small',
		recipient: 'embedding-recipient',
	};
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	expect(await screen.findByRole('combobox', { name: 'Vector database' })).toHaveTextContent(
		'Select database'
	);
	expect(screen.getByRole('button', { name: 'Generate index' })).toBeDisabled();
	expect(agentApi.ragSaveConfiguration).not.toHaveBeenCalled();
});

it('links directly to embedding and database provider configuration', async () => {
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	expect(await screen.findByRole('link', { name: 'Configure models' })).toHaveAttribute('href', '/settings/providers/models');
	expect(screen.getByRole('link', { name: 'Configure databases' })).toHaveAttribute('href', '/settings/providers/database');
});

it('shows a persisted index as ready after restart and retains its completion date', async () => {
	status.index = { indexName: 'kucedr', providerId: 'openai', modelId: 'text-embedding-3-small', dimensions: 1536, completedAt: '2026-10-08T12:00:00Z' };
	render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
	expect(await screen.findByText('Index up to date')).toBeInTheDocument();
	expect(screen.queryByText('Not indexed')).not.toBeInTheDocument();
	expect(screen.getByText('settings.knowledge.lastRun')).toBeInTheDocument();
});

it('refreshes the authoritative configuration when another window changes Knowledge settings', async () => {
	jest.useFakeTimers();
	try {
		render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
		const selector = await screen.findByRole('combobox', { name: 'Embedding model' });
		configuration = { ...configuration, embeddingProviderId: 'voyage', embeddingModelId: 'voyage-3' };
		await act(async () => { jest.advanceTimersByTime(2_000); });
		expect(selector).toHaveTextContent('Voyage / Voyage 3');
		expect(agentApi.ragSaveConfiguration).not.toHaveBeenCalled();
	} finally {
		jest.useRealTimers();
	}
});

it('reports a polling failure and clears it when current status can be read again', async () => {
	jest.useFakeTimers();
	try {
		render(<MemoryRouter><KnowledgePage /></MemoryRouter>);
		await screen.findByRole('combobox', { name: 'Embedding model' });
		agentApi.ragGetStatus.mockRejectedValueOnce(new Error('Cannot read indexing status'));
		await act(async () => { jest.advanceTimersByTime(2_000); });
		expect(screen.getByRole('alert')).toHaveTextContent('Cannot read indexing status');
		await act(async () => { jest.advanceTimersByTime(2_000); });
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	} finally {
		jest.useRealTimers();
	}
});
