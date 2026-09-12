import { loadDatabases } from '../models';
import { pineconeVectorDatabase } from './vector_pinecone';
import type { VectorDatabaseAdapter, VectorDatabaseService } from './vector_types';

const adapters: readonly VectorDatabaseAdapter[] = [pineconeVectorDatabase];

export function listVectorDatabases(): readonly VectorDatabaseService[] {
	return adapters.flatMap((adapter) => {
		const catalog = loadDatabases().find(
			(entry) =>
				entry.provider.id === adapter.service.providerId && entry.id === adapter.service.databaseId
		);
		return catalog
			? [
					{
						...adapter.service,
						providerName: catalog.provider.name,
						databaseName: catalog.name || catalog.id,
					},
				]
			: [];
	});
}

export function findVectorDatabaseAdapter(
	providerId: string | undefined,
	databaseId: string | undefined
): VectorDatabaseAdapter | undefined {
	return adapters.find(
		(adapter) =>
			adapter.service.providerId === providerId && adapter.service.databaseId === databaseId
	);
}

export function supportsVectorDatabase(
	providerId: string | undefined,
	databaseId: string | undefined
): boolean {
	return listVectorDatabases().some(
		(entry) => entry.providerId === providerId && entry.databaseId === databaseId
	);
}
