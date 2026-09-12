const mockPinecone = jest.fn();
jest.mock('@pinecone-database/pinecone', () => ({ Pinecone: mockPinecone }));

import { pineconeVectorDatabase } from '../../../../src/main/database/vector_pinecone';

const upsert = jest.fn();
const namespace = jest.fn();
const deleteNamespace = jest.fn();
const createIndex = jest.fn();
const describeIndex = jest.fn();
const listNamespaces = jest.fn();
const generation = 'kucedr-11111111-1111-1111-8111-111111111111';
const record = { id: 'chunk', path: 'notes/guide.md', text: 'Document plaintext', vector: [1, 2] };

beforeEach(() => {
	jest.resetAllMocks();
	namespace.mockReturnValue({ upsert });
	describeIndex.mockResolvedValue({ spec: { serverless: { cloud: 'aws', region: 'us-east-1' } } });
	mockPinecone.mockReturnValue({
		createIndex,
		describeIndex,
		index: () => ({ namespace, deleteNamespace, listNamespaces }),
	});
});

it('uploads only disclosed plaintext, paths and vectors in bounded batches', async () => {
	const assertCurrent = jest.fn();
	await pineconeVectorDatabase.upload({
		apiKey: 'synthetic-mirror-account',
		indexName: 'knowledge-base',
		generation,
		dimensions: 2,
		records: Array(65).fill(record),
		assertCurrent,
	});

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

it('stops the next batch when the connection or consent is no longer current', async () => {
	const assertCurrent = jest.fn();
	upsert.mockImplementation(async () => {
		assertCurrent.mockImplementation(() => {
			throw new Error('Confirm remote vector database plaintext storage');
		});
	});
	await expect(
		pineconeVectorDatabase.upload({
			apiKey: 'synthetic-mirror-account',
			indexName: 'knowledge-base',
			generation,
			dimensions: 2,
			records: Array(65).fill(record),
			assertCurrent,
		})
	).rejects.toThrow('Confirm remote vector database');
	expect(upsert).toHaveBeenCalledTimes(1);
});

it('rejects an existing index outside the consented Pinecone location before uploading', async () => {
	describeIndex.mockResolvedValue({ spec: { serverless: { cloud: 'aws', region: 'eu-west-1' } } });
	await expect(
		pineconeVectorDatabase.upload({
			apiKey: 'synthetic-mirror-account',
			indexName: 'knowledge-base',
			generation,
			dimensions: 2,
			records: [record],
			assertCurrent: jest.fn(),
		})
	).rejects.toThrow('location differs');
	expect(upsert).not.toHaveBeenCalled();
});

it('deletes only Kucedr-owned namespaces and never the remote index', async () => {
	listNamespaces.mockResolvedValue({
		namespaces: [{ name: generation }, { name: 'another-application' }],
	});
	await expect(
		pineconeVectorDatabase.purge('synthetic-mirror-account', 'knowledge-base')
	).resolves.toBe(1);
	expect(deleteNamespace).toHaveBeenCalledWith(generation);
	expect(mockPinecone.mock.results.at(-1)?.value.index('knowledge-base')).not.toHaveProperty(
		'deleteIndex'
	);
});
