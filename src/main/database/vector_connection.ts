import type { DatabaseConfiguration } from '../../shared/database_types';
import { getProvider } from '../settings_store';
import { findVectorDatabaseAdapter, supportsVectorDatabase } from './vector_adapters';
import type { VectorDatabaseAdapter } from './vector_types';

export interface VectorDatabaseConnection {
	readonly configuration: DatabaseConfiguration;
	readonly adapter: VectorDatabaseAdapter;
	readonly apiKey: string;
}

export function selectedVectorDatabaseConnection(
	configuration: DatabaseConfiguration
): VectorDatabaseConnection {
	if (!configuration.providerId || !configuration.databaseId) {
		throw new Error('Select a vector database in RAG settings before enabling remote storage.');
	}
	if (!supportsVectorDatabase(configuration.providerId, configuration.databaseId)) {
		throw new Error('The selected vector database is not supported by RAG.');
	}
	const adapter = findVectorDatabaseAdapter(configuration.providerId, configuration.databaseId);
	if (!adapter) throw new Error('The selected vector database is not supported by RAG.');
	const apiKey = getProvider(configuration.providerId, 'databases')?.apiKey.trim();
	if (!apiKey) {
		throw new Error(
			`Configure your ${adapter.service.providerName} API key in Settings → Providers → Database.`
		);
	}
	return { configuration, adapter, apiKey };
}

export function isCurrentVectorDatabaseConnection(
	connection: VectorDatabaseConnection,
	configuration: DatabaseConfiguration
): boolean {
	try {
		const current = selectedVectorDatabaseConnection(configuration);
		return (
			current.configuration.providerId === connection.configuration.providerId &&
			current.configuration.databaseId === connection.configuration.databaseId &&
			current.apiKey === connection.apiKey
		);
	} catch {
		return false;
	}
}
