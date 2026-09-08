import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RagPage from '../../../src/renderer/src/pages/settings/pages/rag/Page';

jest.mock('react-i18next', () => {
	const translations: Record<string, string> = {
		'settings.rag.title': 'RAG',
		'settings.rag.description': 'Configure retrieval-augmented generation.',
		'settings.rag.behaviorTitle': 'RAG behavior',
		'settings.rag.enabled': 'Enable RAG',
		'settings.rag.enabledDescription': 'Allow document indexing and assistant search.',
		'settings.rag.embeddingConsent': 'Send document text for embeddings',
		'settings.rag.embeddingConsentDescription':
			'Allow Kucedr to send document chunks to the selected embedding provider.',
		'settings.rag.mirrorConsent': 'Store plaintext knowledge in Pinecone',
		'settings.rag.databaseTitle': 'Vector database',
		'settings.rag.databasePlaceholder': 'Select vector database',
		'settings.rag.embeddingModelTitle': 'Embedding model',
		'settings.rag.embeddingModelDescription':
			'Model used to embed RAG documents for vector search.',
		'settings.rag.configurationTitle': 'Configuration',
		'settings.rag.indexName': 'Index name',
		'settings.rag.indexNameDescription': 'Remote vector index.',
		'settings.rag.indexNamePlaceholder': 'kucedr',
		'settings.rag.documentsDescription': 'Documents to index.',
		'settings.rag.sourceFolder': 'Source folders',
		'settings.rag.sourcePlaceholder': 'Choose source folders',
		'settings.rag.pickFolder': 'Choose folder',
		'settings.rag.index': 'Generate index',
		'settings.rag.scheduleTitle': 'Automation',
		'settings.rag.scheduleFrequency': 'Indexing frequency',
		'settings.rag.scheduleDescription': 'Choose how often indexing runs.',
		'settings.rag.scheduleOptions.off': 'Off',
		'settings.rag.scheduleOptions.every4h': 'Every 4 hours',
		'settings.rag.scheduleOptions.every12h': 'Every 12 hours',
		'settings.rag.scheduleOptions.every1d': 'Every day',
		'settings.rag.scheduleOptions.every7d': 'Every week',
		'settings.rag.scheduleOptions.custom': 'Custom schedule',
		'settings.rag.searchTitle': 'Search',
		'settings.rag.searchPlaceholder': 'Search documents',
		'settings.rag.search': 'Search',
		'settings.modelServices.modelPlaceholder': 'Select model',
		'settings.modelServices.noModels': 'No models are available.',
		'settings.dataControls.title': 'Data management',
		'settings.dataControls.export': 'Export',
		'settings.dataControls.purge': 'Purge',
		'settings.dataControls.ragIndex': 'Full local knowledge index',
		'settings.dataControls.ragIndexDescription': 'All local chunks',
		'settings.dataControls.ragNamespace': 'Active local namespace',
		'settings.dataControls.ragNamespaceDescription': 'Active local chunks',
		'settings.dataControls.remoteNamespace': 'Pinecone namespace',
		'settings.dataControls.remoteNamespaceDescription': 'Exact remote namespace',
		'settings.dataControls.remoteAllNamespaces': 'All Pinecone namespaces',
		'settings.dataControls.remoteAllNamespacesDescription': 'All remote namespaces',
	};
	const t = (key: string): string => translations[key] ?? key;
	return { useTranslation: () => ({ t }) };
});

