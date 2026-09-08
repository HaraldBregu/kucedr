import { getRagConfiguration } from './rag_store';
import { assertRagConsent } from './consent';
import { ragDatabaseKey } from './database';

export function assertMirrorCurrent(apiKey: string, indexName: string): void {
	const configuration = getRagConfiguration();
	if (ragDatabaseKey(configuration) !== apiKey)
		throw new Error('Pinecone account changed during indexing.');
	assertRagConsent(
		configuration,
		configuration.embeddingProviderId,
		configuration.embeddingModelId,
		indexName,
		true
	);
}
