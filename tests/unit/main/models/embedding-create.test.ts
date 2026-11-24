const generateEmbeddings = jest.fn();
const getProvider = jest.fn();
const getProviderId = jest.fn();
const getModelId = jest.fn();
const providerModels = jest.fn();
const findModel = jest.fn();

jest.mock('../../../../src/main/models/adapters/embedding', () => ({ generateEmbeddings }));
jest.mock('../../../../src/main/settings_store', () => ({ getProvider }));
jest.mock('../../../../src/main/models/selection', () => ({ getProviderId, getModelId }));
jest.mock('../../../../src/main/models', () => ({
	defaultProviderId: () => 'openai',
	providerModels,
	findModel,
}));

import { createEmbedding } from '../../../../src/main/models/embedding/embedding_create';
import { SelectedEmbeddingProvider } from '../../../../src/main/agent/knowledge/rag/embedding';

beforeEach(() => {
	jest.clearAllMocks();
	getProvider.mockReturnValue({ apiKey: ' saved-key ' });
	getProviderId.mockReturnValue('openai');
	getModelId.mockReturnValue('text-embedding-3-small');
	providerModels.mockReturnValue([{ id: 'text-embedding-3-small' }]);
	findModel.mockImplementation((_providerId: string, _type: string, id: string) => ({
		id,
		location: 'remote',
		url: 'https://api.example.test/v1',
		provider: { name: 'Test' },
		metadata: { endpoint: '/embeddings' },
	}));
	generateEmbeddings.mockResolvedValue([
		[0.1, 0.2],
		[0.2, 0.3],
	]);
});

it('keeps each input aligned with its selected provider and model', async () => {
	const result = await createEmbedding({
		texts: [' first ', ' second '],
		providerId: ' openai ',
		modelId: ' custom-model ',
		inputType: 'query',
	});
	expect(generateEmbeddings).toHaveBeenCalledWith(
		expect.objectContaining({
			texts: ['first', 'second'],
			model: expect.objectContaining({ id: 'custom-model' }),
			baseURL: 'https://api.example.test/v1/embeddings',
			apiKey: 'saved-key',
			inputType: 'query',
		})
	);
	expect(findModel).toHaveBeenCalledWith('openai', 'embedding', 'custom-model');
	expect(result).toMatchObject({ providerId: 'openai', modelId: 'custom-model', dimensions: 2 });
});

it('rejects an empty item instead of removing it and changing input positions', async () => {
	await expect(createEmbedding({ texts: ['first', ' ', 'last'] })).rejects.toThrow(
		'Every embedding input must contain text'
	);
	expect(generateEmbeddings).not.toHaveBeenCalled();
});

it.each(
	[[], [[]], [[0, 0]], [[Number.NaN, 1]], [[Number.POSITIVE_INFINITY, 1]], [[1], [1, 2]]].map(
		(embeddings) => ({ embeddings })
	)
)('rejects malformed embeddings: $embeddings', async ({ embeddings }) => {
	generateEmbeddings.mockResolvedValue(embeddings);
	await expect(createEmbedding({ texts: ['first'] })).rejects.toThrow('malformed embeddings');
});

it('permits an explicitly selected local embedding model for Knowledge without an API key', async () => {
	getProvider.mockReturnValue(undefined);
	findModel.mockReturnValue({
		id: 'local-embedding',
		location: 'local',
		url: 'http://localhost:8080/embeddings',
		provider: { name: 'Local' },
	});
	generateEmbeddings.mockResolvedValue([[0.1, 0.2]]);
	await expect(
		new SelectedEmbeddingProvider().embed({
			texts: ['document'],
			inputType: 'document',
			providerId: 'local',
			modelId: 'local-embedding',
		})
	).resolves.toMatchObject({ providerId: 'local', modelId: 'local-embedding' });
	expect(generateEmbeddings).toHaveBeenCalledWith(
		expect.objectContaining({ apiKey: '', model: expect.objectContaining({ id: 'local-embedding' }) })
	);
});

it('requires Knowledge to select both provider and model explicitly', async () => {
	await expect(
		new SelectedEmbeddingProvider().embed({
			texts: ['document'],
			inputType: 'document',
			providerId: 'openai',
			modelId: '',
		})
	).rejects.toThrow('Select an embedding provider and model');
	expect(generateEmbeddings).not.toHaveBeenCalled();
});

it('does not call the embedding API for an already canceled request', async () => {
	const controller = new AbortController();
	controller.abort(new Error('Canceled'));
	await expect(createEmbedding({ texts: ['document'] }, controller.signal)).rejects.toThrow(
		'Canceled'
	);
	expect(generateEmbeddings).not.toHaveBeenCalled();
});

it('requires the documented base URL for models with a base URL rule', async () => {
	getProvider.mockReturnValue({
		apiKey: 'key',
		baseUrl: 'https://other.example.test/v1',
	});
	findModel.mockReturnValue({
		id: 'gateway-embedding',
		location: 'remote',
		url: 'https://gateway.example.test/v1',
		provider: { name: 'Test' },
		metadata: { baseUrlRule: { pattern: '^https://gateway\\.example\\.test$' } },
	});
	await expect(
		createEmbedding({ providerId: 'test', modelId: 'gateway-embedding', texts: ['document'] })
	).rejects.toThrow('Set the Test provider base URL');
	expect(generateEmbeddings).not.toHaveBeenCalled();
});
