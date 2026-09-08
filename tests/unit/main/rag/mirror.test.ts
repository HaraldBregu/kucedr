import type { RagConfiguration } from '../../../../src/shared/rag_types';
import type { VectorRecord } from '../../../../src/main/agent/knowledge/rag/types';
const getProvider = jest.fn();
const getRagConfiguration = jest.fn();
const ragClient = jest.fn();
jest.mock('../../../../src/main/settings_store', () => ({ getProvider }));
jest.mock('../../../../src/main/agent/knowledge/rag/rag_store', () => ({ getRagConfiguration }));
jest.mock('../../../../src/main/agent/knowledge/rag/rag_client', () => ({ ragClient }));
import { authorizeRagDisclosure } from '../../../../src/main/agent/knowledge/rag/disclosure';
import { createRagMirror } from '../../../../src/main/agent/knowledge/rag/mirror';
const upsert = jest.fn();
const namespace = jest.fn();
const deleteNamespace = jest.fn();
const createIndex = jest.fn();
const describeIndex = jest.fn();
const generation = 'kucedr-11111111-1111-1111-1111-111111111111';
const record = {
	id: 'chunk',
	path: 'notes/guide.md',
	text: 'Document plaintext',
	vector: [1, 2],
} as VectorRecord;
let configuration: RagConfiguration;
beforeEach(() => {
	jest.resetAllMocks();
	getProvider.mockImplementation((_id, kind) => ({
		apiKey: kind === 'databases' ? 'synthetic-mirror-account' : 'synthetic-embedding-account',
	}));
	configuration = authorizeRagDisclosure({
		enabled: true,
		indexName: 'knowledge-base',
		databaseId: 'pinecone',
		databaseProviderId: 'pinecone',
		embeddingProviderId: 'openai',
		embeddingModelId: 'model',
		embeddingConsent: { version: 1, providerId: 'openai', modelId: 'model' },
		mirrorConsent: { version: 1, indexName: 'knowledge-base' },
		folders: [],
		scheduleEnabled: false,
		cronExpression: '0 3 * * *',
	});
	getRagConfiguration.mockImplementation(() => configuration);
	namespace.mockReturnValue({ upsert });
	describeIndex.mockResolvedValue({ spec: { serverless: { cloud: 'aws', region: 'us-east-1' } } });
	ragClient.mockReturnValue({
		createIndex,
		describeIndex,
		index: () => ({ namespace, deleteNamespace }),
	});
});

it('uploads only the disclosed plaintext, paths and vectors in bounded batches', async () => {
	await createRagMirror().upload('knowledge-base', generation, 2, Array(65).fill(record));
	expect(createIndex).toHaveBeenCalledWith(
		expect.objectContaining({ spec: { serverless: { cloud: 'aws', region: 'us-east-1' } } })
	);
	expect(namespace).toHaveBeenCalledWith(generation);
	expect(upsert.mock.calls.map(([batch]) => batch.records.length)).toEqual([64, 1]);
	expect(upsert.mock.calls[1][0]).toEqual({
		records: [
			{
				id: 'chunk',
				values: [1, 2],
				metadata: { path: 'notes/guide.md', text: 'Document plaintext' },
			},
		],
	});
});

it('stops the next batch when consent is revoked', async () => {
	upsert.mockImplementation(async () => {
		configuration.mirrorConsent = null;
	});
	await expect(
		createRagMirror().upload('knowledge-base', generation, 2, Array(65).fill(record))
	).rejects.toThrow('Confirm Pinecone');
	expect(upsert).toHaveBeenCalledTimes(1);
});

it('rejects an existing index outside the disclosed location before uploading', async () => {
	describeIndex.mockResolvedValue({ spec: { serverless: { cloud: 'aws', region: 'eu-west-1' } } });
	await expect(createRagMirror().upload('knowledge-base', generation, 2, [record])).rejects.toThrow(
		'location differs'
	);
	expect(upsert).not.toHaveBeenCalled();
});

it('pins the failed namespace cleanup to the original account even after credentials rotate', async () => {
	const mirror = createRagMirror();
	getProvider.mockImplementation((_id, kind) => ({
		apiKey: kind === 'databases' ? 'changed-account' : 'synthetic-embedding-account',
	}));
	await expect(mirror.upload('knowledge-base', generation, 2, [record])).rejects.toThrow(
		'account changed'
	);
	const signal = AbortSignal.timeout(1000);
	await mirror.discard('knowledge-base', generation, signal);
	expect(ragClient).toHaveBeenCalledWith(signal, 'synthetic-mirror-account');
	expect(deleteNamespace).toHaveBeenCalledWith(generation);
	await expect(mirror.discard('knowledge-base', 'published', signal)).rejects.toThrow(
		'Invalid staging'
	);
	expect(deleteNamespace).toHaveBeenCalledTimes(1);
});
