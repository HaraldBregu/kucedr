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
	global.fetch = jest.fn();
	namespace.mockReturnValue({ upsert });
	describeIndex.mockResolvedValue({
		dimension: 2,
		metric: 'cosine',
		spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
	});
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
	describeIndex.mockResolvedValue({
		dimension: 2,
		metric: 'cosine',
		spec: { serverless: { cloud: 'aws', region: 'eu-west-1' } },
	});
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

it.each([
	{ dimension: 3, metric: 'cosine' },
	{ dimension: 2, metric: 'dotproduct' },
])('rejects incompatible existing index %j before uploading', async (settings) => {
	describeIndex.mockResolvedValue({
		...settings,
		spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
	});
	await expect(
		pineconeVectorDatabase.upload({
			apiKey: 'synthetic',
			indexName: 'knowledge-base',
			generation,
			dimensions: 2,
			records: [record],
			assertCurrent: jest.fn(),
		})
	).rejects.toThrow('dimensions or metric differ');
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

it.each(['createIndex', 'describeIndex', 'upsert'] as const)(
	'cancels an in-flight %s HTTP request',
	async (operation) => {
		const controller = new AbortController();
		const reason = new Error('Cancelled indexing');
		let requestStarted!: () => void;
		const started = new Promise<void>((resolve) => {
			requestStarted = resolve;
		});
		jest.mocked(global.fetch).mockImplementation(
			async (_url, init) =>
				new Promise<Response>((_resolve, reject) => {
					requestStarted();
					init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
				})
		);
		({ createIndex, describeIndex, upsert })[operation].mockImplementation(() =>
			mockPinecone.mock.calls.at(-1)?.[0].fetchApi('https://api.example.test/pinecone')
		);
		const result = pineconeVectorDatabase.upload({
			apiKey: 'synthetic',
			indexName: 'knowledge-base',
			generation,
			dimensions: 2,
			records: [record],
			signal: controller.signal,
			assertCurrent: jest.fn(),
		});
		await started;
		controller.abort(reason);
		await expect(result).rejects.toBe(reason);
		expect(jest.mocked(global.fetch).mock.calls[0][1]?.signal).toBe(controller.signal);
	}
);

it('uses the separate cleanup deadline to abort an in-flight namespace deletion', async () => {
	const controller = new AbortController();
	const reason = new Error('Cleanup timed out');
	let requestStarted!: () => void;
	const started = new Promise<void>((resolve) => {
		requestStarted = resolve;
	});
	jest.mocked(global.fetch).mockImplementation(
		async (_url, init) =>
			new Promise<Response>((_resolve, reject) => {
				requestStarted();
				init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
			})
	);
	deleteNamespace.mockImplementation(() =>
		mockPinecone.mock.calls.at(-1)?.[0].fetchApi('https://api.example.test/pinecone')
	);
	const result = pineconeVectorDatabase.discard('synthetic', 'knowledge-base', generation, controller.signal);
	await started;
	controller.abort(reason);
	await expect(result).rejects.toBe(reason);
});
