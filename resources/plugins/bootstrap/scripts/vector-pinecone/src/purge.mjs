import { KUCEDR_GENERATION } from './generation.mjs';

/** Deletes one generation, or every Kucedr-owned namespace; never the index itself. */
export async function purge(client, { indexName, generation }) {
	const index = client.index(indexName);
	if (generation) {
		if (!KUCEDR_GENERATION.test(generation)) throw new Error('Invalid staging namespace.');
		await index.deleteNamespace(generation);
		return { deleted: 1 };
	}

	let deleted = 0;
	let paginationToken;
	const seenTokens = new Set();
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
	return { deleted };
}
