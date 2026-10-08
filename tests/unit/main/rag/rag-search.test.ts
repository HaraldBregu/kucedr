const configuration = jest.fn();
const recipient = jest.fn();
const readRagManifest = jest.fn();
jest.mock('../../../../src/main/agent/knowledge/rag/rag_manifest', () => ({ readRagManifest }));
jest.mock('../../../../src/main/agent/knowledge/rag/rag_store', () => ({
	getRagConfiguration: configuration,
}));
jest.mock('../../../../src/main/agent/knowledge/rag/recipient', () => ({
	ragRecipient: recipient,
}));
import type {
	EmbeddingProvider,
	VectorStore,
} from '../../../../src/main/agent/knowledge/rag/types';
import { searchRag } from '../../../../src/main/agent/knowledge/rag/rag_search';

const embed = jest.fn();
const embeddings: EmbeddingProvider = { embed };
const getIndex = jest.fn();
const search = jest.fn();
const vectors: VectorStore = {
	getIndex,
	getReusableSource: jest.fn(),
	publish: jest.fn(),
	search,
	exportIndex: jest.fn(),
	purge: jest.fn(),
	close: jest.fn(),
};

beforeEach(() => {
	jest.clearAllMocks();
	readRagManifest.mockReturnValue(undefined);
	recipient.mockReturnValue('approved-recipient');
	configuration.mockReturnValue({
		enabled: true,
		indexName: 'knowledge-base',
		embeddingProviderId: 'openai',
		embeddingModelId: 'text-embedding-3-small',
		embeddingConsent: {
			providerId: 'openai',
			modelId: 'text-embedding-3-small',
			version: 1,
			recipient: 'approved-recipient',
		},
	});
	getIndex.mockReturnValue({
		indexName: 'knowledge-base',
		generation: 'kucedr-a1b2c3d4',
		providerId: 'openai',
		modelId: 'text-embedding-3-small',
		dimensions: 2,
		completedAt: '2026-08-08T00:00:00.000Z',
	});
	embed.mockResolvedValue({
		providerId: 'openai',
		modelId: 'text-embedding-3-small',
		dimensions: 2,
		embeddings: [[0.1, 0.2]],
	});
	search.mockReturnValue([
		{
			id: 'record-one',
			sourceId: 'source-one',
			sourceFingerprint: 'fingerprint',
			path: 'documents/guide.md',
			chunkIndex: 0,
			lineStart: 4,
			lineEnd: 6,
			text: 'Local guide text',
			checksum: 'checksum',
			indexedAt: '2026-08-08T00:00:00.000Z',
			vector: [0.1, 0.2],
			score: 0.91,
		},
	]);
});

it('searches SQLite with the exact embedding identity used to build the index', async () => {
	await expect(searchRag('query', 'knowledge-base', 5, { embeddings, vectors })).resolves.toEqual([
		{
			sourceId: 'source-one',
			chunkId: 'record-one',
			path: 'documents/guide.md',
			lineStart: 4,
			lineEnd: 6,
			checksum: 'checksum',
			indexedAt: '2026-08-08T00:00:00.000Z',
			text: 'Local guide text',
			score: 0.91,
		},
	]);
	expect(embed).toHaveBeenCalledWith(
		{
			texts: ['query'],
			inputType: 'query',
			providerId: 'openai',
			modelId: 'text-embedding-3-small',
		},
		expect.any(AbortSignal)
	);
	expect(search).toHaveBeenCalledWith('knowledge-base', [0.1, 0.2], 5);
});

it('passes cancellation to the query embedding provider', async () => {
	const controller = new AbortController();
	const reason = new Error('cancel query');
	embed.mockImplementationOnce(
		(_input, signal: AbortSignal) =>
			new Promise((_resolve, reject) => {
				signal.addEventListener('abort', () => reject(signal.reason), { once: true });
			})
	);
	const result = searchRag('query', 'knowledge-base', 5, {
		embeddings,
		vectors,
		signal: controller.signal,
	});
	controller.abort(reason);

	await expect(result).rejects.toBe(reason);
	expect(embed.mock.calls[0][1].aborted).toBe(true);
	expect(embed.mock.calls[0][1].reason).toBe(reason);
	expect(search).not.toHaveBeenCalled();
});

