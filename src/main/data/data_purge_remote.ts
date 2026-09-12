import { selectedVectorDatabaseConnection } from '../database/vector_connection';
import { getRagConfiguration } from '../agent/knowledge/rag/rag_store';

export async function purgeRemoteRagNamespaces(
	indexName: string,
	generation?: string
): Promise<number> {
	const configuration = getRagConfiguration();
	const connection = selectedVectorDatabaseConnection({
		providerId: configuration.databaseProviderId || undefined,
		databaseId: configuration.databaseId || undefined,
	});
	return connection.adapter.purge(connection.apiKey, indexName, generation);
}
