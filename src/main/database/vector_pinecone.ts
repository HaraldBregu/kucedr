import { Pinecone } from '@pinecone-database/pinecone';
import type { VectorDatabaseAdapter, VectorDatabaseUpload } from './vector_types';

const PINECONE_CLOUD = 'aws';
const PINECONE_REGION = 'us-east-1';
const KUCEDR_GENERATION = /^kucedr-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const pineconeVectorDatabase: VectorDatabaseAdapter = {
	service: {
		providerId: 'pinecone',
		databaseId: 'pinecone',
		providerName: 'Pinecone',
		databaseName: 'Pinecone Vector Database',
	},
	consentRecipient: (apiKey, indexName) => [
		'pinecone',
		'pinecone',
		'https://api.pinecone.io',
		PINECONE_CLOUD,
		PINECONE_REGION,
		indexName,
		apiKey,
	],
	upload: uploadPinecone,
	discard: discardPinecone,
	purge: purgePinecone,
};

async function uploadPinecone(input: VectorDatabaseUpload): Promise<void> {
	const { apiKey, indexName, generation, dimensions, records, signal, assertCurrent } = input;
	signal?.throwIfAborted();
	assertCurrent();
	const client = new Pinecone({ apiKey });
	await client.createIndex({
		name: indexName,
		dimension: dimensions,
		metric: 'cosine',
		spec: { serverless: { cloud: PINECONE_CLOUD, region: PINECONE_REGION } },
		waitUntilReady: true,
		suppressConflicts: true,
	});
	signal?.throwIfAborted();
	assertCurrent();
	const description = await client.describeIndex(indexName);
	if (
		!('serverless' in description.spec) ||
		description.spec.serverless?.cloud !== PINECONE_CLOUD ||
		description.spec.serverless.region !== PINECONE_REGION
	) {
		throw new Error('Pinecone index location differs from the consented AWS us-east-1 recipient.');
	}
	const index = client.index(indexName).namespace(generation);
	for (let start = 0; start < records.length; start += 64) {
		signal?.throwIfAborted();
		assertCurrent();
		await index.upsert({
			records: records.slice(start, start + 64).map((record) => ({
				id: record.id,
				values: [...record.vector],
				metadata: { path: record.path, text: record.text },
			})),
		});
	}
	signal?.throwIfAborted();
	assertCurrent();
}

async function discardPinecone(
	apiKey: string,
	indexName: string,
	generation: string,
	signal?: AbortSignal
): Promise<void> {
	if (!KUCEDR_GENERATION.test(generation)) throw new Error('Invalid staging namespace.');
	signal?.throwIfAborted();
	try {
		await new Pinecone({ apiKey }).index(indexName).deleteNamespace(generation);
	} catch (error) {
		if ((error as { name?: string }).name !== 'PineconeNotFoundError') throw error;
	}
}

async function purgePinecone(
	apiKey: string,
	indexName: string,
	generation?: string
): Promise<number> {
	const index = new Pinecone({ apiKey }).index(indexName);
	if (generation) {
		if (!KUCEDR_GENERATION.test(generation)) throw new Error('Invalid staging namespace.');
		await index.deleteNamespace(generation);
		return 1;
	}

	let deleted = 0;
	let paginationToken: string | undefined;
	const seenTokens = new Set<string>();
	do {
		const page = await index.listNamespaces({
			prefix: 'kucedr-',
			limit: 100,
			...(paginationToken ? { paginationToken } : {}),
		});
		for (const namespace of page.namespaces ?? []) {
			const name = namespace.name ?? '';
			if (!KUCEDR_GENERATION.test(name)) continue;
			await index.deleteNamespace(name);
			deleted += 1;
		}
		const next = page.pagination?.next;
		if (!next || seenTokens.has(next)) break;
		seenTokens.add(next);
		paginationToken = next;
	} while (paginationToken);
	return deleted;
}
