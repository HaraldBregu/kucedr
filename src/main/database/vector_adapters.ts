import { pluginScripts } from '../plugins';
import { vectorScriptAdapter } from './vector_script';
import type { VectorDatabaseAdapter, VectorDatabaseService } from './vector_types';

function adapters(): readonly VectorDatabaseAdapter[] {
	return pluginScripts('VECTOR').map(vectorScriptAdapter);
}

export function listVectorDatabases(): readonly VectorDatabaseService[] {
	return adapters().map((adapter) => adapter.service);
}

export function findVectorDatabaseAdapter(
	providerId: string | undefined,
	databaseId: string | undefined
): VectorDatabaseAdapter | undefined {
	return adapters().find(
		(adapter) =>
			adapter.service.providerId === providerId && adapter.service.databaseId === databaseId
	);
}

export function supportsVectorDatabase(
	providerId: string | undefined,
	databaseId: string | undefined
): boolean {
	return findVectorDatabaseAdapter(providerId, databaseId) !== undefined;
}