jest.mock('@/lib/providers', () => ({
	defaultProviderId: () => 'openai',
	databases: () => [
		{ id: 'pinecone', name: 'Pinecone', provider: { id: 'pinecone', name: 'Pinecone' } },
	],
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
	ragIndex: jest.fn(),
};

const databaseApi = {
	getConfiguration: jest.fn(),
	saveConfiguration: jest.fn(),
};

const embeddingApi = {
	getProviderId: jest.fn(),
	getModelId: jest.fn(),
	setProviderId: jest.fn(),
	setModelId: jest.fn(),
};

const dataControls = {
	listScopes: jest.fn().mockResolvedValue([
		{ kind: 'rag', mode: 'local_index', indexName: 'knowledge-base' },
		{
			kind: 'rag',
			mode: 'local_namespace',
			indexName: 'knowledge-base',
			generation: 'kucedr-generation',
		},
		{
			kind: 'rag',
			mode: 'remote_namespace',
			indexName: 'knowledge-base',
			generation: 'kucedr-generation',
		},
		{ kind: 'rag', mode: 'remote_all_namespaces', indexName: 'knowledge-base' },
	]),
	export: jest.fn().mockResolvedValue(undefined),
	previewPurge: jest.fn().mockResolvedValue({ confirmationId: 'confirmation-id' }),
	purge: jest.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'PointerEvent', {
		configurable: true,
		value: MouseEvent,
	});
	Object.defineProperty(window, 'database', { configurable: true, value: databaseApi });
	databaseApi.getConfiguration.mockResolvedValue({ providerId: undefined, databaseId: undefined });
	databaseApi.saveConfiguration.mockImplementation(async (configuration) => configuration);
	Object.defineProperty(window, 'agent', { configurable: true, value: agentApi });
	Object.defineProperty(window, 'models', {
		configurable: true,
		value: { embedding: embeddingApi },
	});
	Object.defineProperty(window, 'dataControls', {
		configurable: true,
		value: dataControls,
	});
	agentApi.ragGetConfiguration.mockResolvedValue({
		enabled: false,
		indexName: 'kucedr',
		databaseProviderId: '',
		databaseId: '',
		embeddingProviderId: 'openai',
		embeddingModelId: 'text-embedding-3-small',
		embeddingConsent: null,
		folders: [],
		scheduleEnabled: false,
		cronExpression: '0 3 * * *',
	});
	agentApi.ragSaveConfiguration.mockImplementation(async (configuration) => configuration);
	embeddingApi.getProviderId.mockResolvedValue('openai');
	embeddingApi.getModelId.mockResolvedValue('text-embedding-3-small');
	embeddingApi.setProviderId.mockResolvedValue(undefined);
	embeddingApi.setModelId.mockResolvedValue(undefined);
});

it('manages RAG data from the RAG page', async () => {
	const user = userEvent.setup();
	render(<RagPage />);

	const localIndex = await screen.findByText('Full local knowledge index');
	const localIndexRow = localIndex.closest('[class*="grid"]') as HTMLElement;
	await user.click(within(localIndexRow).getByRole('button', { name: 'Export' }));
	await waitFor(() =>
		expect(dataControls.export).toHaveBeenCalledWith({
			kind: 'rag',
			mode: 'local_index',
			indexName: 'knowledge-base',
		})
	);

	const allRemote = screen.getByText('All Pinecone namespaces');
	const allRemoteRow = allRemote.closest('[class*="grid"]') as HTMLElement;
	await user.click(within(allRemoteRow).getByRole('button', { name: 'Purge' }));
	await waitFor(() =>
		expect(dataControls.purge).toHaveBeenCalledWith(
			{ kind: 'rag', mode: 'remote_all_namespaces', indexName: 'knowledge-base' },
			'confirmation-id'
		)
	);
});

it('loads and saves the embedding model used by RAG', async () => {
	render(<RagPage />);

	expect(await screen.findByRole('heading', { name: 'RAG' })).toBeInTheDocument();
	const selector = await screen.findByRole('combobox', { name: 'Embedding model' });
	expect(selector).toHaveTextContent('OpenAI / Text Embedding 3 Small');

	fireEvent.keyDown(selector, { key: 'ArrowDown' });
	fireEvent.click(await screen.findByRole('option', { name: 'Voyage / Voyage 3' }));

	await waitFor(() => {
		expect(embeddingApi.setProviderId).toHaveBeenCalledWith('voyage');
		expect(embeddingApi.setModelId).toHaveBeenCalledWith('voyage-3');
	});
});

it('enables RAG from its settings page', async () => {
	const user = userEvent.setup();
	render(<RagPage />);

	const toggle = await screen.findByRole('switch', { name: 'Enable RAG' });
	expect(toggle).not.toBeChecked();
	await user.click(toggle);
	await waitFor(() =>
		expect(agentApi.ragSaveConfiguration).toHaveBeenCalledWith(
			expect.objectContaining({ enabled: true })
		)
	);
});

it('records remote embedding consent for the selected provider and model', async () => {
	const user = userEvent.setup();
	render(<RagPage />);

	const consent = await screen.findByRole('switch', {
		name: 'Send document text for embeddings',
	});
	await user.click(consent);

	await waitFor(() =>
		expect(agentApi.ragSaveConfiguration).toHaveBeenCalledWith(
			expect.objectContaining({
				embeddingConsent: {
					providerId: 'openai',
					modelId: 'text-embedding-3-small',
					version: 1,
				},
			})
		)
	);
});

