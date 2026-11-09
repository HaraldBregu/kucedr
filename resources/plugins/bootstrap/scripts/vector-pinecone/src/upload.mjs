const PINECONE_CLOUD = 'aws';
const PINECONE_REGION = 'us-east-1';

/** Creates the index if missing, checks its shape and location, and upserts into the generation namespace. */
export async function upload(client, { indexName, generation, dimensions, records }) {
	await client.createIndex({
		name: indexName,
		dimension: dimensions,
		metric: 'cosine',
		spec: { serverless: { cloud: PINECONE_CLOUD, region: PINECONE_REGION } },
		waitUntilReady: true,
		timeout: 10 * 60_000,
		suppressConflicts: true,
	});
	const description = await client.describeIndex(indexName);
	if (description.dimension !== dimensions || description.metric !== 'cosine') {
		throw new Error(
			'Pinecone index dimensions or metric differ. Choose a new index for this embedding model.'
		);
	}
	if (
		!('serverless' in description.spec) ||
		description.spec.serverless?.cloud !== PINECONE_CLOUD ||
		description.spec.serverless.region !== PINECONE_REGION
	) {
		throw new Error('Pinecone index location differs from the consented AWS us-east-1 recipient.');
	}
	const index = client.index(indexName).namespace(generation);
	for (let start = 0; start < records.length; start += 64) {
		await index.upsert({
			records: records.slice(start, start + 64).map((record) => ({
				id: record.id,
				values: [...record.vector],
				metadata: { path: record.path, text: record.text },
			})),
		});
	}
}
