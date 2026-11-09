import { KUCEDR_GENERATION } from './generation.mjs';

/** Deletes one staging namespace; a missing namespace is already discarded. */
export async function discard(client, { indexName, generation }) {
	if (!KUCEDR_GENERATION.test(generation)) throw new Error('Invalid staging namespace.');
	try {
		await client.index(indexName).deleteNamespace(generation);
	} catch (error) {
		if (error?.name !== 'PineconeNotFoundError') throw error;
	}
}