it('requires RAG and both disclosures before indexing', async () => {
	databaseApi.getConfiguration.mockResolvedValue({
		providerId: 'pinecone',
		databaseId: 'pinecone',
	});
	const user = userEvent.setup();
	const configuration = await agentApi.ragGetConfiguration();
	agentApi.ragGetConfiguration.mockResolvedValue({
		...configuration,
		folders: ['/Users/example/docs'],
	});
	agentApi.ragSaveConfiguration.mockImplementation(async (next) => ({
		...next,
		embeddingConsent: next.embeddingConsent
			? { ...next.embeddingConsent, recipient: 'embedding-recipient' }
			: null,
		mirrorConsent: next.mirrorConsent
			? { ...next.mirrorConsent, recipient: 'mirror-recipient' }
			: null,
	}));
	agentApi.ragIndex.mockResolvedValue({ files: 1, vectors: 2 });
	render(<RagPage />);

	await screen.findByText('/Users/example/docs');
	const index = screen.getByRole('button', { name: 'Generate index' });
	expect(index).toBeDisabled();
	await user.click(screen.getByRole('switch', { name: 'Enable RAG' }));
	expect(index).toBeDisabled();
	await user.click(screen.getByRole('switch', { name: 'Send document text for embeddings' }));
	expect(index).toBeDisabled();
	await user.click(screen.getByRole('switch', { name: 'Store plaintext knowledge in Pinecone' }));
	await waitFor(() => expect(index).toBeEnabled());
	await user.click(index);
	await waitFor(() => expect(agentApi.ragIndex).toHaveBeenCalledTimes(1));
	await waitFor(() => expect(index).toBeEnabled());

	await user.click(screen.getByRole('switch', { name: 'Send document text for embeddings' }));
	expect(index).toBeDisabled();
	await user.click(index);
	expect(agentApi.ragIndex).toHaveBeenCalledTimes(1);
});

it('does not display embedding disclosure without a recipient as accepted', async () => {
	const configuration = await agentApi.ragGetConfiguration();
	agentApi.ragGetConfiguration.mockResolvedValue({
		...configuration,
		embeddingConsent: {
			version: 1,
			providerId: 'openai',
			modelId: 'text-embedding-3-small',
		},
	});
	render(<RagPage />);

	await screen.findByRole('combobox', { name: 'Embedding model' });
	expect(
		screen.getByRole('switch', { name: 'Send document text for embeddings' })
	).not.toBeChecked();
});

it('groups the model, index, and folder paths in one configuration card', async () => {
	agentApi.ragGetConfiguration.mockResolvedValue({
		indexName: 'kucedr',
		embeddingProviderId: 'openai',
		embeddingModelId: 'text-embedding-3-small',
		folders: ['/Users/example/docs'],
		scheduleEnabled: false,
		cronExpression: '0 3 * * *',
	});

	render(<RagPage />);

	await screen.findByText('/Users/example/docs');
	const configurationTitle = await screen.findByText('Configuration');
	const configurationCard = configurationTitle
		.closest('section')
		?.querySelector<HTMLElement>('[data-slot="card"]');
	expect(configurationCard).toBeInTheDocument();

	const configuration = within(configurationCard as HTMLElement);
	expect(configuration.getByRole('combobox', { name: 'Vector database' })).toBeInTheDocument();
	expect(configuration.getByRole('combobox', { name: 'Embedding model' })).toBeInTheDocument();
	expect(configuration.getByLabelText('Index name')).toHaveValue('kucedr');
	expect(configuration.getByText('/Users/example/docs')).toBeInTheDocument();
	expect(configuration.getByRole('button', { name: 'Choose folder' })).toBeInTheDocument();
	expect(screen.getAllByText('Configuration')).toHaveLength(1);
});

it('saves the selected RAG index name from the configuration card', async () => {
	const user = userEvent.setup();
	render(<RagPage />);

	expect(await screen.findByText('Configuration')).toBeInTheDocument();
	const indexName = screen.getByLabelText('Index name');
	await waitFor(() => expect(indexName).toHaveValue('kucedr'));
	await user.clear(indexName);
	await user.type(indexName, 'knowledge-base');
	expect(indexName).toHaveValue('knowledge-base');
	await user.tab();

	await waitFor(() =>
		expect(agentApi.ragSaveConfiguration).toHaveBeenCalledWith(
			expect.objectContaining({ indexName: 'knowledge-base' })
		)
	);
});

