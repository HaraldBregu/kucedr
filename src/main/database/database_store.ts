import type { DatabaseConfiguration } from '../../shared/database_types';
import { supportsVectorDatabase } from './vector_adapters';
import {
	getRagConfiguration,
	ragConfigurationStorePath,
	saveRagConfiguration,
} from '../agent/knowledge/rag/rag_store';

const DEFAULT_CONFIGURATION: DatabaseConfiguration = {
	providerId: undefined,
	databaseId: undefined,
};

export const databaseConfigurationStorePath = ragConfigurationStorePath;

export function getDatabaseConfiguration(): DatabaseConfiguration {
	const ragConfiguration = getRagConfiguration();
	const configuration = {
		...DEFAULT_CONFIGURATION,
		providerId: ragConfiguration.databaseProviderId || undefined,
		databaseId: ragConfiguration.databaseId || undefined,
	};
	if (configuration.databaseId && !supportsVectorDatabase(configuration.providerId, configuration.databaseId)) {
		configuration.providerId = undefined;
		configuration.databaseId = undefined;
	}
	return configuration;
}

export function saveDatabaseConfiguration(
	configuration: DatabaseConfiguration
): DatabaseConfiguration {
	if (configuration.databaseId && !supportsVectorDatabase(configuration.providerId, configuration.databaseId)) {
		throw new Error(`Database not found: ${configuration.databaseId}`);
	}
	const saved: DatabaseConfiguration = {
		providerId: configuration.providerId,
		databaseId: configuration.databaseId,
	};
	const current = getRagConfiguration();
	saveRagConfiguration({
		...current,
		databaseProviderId: saved.providerId ?? '',
		databaseId: saved.databaseId ?? '',
		mirrorConsent:
			current.databaseProviderId === (saved.providerId ?? '') &&
			current.databaseId === (saved.databaseId ?? '')
				? current.mirrorConsent
				: null,
	});
	return saved;
}
