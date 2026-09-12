import {
	isCurrentVectorDatabaseConnection,
	selectedVectorDatabaseConnection,
	type VectorDatabaseConnection,
} from '../../../database/vector_connection';
import { assertRagConsent } from './consent';
import { getRagConfiguration } from './rag_store';
import type { RagMirror } from './types';

export function createRagMirror(): RagMirror {
	const configuration = getRagConfiguration();
	const connection = selectedVectorDatabaseConnection({
		providerId: configuration.databaseProviderId || undefined,
		databaseId: configuration.databaseId || undefined,
	});
	return {
		upload: (indexName, generation, dimensions, records, signal) =>
			connection.adapter.upload({
				apiKey: connection.apiKey,
				indexName,
				generation,
				dimensions,
				records,
				signal,
				assertCurrent: () => assertMirrorCurrent(connection, indexName),
			}),
		discard: (indexName, generation, signal) =>
			connection.adapter.discard(connection.apiKey, indexName, generation, signal),
	};
}

function assertMirrorCurrent(connection: VectorDatabaseConnection, indexName: string): void {
	const configuration = getRagConfiguration();
	if (
		!isCurrentVectorDatabaseConnection(connection, {
			providerId: configuration.databaseProviderId || undefined,
			databaseId: configuration.databaseId || undefined,
		})
	) {
		throw new Error('The vector database account changed during indexing.');
	}
	assertRagConsent(
		configuration,
		configuration.embeddingProviderId,
		configuration.embeddingModelId,
		indexName,
		true
	);
}