it('abstains without embedding when the selected local index is empty', async () => {
	getIndex.mockReturnValue(undefined);
	configuration.mockReturnValue({ ...configuration(), indexName: 'another-index' });

	await expect(searchRag('query', 'another-index', 5, { embeddings, vectors })).resolves.toEqual(
		[]
	);
	expect(embed).not.toHaveBeenCalled();
});

it('requires query disclosure even when an existing local index can be searched', async () => {
	configuration.mockReturnValue({ ...configuration(), embeddingConsent: null });
	await expect(searchRag('query', 'knowledge-base', 5, { embeddings, vectors })).rejects.toThrow(
		'Confirm remote embedding'
	);
	expect(embed).not.toHaveBeenCalled();
});

it('requires a rebuild after changing embedding models without making a query request', async () => {
	configuration.mockReturnValue({ ...configuration(), embeddingModelId: 'another-model' });
	await expect(searchRag('query', 'knowledge-base', 5, { embeddings, vectors })).rejects.toThrow(
		'Rebuild'
	);
	expect(embed).not.toHaveBeenCalled();
});

it.each(['', '   ', 'sk-abcdefghijklmnopqrstuvwxyz123456'])(
	'rejects unsafe or empty queries before embedding',
	async (query) => {
		await expect(searchRag(query, 'knowledge-base', 5, { embeddings, vectors })).rejects.toThrow(
			'Query'
		);
		expect(embed).not.toHaveBeenCalled();
	}
);

it.each([
	{ vectorsResponse: [[0, 0]] },
	{ vectorsResponse: [[NaN, 1]] },
	{ vectorsResponse: [] },
	{ vectorsResponse: [[1, 2, 3]] },
])('rejects malformed query vectors $vectorsResponse', async ({ vectorsResponse }) => {
	embed.mockResolvedValue({
		providerId: 'openai',
		modelId: 'text-embedding-3-small',
		dimensions: 2,
		embeddings: vectorsResponse,
	});
	await expect(searchRag('query', 'knowledge-base', 5, { embeddings, vectors })).rejects.toThrow(
		/embedding/i
	);
	expect(search).not.toHaveBeenCalled();
});

it('applies the configured relevance threshold and drops nonfinite scores', async () => {
	const match = search()[0];
	configuration.mockReturnValue({ ...configuration(), minimumScore: 0.7 });
	search.mockReturnValue([match, { ...match, score: 0.2 }, { ...match, score: NaN }]);
	await expect(
		searchRag('query', 'knowledge-base', 5, { embeddings, vectors })
	).resolves.toHaveLength(1);
});

it('stops returning evidence if access is revoked while embedding the query', async () => {
	embed.mockImplementationOnce(async () => {
		configuration.mockReturnValue({ ...configuration(), enabled: false });
		return {
			providerId: 'openai',
			modelId: 'text-embedding-3-small',
			dimensions: 2,
			embeddings: [[1, 2]],
		};
	});
	await expect(searchRag('query', 'knowledge-base', 5, { embeddings, vectors })).rejects.toThrow(
		'settings changed'
	);
	expect(search).not.toHaveBeenCalled();
});

it.each(['embeddingRecipient', 'folders'])(
	'requires a rebuild after changing published %s',
	async (field) => {
		readRagManifest.mockReturnValue({
			activeNamespace: 'kucedr-a1b2c3d4',
			[field]: field === 'folders' ? ['/old-source'] : 'old-endpoint',
		});
		await expect(searchRag('query', 'knowledge-base', 5, { embeddings, vectors })).rejects.toThrow(
			'Rebuild'
		);
		expect(embed).not.toHaveBeenCalled();
	}
);

it('includes a match exactly at the configured minimum similarity', async () => {
	const match = search()[0];
	configuration.mockReturnValue({ ...configuration(), minimumScore: 1 });
	search.mockReturnValue([
		{ ...match, score: 1 },
		{ ...match, score: 0 },
	]);
	await expect(
		searchRag('query', 'knowledge-base', 5, { embeddings, vectors })
	).resolves.toHaveLength(1);
});
