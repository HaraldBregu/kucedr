import { selectedVectorDatabaseConnection } from '../database/vector_connection';

export async function purgeRemoteRagNamespaces(
	indexName: string,
	generation?: string
): Promise<number> {
	const connection = selectedVectorDatabaseConnection();
	return connection.adapter.purge(connection.apiKey, indexName, generation);
}