it('saves a friendly automation schedule preset', async () => {
	agentApi.ragGetConfiguration.mockResolvedValue({
		indexName: 'kucedr',
		databaseProviderId: '',
		databaseId: '',
		embeddingProviderId: 'openai',
		embeddingModelId: 'text-embedding-3-small',
		folders: [],
		scheduleEnabled: true,
		cronExpression: '0 */12 * * *',
	});

	render(<RagPage />);

	expect(await screen.findByRole('heading', { name: 'Automation' })).toBeInTheDocument();
	const frequency = screen.getByRole('combobox', { name: 'Indexing frequency' });
	await waitFor(() => expect(frequency).toHaveTextContent('Every 12 hours'));

	fireEvent.keyDown(frequency, { key: 'ArrowDown' });
	fireEvent.click(await screen.findByRole('option', { name: 'Every 4 hours' }));

	await waitFor(() =>
		expect(agentApi.ragSaveConfiguration).toHaveBeenCalledWith(
			expect.objectContaining({
				scheduleEnabled: true,
				cronExpression: '0 */4 * * *',
			})
		)
	);
});

it('leaves the vector database unselected until the user chooses one', async () => {
	render(<RagPage />);
	const selector = screen.getByRole('combobox', { name: 'Vector database' });
	await waitFor(() => expect(selector).toBeEnabled());
	expect(selector).toHaveTextContent('Select vector database');
	expect(databaseApi.saveConfiguration).not.toHaveBeenCalled();
	expect(
		screen.getByRole('switch', { name: 'Store plaintext knowledge in Pinecone' })
	).toBeDisabled();
});

it('saves an explicit vector database choice and reloads cleared disclosure', async () => {
	const configuration = await agentApi.ragGetConfiguration();
	agentApi.ragGetConfiguration.mockResolvedValue({
		...configuration,
		mirrorConsent: { version: 1, indexName: 'kucedr', recipient: 'old-recipient' },
	});
	render(<RagPage />);
	const selector = screen.getByRole('combobox', { name: 'Vector database' });
	await waitFor(() => expect(selector).toBeEnabled());
	agentApi.ragGetConfiguration.mockClear();
	agentApi.ragGetConfiguration.mockResolvedValue({ ...configuration, mirrorConsent: null });
	fireEvent.keyDown(selector, { key: 'ArrowDown' });
	fireEvent.click(await screen.findByRole('option', { name: 'Pinecone / Pinecone' }));
	await waitFor(() =>
		expect(databaseApi.saveConfiguration).toHaveBeenCalledWith({
			providerId: 'pinecone',
			databaseId: 'pinecone',
		})
	);
	await waitFor(() => expect(agentApi.ragGetConfiguration).toHaveBeenCalledTimes(1));
	await waitFor(() => expect(selector).toBeEnabled());
	expect(selector).toHaveTextContent('Pinecone / Pinecone');
	expect(
		screen.getByRole('switch', { name: 'Store plaintext knowledge in Pinecone' })
	).not.toBeChecked();
	expect(agentApi.ragSaveConfiguration).not.toHaveBeenCalled();
});

it('blocks indexing without a selected database even when disclosures are saved', async () => {
	const configuration = await agentApi.ragGetConfiguration();
	agentApi.ragGetConfiguration.mockResolvedValue({
		...configuration,
		enabled: true,
		folders: ['/Users/example/docs'],
		embeddingConsent: {
			version: 1,
			providerId: 'openai',
			modelId: 'text-embedding-3-small',
			recipient: 'embedding-recipient',
		},
		mirrorConsent: { version: 1, indexName: 'kucedr', recipient: 'mirror-recipient' },
	});
	render(<RagPage />);
	await screen.findByText('/Users/example/docs');
	await waitFor(() =>
		expect(screen.getByRole('combobox', { name: 'Vector database' })).toBeEnabled()
	);
	const index = screen.getByRole('button', { name: 'Generate index' });
	expect(index).toBeDisabled();
	fireEvent.click(index);
	expect(agentApi.ragIndex).not.toHaveBeenCalled();
});
