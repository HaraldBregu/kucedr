const generateEmbeddings = jest.fn();
const getProvider = jest.fn();
const getProviderId = jest.fn();
const getModelId = jest.fn();
const providerModels = jest.fn();

jest.mock('../../../../src/main/models/adapters/embedding', () => ({ generateEmbeddings }));
jest.mock('../../../../src/main/settings_store', () => ({ getProvider }));
jest.mock('../../../../src/main/models/selection', () => ({ getProviderId, getModelId }));
jest.mock('../../../../src/main/models', () => ({
	defaultProviderId: () => 'openai',
	providerModels,
}));

import { createEmbedding } from '../../../../src/main/models/embedding/embedding_create';
import { SelectedEmbeddingProvider } from '../../../../src/main/agent/knowledge/rag/embedding';

beforeEach(() => {
	getProvider.mockReturnValue({ apiKey: ' saved-key ' });
	getProviderId.mockReturnValue('openai');
	getModelId.mockReturnValue('text-embedding-3-small');
	providerModels.mockReturnValue([{ id: 'text-embedding-3-small' }]);
	generateEmbeddings.mockResolvedValue([[0.1, 0.2], [0.2, 0.3]]);
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
			providerId: 'openai',
			modelId: 'custom-model',
			apiKey: 'saved-key',
			inputType: 'query',
		})
	);
	expect(result).toMatchObject({ providerId: 'openai', modelId: 'custom-model', dimensions: 2 });
});

it('rejects an empty item instead of removing it and changing input positions', async () => {
	await expect(createEmbedding({ texts: ['first', ' ', 'last'] })).rejects.toThrow(
		'Every embedding input must contain text'
	);
	expect(generateEmbeddings).not.toHaveBeenCalled();
});

it.each([[], [[]], [[0, 0]], [[Number.NaN, 1]], [[Number.POSITIVE_INFINITY, 1]], [[1], [1, 2]]])(
	'rejects malformed embeddings: %j',
	async (embeddings) => {
		generateEmbeddings.mockResolvedValue(embeddings);
		await expect(createEmbedding({ texts: ['first'] })).rejects.toThrow('malformed embeddings');
	}
);

it('permits the explicitly selected local BGE endpoint for Knowledge without an API key', async () => {
	getProvider.mockReturnValue(undefined);
	generateEmbeddings.mockResolvedValue([[0.1, 0.2]]);
	await expect(
		new SelectedEmbeddingProvider().embed({
			texts: ['document'],
			inputType: 'document',
			providerId: 'bge',
			modelId: 'bge-m3',
		})
	).resolves.toMatchObject({ providerId: 'bge', modelId: 'bge-m3' });
	expect(generateEmbeddings).toHaveBeenCalledWith(
		expect.objectContaining({ apiKey: '', modelId: 'bge-m3' })
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
